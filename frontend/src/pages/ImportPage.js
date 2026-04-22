import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import {
  faCircleCheck,
  faDownload,
  faFileArrowUp,
  faFileCircleXmark,
  faFileImport,
  faFileLines,
  faFolderOpen,
  faRocket,
  faTriangleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import api from "../utils/api";
import AppIcon from "../components/common/AppIcon";

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

export default function ImportPage() {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [forceImport, setForceImport] = useState(false);
  const [showDuplicateFileRows, setShowDuplicateFileRows] = useState(false);
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

  const handleFile = (f) => {
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
    setFile(f);
    setResult(null);
    setPreview(null);
    setForceImport(false);
    setShowDuplicateFileRows(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const requestPreview = async () => {
    if (!file) {
      toast.error("Please select a file first.");
      return;
    }

    setPreviewing(true);
    setResult(null);
    setPreview(null);
    setForceImport(false);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/import/preview", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPreview(data);
      toast.success("Preview ready. Confirm to apply import.");
      if (data.duplicateFile) {
        toast.error("This file has already been imported. Use force import to continue.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Preview failed.");
    } finally {
      setPreviewing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!file || !preview) return;
    setCommitting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("confirm", "true");
      formData.append("forceImport", forceImport ? "true" : "false");
      if (preview.importId) formData.append("importId", preview.importId);

      const { data } = await api.post("/import/commit", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setResult(data);
      setPreview(null);
      toast.success(data.message || "Import complete.");
      window.dispatchEvent(
        new CustomEvent("dataChanged", {
          detail: { type: "import", timestamp: Date.now() },
        }),
      );
    } catch (err) {
      const serverData = err.response?.data;
      if (serverData?.code === "DUPLICATE_FILE") {
        setPreview((prev) =>
          prev
            ? {
                ...prev,
                duplicateFile: true,
                duplicateFileDetails: serverData.duplicateFileDetails,
              }
            : prev,
        );
      }
      toast.error(serverData?.message || "Import failed.");
      if (serverData?.details?.code) {
        console.error("Import commit error:", serverData.details);
      }
    } finally {
      setCommitting(false);
    }
  };

  const clearSelection = () => {
    setFile(null);
    setResult(null);
    setPreview(null);
    setForceImport(false);
    setShowDuplicateFileRows(false);
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
    <div style={{ maxWidth: 760 }}>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h2>
            <AppIcon icon={faFileLines} className="header-inline-icon" /> Import
            Instructions
          </h2>
        </div>
        <div className="card-body">
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            Upload an Excel file to bulk-add or update medicines. Existing
            product batches (matched by Product Name + Batch Number + Expiry
            Date) will be stock-updated; new product batches will be inserted.
          </div>
          <p
            style={{
              fontSize: 14,
              marginBottom: 12,
              color: "var(--gray-700)",
            }}
          >
            Your Excel file must follow this structure:
          </p>
          <div className="table-wrap">
            <table
              style={{ width: "auto", marginBottom: 16, borderCollapse: "collapse" }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px" }}>Column</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Type</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Rules</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--gray-100)" }}>
                    <code style={{ background: "var(--gray-100)", padding: "1px 6px", borderRadius: 4 }}>
                      Product Name
                    </code>
                  </td>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--gray-100)" }}>Text</td>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--gray-100)" }}>
                    Required, non-empty
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--gray-100)" }}>
                    <code style={{ background: "var(--gray-100)", padding: "1px 6px", borderRadius: 4 }}>
                      Quantity
                    </code>
                  </td>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--gray-100)" }}>Number</td>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--gray-100)" }}>
                    Required, 0 or more
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--gray-100)" }}>
                    <code style={{ background: "var(--gray-100)", padding: "1px 6px", borderRadius: 4 }}>
                      Batch Number
                    </code>
                  </td>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--gray-100)" }}>Text</td>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--gray-100)" }}>
                    Required, non-empty
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--gray-100)" }}>
                    <code style={{ background: "var(--gray-100)", padding: "1px 6px", borderRadius: 4 }}>
                      Expiry Date
                    </code>
                  </td>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--gray-100)" }}>Date</td>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--gray-100)" }}>
                    Required, format{" "}
                    <code style={{ background: "var(--gray-100)", padding: "1px 6px", borderRadius: 4 }}>
                      dd/mmm/yyyy
                    </code>{" "}
                    (e.g. 31/Mar/2026)
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--gray-100)" }}>
                    <code style={{ background: "var(--gray-100)", padding: "1px 6px", borderRadius: 4 }}>
                      Buying Price
                    </code>
                  </td>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--gray-100)" }}>Number</td>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--gray-100)" }}>
                    Required (e.g. 40)
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--gray-100)" }}>
                    <code style={{ background: "var(--gray-100)", padding: "1px 6px", borderRadius: 4 }}>
                      Selling Price (KES)
                    </code>
                  </td>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--gray-100)" }}>Number</td>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--gray-100)" }}>
                    Optional: If blank, defaults to Buying x 1.4
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 14 }}>
            Note: a title row above headers is allowed. The system auto-detects
            the header row and shows a preview before writing data.
          </p>
          <button className="btn btn-secondary" onClick={downloadTemplate}>
            <AppIcon icon={faDownload} /> Download Template
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h2>
            <AppIcon icon={faFileImport} className="header-inline-icon" /> Upload
            Excel File
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
              <AppIcon icon={faFolderOpen} size="xl" tone="primary" />
            </div>
            {file ? (
              <>
                <p>
                  <strong style={{ color: "var(--primary)" }}>
                    <AppIcon icon={faFileArrowUp} tone="primary" /> {file.name}
                  </strong>
                </p>
                <p
                  style={{
                    fontSize: 12,
                    marginTop: 4,
                    color: "var(--gray-500)",
                  }}
                >
                  {(file.size / 1024).toFixed(1)} KB — click to change
                </p>
              </>
            ) : (
              <>
                <p>
                  <strong>Click to browse</strong> or drag &amp; drop your Excel
                  file here
                </p>
                <p
                  style={{
                    fontSize: 12,
                    marginTop: 6,
                    color: "var(--gray-400)",
                  }}
                >
                  .xlsx or .xls — max 5 MB
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

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              className="btn btn-primary"
              onClick={requestPreview}
              disabled={!file || previewing || committing}
            >
              {previewing ? (
                <>
                  <span className="spinner spinner-sm" /> Previewing...
                </>
              ) : (
                <>
                  <AppIcon icon={faRocket} /> Preview Import
                </>
              )}
            </button>
            {file && (
              <button className="btn btn-secondary" onClick={clearSelection}>
                <AppIcon icon={faXmark} /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {preview && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h2>
              <AppIcon icon={faFileImport} className="header-inline-icon" /> Import
              Preview
            </h2>
          </div>
          <div className="card-body">
            <div className="alert alert-info" style={{ marginBottom: 16 }}>
              No database changes have been made yet. Confirm to apply this import.
            </div>

            {preview.duplicateFile && (
              <div className="alert alert-error" style={{ marginBottom: 16 }}>
                This file has already been imported.
                {preview.duplicateFileDetails?.importId && (
                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    Previous Import ID: {preview.duplicateFileDetails.importId}
                  </div>
                )}
                <div style={{ marginTop: 10 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowDuplicateFileRows((prev) => !prev)}
                  >
                    {showDuplicateFileRows
                      ? "Hide duplicated file rows"
                      : "View duplicated file rows"}
                  </button>
                </div>
                {showDuplicateFileRows &&
                  preview.duplicateFileDetails?.previewRows?.length > 0 && (
                    <div
                      style={{
                        maxHeight: 220,
                        overflowY: "auto",
                        marginTop: 10,
                        border: "1px solid var(--gray-200)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      {preview.duplicateFileDetails.previewRows.map((r, idx) => (
                        <div
                          key={`${r.rowNumber}-${idx}`}
                          style={{
                            padding: "8px 12px",
                            borderBottom: "1px solid var(--gray-100)",
                            fontSize: 13,
                          }}
                        >
                          Row {r.rowNumber}: {r.productName || "N/A"} /{" "}
                          {r.batchNumber || "N/A"} / {r.expiryDate || "N/A"} / Qty{" "}
                          {r.quantity ?? "N/A"}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            )}

            <div className="import-summary" style={{ marginBottom: 16 }}>
              <div className="summary-item added">
                <div className="s-num">{preview.summary?.new || 0}</div>
                <div className="s-label">New</div>
              </div>
              <div className="summary-item updated">
                <div className="s-num">{preview.summary?.update || 0}</div>
                <div className="s-label">Update</div>
              </div>
              <div className="summary-item failed">
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
                { key: "new", title: "New Medicines", rows: rowsByType.new },
                {
                  key: "update",
                  title: "Updated Medicines",
                  rows: rowsByType.update,
                },
                { key: "duplicate", title: "Duplicates", rows: rowsByType.duplicate },
                { key: "invalid", title: "Failed / Invalid", rows: rowsByType.invalid },
              ];

              return (
                <div style={{ marginBottom: 16 }}>
                  {sections.map((section) => (
                    <div key={section.key} style={{ marginBottom: 12 }}>
                      <h3
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          marginBottom: 8,
                          color: "var(--gray-700)",
                        }}
                      >
                        {section.title} ({section.rows?.length || 0})
                      </h3>
                      {!section.rows?.length ? (
                        <div
                          style={{
                            padding: "8px 10px",
                            border: "1px solid var(--gray-100)",
                            borderRadius: "var(--radius-sm)",
                            fontSize: 12,
                            color: "var(--gray-500)",
                          }}
                        >
                          None
                        </div>
                      ) : (
                        <div
                          style={{
                            maxHeight: 170,
                            overflowY: "auto",
                            border: "1px solid var(--gray-200)",
                            borderRadius: "var(--radius-sm)",
                          }}
                        >
                          {section.rows.map((r, idx) => (
                            <div
                              key={`${section.key}-${r.rowNumber}-${idx}`}
                              style={{
                                padding: "8px 12px",
                                borderBottom: "1px solid var(--gray-100)",
                                fontSize: 13,
                              }}
                            >
                              <strong>Row {r.rowNumber}</strong>:{" "}
                              {r.productName || "N/A"} / {r.batchNumber || "N/A"} /{" "}
                              {r.expiryDate || "N/A"} / Qty {r.quantity ?? "N/A"}
                              {r.reason ? (
                                <div style={{ marginTop: 3, color: "var(--gray-500)" }}>
                                  {r.reason}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}

            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 14,
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={forceImport}
                onChange={(e) => setForceImport(e.target.checked)}
              />
              Force import (process duplicate rows/file as well)
            </label>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn btn-primary"
                onClick={handleConfirmImport}
                disabled={committing}
              >
                {committing ? (
                  <>
                    <span className="spinner spinner-sm" /> Importing...
                  </>
                ) : (
                  <>
                    <AppIcon icon={faCircleCheck} /> Confirm Import
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
              {result.success ? "Import Complete" : "Import Failed"}
            </h2>
          </div>
          <div className="card-body">
            <div
              className={`alert ${result.success ? "alert-success" : "alert-error"}`}
              style={{ marginBottom: 16 }}
            >
              {result.message}
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
                <div className="summary-item failed">
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
              <div style={{ marginTop: 20 }}>
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--danger)",
                    marginBottom: 10,
                  }}
                >
                  <AppIcon icon={faTriangleExclamation} tone="danger" /> Failed
                  Rows
                </h3>
                <div
                  style={{
                    maxHeight: 280,
                    overflowY: "auto",
                    border: "1px solid var(--gray-200)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  {result.failedRows.map((row, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "10px 14px",
                        borderBottom: "1px solid var(--gray-100)",
                        fontSize: 13,
                      }}
                    >
                      <strong style={{ color: "var(--danger)" }}>
                        Row {row.row}:
                      </strong>
                      <ul style={{ margin: "4px 0 0 16px", color: "var(--gray-700)" }}>
                        {row.errors.map((e, j) => (
                          <li key={j}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
