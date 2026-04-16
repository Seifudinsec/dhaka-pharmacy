import React, { useState, useEffect } from 'react';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { faChartLine, faChartBar, faDownload, faCalendarDays, faCoins, faArrowTrendUp, faBox, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import AppIcon from '../components/common/AppIcon';
import api from '../utils/api';
import toast from 'react-hot-toast';

const ReportsPage = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [reportData, setReportData] = useState({
    revenue: { daily: [], weekly: [], monthly: [] },
    profit: { daily: [], weekly: [], monthly: [] },
    sales: { daily: [], weekly: [], monthly: [] },
    topMedicines: [],
    lowPerformingMedicines: [],
    summary: {
      totalRevenue: 0,
      totalProfit: 0,
      totalSales: 0,
      averageSaleValue: 0,
      profitMargin: 0,
      growthRate: 0
    }
  });

  const dateRanges = [
    { value: '7days', label: 'Last 7 Days' },
    { value: '30days', label: 'Last 30 Days' },
    { value: '90days', label: 'Last 90 Days' },
    { value: '6months', label: 'Last 6 Months' },
    { value: '1year', label: 'Last Year' },
    { value: 'custom', label: 'Custom Range' }
  ];

  useEffect(() => {
    fetchReportData();
  }, [dateRange, customStartDate, customEndDate]);

  // Listen for data change events to refresh reports data
  useEffect(() => {
    const handleDataChange = (event) => {
      console.log('ReportsPage received data change event:', event.detail);
      // Refresh reports when data changes (e.g., after returns, sales, etc.)
      fetchReportData();
    };

    window.addEventListener('dataChanged', handleDataChange);
    return () => window.removeEventListener('dataChanged', handleDataChange);
  }, [dateRange, customStartDate, customEndDate]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      let startDate, endDate;

      if (dateRange === 'custom') {
        if (!customStartDate || !customEndDate) return;
        startDate = customStartDate;
        endDate = customEndDate;
      } else {
        const now = new Date();
        switch (dateRange) {
          case '7days':
            startDate = format(subDays(now, 7), 'yyyy-MM-dd');
            endDate = format(now, 'yyyy-MM-dd');
            break;
          case '30days':
            startDate = format(subDays(now, 30), 'yyyy-MM-dd');
            endDate = format(now, 'yyyy-MM-dd');
            break;
          case '90days':
            startDate = format(subDays(now, 90), 'yyyy-MM-dd');
            endDate = format(now, 'yyyy-MM-dd');
            break;
          case '6months':
            startDate = format(subMonths(now, 6), 'yyyy-MM-dd');
            endDate = format(now, 'yyyy-MM-dd');
            break;
          case '1year':
            startDate = format(subMonths(now, 12), 'yyyy-MM-dd');
            endDate = format(now, 'yyyy-MM-dd');
            break;
          default:
            startDate = format(subDays(now, 30), 'yyyy-MM-dd');
            endDate = format(now, 'yyyy-MM-dd');
        }
      }

      const { data } = await api.get(`/reports/analytics?startDate=${startDate}&endDate=${endDate}`);
      if (data.success) {
        // Safely merge API data with default values to handle null/undefined
        const apiData = data.data || {};
        const mergedData = {
          revenue: {
            daily: apiData.revenue?.daily || [],
            weekly: apiData.revenue?.weekly || [],
            monthly: apiData.revenue?.monthly || []
          },
          profit: {
            daily: apiData.profit?.daily || [],
            weekly: apiData.profit?.weekly || [],
            monthly: apiData.profit?.monthly || []
          },
          sales: {
            daily: apiData.sales?.daily || [],
            weekly: apiData.sales?.weekly || [],
            monthly: apiData.sales?.monthly || []
          },
          topMedicines: apiData.topMedicines || [],
          lowPerformingMedicines: apiData.lowPerformingMedicines || [],
          summary: {
            totalRevenue: apiData.summary?.totalRevenue || 0,
            totalProfit: apiData.summary?.totalProfit || 0,
            totalSales: apiData.summary?.totalSales || 0,
            averageSaleValue: apiData.summary?.averageSaleValue || 0,
            profitMargin: apiData.summary?.profitMargin || 0,
            growthRate: apiData.summary?.growthRate || 0
          }
        };
        setReportData(mergedData);
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format) => {
    try {
      let startDate, endDate;

      if (dateRange === 'custom') {
        startDate = customStartDate;
        endDate = customEndDate;
      } else {
        const now = new Date();
        switch (dateRange) {
          case '7days':
            startDate = format(subDays(now, 7), 'yyyy-MM-dd');
            endDate = format(now, 'yyyy-MM-dd');
            break;
          case '30days':
            startDate = format(subDays(now, 30), 'yyyy-MM-dd');
            endDate = format(now, 'yyyy-MM-dd');
            break;
          default:
            startDate = format(subDays(now, 30), 'yyyy-MM-dd');
            endDate = format(now, 'yyyy-MM-dd');
        }
      }

      const response = await api.get(`/reports/export?startDate=${startDate}&endDate=${endDate}&format=${format}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `pharmacy-report-${startDate}-to-${endDate}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Error exporting report:', error);
      toast.error('Failed to export report');
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-spinner"></div>
        <p>Loading report data...</p>
      </div>
    );
  }

  return (
    <div className="reports-page">
      <div className="page-header-actions">
        <div className="date-range-selector">
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="form-select">
            {dateRanges.map(range => (
              <option key={range.value} value={range.value}>{range.label}</option>
            ))}
          </select>
          
          {dateRange === 'custom' && (
            <div className="custom-date-range">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="form-input"
                placeholder="Start date"
              />
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="form-input"
                placeholder="End date"
              />
            </div>
          )}
        </div>

        <div className="export-actions">
          <button onClick={() => exportReport('csv')} className="btn btn-secondary">
            <AppIcon icon={faDownload} className="btn-icon" />
            Export CSV
          </button>
          <button onClick={() => exportReport('xlsx')} className="btn btn-primary">
            <AppIcon icon={faDownload} className="btn-icon" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon revenue">
            <AppIcon icon={faCoins} size="2x" />
          </div>
          <div className="card-content">
            <h3>Total Revenue</h3>
            <p className="card-value">KES {(reportData.summary.totalRevenue || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</p>
            <span className="card-change positive">
              <AppIcon icon={faArrowTrendUp} />
              +{(reportData.summary.growthRate || 0).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon profit">
            <AppIcon icon={faChartLine} size="2x" />
          </div>
          <div className="card-content">
            <h3>Total Profit</h3>
            <p className="card-value">KES {(reportData.summary.totalProfit || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</p>
            <span className="card-change positive">
              <AppIcon icon={faArrowTrendUp} />
              {(reportData.summary.profitMargin || 0).toFixed(1)}% margin
            </span>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon sales">
            <AppIcon icon={faChartBar} size="2x" />
          </div>
          <div className="card-content">
            <h3>Total Sales</h3>
            <p className="card-value">{reportData.summary.totalSales}</p>
            <span className="card-change">
              Avg: KES {(reportData.summary.averageSaleValue || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon performance">
            <AppIcon icon={faBox} size="2x" />
          </div>
          <div className="card-content">
            <h3>Performance</h3>
            <p className="card-value">{reportData.topMedicines.length} items</p>
            <span className="card-change">
              {reportData.lowPerformingMedicines.length} low performers
            </span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <div className="chart-container">
          <h3>Revenue Trends</h3>
          <div className="chart-placeholder">
            <div className="mini-chart">
              {(reportData.revenue?.daily || []).slice(-7).map((value, index) => (
                <div key={index} className="chart-bar" style={{ height: `${(value || 0) / Math.max(...(reportData.revenue?.daily || [1])) * 100}%` }}></div>
              ))}
            </div>
            <div className="chart-labels">
              <span>7 days trend</span>
              <span>KES {(reportData.revenue?.daily || []).slice(-7).reduce((a, b) => a + (b || 0), 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <div className="chart-container">
          <h3>Profit Analysis</h3>
          <div className="chart-placeholder">
            <div className="mini-chart">
              {(reportData.profit?.daily || []).slice(-7).map((value, index) => (
                <div key={index} className="chart-bar profit" style={{ height: `${(value || 0) / Math.max(...(reportData.profit?.daily || [1])) * 100}%` }}></div>
              ))}
            </div>
            <div className="chart-labels">
              <span>7 days trend</span>
              <span>KES {(reportData.profit?.daily || []).slice(-7).reduce((a, b) => a + (b || 0), 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div className="tables-section">
        <div className="table-container">
          <h3>Top Selling Medicines</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Medicine Name</th>
                  <th>Units Sold</th>
                  <th>Revenue</th>
                  <th>Profit</th>
                  <th>Profit Margin</th>
                </tr>
              </thead>
              <tbody>
                {(reportData.topMedicines || []).map((medicine, index) => (
                  <tr key={index}>
                    <td>{medicine.name || 'Unknown'}</td>
                    <td>{medicine.unitsSold || 0}</td>
                    <td>KES {(medicine.revenue || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
                    <td>KES {(medicine.profit || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
                    <td>{(medicine.profitMargin || 0).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="table-container">
          <h3>Low Performing Items</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Medicine Name</th>
                  <th>Units Sold</th>
                  <th>Revenue</th>
                  <th>Stock Status</th>
                  <th>Last Sale</th>
                </tr>
              </thead>
              <tbody>
                {(reportData.lowPerformingMedicines || []).map((medicine, index) => (
                  <tr key={index}>
                    <td>{medicine.name || 'Unknown'}</td>
                    <td>{medicine.unitsSold || 0}</td>
                    <td>KES {(medicine.revenue || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
                    <td>
                      <span className={`status-badge ${medicine.stockStatus || 'unknown'}`}>
                        {medicine.stockStatus || 'Unknown'}
                      </span>
                    </td>
                    <td>{medicine.lastSale ? format(new Date(medicine.lastSale), 'MMM dd, yyyy') : 'Never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
