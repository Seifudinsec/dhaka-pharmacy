import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { faBan, faBoxesStacked, faCircleExclamation, faMagnifyingGlass, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import api from '../utils/api';
import { format, differenceInDays } from 'date-fns';
import MetricCard from '../components/common/MetricCard';
import AppIcon from '../components/common/AppIcon';
import useDebounce from '../hooks/useDebounce';

export default function InventoryPage() {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState(searchParams.get('filter') || 'all');
  const [highlightId, setHighlightId] = useState(searchParams.get('highlight') || '');

  // Debounce search to prevent glitching
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    const incomingHighlight = searchParams.get('highlight') || '';
    setHighlightId(incomingHighlight);
    if (incomingHighlight) {
      const timer = setTimeout(() => setHighlightId(''), 3500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [searchParams]);


  const fetchMedicines = useCallback(async (q = debouncedSearch, f = filter) => {
    setLoading(true);
    try {
      const params = { limit: 500 };
      if (q.trim()) params.search = q.trim();
      if (f !== 'all') params.filter = f;
      const { data } = await api.get('/medicines', { params });
      if (data.success) setMedicines(data.data);
    } catch { toast.error('Failed to load inventory.'); }
    finally { setLoading(false); }
  }, [debouncedSearch, filter]);

  useEffect(() => { fetchMedicines(); }, [fetchMedicines]);

  const handleFilter = (f) => {
    setFilter(f);
    setSearchParams(f !== 'all' ? { filter: f } : {});
    fetchMedicines(search, f);
  };

  const getRowClass = (m) => {
    const now = new Date();
    if (new Date(m.expiryDate) < now) return 'inventory-row-expired';
    if (m.stock === 0) return 'inventory-row-expired';
    if (m.stock < 10) return 'inventory-row-low';
    const daysToExpiry = differenceInDays(new Date(m.expiryDate), now);
    if (daysToExpiry <= 30) return 'inventory-row-low';
    return '';
  };

  const getExpiryDisplay = (m) => {
    const now = new Date();
    const expiry = new Date(m.expiryDate);
    const days = differenceInDays(expiry, now);
    if (days < 0) return <span className="badge badge-red">Expired {Math.abs(days)}d ago</span>;
    if (days === 0) return <span className="badge badge-red">Expires today</span>;
    if (days <= 30) return <span className="badge badge-amber">Exp. in {days}d</span>;
    return <span style={{ fontSize: 13 }}>{format(expiry, 'dd MMM yyyy')}</span>;
  };

  const getStockDisplay = (m) => {
    if (m.stock === 0) return <span className="badge badge-red">Out of stock</span>;
    if (m.stock < 10) return <span className="badge badge-amber">{m.stock} left (low)</span>;
    return <span className="badge badge-green">{m.stock} units</span>;
  };

  const summary = {
    total: medicines.length,
    low: medicines.filter(m => m.stock > 0 && m.stock < 10).length,
    out: medicines.filter(m => m.stock === 0).length,
    expired: medicines.filter(m => new Date(m.expiryDate) < new Date()).length,
  };

  return (
    <div>
      {/* Summary row */}
      <div className="inventory-summary-grid">
        <MetricCard label="Total Items" value={summary.total} tone="primary" icon={faBoxesStacked} />
        <MetricCard label="Low Stock" value={summary.low} tone="warning" icon={faTriangleExclamation} />
        <MetricCard label="Out of Stock" value={summary.out} tone="danger" icon={faCircleExclamation} />
        <MetricCard label="Expired" value={summary.expired} tone="danger" icon={faBan} />
      </div>

      <div className="card">
        <div className="card-header">
          <h2><AppIcon icon={faBoxesStacked} className="header-inline-icon" /> Inventory</h2>
        </div>
        <div className="table-toolbar">
          <div className="search-box">
            <span className="search-icon"><AppIcon icon={faMagnifyingGlass} tone="muted" /></span>
            <input className="form-control" placeholder="Search medicines…" value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="filter-tabs">
            {[['all', 'All'], ['in_stock', 'In Stock'], ['low_stock', 'Low Stock'], ['out_of_stock', 'Out of Stock'], ['expired', 'Expired']].map(([val, label]) => (
              <button key={val} className={`filter-tab${filter === val ? ' active' : ''}`} onClick={() => handleFilter(val)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="table-wrap table-responsive-cards">

          {loading ? <div className="loading-center"><div className="spinner" /></div>
            : !medicines.length ? (
              <div className="empty-state">
                <div className="empty-icon"><AppIcon icon={faBoxesStacked} size="xl" tone="muted" /></div>
                <h3>No items found</h3>
                <p>Adjust filters or add medicines from the Medicines page.</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Medicine Name</th>
                    <th>Price (KES)</th>
                    <th>Stock</th>
                    <th>Expiry Date</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {medicines.map((m, i) => (
                    <tr key={m._id} className={`${getRowClass(m)} ${highlightId === m._id ? 'inventory-row-highlight' : ''}`.trim()}>
                      <td data-label="#" style={{ color: 'var(--gray-400)', fontSize: 12 }}>{i + 1}</td>
                      <td data-label="Medicine Name"><strong>{m.name}</strong></td>
                      <td data-label="Price (KES)">KES {Number(m.price).toFixed(2)}</td>
                      <td data-label="Stock">{getStockDisplay(m)}</td>
                      <td data-label="Expiry Date">{getExpiryDisplay(m)}</td>
                      <td data-label="Last Updated" style={{ fontSize: 12, color: 'var(--gray-500)' }}>{format(new Date(m.updatedAt), 'dd MMM yyyy')}</td>
                    </tr>

                  ))}
                </tbody>
              </table>
            )}
        </div>

        <div className="inventory-legend">
          <span className="inventory-legend-chip danger">■</span> Expired / Out of stock
          <span className="inventory-legend-chip warning">■</span> Low stock / Expiring soon (&lt;30 days)
        </div>
      </div>
    </div>
  );
}
