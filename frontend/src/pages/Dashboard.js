import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { faBan, faChartLine, faCircleExclamation, faFileInvoiceDollar, faMoneyBillTrendUp, faPills, faTriangleExclamation, faCoins, faBox, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { format } from 'date-fns';
import MetricCard from '../components/common/MetricCard';
import AppIcon from '../components/common/AppIcon';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/dashboard/stats');
      if (data.success) setStats(data.data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Listen for data change events to refresh dashboard stats
  useEffect(() => {
    const handleDataChange = (event) => {
      console.log('Dashboard received data change event:', event.detail);
      // Refresh stats when data changes (e.g., after returns, sales, etc.)
      fetchStats();
    };

    window.addEventListener('dataChanged', handleDataChange);
    return () => window.removeEventListener('dataChanged', handleDataChange);
  }, [fetchStats]);

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>
              {isAdmin ? 'Pharmacy Analytics Dashboard' : 'Pharmacy Operations Dashboard'}
            </h2>
            <p style={{ color: 'var(--gray-600)', fontSize: 13 }}>
              {isAdmin ? 'Monitor financial performance, inventory health, and sales analytics.' : 'Track inventory status, alerts, and daily operations.'}
            </p>
          </div>
          <img src="/dhaka-pharmacy-logo.png" alt="Dhaka Pharmacy logo" style={{ height: 64, width: 'auto', objectFit: 'contain' }} />
        </div>
      </div>

      <div className="stats-grid">
        {/* Common metrics for all roles */}
        <div onClick={() => navigate('/medicines')} style={{ cursor: 'pointer' }}>
          <MetricCard icon={faPills} label="Total Medicines" value={stats?.totalMedicines} sub="In database" tone="primary" />
        </div>
        <div onClick={() => navigate('/inventory?filter=low_stock')} style={{ cursor: 'pointer' }}>
          <MetricCard icon={faTriangleExclamation} label="Low Stock" value={stats?.lowStockCount} sub="Below 10 units" tone="warning" />
        </div>
        <div onClick={() => navigate('/inventory?filter=out_of_stock')} style={{ cursor: 'pointer' }}>
          <MetricCard icon={faCircleExclamation} label="Out of Stock" value={stats?.outOfStockCount} sub="Zero units left" tone="danger" />
        </div>
        <div onClick={() => navigate('/inventory?filter=expired')} style={{ cursor: 'pointer' }}>
          <MetricCard icon={faBan} label="Expired" value={stats?.expiredCount} sub="Past expiry date" tone="danger" />
        </div>
        
        {/* Role-specific metrics */}
        <div onClick={() => navigate('/sales')} style={{ cursor: 'pointer' }}>
          <MetricCard 
            icon={faFileInvoiceDollar} 
            label="Today's Sales" 
            value={isAdmin ? `KES ${(stats?.todaySales?.total || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}` : `${stats?.todaySales?.count || 0} transaction${stats?.todaySales?.count !== 1 ? 's' : ''}`}
            sub={isAdmin ? `${stats?.todaySales?.count || 0} transaction${stats?.todaySales?.count !== 1 ? 's' : ''}` : 'Completed today'}
            tone="success" 
          />
        </div>
        
        {isAdmin && (
          <>
            <MetricCard icon={faChartLine} label="Today's Profit" value={`KES ${(stats?.todayProfit || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`} sub="From completed sales" tone="success" />
            <MetricCard icon={faCoins} label="Total Revenue" value={`KES ${(stats?.totalRevenue || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`} sub="All time" tone="primary" />
            <MetricCard icon={faBox} label="Inventory Value" value={`KES ${(stats?.inventoryValue || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`} sub="Current stock value" tone="info" />
          </>
        )}
        
        {!isAdmin && (
          <>
            <MetricCard icon={faExclamationTriangle} label="Expiring Soon" value={stats?.expiringSoonCount || 0} sub="Next 30 days" tone="warning" />
            <MetricCard icon={faBox} label="Total Stock" value={stats?.totalStockUnits || 0} sub="Units in inventory" tone="info" />
          </>
        )}
      </div>

      {isAdmin && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h2>Product Profit / Loss Snapshot</h2></div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14 }}>
            <div>
              <h3 style={{ marginBottom: 8, color: 'var(--secondary)', fontSize: 16 }}>Top Potential Profit (in stock)</h3>
              {!stats?.topProfitProducts?.length ? (
                <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>No profit-leading products yet.</p>
              ) : (
                stats.topProfitProducts.map((p) => (
                  <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                    <span>{p.name} (x{p.stock})</span>
                    <strong>KES {Number(p.estimatedStockProfit).toFixed(2)}</strong>
                  </div>
                ))
              )}
            </div>
            <div>
              <h3 style={{ marginBottom: 8, color: 'var(--danger)', fontSize: 16 }}>Potential Loss Items (in stock)</h3>
              {!stats?.topLossProducts?.length ? (
                <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>No loss-making products found.</p>
              ) : (
                stats.topLossProducts.map((p) => (
                  <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                    <span>{p.name} (x{p.stock})</span>
                    <strong style={{ color: 'var(--danger)' }}>KES {Number(p.estimatedStockProfit).toFixed(2)}</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {!isAdmin && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h2>Inventory Alerts</h2></div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14 }}>
            <div>
              <h3 style={{ marginBottom: 8, color: 'var(--warning)', fontSize: 16 }}>Critical Stock Levels</h3>
              {!stats?.criticalStockItems?.length ? (
                <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>All stock levels are healthy.</p>
              ) : (
                stats.criticalStockItems.map((p) => (
                  <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                    <span>{p.name}</span>
                    <strong style={{ color: 'var(--warning)' }}>{p.stock} units left</strong>
                  </div>
                ))
              )}
            </div>
            <div>
              <h3 style={{ marginBottom: 8, color: 'var(--danger)', fontSize: 16 }}>Expired Items</h3>
              {!stats?.expiredItems?.length ? (
                <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>No expired items found.</p>
              ) : (
                stats.expiredItems.slice(0, 5).map((p) => (
                  <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                    <span>{p.name}</span>
                    <strong style={{ color: 'var(--danger)' }}>Expired {format(new Date(p.expiryDate), 'MMM dd, yyyy')}</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>Recent Transactions</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/sales')}>View All</button>
        </div>
        <div className="table-wrap">
          {!stats?.recentSales?.length ? (
            <div className="empty-state">
              <div className="empty-icon"><AppIcon icon={faMoneyBillTrendUp} size="xl" tone="muted" /></div>
              <h3>No sales yet</h3>
              <p>Processed sales will appear here.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Items</th>
                  <th>Served By</th>
                  {isAdmin && <th>Total</th>}
                </tr>
              </thead>
              <tbody>
                {stats.recentSales.map(sale => (
                  <tr key={sale._id}>
                    <td>{format(new Date(sale.createdAt), 'dd MMM yyyy, HH:mm')}</td>
                    <td>
                      {sale.items.slice(0, 2).map(i => (
                        <span key={i.medicineName} className="badge badge-blue" style={{ marginRight: 4, marginBottom: 2 }}>
                          {i.medicineName} ×{i.quantity}
                        </span>
                      ))}
                      {sale.items.length > 2 && <span className="badge badge-gray">+{sale.items.length - 2} more</span>}
                    </td>
                    <td style={{ color: 'var(--gray-500)', fontSize: 13 }}>{sale.servedBy?.username || '–'}</td>
                    {isAdmin && (
                      <td><strong style={{ color: 'var(--secondary)' }}>KES {sale.total.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</strong></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
