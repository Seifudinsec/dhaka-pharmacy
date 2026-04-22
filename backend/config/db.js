const mongoose = require('mongoose');
const Medicine = require('../models/Medicine');

const normalizeText = (value = '') =>
  String(value).trim().toLowerCase().replace(/\s+/g, ' ');

const normalizeBatch = (value = '') =>
  String(value).trim().toUpperCase().replace(/\s+/g, '');

const toDateKey = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

const backfillMedicineImportKeys = async (collection) => {
  const cursor = collection.find(
    {
      $or: [
        { productKey: { $exists: false } },
        { productKey: null },
        { normalizedName: { $exists: false } },
        { normalizedName: null },
        { batchNumberNormalized: { $exists: false } },
        { batchNumberNormalized: null },
        { expiryDateKey: { $exists: false } },
        { expiryDateKey: null },
      ],
    },
    {
      projection: {
        _id: 1,
        name: 1,
        batchNumber: 1,
        expiryDate: 1,
        productKey: 1,
        normalizedName: 1,
        batchNumberNormalized: 1,
        expiryDateKey: 1,
      },
    },
  );

  const ops = [];
  let touched = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc) break;

    const id = String(doc._id);
    const normalizedName =
      normalizeText(doc.normalizedName || doc.name || '') || `legacy_${id}`;
    const productKey =
      normalizeText(doc.productKey || normalizedName) || `legacy_${id}`;
    const batchNumberNormalized =
      normalizeBatch(doc.batchNumberNormalized || doc.batchNumber || '') ||
      `LEGACY-${id}`;

    let expiryDateKey = doc.expiryDateKey || toDateKey(doc.expiryDate);
    if (!expiryDateKey) expiryDateKey = '2100-01-01';

    ops.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            normalizedName,
            productKey,
            batchNumberNormalized,
            expiryDateKey,
          },
        },
      },
    });

    if (ops.length >= 500) {
      const result = await collection.bulkWrite(ops, { ordered: false });
      touched += result.modifiedCount || 0;
      ops.length = 0;
    }
  }

  if (ops.length) {
    const result = await collection.bulkWrite(ops, { ordered: false });
    touched += result.modifiedCount || 0;
  }

  if (touched > 0) {
    console.log(`ℹ️ Backfilled import key fields on ${touched} medicine record(s)`);
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📦 Database: ${conn.connection.name}`);

    try {
      const collection = conn.connection.db.collection('medicines');
      const indexes = await collection.indexes();
      const legacyNameIndex = indexes.find(
        (idx) => idx.name === 'name_1' && idx.unique,
      );
      if (legacyNameIndex) {
        await collection.dropIndex('name_1');
        console.log('ℹ️ Dropped legacy unique index: medicines.name_1');
      }

      await backfillMedicineImportKeys(collection);
      await Medicine.syncIndexes();
    } catch (indexError) {
      console.warn(`⚠️ Medicine index sync warning: ${indexError.message}`);
    }
  } catch (error) {
    console.error(`❌ DB Connection Failed: ${error.message}`);
    setTimeout(connectDB, 5000); // retry after 5s
  }
};

module.exports = connectDB;
