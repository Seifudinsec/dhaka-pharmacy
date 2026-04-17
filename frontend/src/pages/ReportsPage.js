import React, { useState, useEffect, useMemo, useCallback } from "react";
import { format, subDays, subMonths, subYears } from "date-fns";
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
import {
  SkeletonTable,
  SkeletonSummaryCards,
  SkeletonChart,
  SkeletonCard,
} from "../components/common/SkeletonLoaders";

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
    grossRevenue: 0,
    grossProfit: 0,
    refundProfitLoss: 0,
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
    summary: (() => {
      const totalRevenue = numberOrZero(summary.totalRevenue);
      const totalProfit = numberOrZero(summary.totalProfit);
      const totalRefunds = numberOrZero(
        summary.totalRefunds ?? refundSummary.totalRefunds,
      );
      const refundProfitLoss = numberOrZero(summary.refundProfitLoss);
      const grossRevenue = numberOrZero(
        summary.grossRevenue ?? totalRevenue + totalRefunds,
      );
      const grossProfit = numberOrZero(
        summary.grossProfit ?? totalProfit + refundProfitLoss,
      );

      return {
        totalRevenue,
        totalProfit,
        totalSales: numberOrZero(summary.totalSales),
        totalRefunds,
        grossRevenue,
        grossProfit,
        refundProfitLoss,
        averageSaleValue: numberOrZero(summary.averageSaleValue),
        profitMargin: numberOrZero(summary.profitMargin),
        growthRate: numberOrZero(summary.growthRate),
      };
    })(),
  };
};

const ReportsPage = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("30d");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [reportData, setReportData] = useState(DEFAULT_REPORT_DATA);
  const [exportLoading, setExportLoading] = useState(false);

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
    setExportLoading(true);
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
    } finally {
      setExportLoading(false);
    }
  };

  // Determine which series (daily/weekly/monthly) to use for the mini charts
  const determineTrend = () => {
    const range = dateRange;
    let rev = reportData.revenue?.daily || [];
    let prof = reportData.profit?.daily || [];
    let label = "";

    if (range === "7d") {
      label = "7 days";
    } else if (range === "30d") {
      label = "30 days";
    } else if (range === "90d") {
      label = "90 days";
    } else if (range === "6m") {
      rev = reportData.revenue?.monthly || [];
      prof = reportData.profit?.monthly || [];
      label = "6 months";
    } else if (range === "1y") {
      rev = reportData.revenue?.monthly || [];
      prof = reportData.profit?.monthly || [];
      label = "12 months";
    } else if (range === "custom") {
      // custom - prefer daily breakdown when available
      label =
        customStartDate && customEndDate
          ? `${customStartDate} to ${customEndDate}`
          : "Custom range";
    }

    return { rev, prof, label };
  };

  const {
    rev: revenueTrend,
    prof: profitTrend,
    label: trendLabel,
  } = determineTrend();

  const getWindowSize = () => {
    if (dateRange === "7d") return 7;
    if (dateRange === "30d") return 30;
    if (dateRange === "90d") return 90;
    if (dateRange === "6m") return 6; // months
    if (dateRange === "1y") return 12; // months
    return null; // custom or unknown -> use full series
  };

  const windowSize = getWindowSize();
  const revenueDisplay = windowSize
    ? revenueTrend.slice(-windowSize)
    : revenueTrend;
  const profitDisplay = windowSize
    ? profitTrend.slice(-windowSize)
    : profitTrend;

  const revenueChartMax = Math.max(
    ...(revenueDisplay.length ? revenueDisplay : [1]),
    1,
  );
  const profitChartMax = Math.max(
    ...(profitDisplay.length ? profitDisplay.map((v) => Math.abs(v)) : [1]),
    1,
  );

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
          <button
            onClick={exportExcel}
            className="btn btn-primary"
            disabled={exportLoading || loading}
          >
            {exportLoading ? (
              <>
                <span className="spinner spinner-sm" aria-hidden="true" />{" "}
                Generating report...
              </>
            ) : (
              <>
                <AppIcon icon={faDownload} className="btn-icon" /> Export Excel
              </>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <SkeletonSummaryCards count={4} />
      ) : (
        <div className="summary-cards">
          <div className="summary-card">
            <div className="card-icon revenue">
              <AppIcon icon={faCoins} size="2x" />
            </div>
            <div className="card-content">
              <h3>Total Revenue</h3>
              <p className="card-value">
                KES{" "}
                {(reportData.summary.totalRevenue || 0).toLocaleString(
                  "en-KE",
                  {
                    minimumFractionDigits: 2,
                  },
                )}
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
              <p className="card-value">
                {reportData.topMedicines.length} items
              </p>
              <span className="card-change">
                {reportData.lowPerformingMedicines.length} low performers
              </span>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonCard lines={3} showHeader={true} />
      ) : (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h2>Profit Breakdown</h2>
          </div>
          <div className="card-body" style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
              }}
            >
              <span>Gross Profit (Before refunds)</span>
              <strong>
                KES{" "}
                {(reportData.summary.grossProfit || 0).toLocaleString("en-KE", {
                  minimumFractionDigits: 2,
                })}
              </strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
              }}
            >
              <span>Refund Profit Loss</span>
              <strong style={{ color: "var(--danger)" }}>
                - KES{" "}
                {(reportData.summary.refundProfitLoss || 0).toLocaleString(
                  "en-KE",
                  {
                    minimumFractionDigits: 2,
                  },
                )}
              </strong>
            </div>
            <div
              style={{
                borderTop: "1px solid var(--gray-200)",
                paddingTop: 10,
                display: "flex",
                justifyContent: "space-between",
                fontSize: 15,
              }}
            >
              <span>
                <strong>Net Profit</strong>
              </span>
              <strong>
                KES{" "}
                {(reportData.summary.totalProfit || 0).toLocaleString("en-KE", {
                  minimumFractionDigits: 2,
                })}
              </strong>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="charts-section loader-fade-in">
          <div className="chart-container">
            <SkeletonChart />
          </div>
          <div className="chart-container">
            <SkeletonChart />
          </div>
        </div>
      ) : (
        <div className="charts-section">
          <div className="chart-container">
            <h3>Revenue Trends (Net)</h3>
            <div className="chart-placeholder">
              <div className="mini-chart">
                {revenueDisplay.map((value, index) => {
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
                <span>
                  {windowSize
                    ? `${windowSize} ${windowSize > 1 && (dateRange === "6m" || dateRange === "1y") ? "months" : "days"} trend`
                    : `${trendLabel} trend`}
                </span>
                <span>
                  KES{" "}
                  {revenueDisplay
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
                {profitDisplay.map((value, index) => {
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
                <span>
                  {windowSize
                    ? `${windowSize} ${windowSize > 1 && (dateRange === "6m" || dateRange === "1y") ? "months" : "days"} trend`
                    : `${trendLabel} trend`}
                </span>
                <span>
                  KES{" "}
                  {profitDisplay
                    .reduce((a, b) => a + (b || 0), 0)
                    .toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="tables-section loader-fade-in">
          <div className="table-container">
            <SkeletonTable rows={5} cols={5} />
          </div>
          <div className="table-container">
            <SkeletonTable rows={5} cols={5} />
          </div>
        </div>
      ) : (
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
                        <td data-label="Units Sold">
                          {medicine.unitsSold || 0}
                        </td>
                        <td data-label="Revenue">
                          KES{" "}
                          {(medicine.revenue || 0).toLocaleString("en-KE", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td data-label="Stock Status">
                          <span
                            className={`badge ${
                              medicine.stockStatus === "out_of_stock"
                                ? "badge-red"
                                : medicine.stockStatus === "low"
                                  ? "badge-amber"
                                  : medicine.stockStatus === "ok"
                                    ? "badge-green"
                                    : medicine.stockStatus === "not_found"
                                      ? "badge-gray"
                                      : "badge-gray"
                            }`}
                          >
                            {medicine.stockStatus === "out_of_stock"
                              ? "Out of Stock"
                              : medicine.stockStatus === "low"
                                ? "Low Stock"
                                : medicine.stockStatus === "ok"
                                  ? "In Stock"
                                  : medicine.stockStatus === "not_found"
                                    ? "Deleted"
                                    : "Unknown"}
                          </span>
                        </td>
                        <td data-label="Last Sale">
                          {medicine.lastSale
                            ? format(
                                new Date(medicine.lastSale),
                                "MMM dd, yyyy",
                              )
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
      )}
    </div>
  );
};

export default ReportsPage;
