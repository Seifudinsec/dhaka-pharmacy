import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import {
  faChevronDown,
  faChevronUp,
  faCircleCheck,
  faCircleInfo,
  faDownload,
  faFileArrowUp,
  faFileCircleXmark,
  faFileImport,
  faFileLines,
  faFolderOpen,
  faRocket,
  faTriangleExclamation,
  faXmark,
  faBox,
  faTag,
  faCalendarDay,
} from "@fortawesome/free-solid-svg-icons";
import api from "../utils/api";
import AppIcon from "../components/common/AppIcon";
import "./ImportPage.css";

const TEMPLATE_HEADERS = [
  "#",
  "Product Name",
  "Quantity",
  "Batch Number",
  "Expiry Date",
  "Buying Price",
  "Selling Price (KES)",
];
const SAMPLE_DATA = [
  [1, "Paracetamol 500mg", 100, "BT2026001", "31/Dec/2026", 40, ""],
  [2, "Amoxicillin 250mg", 50, "BT2026002", "30/Jun/2026", 95, ""],
  [3, "Ibuprofen 400mg", 75, "BT2026003", "15/Sep/2025", 68, ""],
];

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

const normalizeKey = (val = "") =>
  String(val)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export default function ImportPage() {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [forceImport, setForceImport] = useState(false);
  const [selectedDuplicateRows, setSelectedDuplicateRows] = useState([]);
  const [showDuplicateFileRows, setShowDuplicateFileRows] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const inputRef = useRef();

  const getRowsByType = () => {
    if (!preview) {
      return { new: [], update: [], duplicate: [], invalid: [] };
    }
    if (preview.rowsByType) return preview.rowsByType;

    const grouped = { new: [], update: [], duplicate: [], invalid: [] };
    (preview.rows || []).forEach((row) => {
      if (row.classification === "NEW") grouped.new.push(row);
      else if (row.classification === "UPDATE") grouped.update.push(row);
      else if (row.classification === "DUPLICATE") grouped.duplicate.push(row);
      else grouped.invalid.push(row);
    });
    return grouped;
  };

  const parseExcelFile = (f) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array", cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const matrix = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: "",
          });

          if (!matrix.length) {
            reject(new Error("Excel file is empty."));
            return;
          }

          let headerRowIndex = -1;
          let headerMapping = {};

          for (let i = 0; i < Math.min(matrix.length, 20); i++) {
            const normalizedCells = matrix[i].map((c) => normalizeKey(c));
            const mapping = {};

            for (const [canonical, aliases] of Object.entries(HEADER_MAP)) {
              const foundIdx = normalizedCells.findIndex((c) =>
                aliases.includes(c),
              );
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
            reject(new Error("Required columns (Name, Quantity) not found."));
            return;
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

          resolve({ rows, headerMapping });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(f);
    });
  };

  const handleFile = async (f) => {
    if (!f) return;
    const ext = f.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls"].includes(ext)) {
      toast.error("Please upload an Excel file (.xlsx or .xls)");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 5MB.");
      return;
    }

    const loadingToast = toast.loading("Parsing Excel file...");
    try {
      const parsed = await parseExcelFile(f);
      setFile(f);
      setParsedData(parsed);
      setResult(null);
      setPreview(null);
      setForceImport(false);
      setSelectedDuplicateRows([]);
      setShowDuplicateFileRows(false);
      toast.success("File parsed successfully", { id: loadingToast });
    } catch (err) {
      toast.error(err.message || "Failed to parse file", { id: loadingToast });
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const requestPreview = async () => {
    if (!parsedData) {
      toast.error("Please select a file first.");
      return;
    }

    setPreviewing(true);
    setResult(null);
    setPreview(null);
    setForceImport(false);
    setSelectedDuplicateRows([]);

    try {
      const { data } = await api.post("/import/preview", {
        rows: parsedData.rows,
        headerMapping: parsedData.headerMapping,
        fileName: file.name,
      });
      setPreview(data);
      setSelectedDuplicateRows([]);
      toast.success("Preview ready. Confirm to apply import.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Preview failed.");
    } finally {
      setPreviewing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedData || !preview) return;
    setCommitting(true);
    setResult(null);

    try {
      const { data } = await api.post(
        "/import/commit",
        {
          rows: parsedData.rows,
          headerMapping: parsedData.headerMapping,
          fileName: file.name,
          confirm: "true",
          forceImport: forceImport ? "true" : "false",
          selectedDuplicateRows: selectedDuplicateRows,
          importId: preview.importId,
        },
        {
          timeout: 180000,
        },
      );

      setResult(data);
      setPreview(null);
      setSelectedDuplicateRows([]);
      toast.success(data.message || "Import complete.");
      window.dispatchEvent(
        new CustomEvent("dataChanged", {
          detail: { type: "import", timestamp: Date.now() },
        }),
      );
    } catch (err) {
      const serverData = err.response?.data;
      toast.error(serverData?.message || err.message || "Import failed.");
    } finally {
      setCommitting(false);
    }
  };

  const clearSelection = () => {
    setFile(null);
    setParsedData(null);
    setResult(null);
    setPreview(null);
    setForceImport(false);
    setSelectedDuplicateRows([]);
    setShowDuplicateFileRows(false);
  };

  const toggleDuplicateRowSelection = (rowNumber) => {
    setSelectedDuplicateRows((prev) =>
      prev.includes(rowNumber)
        ? prev.filter((n) => n !== rowNumber)
        : [...prev, rowNumber],
    );
  };

  const downloadTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...SAMPLE_DATA]);
      XLSX.utils.book_append_sheet(wb, ws, "Medicines");
      XLSX.writeFile(wb, "dhaka_import_template.xlsx");
    } catch (err) {
      console.error("Template download error:", err);
      toast.error("Failed to generate Excel template.");
    }
  };

  return (
    <div className="import-page-container">
      <div
        className="instruction-toggle"
        onClick={() => setShowInstructions(!showInstructions)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AppIcon icon={faFileLines} tone="primary" size="lg" />
          <strong style={{ fontSize: 16 }}>
            Import Instructions & Guidelines
          </strong>
        </div>
        <AppIcon
          icon={showInstructions ? faChevronUp : faChevronDown}
          tone="muted"
        />
      </div>

      {showInstructions && (
        <div className="instructions-content">
          <div className="card">
            <div className="card-body">
              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                <AppIcon icon={faCircleInfo} style={{ marginRight: 8 }} />
                Bulk-add or update medicines. Existing products (matched by
                Name, Batch, and Expiry) will be updated; others will be
                created.
              </div>

              <div
                className="table-wrap"
                style={{ borderRadius: 8, border: "1px solid var(--gray-200)" }}
              >
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Type</th>
                      <th>Rules</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <code>Product Name</code>
                      </td>
                      <td>Text</td>
                      <td>Required, non-empty</td>
                    </tr>
                    <tr>
                      <td>
                        <code>Quantity</code>
                      </td>
                      <td>Number</td>
                      <td>Required, 0 or more</td>
                    </tr>
                    <tr>
                      <td>
                        <code>Batch Number</code>
                      </td>
                      <td>Text</td>
                      <td>Required</td>
                    </tr>
                    <tr>
                      <td>
                        <code>Expiry Date</code>
                      </td>
                      <td>Date</td>
                      <td>Required (e.g. 31/Mar/2026)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>Buying Price</code>
                      </td>
                      <td>Number</td>
                      <td>Required</td>
                    </tr>
                    <tr>
                      <td>
                        <code>Selling Price</code>
                      </td>
                      <td>Number</td>
                      <td>Optional (Defaults to Buying x 1.4)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 20 }}>
                <button
                  className="btn btn-secondary"
                  onClick={downloadTemplate}
                >
                  <AppIcon icon={faDownload} /> Download Excel Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h2>
            <AppIcon icon={faFileImport} className="header-inline-icon" /> 1.
            Upload Excel File
          </h2>
        </div>
        <div className="card-body">
          <div
            className={`drop-zone${dragOver ? " drag-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <div className="drop-icon">
              <AppIcon icon={faFolderOpen} size="xl" />
            </div>
            {file ? (
              <>
                <p>
                  <strong style={{ color: "var(--primary)", fontSize: 16 }}>
                    <AppIcon icon={faFileArrowUp} /> {file.name}
                  </strong>
                </p>
                <p
                  style={{
                    fontSize: 13,
                    marginTop: 4,
                    color: "var(--gray-500)",
                  }}
                >
                  {(file.size / 1024).toFixed(1)} KB —{" "}
                  {parsedData?.rows.length || 0} rows found
                </p>
                <p
                  style={{
                    fontSize: 11,
                    marginTop: 8,
                    color: "var(--gray-400)",
                  }}
                >
                  Click to change file
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 16, fontWeight: 600 }}>
                  Click to browse or drag & drop
                </p>
                <p
                  style={{
                    fontSize: 13,
                    marginTop: 6,
                    color: "var(--gray-400)",
                  }}
                >
                  Excel files (.xlsx, .xls) — max 5 MB
                </p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>

          {file && (
            <div className="action-bar">
              <button
                className="btn btn-primary"
                onClick={requestPreview}
                disabled={previewing || committing}
                style={{ flex: 1 }}
              >
                {previewing ? (
                  <>
                    <span className="spinner spinner-sm" /> Processing...
                  </>
                ) : (
                  <>
                    <AppIcon icon={faRocket} /> Generate Preview
                  </>
                )}
              </button>
              <button
                className="btn btn-secondary"
                onClick={clearSelection}
                disabled={previewing || committing}
              >
                <AppIcon icon={faXmark} /> Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {preview && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h2>
              <AppIcon icon={faFileImport} className="header-inline-icon" /> 2.
              Import Preview
            </h2>
          </div>
          <div className="card-body">
            <div className="import-summary">
              <div className="summary-item added">
                <div className="s-num">{preview.summary?.new || 0}</div>
                <div className="s-label">New</div>
              </div>
              <div className="summary-item updated">
                <div className="s-num">{preview.summary?.update || 0}</div>
                <div className="s-label">Update</div>
              </div>
              <div className="summary-item duplicate">
                <div className="s-num">{preview.summary?.duplicate || 0}</div>
                <div className="s-label">Duplicate</div>
              </div>
              <div className="summary-item failed">
                <div className="s-num">{preview.summary?.invalid || 0}</div>
                <div className="s-label">Invalid</div>
              </div>
            </div>

            {(() => {
              const rowsByType = getRowsByType();
              const sections = [
                {
                  key: "new",
                  title: "New Items",
                  rows: rowsByType.new,
                  color: "var(--secondary)",
                },
                {
                  key: "update",
                  title: "Updates",
                  rows: rowsByType.update,
                  color: "var(--info)",
                },
                {
                  key: "duplicate",
                  title: "Duplicates (Requires Action)",
                  rows: rowsByType.duplicate,
                  color: "var(--warning)",
                },
                {
                  key: "invalid",
                  title: "Invalid / Errors",
                  rows: rowsByType.invalid,
                  color: "var(--danger)",
                },
              ];

              return (
                <div style={{ display: "grid", gap: 20 }}>
                  {sections.map((section) => (
                    <div key={section.key} className="preview-section">
                      <div className="preview-header">
                        <h3>
                          {section.title}{" "}
                          <span
                            style={{
                              color: "var(--gray-400)",
                              fontWeight: 400,
                            }}
                          >
                            ({section.rows?.length || 0})
                          </span>
                        </h3>
                      </div>

                      {!section.rows?.length ? (
                        <div
                          style={{
                            padding: "12px",
                            background: "var(--gray-50)",
                            borderRadius: 8,
                            fontSize: 13,
                            color: "var(--gray-400)",
                          }}
                        >
                          No items in this category
                        </div>
                      ) : (
                        <div className="preview-list">
                          {section.rows.map((r, idx) => (
                            <div
                              key={`${section.key}-${idx}`}
                              className="preview-row"
                            >
                              <div className="preview-row-main">
                                Row {r.rowNumber}: {r.productName || "N/A"}
                              </div>
                              <div className="preview-row-meta">
                                <span className="meta-item">
                                  <AppIcon icon={faBox} size="xs" /> Qty:{" "}
                                  {r.quantity ?? 0}
                                </span>
                                <span className="meta-item">
                                  <AppIcon icon={faTag} size="xs" /> Batch:{" "}
                                  {r.batchNumber || "N/A"}
                                </span>
                                <span className="meta-item">
                                  <AppIcon icon={faCalendarDay} size="xs" />{" "}
                                  Exp: {r.expiryDate || "N/A"}
                                </span>
                              </div>
                              {section.key === "duplicate" && (
                                <div style={{ marginTop: 8 }}>
                                  <label
                                    className="checkbox-label"
                                    style={{ fontSize: 12 }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedDuplicateRows.includes(
                                        Number(r.rowNumber),
                                      )}
                                      onChange={() =>
                                        toggleDuplicateRowSelection(
                                          Number(r.rowNumber),
                                        )
                                      }
                                    />
                                    Force import this duplicate
                                  </label>
                                </div>
                              )}
                              {r.reason && (
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: section.color,
                                    marginTop: 2,
                                    fontWeight: 500,
                                  }}
                                >
                                  {r.reason}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}

            <div
              style={{
                marginTop: 24,
                padding: 16,
                background: "var(--gray-50)",
                borderRadius: 8,
              }}
            >
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={forceImport}
                  onChange={(e) => setForceImport(e.target.checked)}
                />
                <strong>Global Force Import</strong>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--gray-500)",
                    fontWeight: 400,
                  }}
                >
                  (Process all duplicate rows/file)
                </span>
              </label>
            </div>

            <div className="action-bar">
              <button
                className="btn btn-primary"
                onClick={handleConfirmImport}
                disabled={committing}
                style={{ flex: 1 }}
              >
                {committing ? (
                  <>
                    <span className="spinner spinner-sm" /> Importing Data...
                  </>
                ) : (
                  <>
                    <AppIcon icon={faCircleCheck} /> Confirm & Commit Import
                  </>
                )}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setPreview(null);
                  setForceImport(false);
                }}
                disabled={committing}
              >
                <AppIcon icon={faXmark} /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="card">
          <div className="card-header">
            <h2>
              <AppIcon
                icon={result.success ? faCircleCheck : faFileCircleXmark}
                className="header-inline-icon"
              />
              3. Import Result
            </h2>
          </div>
          <div className="card-body">
            <div
              className={`status-indicator ${result.success ? "success" : "error"}`}
            >
              <AppIcon
                icon={result.success ? faCircleCheck : faTriangleExclamation}
                size="lg"
              />
              <div>
                <div style={{ fontWeight: 700 }}>
                  {result.success ? "Import Successful" : "Import Failed"}
                </div>
                <div style={{ fontSize: 14 }}>{result.message}</div>
              </div>
            </div>

            {result.summary && (
              <div className="import-summary">
                <div className="summary-item added">
                  <div className="s-num">{result.summary.added || 0}</div>
                  <div className="s-label">Added</div>
                </div>
                <div className="summary-item updated">
                  <div className="s-num">{result.summary.updated || 0}</div>
                  <div className="s-label">Updated</div>
                </div>
                <div className="summary-item duplicate">
                  <div className="s-num">{result.summary.duplicate || 0}</div>
                  <div className="s-label">Duplicate</div>
                </div>
                <div className="summary-item failed">
                  <div className="s-num">{result.summary.invalid || 0}</div>
                  <div className="s-label">Invalid</div>
                </div>
              </div>
            )}

            {result.failedRows?.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h3
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--danger)",
                    marginBottom: 12,
                  }}
                >
                  <AppIcon icon={faTriangleExclamation} /> Failed Rows Detail
                </h3>
                <div className="preview-list">
                  {result.failedRows.map((row, i) => (
                    <div
                      key={i}
                      className="preview-row"
                      style={{ borderLeft: "4px solid var(--danger)" }}
                    >
                      <strong style={{ color: "var(--danger)" }}>
                        Row {row.row}
                      </strong>
                      <ul
                        style={{
                          margin: "4px 0 0 16px",
                          color: "var(--gray-700)",
                          fontSize: 13,
                        }}
                      >
                        {row.errors.map((e, j) => (
                          <li key={j}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 24 }}>
              <button className="btn btn-primary" onClick={clearSelection}>
                Start New Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
