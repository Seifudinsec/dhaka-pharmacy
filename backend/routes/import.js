const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const Medicine = require('../models/Medicine');
const { protect } = require('../middleware/auth');

router.use(protect);

// Multer — memory storage, only xlsx/xls
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    const allowedExts = ['.xlsx', '.xls'];
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();

    if (allowed.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed.'), false);
    }
  },
});

const normalizeKey = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const parseWithMonthText = (value) => {
  const raw = String(value).trim();
  if (!raw) return null;

  // Format: 31/Dec/2026 or 31-Dec-2026
  const slashMatch = raw.match(/^(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{2,4})$/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = MONTHS[slashMatch[2].toLowerCase()];
    const year = Number(slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3]);
    if (month !== undefined) return new Date(year, month, day);
  }

  // Format: Dec/2026
  const monthYearMatch = raw.match(/^([A-Za-z]{3})[\/\-](\d{2,4})$/);
  if (monthYearMatch) {
    const month = MONTHS[monthYearMatch[1].toLowerCase()];
    const year = Number(monthYearMatch[2].length === 2 ? `20${monthYearMatch[2]}` : monthYearMatch[2]);
    if (month !== undefined) return new Date(year, month, 1);
  }

  return null;
};

const parseExcelDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  
  // Excel serial number
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) return new Date(d.y, d.m - 1, d.d);
    return null;
  }

  const raw = String(value).trim();
  const monthTextDate = parseWithMonthText(raw);
  if (monthTextDate) return monthTextDate;

  // Attempt standard JS parsing
  const parsed = new Date(raw.replace(/\//g, '-'));
  if (!isNaN(parsed.getTime())) return parsed;

  // Try YYYY-MM-DD
  const isoMatch = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));

  // Try DD-MM-YYYY
  const dmMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmMatch) return new Date(Number(dmMatch[3]), Number(dmMatch[2]) - 1, Number(dmMatch[1]));

  return null;
};

const getFirstValue = (row, keys) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key];
    }
  }
  return '';
};

const HEADER_MAP = {
  name: ['product_name', 'item_name', 'medicine_name', 'item', 'medicine', 'name', 'description'],
  stock: ['quantity', 'stock', 'qty', 'count', 'amount', 'balance'],
  batch: ['batch_number', 'batch', 'lot', 'batch_no', 'lot_no'],
  expiry: ['expiry_date', 'expirydate', 'expiry', 'exp_date', 'exp'],
  buyingPrice: ['buying_price_kes', 'buying_price', 'buying', 'cost_price', 'cost'],
  sellingPrice: ['selling_price_kes', 'selling_price', 'price', 'selling', 'rate'],
};

const validateRow = (row, index, headerMapping) => {
  const errors = [];
  const rowNum = index + 2;

  const name = String(getFirstValue(row, [headerMapping.name, 'Product Name', 'product_name'])).trim();
  const batchNumber = String(getFirstValue(row, [headerMapping.batch, 'Batch Number', 'batch_number'])).trim() || 'UNTITLED';
  const buyingPriceRaw = getFirstValue(row, [headerMapping.buyingPrice, 'Buying Price', 'buying_price']);
  const sellingPriceRaw = getFirstValue(row, [headerMapping.sellingPrice, 'Selling Price (KES)', 'selling_price_kes']);
  const buyingPrice = Number(buyingPriceRaw);
  const price = Number(sellingPriceRaw);
  const stock = Number(getFirstValue(row, [headerMapping.stock, 'Quantity', 'quantity']));
  const expiryRaw = getFirstValue(row, [headerMapping.expiry, 'Expiry Date', 'expiry_date']);
  const expiryDate = parseExcelDate(expiryRaw);

  if (!name) errors.push(`Row ${rowNum}: Name is missing`);
  if (isNaN(buyingPrice) || buyingPrice < 0) errors.push(`Row ${rowNum}: Invalid Buying Price (${buyingPriceRaw})`);
  const finalPrice = isNaN(price) || price <= 0 ? Number((buyingPrice * 1.4).toFixed(2)) : price;
  if (isNaN(finalPrice) || finalPrice <= 0) errors.push(`Row ${rowNum}: Could not determine selling price`);
  if (isNaN(stock) || stock < 0) errors.push(`Row ${rowNum}: Invalid Quantity (${stock})`);
  if (!expiryDate) errors.push(`Row ${rowNum}: Invalid Expiry Date (${expiryRaw})`);

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? {
      name,
      price: Number((buyingPrice * 1.4).toFixed(2)), // Strictly enforce 1.4x markup
      buyingPrice,
      batchNumber,
      stock: Math.floor(stock),
      expiryDate,
    } : null,
  };
};

// POST /api/import
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return res.status(400).json({ success: false, message: 'Excel file has no sheets.' });

    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (matrix.length === 0) return res.status(400).json({ success: false, message: 'Excel file is empty.' });

    // 1. Better Header Detection (Fuzzy)
    let headerRowIndex = -1;
    let headerMapping = {};

    for (let i = 0; i < Math.min(matrix.length, 20); i++) {
      const normalizedCells = matrix[i].map(c => normalizeKey(c));
      const mapping = {};
      let matches = 0;

      for (const [canonical, aliases] of Object.entries(HEADER_MAP)) {
        const foundIdx = normalizedCells.findIndex(c => aliases.includes(c));
        if (foundIdx !== -1) {
          mapping[canonical] = matrix[i][foundIdx]; // Use the actual key for lookup
          matches++;
        }
      }

      // If we found at least Name and Stock/Quantity, it's probably the header row
      if (mapping.name || mapping.stock) {
        headerRowIndex = i;
        headerMapping = mapping;
        break;
      }
    }

    if (headerRowIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'Could not find required columns (Name, Quantity). Please use the template.',
      });
    }

    const rows = matrix.slice(headerRowIndex + 1)
      .filter((cells) => cells.some((cell) => String(cell).trim() !== ''))
      .map((cells) => {
        const rowObj = {};
        // Match cells back to their header keys
        matrix[headerRowIndex].forEach((h, idx) => { rowObj[h] = cells[idx]; });
        return rowObj;
      });

    if (rows.length === 0) return res.status(400).json({ success: false, message: 'No data rows found.' });

    // 2. High-Performance Bulk Processing
    const bulkOps = [];
    const failedRows = [];
    let addedCount = 0;
    let updatedCount = 0;

    // Get existing to differentiate Added/Updated (optional, for summary)
    const existingNames = new Set((await Medicine.find({}, 'name')).map(m => m.name.toLowerCase()));

    for (let i = 0; i < rows.length; i++) {
      const { valid, errors, data } = validateRow(rows[i], headerRowIndex + i, headerMapping);
      if (!valid) {
        failedRows.push({ row: headerRowIndex + i + 2, errors });
        continue;
      }

      const isUpdate = existingNames.has(data.name.toLowerCase());
      if (isUpdate) updatedCount++; else addedCount++;

      bulkOps.push({
        updateOne: {
          filter: { name: { $regex: `^${data.name.trim()}$`, $options: 'i' } },
          update: { $set: { ...data, status: 'active' } },
          upsert: true,
        }
      });
    }

    if (bulkOps.length > 0) {
      await Medicine.bulkWrite(bulkOps, { ordered: false });
    }

    res.json({
      success: true,
      message: `Direct Bulk Import Complete. Speed optimization active.`,
      summary: {
        added: addedCount,
        updated: updatedCount,
        failed: failedRows.length,
        total: rows.length,
      },
      failedRows: failedRows.length > 0 ? failedRows : undefined,
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ success: false, message: 'Server error during bulk import. ' + error.message });
  }
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File too large. Maximum size is 5MB.' });
  }
  res.status(400).json({ success: false, message: err.message || 'File upload error.' });
});

module.exports = router;
