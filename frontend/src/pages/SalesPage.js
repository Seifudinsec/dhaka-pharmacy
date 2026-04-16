import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { faChevronDown, faChevronLeft, faChevronRight, faChevronUp, faFileInvoiceDollar, faMagnifyingGlass, faMoneyBillTrendUp, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { format } from 'date-fns';
import MetricCard from '../components/common/MetricCard';
import AppIcon from '../components/common/AppIcon';
import useDebounce from '../hooks/useDebounce';

export default function SalesPage() {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [revenue, setRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [endDate, setEndDate] = useState('');
  const [expanded, setExpanded] = useState(null);

  const debouncedStart = useDebounce(startDate, 500);
  const debouncedEnd = useDebounce(endDate, 500);

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState('');
  const [processingReturn, setProcessingReturn] = useState(false);

  const fetchSales = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 20 };
      if (debouncedStart) params.startDate = debouncedStart;
      if (debouncedEnd) params.endDate = debouncedEnd;
      const { data } = await api.get('/sales', { params });
      if (data.success) {
        setSales(data.data);
        setRevenue(data.totalRevenue);
        setPagination(data.pagination);
        setPage(p);
      }
    } catch { toast.error('Failed to load sales.'); }
    finally { setLoading(false); }
  }, [debouncedStart, debouncedEnd]);

  useEffect(() => { fetchSales(1); }, [fetchSales]);

  const openReturnModal = (sale) => {
    console.log('Opening return modal for sale:', sale);
    setSelectedSale(sale);
    
    const returnItemsData = sale.items.map(item => {
      const medicineId = item.medicine?._id || item.medicine;
      console.log('Item medicine data:', { medicine: item.medicine, medicineId, medicineName: item.medicineName });
      
      return {
        medicineId: medicineId,
        medicineName: item.medicineName,
        originalQuantity: item.quantity,
        returnQuantity: 0,
        unitPrice: item.unitPrice,
        maxReturnable: item.quantity
      };
    });
    
    console.log('Return items data:', returnItemsData);
    setReturnItems(returnItemsData);
    setReturnReason('');
    setShowReturnModal(true);
  };

  const updateReturnQuantity = (index, quantity) => {
    const newReturnItems = [...returnItems];
    const maxReturnable = newReturnItems[index].maxReturnable;
    newReturnItems[index].returnQuantity = Math.min(Math.max(0, quantity), maxReturnable);
    setReturnItems(newReturnItems);
  };

  const calculateTotalRefund = () => {
    return returnItems.reduce((sum, item) => {
      return sum + (item.returnQuantity * item.unitPrice);
    }, 0);
  };

  const processReturn = async () => {
    const itemsToReturn = returnItems.filter(item => item.returnQuantity > 0);
    
    console.log('Processing return with items:', itemsToReturn);
    console.log('Selected sale:', selectedSale);
    
    if (itemsToReturn.length === 0) {
      toast.error('Please select at least one item to return');
      return;
    }

    // Validate that return quantities don't exceed available quantities
    for (const item of itemsToReturn) {
      if (item.returnQuantity > item.maxReturnable) {
        toast.error(`Cannot return ${item.returnQuantity} units of ${item.medicineName}. Only ${item.maxReturnable} units available.`);
        return;
      }
    }

    setProcessingReturn(true);
    try {
      const payload = {
        originalSaleId: selectedSale._id,
        items: itemsToReturn.map(item => ({
          medicineId: item.medicineId,
          quantity: item.returnQuantity
        })),
        reason: returnReason || 'Customer return'
      };
      
      console.log('Return payload:', payload);
      
      const { data } = await api.post('/returns', payload);
      console.log('Return response:', data);

      if (data.success) {
        toast.success(`Return processed successfully! ${itemsToReturn.length} item(s) returned. Stock updated.`);
        setShowReturnModal(false);
        setSelectedSale(null);
        setReturnItems([]);
        setReturnReason('');
        
        // Refresh sales list to show updated status
        await fetchSales(page);
        
        // Force refresh of medicines to show updated stock
        try {
          // Trigger a global refresh by calling the medicines API
          await api.get('/medicines');
          console.log('Medicines data refreshed successfully');
          
          // Also refresh dashboard data to reflect changes
          try {
            await api.get('/dashboard/stats');
            console.log('Dashboard stats refreshed successfully');
          } catch (dashboardError) {
            console.log('Dashboard refresh failed:', dashboardError);
          }
          
          // If reports are open, refresh them too
          try {
            await api.get('/reports/analytics?startDate=&endDate=');
            console.log('Reports data refreshed successfully');
          } catch (reportsError) {
            console.log('Reports refresh failed:', reportsError);
          }
          
        } catch (medError) {
          console.error('Could not refresh medicines list:', medError);
        }
        
        // Trigger a custom event to notify other components of data changes
        window.dispatchEvent(new CustomEvent('dataChanged', { 
          detail: { type: 'return', timestamp: Date.now() }
        }));
      }
    } catch (error) {
      console.error('Return processing error:', error);
      console.error('Error response:', error.response);
      const errorMessage = error.response?.data?.message || 'Failed to process return';
      toast.error(errorMessage);
    } finally {
      setProcessingReturn(false);
    }
  };

  return (
    <div>
      <div className="sales-summary-grid">
        <MetricCard
          label="Total Revenue"
          value={`KES ${revenue.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`}
          sub="For selected period"
          tone="success"
          icon={faMoneyBillTrendUp}
        />
        <MetricCard
          label="Transactions"
          value={pagination.total || 0}
          sub="Total sales recorded"
          tone="primary"
          icon={faFileInvoiceDollar}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <h2><AppIcon icon={faMoneyBillTrendUp} className="header-inline-icon" /> Sales History</h2>
        </div>
        <div className="table-toolbar">
          <div className="table-toolbar-filters">
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="filter-from" className="form-label" style={{ marginBottom: 4 }}>From</label>
              <input id="filter-from" className="form-control" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: 160 }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="filter-to" className="form-label" style={{ marginBottom: 4 }}>To</label>
              <input id="filter-to" className="form-control" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: 160 }} />
            </div>
            <button className="btn btn-primary" onClick={() => fetchSales(1)}><AppIcon icon={faMagnifyingGlass} /> Filter</button>
            <button className="btn btn-secondary" onClick={() => { setStartDate(''); setEndDate(''); }}>Clear</button>
          </div>
        </div>

        <div className="table-wrap">
          {loading ? <div className="loading-center"><div className="spinner" /></div>
            : !sales.length ? (
              <div className="empty-state">
                <div className="empty-icon"><AppIcon icon={faMoneyBillTrendUp} size="xl" tone="muted" /></div>
                <h3>No sales found</h3>
                <p>Adjust the date filter or process a sale from the Billing page.</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date &amp; Time</th>
                    <th>Items</th>
                    <th>Served By</th>
                    <th>Notes</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(sale => (
                    <React.Fragment key={sale._id}>
                      <tr>
                        <td style={{ fontSize: 13 }}>{format(new Date(sale.createdAt), 'dd MMM yyyy, HH:mm')}</td>
                        <td>
                          {sale.items.slice(0, 2).map(i => (
                            <span key={i.medicineName} className="badge badge-blue" style={{ marginRight: 4, marginBottom: 2 }}>
                              {i.medicineName} ×{i.quantity}
                            </span>
                          ))}
                          {sale.items.length > 2 && <span className="badge badge-gray">+{sale.items.length - 2}</span>}
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>{sale.servedBy?.username || '–'}</td>
                        <td style={{ fontSize: 12, color: 'var(--gray-500)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sale.notes || '–'}</td>
                        <td>
                          <span className={`status-badge ${sale.status || 'completed'}`}>
                            {sale.status === 'completed' ? 'Completed' : 
                             sale.status === 'partially_returned' ? 'Partially Returned' : 
                             sale.status === 'fully_refunded' ? 'Fully Refunded' : 'Completed'}
                          </span>
                        </td>
                        <td><strong style={{ color: 'var(--secondary)' }}>KES {sale.total.toFixed(2)}</strong></td>
                        <td>
                          <div className="action-buttons" style={{ display: 'flex', gap: 4 }}>
                            {sale.status !== 'fully_refunded' && (
                              <button 
                                className="btn btn-sm btn-warning" 
                                onClick={() => openReturnModal(sale)}
                                title="Process Return/Refund"
                              >
                                <AppIcon icon={faRotateLeft} />
                              </button>
                            )}
                            <button className="btn btn-secondary btn-sm" onClick={() => setExpanded(expanded === sale._id ? null : sale._id)}>
                              {expanded === sale._id ? <><AppIcon icon={faChevronUp} /> Hide</> : <><AppIcon icon={faChevronDown} /> Details</>}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded === sale._id && (
                        <tr>
                          <td colSpan={7} className="sales-details-cell">
                            <table style={{ width: 'auto', minWidth: 400 }}>
                              <thead>
                                <tr>
                                  <th>Medicine</th>
                                  <th>Unit Price</th>
                                  <th>Qty</th>
                                  <th>Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sale.items.map((item, idx) => (
                                  <tr key={idx}>
                                    <td>{item.medicineName}</td>
                                    <td>KES {item.unitPrice.toFixed(2)}</td>
                                    <td>{item.quantity}</td>
                                    <td><strong>KES {item.subtotal.toFixed(2)}</strong></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>
              Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => fetchSales(page - 1)} disabled={page <= 1}><AppIcon icon={faChevronLeft} /> Prev</button>
              <button className="btn btn-secondary btn-sm" onClick={() => fetchSales(page + 1)} disabled={page >= pagination.pages}>Next <AppIcon icon={faChevronRight} /></button>
            </div>
          </div>
        )}

      {/* Return/Refund Modal */}
      {showReturnModal && selectedSale && (
        <div className="modal-overlay" onClick={() => setShowReturnModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Process Return/Refund</h2>
              <button className="modal-close" onClick={() => setShowReturnModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="sale-info" style={{ background: 'var(--gray-50)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--gray-600)' }}>Original Sale</div>
                <div style={{ fontWeight: 'bold' }}>#{selectedSale._id.slice(-8)}</div>
                <div style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
                  {format(new Date(selectedSale.createdAt), 'dd MMM yyyy, HH:mm')} - KES {selectedSale.total.toFixed(2)}
                </div>
              </div>

              <div className="form-group">
                <label>Select Items to Return</label>
                <div className="return-items-list">
                  {returnItems.map((item, index) => (
                    <div key={index} className="return-item" style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '8px',
                      border: '1px solid var(--gray-200)',
                      borderRadius: '6px',
                      marginBottom: '8px'
                    }}>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{item.medicineName}</div>
                        <div style={{ fontSize: '12px', color: 'var(--gray-600)' }}>
                          Original: {item.originalQuantity} units @ KES {item.unitPrice.toFixed(2)} each
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          min="0"
                          max={item.maxReturnable}
                          value={item.returnQuantity}
                          onChange={(e) => updateReturnQuantity(index, parseInt(e.target.value) || 0)}
                          className="form-input"
                          style={{ width: '80px', textAlign: 'center' }}
                        />
                        <span style={{ fontSize: '12px', color: 'var(--gray-600)' }}>
                          / {item.maxReturnable}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Reason (Optional)</label>
                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="form-input"
                  placeholder="Enter reason for return..."
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="return-summary" style={{ 
                background: 'var(--primary-50)', 
                padding: '12px', 
                borderRadius: '8px',
                border: '1px solid var(--primary-200)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold' }}>Total Refund Amount:</span>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--primary-600)' }}>
                    KES {calculateTotalRefund().toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowReturnModal(false)}
                disabled={processingReturn}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-warning" 
                onClick={processReturn}
                disabled={processingReturn || calculateTotalRefund() === 0}
              >
                {processingReturn ? (
                  <>
                    <div className="spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                    Processing...
                  </>
                ) : (
                  <>
                    <AppIcon icon={faRotateLeft} className="btn-icon" />
                    Process Return
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
