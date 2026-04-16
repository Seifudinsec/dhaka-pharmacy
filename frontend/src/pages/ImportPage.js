import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { faCircleCheck, faDownload, faFileArrowUp, faFileCircleXmark, faFileImport, faFileLines, faFolderOpen, faRocket, faTriangleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons';
import api from '../utils/api';
import AppIcon from '../components/common/AppIcon';

const TEMPLATE_HEADERS = ['#', 'Product Name', 'Quantity', 'Batch Number', 'Expiry Date', 'Buying Price', 'Selling Price (KES)'];
const SAMPLE_DATA = [
  [1, 'Paracetamol 500mg', 100, 'BT2026001', '31/Dec/2026', 40, ''],
  [2, 'Amoxicillin 250mg', 50, 'BT2026002', '30/Jun/2026', 95, ''],
  [3, 'Ibuprofen 400mg', 75, 'BT2026003', '15/Sep/2025', 68, ''],
];

export default function ImportPage() {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(ext)) { toast.error('Please upload an Excel file (.xlsx or .xls)'); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error('File too large. Maximum size is 5MB.'); return; }
    setFile(f);
    setResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) { toast.error('Please select a file first.'); return; }
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message || 'Import failed.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed.');
    } finally { setUploading(false); }
  };

  const downloadTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...SAMPLE_DATA]);
      XLSX.utils.book_append_sheet(wb, ws, 'Medicines');
      XLSX.writeFile(wb, 'dhaka_import_template.xlsx');
    } catch (err) {
      console.error('Template download error:', err);
      toast.error('Failed to generate Excel template.');
    }
  };

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Instructions */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><h2><AppIcon icon={faFileLines} className="header-inline-icon" /> Import Instructions</h2></div>
        <div className="card-body">
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            Upload an Excel file to bulk-add or update medicines. Existing medicines (matched by name) will be updated; new ones will be inserted.
          </div>
          <p style={{ fontSize: 14, marginBottom: 12, color: 'var(--gray-700)' }}>Your Excel file must follow this structure:</p>
          <div className="table-wrap">
            <table style={{ width: 'auto', marginBottom: 16, borderCollapse: 'collapse' }}>
              <thead><tr><th style={{ textAlign: 'left', padding: '8px' }}>Column</th><th style={{ textAlign: 'left', padding: '8px' }}>Type</th><th style={{ textAlign: 'left', padding: '8px' }}>Rules</th></tr></thead>
              <tbody>
                <tr><td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)' }}><code style={{ background: 'var(--gray-100)', padding: '1px 6px', borderRadius: 4 }}>Product Name</code></td><td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)' }}>Text</td><td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)' }}>Required, non-empty</td></tr>
                <tr><td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)' }}><code style={{ background: 'var(--gray-100)', padding: '1px 6px', borderRadius: 4 }}>Quantity</code></td><td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)' }}>Number</td><td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)' }}>Required, 0 or more</td></tr>
                <tr><td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)' }}><code style={{ background: 'var(--gray-100)', padding: '1px 6px', borderRadius: 4 }}>Batch Number</code></td><td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)' }}>Text</td><td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)' }}>Required, non-empty</td></tr>
                <tr><td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)' }}><code style={{ background: 'var(--gray-100)', padding: '1px 6px', borderRadius: 4 }}>Expiry Date</code></td><td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)' }}>Date</td><td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)' }}>Required, format <code style={{ background: 'var(--gray-100)', padding: '1px 6px', borderRadius: 4 }}>dd/mmm/yyyy</code> (e.g. 31/Mar/2026)</td></tr>
                <tr><td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)' }}><code style={{ background: 'var(--gray-100)', padding: '1px 6px', borderRadius: 4 }}>Buying Price</code></td><td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)' }}>Number</td><td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)' }}>Required (e.g. 40)</td></tr>
                <tr><td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)' }}><code style={{ background: 'var(--gray-100)', padding: '1px 6px', borderRadius: 4 }}>Selling Price (KES)</code></td><td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)' }}>Number</td><td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)' }}>Optional (will be auto-calculated as Buying x 1.4)</td></tr>
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 14 }}>
            Note: a title row above headers is allowed (like in your Dakha stock sheet). The system auto-detects the header row.
          </p>
          <button className="btn btn-secondary" onClick={downloadTemplate}><AppIcon icon={faDownload} /> Download Template</button>
        </div>
      </div>

      {/* Upload area */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><h2><AppIcon icon={faFileImport} className="header-inline-icon" /> Upload Excel File</h2></div>
        <div className="card-body">
          <div
            className={`drop-zone${dragOver ? ' drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <div className="drop-icon"><AppIcon icon={faFolderOpen} size="xl" tone="primary" /></div>
            {file ? (
              <>
                <p><strong style={{ color: 'var(--primary)' }}><AppIcon icon={faFileArrowUp} tone="primary" /> {file.name}</strong></p>
                <p style={{ fontSize: 12, marginTop: 4, color: 'var(--gray-500)' }}>{(file.size / 1024).toFixed(1)} KB — click to change</p>
              </>
            ) : (
              <>
                <p><strong>Click to browse</strong> or drag &amp; drop your Excel file here</p>
                <p style={{ fontSize: 12, marginTop: 6, color: 'var(--gray-400)' }}>.xlsx or .xls — max 5 MB</p>
              </>
            )}
            <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? <><span className="spinner spinner-sm" /> Importing...</> : <><AppIcon icon={faRocket} /> Start Import</>}
            </button>
            {file && <button className="btn btn-secondary" onClick={() => { setFile(null); setResult(null); }}><AppIcon icon={faXmark} /> Clear</button>}
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="card">
          <div className="card-header">
            <h2>
              <AppIcon icon={result.success ? faCircleCheck : faFileCircleXmark} className="header-inline-icon" />
              {result.success ? 'Import Complete' : 'Import Failed'}
            </h2>
          </div>
          <div className="card-body">
            <div className={`alert ${result.success ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>
              {result.message}
            </div>

            {result.summary && (
              <div className="import-summary">
                <div className="summary-item added">
                  <div className="s-num">{result.summary.added}</div>
                  <div className="s-label">Added</div>
                </div>
                <div className="summary-item updated">
                  <div className="s-num">{result.summary.updated}</div>
                  <div className="s-label">Updated</div>
                </div>
                <div className="summary-item failed">
                  <div className="s-num">{result.summary.failed}</div>
                  <div className="s-label">Failed</div>
                </div>
              </div>
            )}

            {result.failedRows?.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)', marginBottom: 10 }}><AppIcon icon={faTriangleExclamation} tone="danger" /> Failed Rows</h3>
                <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)' }}>
                  {result.failedRows.map((row, i) => (
                    <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid var(--gray-100)', fontSize: 13 }}>
                      <strong style={{ color: 'var(--danger)' }}>Row {row.row}:</strong>
                      <ul style={{ margin: '4px 0 0 16px', color: 'var(--gray-700)' }}>
                        {row.errors.map((e, j) => <li key={j}>{e}</li>)}
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
