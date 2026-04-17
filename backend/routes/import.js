const express = require("express");
const router = express.Router();
const multer = require("multer");
const XLSX = require("xlsx");
const Medicine = require("../models/Medicine");
const { protect } = require("../middleware/auth");

router.use(protect);

// Multer — memory storage, only xlsx/xls
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    const allowedExts = [".xlsx", ".xls"];
    const ext = "." + file.originalname.split(".").pop().toLowerCase();

    if (allowed.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files (.xlsx, .xls) are allowed."), false);
    }
  },
});

const normalizeKey = (val = "") =>
  String(val)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const MONTHS = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const parseExcelDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    return d ? new Date(d.y, d.m - 1, d.d) : null;
  }

  const s = String(val).trim();
  const parts = s.split(/[\/\-]/);

  if (parts.length === 3) {
    const [d, m, y] = parts;
    const month = MONTHS[m.toLowerCase()] ?? Number(m) - 1;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const date = new Date(year, month, Number(d) || 1);
    if (!isNaN(date)) return date;
  }

  const parsed = new Date(s.replace(/\//g, "-"));
  return isNaN(parsed) ? null : parsed;
};

const getFirstValue = (row, keys) => {
  const found = keys.find(
    (k) => row[k] !== undefined && String(row[k]).trim() !== "",
  );
  return found ? row[found] : "";
};

const HEADER_MAP = {
  name: [
    "product_name",
    "item_name",
    "medicine_name",
    "item",
    "medicine",
    "name",
    "description",
  ],
  stock: ["quantity", "stock", "qty", "count", "amount", "balance"],
  batch: ["batch_number", "batch", "lot", "batch_no", "lot_no"],
  expiry: ["expiry_date", "expirydate", "expiry", "exp_date", "exp"],
  buyingPrice: [
    "buying_price_kes",
    "buying_price",
    "buying",
    "cost_price",
    "cost",
  ],
  sellingPrice: [
    "selling_price_kes",
    "selling_price",
    "price",
    "selling",
    "rate",
  ],
};

const validateRow = (row, index, mapping) => {
  const errors = [];
  const rowNum = index + 2;

  const name = String(getFirstValue(row, [mapping.name, "name"])).trim();
  const batchNumber =
    String(getFirstValue(row, [mapping.batch, "batch"])).trim() || "UNTITLED";
  const bPrice = Number(
    getFirstValue(row, [mapping.buyingPrice, "buyingPrice"]),
  );
  const sPrice = Number(
    getFirstValue(row, [mapping.sellingPrice, "sellingPrice"]),
  );
  const stock = Math.floor(
    Number(getFirstValue(row, [mapping.stock, "stock"])),
  );
  const expiry = parseExcelDate(getFirstValue(row, [mapping.expiry, "expiry"]));

  if (!name) errors.push(`Row ${rowNum}: Name missing`);
  if (isNaN(bPrice) || bPrice < 0)
    errors.push(`Row ${rowNum}: Invalid buying price`);
  const price =
    isNaN(sPrice) || sPrice <= 0 ? Number((bPrice * 1.4).toFixed(2)) : sPrice;
  if (isNaN(price) || price <= 0)
    errors.push(`Row ${rowNum}: Invalid selling price`);
  if (isNaN(stock) || stock < 0) errors.push(`Row ${rowNum}: Invalid quantity`);
  if (!expiry) errors.push(`Row ${rowNum}: Invalid expiry date`);

  return {
    valid: !errors.length,
    errors,
    data: errors.length
      ? null
      : {
          name,
          price,
          buyingPrice: bPrice,
          batchNumber,
          stock,
          expiryDate: expiry,
        },
  };
};

// POST /api/import
router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded." });
    }

    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer",
      cellDates: true,
    });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName)
      return res
        .status(400)
        .json({ success: false, message: "Excel file has no sheets." });

    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (matrix.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "Excel file is empty." });

    let headerRowIndex = -1;
    let headerMapping = {};

    for (let i = 0; i < Math.min(matrix.length, 20); i++) {
      const normalizedCells = matrix[i].map((c) => normalizeKey(c));
      const mapping = {};

      for (const [canonical, aliases] of Object.entries(HEADER_MAP)) {
        const foundIdx = normalizedCells.findIndex((c) => aliases.includes(c));
        if (foundIdx !== -1) {
          mapping[canonical] = matrix[i][foundIdx];
        }
      }

      if (mapping.name || mapping.stock) {
        headerRowIndex = i;
        headerMapping = mapping;
        break;
      }
    }

    if (headerRowIndex === -1) {
      return res.status(400).json({
        success: false,
        message:
          "Required columns (Name, Quantity) not found. Please use the template.",
      });
    }

    const rows = matrix
      .slice(headerRowIndex + 1)
      .filter((cells) => cells.some((cell) => String(cell).trim() !== ""))
      .map((cells) => {
        const rowObj = {};
        matrix[headerRowIndex].forEach((h, idx) => {
          rowObj[h] = cells[idx];
        });
        return rowObj;
      });

    if (rows.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No data rows found." });
    }

    const bulkOps = [];
    const failedRows = [];
    let addedCount = 0;
    let updatedCount = 0;

    const existingNames = new Set(
      (await Medicine.find({}, "name")).map((m) => m.name.toLowerCase()),
    );

    for (let i = 0; i < rows.length; i++) {
      const { valid, errors, data } = validateRow(
        rows[i],
        headerRowIndex + i,
        headerMapping,
      );
      if (!valid) {
        failedRows.push({ row: headerRowIndex + i + 2, errors });
        continue;
      }

      if (existingNames.has(data.name.toLowerCase())) updatedCount++;
      else addedCount++;

      bulkOps.push({
        updateOne: {
          filter: { name: { $regex: `^${data.name.trim()}$`, $options: "i" } },
          update: { $set: { ...data, status: "active" } },
          upsert: true,
        },
      });
    }

    if (bulkOps.length > 0) {
      await Medicine.bulkWrite(bulkOps, { ordered: false });
    }

    res.json({
      success: true,
      message: "Bulk Import Complete.",
      summary: {
        added: addedCount,
        updated: updatedCount,
        failed: failedRows.length,
        total: rows.length,
      },
      failedRows: failedRows.length > 0 ? failedRows : undefined,
    });
  } catch (error) {
    console.error("Bulk import error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during bulk import. " + error.message,
    });
  }
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "File too large. Maximum size is 5MB.",
    });
  }
  res
    .status(400)
    .json({ success: false, message: err.message || "File upload error." });
});

module.exports = router;
