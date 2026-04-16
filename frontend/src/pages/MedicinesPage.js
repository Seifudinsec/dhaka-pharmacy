import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { faArrowsRotate, faFloppyDisk, faPenToSquare, faPills, faPlus, faPowerOff, faTrashCan, faXmark, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import api from '../utils/api';
import { format } from 'date-fns';
import AppIcon from '../components/common/AppIcon';
import { useAuth } from '../context/AuthContext';

const EMPTY_FORM = { name: '', price: '', buyingPrice: '', batchNumber: '', stock: '', expiryDate: '' };

const MedicineModal = ({ medicine, onClose, onSaved }) => {
  const [form, setForm] = useState(
    medicine
      ? {
        name: medicine.name,
        price: medicine.price,
        buyingPrice: medicine.buyingPrice ?? '',
        batchNumber: medicine.batchNumber ?? '',
        stock: medicine.stock,
        expiryDate: medicine.expiryDate ? format(new Date(medicine.expiryDate), 'yyyy-MM-dd') : '',
      }
      : EMPTY_FORM
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.batchNumber.trim()) e.batchNumber = 'Batch number is required.';
    if (!form.price || isNaN(form.price) || Number(form.price) <= 0) e.price = 'Price must be greater than 0.';
    if (!form.buyingPrice || isNaN(form.buyingPrice) || Number(form.buyingPrice) <= 0) e.buyingPrice = 'Buying price must be greater than 0.';
    if (form.stock === '' || isNaN(form.stock) || Number(form.stock) < 0) e.stock = 'Stock must be 0 or more.';
    if (!form.expiryDate) e.expiryDate = 'Expiry date is required.';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        batchNumber: form.batchNumber.trim(),
        price: Number(form.price),
        buyingPrice: Number(form.buyingPrice),
        stock: Number(form.stock),
        expiryDate: form.expiryDate,
      };
      if (medicine) {
        await api.put(`/medicines/${medicine._id}`, payload);
        toast.success('Medicine updated.');
      } else {
        await api.post('/medicines', payload);
        toast.success('Medicine added.');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const set = (field, val) => { setForm(f => ({ ...f, [field]: val })); setErrors(e => ({ ...e, [field]: '' })); };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>
            <AppIcon icon={medicine ? faPenToSquare : faPlus} className="header-inline-icon" />
            {medicine ? 'Edit Medicine' : 'Add Medicine'}
          </h3>
          <button className="modal-close" onClick={onClose}><AppIcon icon={faXmark} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="modal-name" className="form-label">Name <span className="required">*</span></label>
              <input id="modal-name" className={`form-control${errors.name ? ' error' : ''}`} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Paracetamol 500mg" />
              {errors.name && <div className="form-error">{errors.name}</div>}
            </div>
            <div className="form-group">
              <label htmlFor="modal-batch" className="form-label">Batch Number <span className="required">*</span></label>
              <input id="modal-batch" className={`form-control${errors.batchNumber ? ' error' : ''}`} value={form.batchNumber} onChange={e => set('batchNumber', e.target.value)} placeholder="e.g. BT-1029" />
              {errors.batchNumber && <div className="form-error">{errors.batchNumber}</div>}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="modal-price" className="form-label">Price (KES) <span className="required">*</span></label>
                <input id="modal-price" className={`form-control${errors.price ? ' error' : ''}`} type="number" min="0.01" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.00" />
                {errors.price && <div className="form-error">{errors.price}</div>}
              </div>
              <div className="form-group">
                <label htmlFor="modal-buying-price" className="form-label">Buying Price (KES) <span className="required">*</span></label>
                <input id="modal-buying-price" className={`form-control${errors.buyingPrice ? ' error' : ''}`} type="number" min="0.01" step="0.01" value={form.buyingPrice} onChange={e => set('buyingPrice', e.target.value)} placeholder="0.00" />
                {errors.buyingPrice && <div className="form-error">{errors.buyingPrice}</div>}
              </div>
              <div className="form-group">
                <label htmlFor="modal-stock" className="form-label">Stock (units) <span className="required">*</span></label>
                <input id="modal-stock" className={`form-control${errors.stock ? ' error' : ''}`} type="number" min="0" step="1" value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="0" />
                {errors.stock && <div className="form-error">{errors.stock}</div>}
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="modal-expiry" className="form-label">Expiry Date <span className="required">*</span></label>
              <input id="modal-expiry" className={`form-control${errors.expiryDate ? ' error' : ''}`} type="date" value={form.expiryDate} onChange={e => set('expiryDate', e.target.value)} />
              {errors.expiryDate && <div className="form-error">{errors.expiryDate}</div>}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner spinner-sm" /> Saving...</> : <><AppIcon icon={faFloppyDisk} /> Save</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const StatusModal = ({ medicine, mode, onClose, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const isDeactivate = mode === 'deactivate';
  const isReactivate = mode === 'reactivate';
  const isDelete = mode === 'delete';
  const handleSubmit = async () => {
    setSaving(true);
    try {
      if (isDelete) {
        await api.delete(`/medicines/${medicine._id}/permanent`);
        toast.success(`"${medicine.name}" permanently deleted.`);
      } else {
        const endpoint = isDeactivate ? `/medicines/${medicine._id}/deactivate` : `/medicines/${medicine._id}/reactivate`;
        await api.patch(endpoint);
        toast.success(`"${medicine.name}" ${isDeactivate ? 'deactivated' : 'reactivated'}.`);
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${isDeactivate ? 'deactivate' : isReactivate ? 'reactivate' : 'delete'}.`);
    } finally { setSaving(false); }
  };
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header"><h3><AppIcon icon={isDeactivate ? faPowerOff : isReactivate ? faArrowsRotate : faTrashCan} className="header-inline-icon" /> {isDeactivate ? 'Deactivate Medicine' : isReactivate ? 'Reactivate Medicine' : 'Delete Medicine'}</h3><button className="modal-close" onClick={onClose}><AppIcon icon={faXmark} /></button></div>
        <div className="modal-body">
          <p style={{ fontSize: 14, color: 'var(--gray-700)' }}>
            {isDeactivate
              ? <>Are you sure you want to deactivate <strong>"{medicine.name}"</strong>? This medicine will be hidden from active inventory and cannot be sold.</>
              : isReactivate
                ? <>Reactivate <strong>"{medicine.name}"</strong> and return it to active inventory?</>
                : <>Permanently delete <strong>"{medicine.name}"</strong>? This action cannot be undone.</>}
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className={`btn ${isDeactivate || isDelete ? 'btn-danger' : 'btn-success'}`} onClick={handleSubmit} disabled={saving}>
            {saving ? <><span className="spinner spinner-sm" /> Saving...</> : <><AppIcon icon={isDeactivate ? faPowerOff : isReactivate ? faArrowsRotate : faTrashCan} /> {isDeactivate ? 'Deactivate' : isReactivate ? 'Reactivate' : 'Delete Permanently'}</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function MedicinesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [statusTab, setStatusTab] = useState('active');
  const [modal, setModal] = useState(null); // { type: 'add'|'edit'|'deactivate'|'reactivate', medicine? }
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeactivating, setBulkDeactivating] = useState(false);
  const searchRef = useRef();

  const fetchMedicines = useCallback(async (q = search, f = filter, s = statusTab) => {
    setLoading(true);
    try {
      const params = { limit: 200, status: s };
      if (q.trim()) params.search = q.trim();
      if (f !== 'all') params.filter = f;
      const { data } = await api.get('/medicines', { params });
      if (data.success) {
        setMedicines(data.data);
        setSelectedIds((prev) => prev.filter((id) => data.data.some((m) => m._id === id)));
      }
    } catch (err) {
      toast.error('Failed to load medicines.');
    } finally { setLoading(false); }
  }, [search, filter, statusTab]);

  useEffect(() => { fetchMedicines(); }, [fetchMedicines]);

  // Listen for data change events to refresh medicines list
  useEffect(() => {
    const handleDataChange = (event) => {
      console.log('MedicinesPage received data change event:', event.detail);
      // Refresh medicines when data changes (e.g., after returns, sales, etc.)
      fetchMedicines();
    };

    window.addEventListener('dataChanged', handleDataChange);
    return () => window.removeEventListener('dataChanged', handleDataChange);
  }, [fetchMedicines]);

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearch(val);
    fetchMedicines(val, filter, statusTab);
  };

  const handleFilter = (f) => {
    setFilter(f);
    fetchMedicines(search, f, statusTab);
  };

  const handleStatusTab = (s) => {
    setStatusTab(s);
    setSelectedIds([]);
    fetchMedicines(search, filter, s);
  };

  const stockBadge = (m) => {
    if (new Date() > new Date(m.expiryDate)) return <span className="badge badge-red">Expired</span>;
    if (m.stock === 0) return <span className="badge badge-red">Out of stock</span>;
    if (m.stock < 10) return <span className="badge badge-amber">Low stock</span>;
    return <span className="badge badge-green">In stock</span>;
  };

  const allSelected = useMemo(() => medicines.length > 0 && selectedIds.length === medicines.length, [medicines, selectedIds]);

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(medicines.map((m) => m._id));
  };

  const toggleOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleBulkDeactivate = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Deactivate ${selectedIds.length} selected medicine(s)?`)) return;
    setBulkDeactivating(true);
    try {
      const { data } = await api.post('/medicines/bulk-deactivate', { ids: selectedIds });
      toast.success(data.message || 'Selected medicines deactivated.');
      setSelectedIds([]);
      fetchMedicines();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk deactivation failed.');
    } finally {
      setBulkDeactivating(false);
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2><AppIcon icon={faPills} className="header-inline-icon" /> {statusTab === 'active' ? 'Active Medicines' : 'Inactive Medicines'} ({medicines.length})</h2>
          <div className="card-header-actions">
            {statusTab === 'active' && (
              <button className="btn btn-danger" onClick={handleBulkDeactivate} disabled={!selectedIds.length || bulkDeactivating}>
                {bulkDeactivating ? 'Saving...' : <><AppIcon icon={faPowerOff} /> Bulk Deactivate ({selectedIds.length})</>}
              </button>
            )}
            {statusTab === 'active' && <button className="btn btn-primary" onClick={() => setModal({ type: 'add' })}><AppIcon icon={faPlus} /> Add Medicine</button>}
          </div>
        </div>

        <div className="table-toolbar">
          <div className="filter-tabs">
            {[['active', 'Active Medicines'], ['inactive', 'Inactive Medicines']].map(([val, label]) => (
              <button key={val} className={`filter-tab${statusTab === val ? ' active' : ''}`} onClick={() => handleStatusTab(val)}>{label}</button>
            ))}
          </div>
          <div className="search-box">
            <span className="search-icon"><AppIcon icon={faMagnifyingGlass} tone="muted" /></span>
            <input ref={searchRef} className="form-control" placeholder="Search medicines…" value={search} onChange={handleSearch} />
          </div>
          {statusTab === 'active' && (
            <div className="filter-tabs">
              {[['all', 'All'], ['in_stock', 'In Stock'], ['low_stock', 'Low Stock'], ['out_of_stock', 'Out of Stock'], ['expired', 'Expired']].map(([val, label]) => (
                <button key={val} className={`filter-tab${filter === val ? ' active' : ''}`} onClick={() => handleFilter(val)}>{label}</button>
              ))}
            </div>
          )}
        </div>

        <div className="table-wrap">
          {loading ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : !medicines.length ? (
            <div className="empty-state">
              <div className="empty-icon"><AppIcon icon={faPills} size="xl" tone="muted" /></div>
              <h3>No medicines found</h3>
              <p>{statusTab === 'active' ? 'Try a different search or add a new medicine.' : 'No inactive medicines available.'}</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all medicines" />
                  </th>
                  <th>#</th>
                  <th>Name</th>
                  <th>Batch</th>
                  <th>Buying (KES)</th>
                  <th>Price (KES)</th>
                  <th>Unit P/L</th>
                  <th>Stock P/L</th>
                  <th>Stock</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {medicines.map((m, i) => (
                  <tr
                    key={m._id}
                    className={new Date() > new Date(m.expiryDate) ? 'medicine-row-expired' : m.stock < 10 ? 'medicine-row-low-stock' : ''}
                  >
                    <td>
                      {statusTab === 'active' ? (
                        <input type="checkbox" checked={selectedIds.includes(m._id)} onChange={() => toggleOne(m._id)} aria-label={`Select ${m.name}`} />
                      ) : null}
                    </td>
                    <td style={{ color: 'var(--gray-400)', fontSize: 12 }}>{i + 1}</td>
                    <td><strong>{m.name}</strong></td>
                    <td>{m.batchNumber || '—'}</td>
                    <td>KES {Number(m.buyingPrice || 0).toFixed(2)}</td>
                    <td>KES {Number(m.price).toFixed(2)}</td>
                    <td style={{ color: Number(m.price) >= Number(m.buyingPrice || 0) ? 'var(--secondary)' : 'var(--danger)' }}>
                      KES {(Number(m.price) - Number(m.buyingPrice || 0)).toFixed(2)}
                    </td>
                    <td style={{ color: (Number(m.price) - Number(m.buyingPrice || 0)) * Number(m.stock) >= 0 ? 'var(--secondary)' : 'var(--danger)' }}>
                      KES {((Number(m.price) - Number(m.buyingPrice || 0)) * Number(m.stock)).toFixed(2)}
                    </td>
                    <td><strong style={{ color: m.stock === 0 ? 'var(--danger)' : m.stock < 10 ? 'var(--warning)' : 'var(--secondary)' }}>{m.stock}</strong></td>
                    <td style={{ fontSize: 13 }}>{format(new Date(m.expiryDate), 'dd/MMM/yyyy')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {stockBadge(m)}
                        <span className={`badge ${m.status === 'inactive' ? 'badge-gray' : 'badge-green'}`}>{m.status === 'inactive' ? 'Inactive' : 'Active'}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {m.status === 'active' && (
                          <>
                            <button className="btn btn-secondary btn-sm" onClick={() => setModal({ type: 'edit', medicine: m })}><AppIcon icon={faPenToSquare} /> Edit</button>
                            <button className="btn btn-danger btn-sm" onClick={() => setModal({ type: 'deactivate', medicine: m })}><AppIcon icon={faPowerOff} /> Deactivate</button>
                          </>
                        )}
                        {m.status === 'inactive' && isAdmin && (
                          <>
                            <button className="btn btn-success btn-sm" onClick={() => setModal({ type: 'reactivate', medicine: m })}><AppIcon icon={faArrowsRotate} /> Reactivate</button>
                            <button className="btn btn-danger btn-sm" onClick={() => setModal({ type: 'delete', medicine: m })}><AppIcon icon={faTrashCan} /> Delete</button>
                          </>
                        )}
                        {m.status === 'inactive' && !isAdmin && (
                          <span className="badge badge-gray">Admin only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal?.type === 'add' && <MedicineModal onClose={() => setModal(null)} onSaved={() => { setModal(null); fetchMedicines(); }} />}
      {modal?.type === 'edit' && <MedicineModal medicine={modal.medicine} onClose={() => setModal(null)} onSaved={() => { setModal(null); fetchMedicines(); }} />}
      {(modal?.type === 'deactivate' || modal?.type === 'reactivate' || modal?.type === 'delete') && (
        <StatusModal
          medicine={modal.medicine}
          mode={modal.type}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchMedicines(); }}
        />
      )}
    </div>
  );
}
