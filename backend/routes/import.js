const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const Medicine = require("../models/Medicine");
const ImportHistory = require("../models/ImportHistory");
const ImportRow = require("../models/ImportRow");
const AuditLog = require("../models/AuditLog");
const { protect } = require("../middleware/auth");

const router = express.Router();
router.use(protect);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    const allowedExts = [".xlsx", ".xls"];
    const ext = "." + file.originalname.split(".").pop().toLowerCase();

    if (allowed.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only Excel files (.xlsx, .xls) are allowed."), false);
  },
});

const normalizeKey = (val = "") =>
  String(val)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeName = (val = "") =>
  String(val).trim().toLowerCase().replace(/\s+/g, " ");

const normalizeBatch = (val = "") =>
  String(val).trim().toUpperCase().replace(/\s+/g, "");

const makeDateKey = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

const fileHashFromBuffer = (buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex");

const hashRowKey = (input) =>
  crypto.createHash("sha256").update(input).digest("hex");

const strictRowIdentityFromData = (data) =>
  [
    String(data.normalizedProductName || "").trim(),
    String(data.batchNumber || "").trim(),
    String(data.expiryDateKey || "").trim(),
    String(data.quantity),
    Number(data.buyingPrice).toFixed(4),
  ].join("|");

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

const HEADER_MAP = {
  name: [
    "product_name",
    "item_name",
    "medicine_name",
    "item",
    "medicine",
    "name",
    "description",
    "productname",
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
    "selling price kes",
    "price",
    "selling",
    "rate",
  ],
};

const getFirstValue = (row, keys) => {
  const found = keys.find(
    (k) => row[k] !== undefined && String(row[k]).trim() !== "",
  );
  return found ? row[found] : "";
};

const parseExcelDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === "number") {
    const parsed = XLSX.SSF.parse_date_code(val);
    return parsed ? new Date(parsed.y, parsed.m - 1, parsed.d) : null;
  }

  const s = String(val).trim();
  const parts = s.split(/[\/\-]/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const month = MONTHS[m.toLowerCase()] ?? Number(m) - 1;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const date = new Date(year, month, Number(d) || 1);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const parsed = new Date(s.replace(/\//g, "-"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseWorkbookRows = (fileBuffer) => {
  const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { error: "Excel file has no sheets." };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (!matrix.length) {
    return { error: "Excel file is empty." };
  }

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
    return {
      error:
        "Required columns (Name, Quantity) not found. Please use the template.",
    };
  }

  const rows = matrix
    .slice(headerRowIndex + 1)
    .filter((cells) => cells.some((cell) => String(cell).trim() !== ""))
    .map((cells, idx) => {
      const rowObj = {};
      matrix[headerRowIndex].forEach((h, colIdx) => {
        rowObj[h] = cells[colIdx];
      });
      return {
        rowNumber: headerRowIndex + idx + 2,
        row: rowObj,
      };
    });

  if (!rows.length) {
    return { error: "No data rows found." };
  }

  return { rows, headerMapping };
};

const validateAndNormalizeRow = (rawRow, mapping) => {
  const errors = [];
  const productNameRaw = String(
    getFirstValue(rawRow.row, [mapping.name, "name"]),
  ).trim();
  const productName = productNameRaw.replace(/\s+/g, " ").trim();
  const normalizedProductName = normalizeName(productName);

  const batchRaw = String(
    getFirstValue(rawRow.row, [mapping.batch, "batch"]),
  ).trim();
  const batchNumber = batchRaw || "UNTITLED";
  const batchNumberForRowKey = batchNumber.trim();
  const batchNumberNormalized = normalizeBatch(batchNumber);

  const quantity = Math.floor(
    Number(getFirstValue(rawRow.row, [mapping.stock, "stock"])),
  );
  const buyingPrice = Number(
    getFirstValue(rawRow.row, [mapping.buyingPrice, "buyingPrice"]),
  );
  const providedSellingPrice = Number(
    getFirstValue(rawRow.row, [mapping.sellingPrice, "sellingPrice"]),
  );
  const expiryDate = parseExcelDate(
    getFirstValue(rawRow.row, [mapping.expiry, "expiry"]),
  );
  const expiryDateKey = makeDateKey(expiryDate);

  if (!productName) errors.push("Product name is missing");
  if (Number.isNaN(quantity) || quantity < 0)
    errors.push("Invalid quantity (must be 0 or more)");
  if (Number.isNaN(buyingPrice) || buyingPrice <= 0)
    errors.push("Invalid buying price (must be greater than 0)");
  if (!expiryDate || !expiryDateKey) errors.push("Invalid expiry date");

  let sellingPrice = providedSellingPrice;
  if (Number.isNaN(sellingPrice) || sellingPrice <= 0) {
    sellingPrice = Number((buyingPrice * 1.4).toFixed(2));
  }
  if (Number.isNaN(sellingPrice) || sellingPrice <= 0) {
    errors.push("Invalid selling price");
  }

  // STRICT row idempotency key: normalized name + exact trimmed batch + expiry + quantity + buying price
  const rowKeyInput = [
    normalizedProductName,
    batchNumberForRowKey,
    expiryDateKey,
    String(quantity),
    Number.isNaN(buyingPrice) ? "" : buyingPrice.toFixed(4),
  ].join("|");

  return {
    rowNumber: rawRow.rowNumber,
    valid: errors.length === 0,
    errors,
    data:
      errors.length > 0
        ? null
        : {
            productName,
            normalizedProductName,
            productKey: normalizedProductName,
            quantity,
            batchNumber,
            batchNumberNormalized,
            expiryDate,
            expiryDateKey,
            buyingPrice,
            sellingPrice,
            rowKey: hashRowKey(rowKeyInput),
            rowKeyInput,
          },
  };
};

const classifyRows = async (normalizedRows) => {
  const validRows = normalizedRows.filter((r) => r.valid).map((r) => r.data);
  const productKeys = [...new Set(validRows.map((r) => r.productKey))];

  const candidateMedicines = productKeys.length
    ? await Medicine.find(
        {
          $or: [
            { productKey: { $in: productKeys } },
            { normalizedName: { $in: productKeys } },
          ],
        },
        {
          _id: 1,
          productKey: 1,
          normalizedName: 1,
          batchNumberNormalized: 1,
          expiryDateKey: 1,
          stock: 1,
        },
      ).lean()
    : [];
  const medicineMap = new Map();
  for (const med of candidateMedicines) {
    const medProductKey = med.productKey || med.normalizedName;
    const key = `${medProductKey}|${med.batchNumberNormalized}|${med.expiryDateKey}`;
    medicineMap.set(key, med);
  }

  const inFileSeen = new Map();
  return normalizedRows.map((row) => {
    if (!row.valid) {
      return {
        rowNumber: row.rowNumber,
        classification: "INVALID",
        reason: row.errors.join("; "),
        data: null,
      };
    }

    const data = row.data;
    const strictIdentity = strictRowIdentityFromData(data);
    if (inFileSeen.has(strictIdentity)) {
      const firstRowNumber = inFileSeen.get(strictIdentity);
      return {
        rowNumber: row.rowNumber,
        classification: "DUPLICATE",
        reason: `Duplicate row inside this upload file (matches row ${firstRowNumber})`,
        data,
      };
    }
    inFileSeen.set(strictIdentity, row.rowNumber);

    const matchKey = `${data.productKey}|${data.batchNumberNormalized}|${data.expiryDateKey}`;
    const existing = medicineMap.get(matchKey);
    if (existing) {
      return {
        rowNumber: row.rowNumber,
        classification: "UPDATE",
        reason: "Existing product batch will be stock-updated",
        data: {
          ...data,
          existingMedicineId: existing._id,
          existingStock: Number(existing.stock || 0),
        },
      };
    }

    return {
      rowNumber: row.rowNumber,
      classification: "NEW",
      reason: "New product batch will be created",
      data,
    };
  });
};

const summarizeClassifications = (classifiedRows) => {
  const summary = { new: 0, update: 0, duplicate: 0, invalid: 0, total: 0 };
  for (const row of classifiedRows) {
    summary.total += 1;
    if (row.classification === "NEW") summary.new += 1;
    else if (row.classification === "UPDATE") summary.update += 1;
    else if (row.classification === "DUPLICATE") summary.duplicate += 1;
    else summary.invalid += 1;
  }
  return summary;
};

const mapPreviewRow = (row) => ({
  rowNumber: row.rowNumber,
  classification: row.classification,
  reason: row.reason,
  productName: row.data?.productName || null,
  batchNumber: row.data?.batchNumber || null,
  expiryDate: row.data?.expiryDateKey || null,
  quantity: row.data?.quantity ?? null,
  buyingPrice: row.data?.buyingPrice ?? null,
  duplicateRule:
    "normalized(product_name) + batch_no.trim() + expiry_date + quantity + buying_price",
});

const splitPreviewRows = (classifiedRows, limitPerType = 200) => {
  const rowsByType = {
    new: [],
    update: [],
    duplicate: [],
    invalid: [],
  };

  for (const row of classifiedRows) {
    const mapped = mapPreviewRow(row);
    if (row.classification === "NEW") {
      if (rowsByType.new.length < limitPerType) rowsByType.new.push(mapped);
    } else if (row.classification === "UPDATE") {
      if (rowsByType.update.length < limitPerType)
        rowsByType.update.push(mapped);
    } else if (row.classification === "DUPLICATE") {
      if (rowsByType.duplicate.length < limitPerType)
        rowsByType.duplicate.push(mapped);
    } else {
      if (rowsByType.invalid.length < limitPerType)
        rowsByType.invalid.push(mapped);
    }
  }

  return rowsByType;
};

const buildDuplicateFileDetails = (historyDoc) => {
  if (!historyDoc) return null;
  return {
    importId: historyDoc.importId,
    fileName: historyDoc.fileName,
    createdAt: historyDoc.createdAt,
    summary: historyDoc.summary || {},
    previewRows: historyDoc.previewSnapshot || [],
  };
};

const runPreview = async (req, res) => {
  let rows = [];
  let headerMapping = {};
  let fileName = "json_import";
  let fileHash = "no_hash";

  if (req.file) {
    const parsed = parseWorkbookRows(req.file.buffer);
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }
    rows = parsed.rows;
    headerMapping = parsed.headerMapping;
    fileName = req.file.originalname;
    fileHash = fileHashFromBuffer(req.file.buffer);
  } else if (req.body.rows && Array.isArray(req.body.rows)) {
    rows = req.body.rows;
    headerMapping = req.body.headerMapping || {};
    fileName = req.body.fileName || "json_import";
    fileHash = req.body.fileHash || "no_hash";
  } else {
    return res
      .status(400)
      .json({ success: false, message: "No file or data provided." });
  }

  const normalizedRows = rows.map((row) =>
    validateAndNormalizeRow(row, headerMapping),
  );

  const classifiedRows = await classifyRows(normalizedRows);
  const summary = summarizeClassifications(classifiedRows);
  const importId = crypto.randomUUID();

  return res.json({
    success: true,
    message: "Import preview generated. Review and confirm before applying.",
    importId,
    fileHash,
    fileName,
    duplicateFile: false,
    duplicateFileDetails: null,
    summary,
    rows: classifiedRows.slice(0, 300).map(mapPreviewRow),
    rowsByType: splitPreviewRows(classifiedRows, 200),
  });
};

const insertImportRowsInBatches = async (rows, session) => {
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    if (chunk.length) {
      const options = session
        ? { session, ordered: false }
        : { ordered: false };
      await ImportRow.insertMany(chunk, options);
    }
  }
};

const processWithConcurrency = async (items, concurrency, worker) => {
  const queue = [...items];
  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length || 1)) },
    async () => {
      while (queue.length) {
        const next = queue.shift();
        if (!next) return;
        await worker(next);
      }
    },
  );
  await Promise.all(workers);
};

const upsertMedicineForImport = async (rowData, importId, session) => {
  const filter = {
    productKey: rowData.productKey,
    batchNumberNormalized: rowData.batchNumberNormalized,
    expiryDateKey: rowData.expiryDateKey,
  };

  let existing;
  if (session) {
    existing = await Medicine.findOne(filter).session(session);
  } else {
    existing = await Medicine.findOne(filter);
  }
  if (!existing) {
    // Backward compatibility for legacy records without normalized fields
    const legacyQuery = {
      name: { $regex: `^${escapeRegex(rowData.productName)}$`, $options: "i" },
      batchNumber: {
        $regex: `^${escapeRegex(rowData.batchNumber)}$`,
        $options: "i",
      },
      expiryDate: rowData.expiryDate,
    };
    if (session) {
      existing = await Medicine.findOne(legacyQuery).session(session);
    } else {
      existing = await Medicine.findOne(legacyQuery);
    }
  }

  if (!existing) {
    try {
      const createPayload = [
        {
          name: rowData.productName,
          normalizedName: rowData.normalizedProductName,
          productKey: rowData.productKey,
          price: rowData.sellingPrice,
          buyingPrice: rowData.buyingPrice,
          batchNumber: rowData.batchNumber,
          batchNumberNormalized: rowData.batchNumberNormalized,
          stock: rowData.quantity,
          expiryDate: rowData.expiryDate,
          expiryDateKey: rowData.expiryDateKey,
          status: "active",
          lastImportId: importId,
        },
      ];
      const created = await Medicine.create(
        createPayload,
        session ? { session } : undefined,
      );
      return { medicineId: created[0]._id, type: "NEW" };
    } catch (createError) {
      // Race condition safety: if another operation inserted same batch key, recover and update.
      if (createError?.code === 11000) {
        if (session) {
          existing = await Medicine.findOne(filter).session(session);
        } else {
          existing = await Medicine.findOne(filter);
        }
      } else {
        throw createError;
      }
    }
  }

  if (!existing) {
    throw new Error(
      `Could not resolve medicine batch for ${rowData.productName} (${rowData.batchNumber})`,
    );
  }

  const nextStock =
    Number(existing.stock || 0) === 0
      ? rowData.quantity
      : Number(existing.stock || 0) + rowData.quantity;

  await Medicine.updateOne(
    { _id: existing._id },
    {
      $set: {
        name: rowData.productName,
        normalizedName: rowData.normalizedProductName,
        productKey: rowData.productKey,
        price: rowData.sellingPrice,
        buyingPrice: rowData.buyingPrice,
        batchNumber: rowData.batchNumber,
        batchNumberNormalized: rowData.batchNumberNormalized,
        expiryDate: rowData.expiryDate,
        expiryDateKey: rowData.expiryDateKey,
        status: "active",
        stock: nextStock,
        lastImportId: importId,
      },
    },
    session ? { session } : undefined,
  );

  return { medicineId: existing._id, type: "UPDATE" };
};

const runCommit = async (req, res, { legacy = false } = {}) => {
  const forceImport = String(req.body?.forceImport || "false") === "true";
  let selectedDuplicateRows = [];
  try {
    selectedDuplicateRows = req.body?.selectedDuplicateRows
      ? typeof req.body.selectedDuplicateRows === "string"
        ? JSON.parse(req.body.selectedDuplicateRows)
        : req.body.selectedDuplicateRows
      : [];
  } catch (e) {
    selectedDuplicateRows = [];
  }
  const selectedDuplicateRowSet = new Set(
    Array.isArray(selectedDuplicateRows)
      ? selectedDuplicateRows
          .map((v) => Number(v))
          .filter((v) => Number.isFinite(v))
      : [],
  );
  const confirmed = legacy || String(req.body?.confirm || "false") === "true";
  if (!confirmed) {
    return res.status(400).json({
      success: false,
      message: "Import confirmation is required before applying changes.",
    });
  }

  let rows = [];
  let headerMapping = {};
  let fileName = "json_import";
  let fileHash = "no_hash";

  if (req.file) {
    const parsed = parseWorkbookRows(req.file.buffer);
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }
    rows = parsed.rows;
    headerMapping = parsed.headerMapping;
    fileName = req.file.originalname;
    fileHash = fileHashFromBuffer(req.file.buffer);
  } else if (req.body.rows && Array.isArray(req.body.rows)) {
    rows = req.body.rows;
    headerMapping = req.body.headerMapping || {};
    fileName = req.body.fileName || "json_import";
    fileHash = req.body.fileHash || "no_hash";
  } else {
    return res
      .status(400)
      .json({ success: false, message: "No file or data provided." });
  }

  const normalizedRows = rows.map((row) =>
    validateAndNormalizeRow(row, headerMapping),
  );
  const classifiedRows = await classifyRows(normalizedRows);
  const previewSummary = summarizeClassifications(classifiedRows);
  let importId = req.body?.importId || crypto.randomUUID();

  const existingByImportId = await ImportHistory.findOne({ importId }).lean();
  if (existingByImportId) {
    if (existingByImportId.status === "completed") {
      return res.json({
        success: true,
        message: "This import confirmation was already processed.",
        importId,
        summary: existingByImportId.summary || {
          added: 0,
          updated: 0,
          duplicate: 0,
          invalid: 0,
          processed: 0,
          total: existingByImportId.totalRows || 0,
        },
      });
    }

    if (existingByImportId.status === "processing") {
      return res.status(409).json({
        success: false,
        message: "This import is already being processed. Please wait.",
        importId,
      });
    }

    // Failed/pre-existing import id can be retried with a new id.
    importId = crypto.randomUUID();
  }
  const summary = {
    added: 0,
    updated: 0,
    duplicate: 0,
    invalid: 0,
    processed: 0,
    skipped: 0,
  };

  let importHistoryCreated = false;

  try {
    await ImportHistory.create({
      importId,
      fileHash,
      fileName,
      totalRows: previewSummary.total,
      summary: {
        added: 0,
        updated: 0,
        duplicate: 0,
        invalid: 0,
        processed: 0,
        skipped: 0,
      },
      status: "processing",
      forced: forceImport,
      duplicateOfImportId: null,
      createdBy: req.user?._id,
      previewSnapshot: classifiedRows.slice(0, 50).map((row) => ({
        rowNumber: row.rowNumber,
        classification: row.classification,
        reason: row.reason,
        productName: row.data?.productName || null,
        batchNumber: row.data?.batchNumber || null,
        expiryDate: row.data?.expiryDateKey || null,
        quantity: row.data?.quantity ?? null,
      })),
    });
    importHistoryCreated = true;

    const importRowsToInsert = [];
    const processableRows = [];

    for (const row of classifiedRows) {
      if (row.classification === "INVALID") {
        summary.invalid += 1;
        summary.skipped += 1;
        importRowsToInsert.push({
          importId,
          rowNumber: row.rowNumber,
          rowKey: `invalid:${importId}:${row.rowNumber}`,
          productName: "INVALID",
          batchNumber: "INVALID",
          expiryDateKey: "1970-01-01",
          quantity: 0,
          buyingPrice: 0,
          sellingPrice: 0,
          status: "invalid",
          reason: row.reason,
          medicine: null,
        });
        continue;
      }

      if (row.classification === "DUPLICATE" && !forceImport) {
        summary.duplicate += 1;
        summary.skipped += 1;
        importRowsToInsert.push({
          importId,
          rowNumber: row.rowNumber,
          rowKey: row.data.rowKey,
          productName: row.data.productName,
          batchNumber: row.data.batchNumber,
          expiryDateKey: row.data.expiryDateKey,
          quantity: row.data.quantity,
          buyingPrice: row.data.buyingPrice,
          sellingPrice: row.data.sellingPrice,
          status: "duplicate",
          reason: row.reason,
          medicine: row.data.existingMedicineId || null,
        });
        continue;
      }

      if (row.classification === "DUPLICATE" && forceImport) {
        const isSelected =
          selectedDuplicateRowSet.size === 0 ||
          selectedDuplicateRowSet.has(Number(row.rowNumber));
        if (!isSelected) {
          summary.duplicate += 1;
          summary.skipped += 1;
          importRowsToInsert.push({
            importId,
            rowNumber: row.rowNumber,
            rowKey: row.data.rowKey,
            productName: row.data.productName,
            batchNumber: row.data.batchNumber,
            expiryDateKey: row.data.expiryDateKey,
            quantity: row.data.quantity,
            buyingPrice: row.data.buyingPrice,
            sellingPrice: row.data.sellingPrice,
            status: "duplicate",
            reason: "Duplicate row not selected for force import",
            medicine: row.data.existingMedicineId || null,
          });
          continue;
        }
      }

      processableRows.push(row);
    }

    await processWithConcurrency(processableRows, 20, async (row) => {
      const upsertResult = await upsertMedicineForImport(row.data, importId);
      summary.processed += 1;
      if (upsertResult.type === "NEW") summary.added += 1;
      else summary.updated += 1;

      importRowsToInsert.push({
        importId,
        rowNumber: row.rowNumber,
        rowKey: row.data.rowKey,
        productName: row.data.productName,
        batchNumber: row.data.batchNumber,
        expiryDateKey: row.data.expiryDateKey,
        quantity: row.data.quantity,
        buyingPrice: row.data.buyingPrice,
        sellingPrice: row.data.sellingPrice,
        status: "processed",
        reason:
          forceImport && row.classification === "DUPLICATE"
            ? "Processed with force import"
            : "",
        medicine: upsertResult.medicineId,
      });
    });

    await insertImportRowsInBatches(importRowsToInsert);

    await ImportHistory.updateOne(
      { importId },
      {
        $set: {
          summary,
          status: "completed",
          completedAt: new Date(),
        },
      },
    );

    try {
      await AuditLog.create({
        user: req.user._id,
        action: "MEDICINES_IMPORTED",
        resourceType: "System",
        description: `User ${req.user.username} imported medicines. Added ${summary.added}, updated ${summary.updated}, duplicates ${summary.duplicate}, invalid ${summary.invalid}.`,
        ipAddress: req.ip || req.connection?.remoteAddress || "unknown",
        userAgent: req.get("User-Agent"),
        metadata: {
          importId,
          fileName,
          fileHash,
          forced: forceImport,
          summary,
        },
      });
    } catch (auditError) {}
  } catch (error) {
    if (
      error?.code === 11000 &&
      String(error?.message || "").includes("importId")
    ) {
      const existing = await ImportHistory.findOne({ importId }).lean();
      if (existing?.status === "completed") {
        return res.json({
          success: true,
          message: "This import confirmation was already processed.",
          importId,
          summary: existing.summary || {
            added: 0,
            updated: 0,
            duplicate: 0,
            invalid: 0,
            processed: 0,
            total: existing.totalRows || 0,
          },
        });
      }
      return res.status(409).json({
        success: false,
        message:
          "Import request is already in progress. Please wait and refresh.",
        importId,
      });
    }

    if (importHistoryCreated) {
      await ImportHistory.updateOne(
        { importId },
        {
          $set: {
            status: "failed",
            failureReason: error.message || "Unknown import failure",
            summary,
          },
        },
      );
    }

    console.error("[IMPORT] Commit failed:", {
      message: error?.message,
      code: error?.code,
      name: error?.name,
      importId,
      fileName: req.file?.originalname,
    });
    return res.status(500).json({
      success: false,
      message: `Server error during import: ${error.message || "Unknown error"}`,
      details:
        process.env.NODE_ENV === "development"
          ? {
              name: error.name,
              code: error.code,
              stack: error.stack,
            }
          : undefined,
    });
  } finally {
  }

  return res.json({
    success: true,
    message: "Bulk import complete.",
    importId,
    summary: {
      added: summary.added,
      updated: summary.updated,
      duplicate: summary.duplicate,
      invalid: summary.invalid,
      failed: summary.invalid,
      processed: summary.processed,
      total: previewSummary.total,
    },
  });
};

const optionalUpload = (req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    return upload.single("file")(req, res, next);
  }
  next();
};

router.post("/preview", optionalUpload, runPreview);
router.post("/commit", optionalUpload, (req, res) =>
  runCommit(req, res, { legacy: false }),
);

router.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "File too large. Maximum size is 5MB.",
    });
  }
  return res
    .status(400)
    .json({ success: false, message: err.message || "File upload error." });
});

module.exports = router;
