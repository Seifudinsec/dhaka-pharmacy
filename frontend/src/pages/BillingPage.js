import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { faCartShopping, faCheckCircle, faFileInvoiceDollar, faMagnifyingGlass, faPills, faXmark } from '@fortawesome/free-solid-svg-icons';
import api from '../utils/api';
import AppIcon from '../components/common/AppIcon';

export default function BillingPage() {
  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState([]);
  const [cart, setCart] = useState([]);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);

  const fetchMedicines = useCallback(async () => {
    try {
      const { data } = await api.get('/medicines', { params: { limit: 500, status: 'active' } });
      if (data.success) {
        const allActive = data.data || [];
        setMedicines(allActive);
        setFiltered(allActive);
      }
    } catch { toast.error('Failed to load medicines.'); }
  }, []);

  useEffect(() => { fetchMedicines(); }, [fetchMedicines]);

  const handleSearch = (q) => {
    setSearch(q);
    setFiltered(q.trim() ? medicines.filter(m => m.name.toLowerCase().includes(q.toLowerCase())) : medicines);
  };

  const addToCart = (medicine) => {
    const expired = new Date(medicine.expiryDate) <= new Date();
    if (expired) {
      toast.error(`"${medicine.name}" is expired and cannot be sold.`);
      return;
    }
    if (medicine.stock <= 0) {
      toast.error(`"${medicine.name}" is out of stock.`);
      return;
    }

    setCart(prev => {
      const exists = prev.find(i => i._id === medicine._id);
      if (exists) {
        if (exists.qty >= medicine.stock) { toast.error(`Only ${medicine.stock} units available.`); return prev; }
        return prev.map(i => i._id === medicine._id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...medicine, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => {
      const item = prev.find(i => i._id === id);
      if (!item) return prev;
      const newQty = item.qty + delta;
      if (newQty <= 0) return prev.filter(i => i._id !== id);
      const med = medicines.find(m => m._id === id);
      if (newQty > (med?.stock || 0)) { toast.error(`Only ${med?.stock} units available.`); return prev; }
      return prev.map(i => i._id === id ? { ...i, qty: newQty } : i);
    });
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i._id !== id));

  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

  const handleSale = async () => {
    if (!cart.length) { toast.error('Cart is empty.'); return; }
    setProcessing(true);
    try {
      const { data } = await api.post('/sales', {
        items: cart.map(i => ({ medicineId: i._id, quantity: i.qty })),
        notes: notes.trim() || undefined,
      });
      if (data.success) {
        toast.success('Sale processed successfully!');
        setLastReceipt({ ...data.data, cartSnapshot: [...cart] });
        setCart([]);
        setNotes('');
        fetchMedicines();
        if (data.warnings?.length) {
          data.warnings.forEach(w => toast.error(w, { duration: 5000 }));
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to process sale.';
      toast.error(msg);
      const errs = err.response?.data?.errors || [];
      errs.forEach(e => toast.error(e, { duration: 5000 }));
    } finally { setProcessing(false); }
  };

  return (
    <div className="billing-layout">
      {/* Medicine selector */}
      <div className="card">
        <div className="card-header"><h2><AppIcon icon={faMagnifyingGlass} className="header-inline-icon" /> Select Medicines</h2></div>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray-100)' }}>
          <div className="search-box" style={{ width: '100%' }}>
            <span className="search-icon"><AppIcon icon={faMagnifyingGlass} tone="muted" /></span>
            <input className="form-control" placeholder="Search by name…" value={search} onChange={e => handleSearch(e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>
        <div className="table-wrap" style={{ maxHeight: 500, overflowY: 'auto' }}>
          {!filtered.length ? (
            <div className="empty-state"><div className="empty-icon"><AppIcon icon={faPills} size="xl" tone="muted" /></div><h3>No medicines available</h3><p>All medicines may be out of stock or expired.</p></div>
          ) : (
            <table>
              <thead><tr><th>Medicine</th><th>Price</th><th>Stock</th><th></th></tr></thead>
              <tbody>
                {filtered.map(m => {
                  const inCart = cart.find(i => i._id === m._id);
                  const isExpired = new Date(m.expiryDate) <= new Date();
                  const isOutOfStock = m.stock <= 0;
                  const isSellable = !isExpired && !isOutOfStock;
                  return (
                    <tr key={m._id}>
                      <td><strong>{m.name}</strong></td>
                      <td>KES {Number(m.price).toFixed(2)}</td>
                      <td>
                        {isExpired ? (
                          <span className="badge badge-red">Expired</span>
                        ) : isOutOfStock ? (
                          <span className="badge badge-red">Out of stock</span>
                        ) : (
                          <span className={`badge ${m.stock < 10 ? 'badge-amber' : 'badge-green'}`}>{m.stock}</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => addToCart(m)}
                          disabled={!isSellable || inCart?.qty >= m.stock}
                        >
                          {isExpired ? 'Expired' : isOutOfStock ? 'Out of stock' : inCart ? `+1 (${inCart.qty})` : '+ Add'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Cart / Bill */}
      <div>
        <div className="card">
          <div className="card-header">
            <h2><AppIcon icon={faFileInvoiceDollar} className="header-inline-icon" /> Current Bill</h2>
            {cart.length > 0 && <button className="btn btn-secondary btn-sm" onClick={() => setCart([])}>Clear All</button>}
          </div>
          <div className="card-body" style={{ minHeight: 200 }}>
            {!cart.length ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--gray-400)' }}>
                <div style={{ fontSize: 32 }}><AppIcon icon={faCartShopping} size="xl" tone="muted" /></div>
                <p style={{ marginTop: 8, fontSize: 14 }}>Add medicines to start billing</p>
              </div>
            ) : (
              cart.map(item => (
                <div className="bill-item" key={item._id}>
                  <div className="bill-item-info">
                    <div className="bill-item-name">{item.name}</div>
                    <div className="bill-item-price">KES {item.price.toFixed(2)} each</div>
                  </div>
                  <div className="bill-item-qty">
                    <button className="qty-btn" onClick={() => updateQty(item._id, -1)}>−</button>
                    <span className="qty-display">{item.qty}</span>
                    <button className="qty-btn" onClick={() => updateQty(item._id, 1)}>+</button>
                  </div>
                  <div style={{ minWidth: 70, textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
                    KES {(item.price * item.qty).toFixed(2)}
                  </div>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', fontSize: 16 }} onClick={() => removeFromCart(item._id)}><AppIcon icon={faXmark} /></button>
                </div>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <>
              <div style={{ padding: '0 20px 16px' }}>
                <label className="form-label">Notes (optional)</label>
                <input className="form-control" placeholder="e.g. Patient name, prescription ID…" value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <div style={{ padding: '16px 20px', borderTop: '2px dashed var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase' }}>Total Amount</div>
                  <div className="bill-total">KES {total.toFixed(2)}</div>
                </div>
                <button className="btn btn-success" onClick={handleSale} disabled={processing} style={{ padding: '10px 22px' }}>
                  {processing ? <><span className="spinner spinner-sm" /> Processing...</> : <><AppIcon icon={faCheckCircle} /> Confirm Sale</>}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Last receipt */}
        {lastReceipt && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <h2><AppIcon icon={faFileInvoiceDollar} className="header-inline-icon" /> Last Receipt</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setLastReceipt(null)}><AppIcon icon={faXmark} /> Dismiss</button>
            </div>
            <div className="card-body">
              <div className="alert alert-success" style={{ marginBottom: 12 }}>Sale recorded successfully!</div>
              {lastReceipt.cartSnapshot.map(i => (
                <div key={i._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 13 }}>
                  <span>{i.name} ×{i.qty}</span>
                  <span>KES {(i.price * i.qty).toFixed(2)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontWeight: 800, fontSize: 15 }}>
                <span>Total</span>
                <span style={{ color: 'var(--secondary)' }}>KES {lastReceipt.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
