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

  const slashMatch = raw.match(/^(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{2,4})$/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = MONTHS[slashMatch[2].toLowerCase()];
    const year = Number(slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3]);
    if (month !== undefined) return new Date(year, month, day);
  }

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
  const monthTextDate = parseWithMonthText(value);
  if (monthTextDate) return monthTextDate;
  const parsed = new Date(String(value).replace(/\//g, '-'));
  return isNaN(parsed.getTime()) ? null : parsed;
};

const getFirstValue = (row, keys) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key];
    }
  }
  return '';
};

const validateRow = (row, index) => {
  const errors = [];
  const rowNum = index + 2; // 1-indexed + header row

  const name = String(getFirstValue(row, ['product_name', 'name'])).trim();
  const batchNumber = String(getFirstValue(row, ['batch_number', 'batch'])).trim();
  const buyingPriceRaw = getFirstValue(row, ['buying_price_kes', 'buying_price']);
  const sellingPriceRaw = getFirstValue(row, ['selling_price_kes', 'selling_price', 'price']);
  const buyingPrice = Number(buyingPriceRaw);
  const normalizedSellingRaw = String(sellingPriceRaw).trim();
  const hasSellingInput = normalizedSellingRaw !== '';
  const derivedSellingPrice = Number((buyingPrice * 1.4).toFixed(2));
  const price = hasSellingInput ? Number(sellingPriceRaw) : derivedSellingPrice;
  const stock = Number(getFirstValue(row, ['quantity', 'stock']));
  const expiryRaw = getFirstValue(row, ['expiry_date', 'expirydate', 'expiry']);
  const expiryDate = parseExcelDate(expiryRaw);

  if (!name) errors.push(`Row ${rowNum}: Name is empty`);
  if (!batchNumber) errors.push(`Row ${rowNum}: Batch Number is empty`);
  if (isNaN(buyingPrice) || buyingPrice <= 0) errors.push(`Row ${rowNum}: Buying Price must be > 0 (got "${buyingPriceRaw}")`);
  if (isNaN(price) || price <= 0) errors.push(`Row ${rowNum}: Selling Price must be > 0 (got "${sellingPriceRaw}")`);
  if (isNaN(stock) || stock < 0) errors.push(`Row ${rowNum}: Quantity must be >= 0 (got "${getFirstValue(row, ['quantity', 'stock'])}")`);
  if (!expiryDate) errors.push(`Row ${rowNum}: Invalid expiry date (got "${expiryRaw}")`);

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? {
      name,
      price,
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

    // Parse workbook
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ success: false, message: 'Excel file has no sheets.' });
    }

    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (matrix.length === 0) {
      return res.status(400).json({ success: false, message: 'Excel file is empty.' });
    }

    // Find the actual header row (some files include a title row above headers)
    const headerRowIndex = matrix.findIndex((cells) => {
      const keys = cells.map((cell) => normalizeKey(cell));
      return keys.includes('product_name') && keys.includes('quantity') && keys.includes('expiry_date');
    });

    if (headerRowIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'Header row not found. Expected columns: Product Name, Quantity, Expiry Date, Selling Price (KES).',
      });
    }

    const headers = matrix[headerRowIndex].map((cell) => normalizeKey(cell));
    const rows = matrix.slice(headerRowIndex + 1)
      .filter((cells) => cells.some((cell) => String(cell).trim() !== ''))
      .map((cells) => {
        const normalized = {};
        headers.forEach((header, idx) => {
          if (!header) return;
          normalized[header] = cells[idx];
        });
        return normalized;
      });

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data rows found below the header.' });
    }

    const headerAdjustedIndex = headerRowIndex + 1; // switch to 1-indexed
    const expectedColumns = ['product_name', 'quantity', 'batch_number', 'expiry_date', 'buying_price_kes', 'selling_price_kes'];
    const missingColumns = expectedColumns.filter((col) => !headers.includes(col));
    if (missingColumns.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required columns: ${missingColumns.join(', ')}`,
      });
    }

    const existingBeforeImport = await Medicine.find({}, 'name').lean();
    const existingNameSet = new Set(
      existingBeforeImport.map((m) => String(m.name || '').trim().toLowerCase())
    );

    let addedCount = 0;
    let updatedCount = 0;
    let duplicateRowsCount = 0;
    const failedRows = [];

    for (let i = 0; i < rows.length; i++) {
      const excelRowNumber = headerAdjustedIndex + i + 1;
      const { valid, errors, data } = validateRow(rows[i], excelRowNumber - 2);

      if (!valid) {
        failedRows.push({ row: excelRowNumber, errors });
        continue;
      }

      try {
        const existing = await Medicine.findOne({ name: { $regex: `^${data.name}$`, $options: 'i' } });
        const normalizedName = data.name.trim().toLowerCase();

        if (existing) {
          await Medicine.findByIdAndUpdate(existing._id, {
            price: data.price,
            buyingPrice: data.buyingPrice,
            batchNumber: data.batchNumber,
            stock: data.stock,
            expiryDate: data.expiryDate,
            status: 'active',
          });
          if (existingNameSet.has(normalizedName)) {
            updatedCount++;
          } else {
            duplicateRowsCount++;
          }
        } else {
          await Medicine.create(data);
          addedCount++;
        }
      } catch (dbErr) {
        failedRows.push({ row: excelRowNumber, errors: [`Database error: ${dbErr.message}`] });
      }
    }

    res.json({
      success: true,
      message: `Import complete. Added: ${addedCount}, Updated: ${updatedCount}, Duplicates in file: ${duplicateRowsCount}, Failed: ${failedRows.length}`,
      summary: {
        added: addedCount,
        updated: updatedCount,
        duplicateRows: duplicateRowsCount,
        failed: failedRows.length,
        total: rows.length,
      },
      failedRows: failedRows.length > 0 ? failedRows : undefined,
    });
  } catch (error) {
    if (error.message && error.message.includes('Excel')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Import error:', error);
    res.status(500).json({ success: false, message: 'Failed to process Excel file.' });
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
