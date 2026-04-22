const mongoose = require('mongoose');
const Medicine = require('../models/Medicine');

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
