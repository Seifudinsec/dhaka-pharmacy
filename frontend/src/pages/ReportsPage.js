import React, { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import {
  faChartLine,
  faChartBar,
  faDownload,
  faCoins,
  faArrowTrendUp,
  faBox,
} from "@fortawesome/free-solid-svg-icons";
import AppIcon from "../components/common/AppIcon";
import api from "../utils/api";
import toast from "react-hot-toast";

const RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "6m", label: "Last 6 Months" },
  { value: "1y", label: "Last Year" },
  { value: "custom", label: "Custom Range" },
];

const DEFAULT_REPORT_DATA = {
  revenue: { daily: [], weekly: [], monthly: [] },
  profit: { daily: [], weekly: [], monthly: [] },
  sales: { daily: [], weekly: [], monthly: [] },
  topMedicines: [],
  lowPerformingMedicines: [],
  summary: {
    totalRevenue: 0,
    totalProfit: 0,
    totalSales: 0,
    totalRefunds: 0,
    averageSaleValue: 0,
    profitMargin: 0,
    growthRate: 0,
  },
};

const numberOrZero = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const resolveRangePayload = (range, customStartDate, customEndDate) => {
  if (range !== "custom") return { range };

  if (!customStartDate || !customEndDate) {
    return null;
  }

  return {
    range: "custom",
    startDate: customStartDate,
    endDate: customEndDate,
  };
};

const normalizeReportsResponse = (payload) => {
  // New API shape:
  // { summary, revenueTrends, profitTrends, topSelling, lowPerforming, refundSummary, range }
  // Backward-compatible analytics shape (under data) still possible.
  if (!payload || typeof payload !== "object") return DEFAULT_REPORT_DATA;

  const source =
    payload.data && typeof payload.data === "object" ? payload.data : payload;

  const summary = source.summary || {};
  const revenueTrends = source.revenueTrends || source.revenue || {};
  const profitTrends = source.profitTrends || source.profit || {};
  const salesCounts = source.salesCounts || source.sales || {};
  const topSelling = source.topSelling || source.topMedicines || [];
  const lowPerforming =
    source.lowPerforming || source.lowPerformingMedicines || [];
  const refundSummary = source.refundSummary || {};

  return {
    revenue: {
      daily: Array.isArray(revenueTrends.daily) ? revenueTrends.daily : [],
      weekly: Array.isArray(revenueTrends.weekly) ? revenueTrends.weekly : [],
      monthly: Array.isArray(revenueTrends.monthly)
        ? revenueTrends.monthly
        : [],
    },
    profit: {
      daily: Array.isArray(profitTrends.daily) ? profitTrends.daily : [],
      weekly: Array.isArray(profitTrends.weekly) ? profitTrends.weekly : [],
      monthly: Array.isArray(profitTrends.monthly) ? profitTrends.monthly : [],
    },
    sales: {
      daily: Array.isArray(salesCounts.daily) ? salesCounts.daily : [],
      weekly: Array.isArray(salesCounts.weekly) ? salesCounts.weekly : [],
      monthly: Array.isArray(salesCounts.monthly) ? salesCounts.monthly : [],
    },
    topMedicines: Array.isArray(topSelling) ? topSelling : [],
    lowPerformingMedicines: Array.isArray(lowPerforming) ? lowPerforming : [],
    summary: {
      totalRevenue: numberOrZero(summary.totalRevenue),
      totalProfit: numberOrZero(summary.totalProfit),
      totalSales: numberOrZero(summary.totalSales),
      totalRefunds: numberOrZero(
        summary.totalRefunds ?? refundSummary.totalRefunds,
      ),
      averageSaleValue: numberOrZero(summary.averageSaleValue),
      profitMargin: numberOrZero(summary.profitMargin),
      growthRate: numberOrZero(summary.growthRate),
    },
  };
};

const ReportsPage = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("30d");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [reportData, setReportData] = useState(DEFAULT_REPORT_DATA);

  const queryParams = useMemo(
    () => resolveRangePayload(dateRange, customStartDate, customEndDate),
    [dateRange, customStartDate, customEndDate],
  );

  const fetchReportData = useCallback(async () => {
    if (!queryParams) return;

    try {
      setLoading(true);

      let response;
      try {
        // Preferred endpoint (new API shape)
        response = await api.get("/reports", { params: queryParams });
      } catch (primaryError) {
        // Backward-compatible fallback for environments still on old backend routes
        const status = primaryError?.response?.status;
        if (status === 404) {
          response = await api.get("/reports/analytics", {
            params: queryParams,
          });
        } else {
          throw primaryError;
        }
      }

      const payload = response?.data;
      if (payload?.success) {
        setReportData(normalizeReportsResponse(payload));
      } else {
        setReportData(DEFAULT_REPORT_DATA);
        toast.error(payload?.message || "Failed to load report data");
      }
    } catch (error) {
      console.error("Error fetching report data:", error);
      toast.error("Failed to load report data");
      setReportData(DEFAULT_REPORT_DATA);
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  useEffect(() => {
    const handleDataChange = () => {
      fetchReportData();
    };

    window.addEventListener("dataChanged", handleDataChange);
    return () => window.removeEventListener("dataChanged", handleDataChange);
  }, [fetchReportData]);

  const exportExcel = async () => {
    if (!queryParams) {
      toast.error("Please select both start and end date for custom range.");
      return;
    }

    try {
      let response;
      try {
        response = await api.get("/reports/export", {
          params: { ...queryParams, format: "xlsx" },
          responseType: "blob",
        });
      } catch (primaryError) {
        const status = primaryError?.response?.status;
        if (status === 404) {
          // Legacy backend may still support export via analytics-era params
          response = await api.get("/reports/export", {
            params: {
              startDate: queryParams.startDate,
              endDate: queryParams.endDate,
              format: "xlsx",
            },
            responseType: "blob",
          });
        } else {
          throw primaryError;
        }
      }

      const fileRangeStart =
        queryParams.startDate || format(new Date(), "yyyy-MM-dd");
      const fileRangeEnd =
        queryParams.endDate || format(new Date(), "yyyy-MM-dd");
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");

      link.href = url;
      link.setAttribute(
        "download",
        `dhaka-pharmacy-report-${fileRangeStart}-to-${fileRangeEnd}.xlsx`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Excel report exported successfully");
    } catch (error) {
      console.error("Error exporting Excel report:", error);
      toast.error("Failed to export Excel report");
    }
  };

  const revenueDaily = reportData.revenue?.daily || [];
  const profitDaily = reportData.profit?.daily || [];

  const revenueChartMax = Math.max(...revenueDaily, 1);
  const profitChartMax = Math.max(...profitDaily.map((v) => Math.abs(v)), 1);

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
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="form-select"
          >
            {RANGE_OPTIONS.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>

          {dateRange === "custom" && (
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
          <button onClick={exportExcel} className="btn btn-primary">
            <AppIcon icon={faDownload} className="btn-icon" />
            Export Excel
          </button>
        </div>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon revenue">
            <AppIcon icon={faCoins} size="2x" />
          </div>
          <div className="card-content">
            <h3>Total Revenue</h3>
            <p className="card-value">
              KES{" "}
              {(reportData.summary.totalRevenue || 0).toLocaleString("en-KE", {
                minimumFractionDigits: 2,
              })}
            </p>
            <span className="card-change positive">
              <AppIcon icon={faArrowTrendUp} />
              {(reportData.summary.growthRate || 0).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon profit">
            <AppIcon icon={faChartLine} size="2x" />
          </div>
          <div className="card-content">
            <h3>Total Profit</h3>
            <p className="card-value">
              KES{" "}
              {(reportData.summary.totalProfit || 0).toLocaleString("en-KE", {
                minimumFractionDigits: 2,
              })}
            </p>
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
              Avg: KES{" "}
              {(reportData.summary.averageSaleValue || 0).toLocaleString(
                "en-KE",
                {
                  minimumFractionDigits: 2,
                },
              )}
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

      <div className="charts-section">
        <div className="chart-container">
          <h3>Revenue Trends (Net)</h3>
          <div className="chart-placeholder">
            <div className="mini-chart">
              {revenueDaily.slice(-7).map((value, index) => {
                const height = `${(Math.abs(value || 0) / revenueChartMax) * 100}%`;
                return (
                  <div
                    key={index}
                    className="chart-bar"
                    style={{ height }}
                  ></div>
                );
              })}
            </div>
            <div className="chart-labels">
              <span>7 days trend</span>
              <span>
                KES{" "}
                {revenueDaily
                  .slice(-7)
                  .reduce((a, b) => a + (b || 0), 0)
                  .toLocaleString("en-KE", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        <div className="chart-container">
          <h3>Profit Analysis (Net)</h3>
          <div className="chart-placeholder">
            <div className="mini-chart">
              {profitDaily.slice(-7).map((value, index) => {
                const height = `${(Math.abs(value || 0) / profitChartMax) * 100}%`;
                return (
                  <div
                    key={index}
                    className="chart-bar profit"
                    style={{ height }}
                  ></div>
                );
              })}
            </div>
            <div className="chart-labels">
              <span>7 days trend</span>
              <span>
                KES{" "}
                {profitDaily
                  .slice(-7)
                  .reduce((a, b) => a + (b || 0), 0)
                  .toLocaleString("en-KE", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="tables-section">
        <div className="table-container">
          <h3>Top Selling Medicines</h3>
          <div className="table-wrap table-responsive-cards">
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
                    <td data-label="Medicine">{medicine.name || "Unknown"}</td>
                    <td data-label="Units Sold">{medicine.unitsSold || 0}</td>
                    <td data-label="Revenue">
                      KES{" "}
                      {(medicine.revenue || 0).toLocaleString("en-KE", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td data-label="Profit">
                      KES{" "}
                      {(medicine.profit || 0).toLocaleString("en-KE", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td data-label="Margin">
                      {(medicine.profitMargin || 0).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="table-container">
          <h3>Low Performing Items</h3>
          <div className="table-wrap table-responsive-cards">
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
                {(reportData.lowPerformingMedicines || []).map(
                  (medicine, index) => (
                    <tr key={index}>
                      <td data-label="Medicine">
                        {medicine.name || "Unknown"}
                      </td>
                      <td data-label="Units Sold">{medicine.unitsSold || 0}</td>
                      <td data-label="Revenue">
                        KES{" "}
                        {(medicine.revenue || 0).toLocaleString("en-KE", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td data-label="Stock Status">
                        <span
                          className={`status-badge ${medicine.stockStatus || "unknown"}`}
                        >
                          {medicine.stockStatus || "Unknown"}
                        </span>
                      </td>
                      <td data-label="Last Sale">
                        {medicine.lastSale
                          ? format(new Date(medicine.lastSale), "MMM dd, yyyy")
                          : "Never"}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
