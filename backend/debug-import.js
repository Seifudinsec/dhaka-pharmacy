const XLSX = require('xlsx');
const mongoose = require('mongoose');
require('dotenv').config();
const Medicine = require('./models/Medicine');

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
  return null;
};

const parseExcelDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  const monthTextDate = parseWithMonthText(value);
  if (monthTextDate) return monthTextDate;
  const parsed = new Date(String(value).replace(/\//g, '-'));
  return isNaN(parsed.getTime()) ? null : parsed;
};

async function testImport() {
  try {
    console.log('Connecting to DB:', process.env.MONGODB_URI.split('@')[1]); // Log host only for safety
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected.');

    const workbook = XLSX.readFile('test_import.xlsx', { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    const headerRowIndex = matrix.findIndex((cells) => {
      const keys = cells.map((cell) => normalizeKey(cell));
      return keys.includes('product_name') && keys.includes('quantity') && keys.includes('expiry_date');
    });

    if (headerRowIndex === -1) {
      console.error('❌ Header row not found. Got headers:', matrix[0].map(c => normalizeKey(c)));
      process.exit(1);
    }

    const headers = matrix[headerRowIndex].map((cell) => normalizeKey(cell));
    const rows = matrix.slice(headerRowIndex + 1)
      .filter((cells) => cells.some((cell) => String(cell).trim() !== ''))
      .map((cells) => {
        const normalized = {};
        headers.forEach((header, idx) => { if (header) normalized[header] = cells[idx]; });
        return normalized;
      });

    console.log(`📊 Processing ${rows.length} rows...`);

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        console.log(`  Row ${i+2}: ${row.product_name} - Qty: ${row.quantity} - Expiry: ${row.expiry_date}`);
        const expiryDate = parseExcelDate(row.expiry_date);
        if (!expiryDate) {
            console.error(`  ❌ Invalid date at row ${i+2}: ${row.expiry_date}`);
        } else {
            console.log(`  ✅ Parsed date: ${expiryDate.toDateString()}`);
        }
    }

    console.log('🚀 Test complete.');
    process.exit(0);
  } catch (err) {
    console.error('💥 CRITICAL ERROR:', err);
    process.exit(1);
  }
}

testImport();
