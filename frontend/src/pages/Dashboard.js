import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  faBan,
  faChartLine,
  faCircleExclamation,
  faFileInvoiceDollar,
  faMoneyBillTrendUp,
  faPills,
  faTriangleExclamation,
  faCoins,
  faBox,
  faExclamationTriangle,
  faArrowsRotate,
  faChartBar,
  faRotateLeft,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import { format } from "date-fns";
import MetricCard from "../components/common/MetricCard";
import AppIcon from "../components/common/AppIcon";
import {
  SkeletonTable,
  SkeletonMetricRow,
  SkeletonCard,
} from "../components/common/SkeletonLoaders";
import useDelayedLoading from "../hooks/useDelayedLoading";

const STOCK_HEALTH_SEGMENTS = [
  { key: "healthy", label: "Healthy stock", color: "#62a87a" },
  { key: "low", label: "Low stock", color: "#e2a53a" },
  { key: "expired", label: "Expired stock", color: "#d56b70" },
  { key: "out", label: "Out of stock", color: "#778397" },
];

const formatKes = (value) =>
  `KES ${Number(value || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatCompactKes = (value) =>
  `KES ${Number(value || 0).toLocaleString("en-KE", {
    notation: "compact",
    maximumFractionDigits: 1,
  })}`;

const createSampleDashboardStats = () => {
  const salesTrend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const totals = [18240, 24680, 19850, 31240, 27560, 35890, 42560.75];
    const counts = [11, 15, 13, 19, 17, 22, 26];
    return { date: format(date, "yyyy-MM-dd"), total: totals[index], count: counts[index] };
  });
  const now = new Date();
  const saleDate = (minutesAgo) =>
    new Date(now.getTime() - minutesAgo * 60_000).toISOString();

  return {
    totalMedicines: 86,
    lowStockCount: 11,
    outOfStockCount: 6,
    expiredCount: 5,
    expiringSoonCount: 8,
    totalStockUnits: 3680,
    stockHealth: { healthy: 64, low: 11, out: 6, expired: 5 },
    salesTrend,
    inventoryValue: 348920,
    totalRevenue: 1284600,
    todaySales: { count: 26, total: 42560.75 },
    todayProfit: 11348.2,
    topProfitProducts: [
      { _id: "sample-profit-1", name: "Amoxicillin 500mg", stock: 120, estimatedStockProfit: 8400 },
      { _id: "sample-profit-2", name: "Omeprazole 20mg", stock: 85, estimatedStockProfit: 6375 },
      { _id: "sample-profit-3", name: "Cetirizine 10mg", stock: 96, estimatedStockProfit: 4320 },
    ],
    potentialLossItems: [
      { _id: "sample-loss-1", name: "Expired cough syrup", stock: 12, lossType: "EXPIRED", lossAmount: 3840 },
      { _id: "sample-loss-2", name: "Ibuprofen 400mg", stock: 20, lossType: "BELOW_COST", lossAmount: 1200 },
      { _id: "sample-loss-3", name: "Vitamin D drops", stock: 18, lossType: "EXPIRING_RISK", lossAmount: 1620 },
    ],
    totalPotentialLoss: 6660,
    criticalStockItems: [
      { _id: "sample-critical-1", name: "Salbutamol Inhaler", stock: 3 },
      { _id: "sample-critical-2", name: "Ferrous Sulfate 200mg", stock: 7 },
      { _id: "sample-critical-3", name: "ORS Sachets", stock: 9 },
    ],
    expiredItems: [
      { _id: "sample-expired-1", name: "Expired cough syrup", expiryDate: "2026-10-12T00:00:00.000Z" },
      { _id: "sample-expired-2", name: "Eye drops 10ml", expiryDate: "2026-09-28T00:00:00.000Z" },
    ],
    recentSales: [
      { _id: "sample-sale-1", createdAt: saleDate(12), total: 2840, servedBy: { username: "Amina" }, items: [{ medicineName: "Amoxicillin 500mg", quantity: 2 }, { medicineName: "Paracetamol 500mg", quantity: 4 }] },
      { _id: "sample-sale-2", createdAt: saleDate(38), total: 1650, servedBy: { username: "Daniel" }, items: [{ medicineName: "Cetirizine 10mg", quantity: 3 }] },
      { _id: "sample-sale-3", createdAt: saleDate(71), total: 3920, servedBy: { username: "Amina" }, items: [{ medicineName: "Omeprazole 20mg", quantity: 2 }, { medicineName: "Vitamin C 500mg", quantity: 2 }, { medicineName: "ORS Sachets", quantity: 6 }] },
      { _id: "sample-sale-4", createdAt: saleDate(126), total: 980, servedBy: { username: "Joseph" }, items: [{ medicineName: "Ibuprofen 400mg", quantity: 2 }] },
      { _id: "sample-sale-5", createdAt: saleDate(184), total: 2240, servedBy: { username: "Daniel" }, items: [{ medicineName: "Metformin 500mg", quantity: 2 }, { medicineName: "Vitamin C 500mg", quantity: 1 }] },
    ],
  };
};

function getSalesChartScale(maxValue) {
  if (!maxValue) return { max: 1, step: 0.25 };

  const rawStep = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalizedStep = rawStep / magnitude;
  const stepSize = [1, 2, 2.5, 5, 10].find(
    (candidate) => normalizedStep <= candidate,
  );
  const step = stepSize * magnitude;

  return { max: step * 4, step };
}

function StockHealthChart({ stockHealth = {} }) {
  const [activeKey, setActiveKey] = useState(null);
  const total = STOCK_HEALTH_SEGMENTS.reduce(
    (sum, segment) => sum + Number(stockHealth[segment.key] || 0),
    0,
  );
  const circumference = 2 * Math.PI * 72;
  let offset = 0;
  const segments = STOCK_HEALTH_SEGMENTS.map((segment) => {
    const value = Number(stockHealth[segment.key] || 0);
    const length = total ? (value / total) * circumference : 0;
    const current = { ...segment, value, length, offset };
    offset += length;
    return current;
  });
  const activeSegment = segments.find((segment) => segment.key === activeKey);

  return (
    <section
      className="dashboard-chart-card dashboard-chart-donut"
      aria-labelledby="stock-health-title"
      data-tour="dashboard-charts"
    >
      <div className="dashboard-chart-heading">
        <div>
          <span className="dashboard-section-kicker">INVENTORY MIX</span>
          <h2 id="stock-health-title">Stock health</h2>
        </div>
        <span className="dashboard-chart-period">Current</span>
      </div>
      <div className="dashboard-donut-layout">
        <div
          className="dashboard-donut"
          role="group"
          aria-label={`Inventory health across ${total} medicine batches`}
          onMouseLeave={() => setActiveKey(null)}
        >
          <svg viewBox="0 0 180 180">
            <circle className="dashboard-donut-track" cx="90" cy="90" r="72" />
            {segments.map((segment, index) =>
              segment.value > 0 ? (
                <circle
                  key={segment.key}
                  cx="90"
                  cy="90"
                  r="72"
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="22"
                  strokeDasharray={`${segment.length} ${circumference - segment.length}`}
                  strokeDashoffset={-segment.offset}
                  className="dashboard-donut-segment"
                  tabIndex={0}
                  role="button"
                  aria-label={`${segment.label}: ${segment.value} batches, ${total ? Math.round((segment.value / total) * 100) : 0}%`}
                  onMouseEnter={() => setActiveKey(segment.key)}
                  onFocus={() => setActiveKey(segment.key)}
                  onBlur={() => setActiveKey(null)}
                  onClick={() =>
                    setActiveKey((current) =>
                      current === segment.key ? null : segment.key,
                    )
                  }
                  style={{
                    "--segment-length": segment.length,
                    "--segment-gap": circumference - segment.length,
                    "--segment-delay": `${index * 70}ms`,
                    "--segment-opacity": activeKey && activeKey !== segment.key ? 0.42 : 1,
                    "--segment-width": activeKey === segment.key ? "28px" : "22px",
                  }}
                />
              ) : null,
            )}
          </svg>
          <div className="dashboard-donut-center">
            <span>{activeSegment?.label || "Total"}</span>
            <strong>{(activeSegment?.value ?? total).toLocaleString()}</strong>
            <small>
              {activeSegment
                ? `${total ? Math.round((activeSegment.value / total) * 100) : 0}% of batches`
                : "batches"}
            </small>
          </div>
        </div>
        <ul className={`dashboard-chart-legend${activeKey ? " has-active" : ""}`}>
          {segments.map((segment) => (
            <li
              key={segment.key}
              className={activeKey === segment.key ? "active" : ""}
              onMouseEnter={() => setActiveKey(segment.key)}
              onMouseLeave={() => setActiveKey(null)}
            >
              <span className="dashboard-legend-name">
                <span
                  className="dashboard-legend-swatch"
                  style={{ backgroundColor: segment.color }}
                />
                {segment.label}
              </span>
              <strong>
                {segment.value.toLocaleString()}
                <small>
                  {total
                    ? ` · ${Math.round((segment.value / total) * 100)}%`
                    : " · 0%"}
                </small>
              </strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function WeeklySalesChart({ salesTrend = [] }) {
  const maxTotal = Math.max(...salesTrend.map((day) => Number(day.total || 0)), 0);
  const { max: scaleMax, step } = getSalesChartScale(maxTotal);
  const chartTotal = salesTrend.reduce(
    (sum, day) => sum + Number(day.total || 0),
    0,
  );

  return (
    <section
      className="dashboard-chart-card dashboard-chart-sales"
      aria-labelledby="weekly-sales-title"
      data-tour="dashboard-sales-chart"
    >
      <div className="dashboard-chart-heading">
        <div>
          <span className="dashboard-section-kicker">SALES ACTIVITY</span>
          <h2 id="weekly-sales-title">Sales this week</h2>
        </div>
        <div className="dashboard-sales-summary">
          <strong>{formatKes(chartTotal)}</strong>
          <span>Last 7 days</span>
        </div>
      </div>
      <div
        className="dashboard-sales-chart"
        role="group"
        aria-label={`Daily sales revenue for the last seven days. Highest day: ${formatKes(maxTotal)}.`}
      >
        <div className="dashboard-chart-y-axis" aria-hidden="true">
          {[4, 3, 2, 1, 0].map((tick) => (
            <span key={tick}>
              {formatCompactKes(step * tick)}
            </span>
          ))}
        </div>
        <div className="dashboard-sales-columns">
          {[4, 3, 2, 1, 0].map((tick) => (
            <span
              key={tick}
              className="dashboard-chart-gridline"
              style={{ bottom: `${(tick / 4) * 100}%` }}
              aria-hidden="true"
            />
          ))}
          {salesTrend.map((day, index) => {
            const value = Number(day.total || 0);
            const dayDate = new Date(`${day.date}T12:00:00`);
            const label = Number.isNaN(dayDate.getTime())
              ? day.date
              : format(dayDate, "EEE");
            const fullDate = Number.isNaN(dayDate.getTime())
              ? day.date
              : format(dayDate, "EEEE, dd MMM");
            const height = value ? Math.max((value / scaleMax) * 100, 4) : 0;

            return (
              <div
                className="dashboard-sales-column"
                key={day.date}
                role="img"
                tabIndex={0}
                aria-label={`${fullDate}: ${formatKes(value)}, ${day.count || 0} sales`}
                style={{ "--bar-delay": `${180 + index * 55}ms` }}
              >
                <div className="dashboard-sales-bar-track">
                  <div
                    className="dashboard-sales-bar"
                    style={{ height: `${height}%` }}
                  />
                  <span className="dashboard-sales-tooltip" aria-hidden="true">
                    <strong>{formatKes(value)}</strong>
                    <small>{day.count || 0} sales · {fullDate}</small>
                  </span>
                </div>
                <span className="dashboard-sales-day">{label}</span>
                <span className="dashboard-sales-value">{formatCompactKes(value)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [samplePreview, setSamplePreview] = useState(
    () => new URLSearchParams(window.location.search).get("preview") === "sample",
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin" || user?.role === "main_admin";
  const showLoader = useDelayedLoading(loading);
  const isInitialLoading = loading && !stats && !samplePreview;
  const showSkeletons = isInitialLoading && showLoader;
  const sampleStats = useMemo(() => createSampleDashboardStats(), []);
  const displayStats = useMemo(() => {
    if (!samplePreview) return stats;
    if (isAdmin) return sampleStats;

    const operationalStats = { ...sampleStats };
    delete operationalStats.inventoryValue;
    delete operationalStats.totalRevenue;
    delete operationalStats.todayProfit;
    delete operationalStats.topProfitProducts;
    delete operationalStats.potentialLossItems;
    delete operationalStats.totalPotentialLoss;
    const dailyTotals = [6240, 7180, 5930, 8460, 7820, 9340, 10120];
    const dailyCounts = [4, 5, 3, 6, 5, 7, 8];
    return {
      ...operationalStats,
      salesTrend: sampleStats.salesTrend.map((day, index) => ({
        ...day,
        total: dailyTotals[index],
        count: dailyCounts[index],
      })),
      todaySales: { count: dailyCounts[dailyCounts.length - 1] },
      recentSales: sampleStats.recentSales.slice(0, 2).map((sale) => ({
        ...sale,
        servedBy: { username: user?.username || "Pharmacist" },
      })),
    };
  }, [samplePreview, stats, isAdmin, sampleStats, user?.username]);
  const setSamplePreviewMode = (enabled) => {
    setSamplePreview(enabled);
    const url = new URL(window.location.href);
    if (enabled) url.searchParams.set("preview", "sample");
    else url.searchParams.delete("preview");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };
  const metricLink = (path, metric) => (
    <button
      type="button"
      className="dashboard-metric-link"
      onClick={() => navigate(path)}
    >
      {metric}
    </button>
  );

  const fetchStats = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data } = await api.get("/dashboard/stats");
      if (data.success) setStats(data.data);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Listen for data change events to refresh dashboard stats
  useEffect(() => {
    const handleDataChange = (event) => {
      console.log("Dashboard received data change event:", event.detail);
      // Refresh stats when data changes (e.g., after returns, sales, etc.)
      fetchStats();
    };

    window.addEventListener("dataChanged", handleDataChange);
    return () => window.removeEventListener("dataChanged", handleDataChange);
  }, [fetchStats]);

  return (
    <div
      className={`dashboard-page${isInitialLoading ? "" : " dashboard-page--loaded"}`}
      aria-busy={isInitialLoading}
    >
      <div className="card dashboard-welcome dashboard-enter" style={{ marginBottom: 16 }}>
        <div className="card-body dashboard-head-card">
          <div className="dashboard-head-text">
            <span className="dashboard-eyebrow">PHARMACY OVERVIEW</span>
            <h2 className="dashboard-head-title">
              Welcome back, {user?.username || "there"}
            </h2>
            <p className="dashboard-head-sub">
              {isAdmin
                ? "Monitor financial performance, inventory health, and sales analytics."
                : "Track inventory status, alerts, and daily operations."}
            </p>
          </div>
          <img
            src="/dhaka-pharmacy-logo.jpg"
            alt="Dhaka Pharmacy logo"
            style={{ height: 64, width: "auto", objectFit: "contain" }}
          />
          <div className="dashboard-welcome-tools">
            <span className="dashboard-date-pill">
              {format(new Date(), "EEEE, dd MMM yyyy")}
            </span>
            <button
              type="button"
              className="dashboard-refresh"
              onClick={fetchStats}
              disabled={refreshing}
              aria-label="Refresh dashboard data"
              title="Refresh dashboard data"
            >
              <AppIcon
                icon={faArrowsRotate}
                className={refreshing ? "dashboard-refreshing" : ""}
              />
            </button>
          </div>
        </div>
      </div>

      {samplePreview && (
        <div className="dashboard-sample-banner" role="status">
          <strong>Sample data preview</strong>
          <span>Illustrative dashboard data only. Nothing has been saved to the pharmacy database.</span>
        </div>
      )}

      <section className="dashboard-overview-panel dashboard-enter" aria-labelledby="dashboard-overview-title">
        <div className="dashboard-section-heading">
          <div>
            <span className="dashboard-section-kicker">
              {samplePreview ? "SAMPLE PREVIEW" : "LIVE SNAPSHOT"}
            </span>
            <h2 id="dashboard-overview-title">Inventory &amp; sales snapshot</h2>
          </div>
          <div className="dashboard-snapshot-actions">
            <span className="dashboard-updated-label">
              <span className={samplePreview ? "dashboard-sample-dot" : "dashboard-live-dot"} />
              {samplePreview ? "Sample preview" : "Current overview"}
            </span>
            <button
              type="button"
              className="dashboard-preview-button"
              data-tour="dashboard-sample"
              onClick={() => setSamplePreviewMode(!samplePreview)}
              aria-pressed={samplePreview}
            >
              <AppIcon icon={samplePreview ? faRotateLeft : faChartBar} />
              {samplePreview ? "Show live data" : "Preview sample data"}
            </button>
          </div>
        </div>
      {showSkeletons ? (
        <SkeletonMetricRow
          count={isAdmin ? 8 : 7}
          gridClassName={`stats-grid dashboard-metrics-grid dashboard-metrics-grid--${isAdmin ? "admin" : "pharmacist"}`}
        />
      ) : isInitialLoading ? null : (
        <div
          className={`stats-grid dashboard-metrics-grid dashboard-metrics-grid--${isAdmin ? "admin" : "pharmacist"}`}
        >
          {/* Common metrics for all roles */}
          {metricLink(
            "/medicines",
            <MetricCard
              icon={faPills}
              label="Medicine Batches"
              value={displayStats?.totalMedicines}
              sub="In inventory"
              tone="primary"
              className="dashboard-metric--catalog"
            />,
          )}
          {metricLink(
            "/inventory?filter=low_stock",
            <MetricCard
              icon={faTriangleExclamation}
              label="Low Stock"
              value={displayStats?.lowStockCount}
              sub="Below 10 units"
              tone="warning"
              className="dashboard-metric--low"
            />,
          )}
          {metricLink(
            "/inventory?filter=out_of_stock",
            <MetricCard
              icon={faCircleExclamation}
              label="Out of Stock"
              value={displayStats?.outOfStockCount}
              sub="Zero units left"
              tone="danger"
              className="dashboard-metric--out"
            />,
          )}
          {metricLink(
            "/inventory?filter=expired",
            <MetricCard
              icon={faBan}
              label="Expired"
              value={displayStats?.expiredCount}
              sub="Past expiry date"
              tone="danger"
              className="dashboard-metric--expired"
            />,
          )}

          {/* Role-specific metrics */}
          {metricLink(
            "/sales",
            <MetricCard
              icon={faFileInvoiceDollar}
              label="Today's Sales"
              value={
                isAdmin
                  ? `KES ${(displayStats?.todaySales?.total || 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`
                  : `${displayStats?.todaySales?.count || 0} transaction${displayStats?.todaySales?.count !== 1 ? "s" : ""}`
              }
              sub={
                isAdmin
                  ? `${displayStats?.todaySales?.count || 0} transaction${displayStats?.todaySales?.count !== 1 ? "s" : ""}`
                  : "Completed today"
              }
              tone="success"
              className="dashboard-metric--sales"
            />,
          )}

          {isAdmin && (
            <>
              {metricLink(
                "/reports",
                <MetricCard
                icon={faChartLine}
                label="Today's Profit"
                value={`KES ${(displayStats?.todayProfit || 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`}
                sub="From completed sales"
                tone="success"
                className="dashboard-metric--profit"
                />,
              )}
              {metricLink(
                "/reports",
                <MetricCard
                icon={faCoins}
                label="Total Revenue"
                value={`KES ${(displayStats?.totalRevenue || 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`}
                sub="All time"
                tone="primary"
                className="dashboard-metric--revenue"
                />,
              )}
              {metricLink(
                "/inventory",
                <MetricCard
                icon={faBox}
                label="Inventory Value"
                value={`KES ${(displayStats?.inventoryValue || 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`}
                sub="Current stock value"
                tone="info"
                className="dashboard-metric--inventory-value"
                />,
              )}
            </>
          )}

          {!isAdmin && (
            <>
              {metricLink(
                "/inventory",
                <MetricCard
                icon={faExclamationTriangle}
                label="Expiring Soon"
                value={displayStats?.expiringSoonCount || 0}
                sub="Next 30 days"
                tone="warning"
                className="dashboard-metric--expiring"
                />,
              )}
              {metricLink(
                "/inventory",
                <MetricCard
                icon={faBox}
                label="Total Stock"
                value={displayStats?.totalStockUnits || 0}
                sub="Units in inventory"
                tone="info"
                className="dashboard-metric--stock"
                />,
              )}
            </>
          )}
        </div>
      )}
      </section>

      {!isInitialLoading && (
        <div className="dashboard-charts-grid dashboard-enter">
          <StockHealthChart stockHealth={displayStats?.stockHealth} />
          <WeeklySalesChart salesTrend={displayStats?.salesTrend} />
        </div>
      )}

      {showSkeletons ? (
        <SkeletonCard lines={4} showHeader={true} />
      ) : isInitialLoading ? null : isAdmin ? (
        <div className="card dashboard-panel dashboard-enter" style={{ marginBottom: 16 }}>
          <div className="card-header dashboard-panel-header">
            <div>
              <span className="dashboard-section-kicker">INVENTORY HEALTH</span>
              <h2>Product Profit / Loss Snapshot</h2>
            </div>
          </div>
          <div
            className="card-body"
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
              gap: 14,
            }}
          >
            <div className="dashboard-insight dashboard-insight-profit">
              <h3
                className="dashboard-insight-title--profit"
                style={{
                  marginBottom: 8,
                  color: "var(--secondary)",
                  fontSize: 16,
                }}
              >
                Top Potential Profit (in stock)
              </h3>
              {!displayStats?.topProfitProducts?.length ? (
                <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
                  No profit-leading products yet.
                </p>
              ) : (
                displayStats.topProfitProducts.map((p) => (
                  <div
                    key={p._id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 6,
                      fontSize: 13,
                    }}
                  >
                    <span>
                      {p.name} (x{p.stock})
                    </span>
                    <strong>
                      KES {Number(p.estimatedStockProfit).toFixed(2)}
                    </strong>
                  </div>
                ))
              )}
            </div>
            <div className="dashboard-insight dashboard-insight-risk">
              <h3
                className="dashboard-insight-title--risk"
                style={{
                  marginBottom: 8,
                  color: "var(--danger)",
                  fontSize: 16,
                }}
              >
                Potential Loss Items (in stock)
              </h3>
              {displayStats?.totalPotentialLoss > 0 && (
                <p className="dashboard-total-risk" style={{ fontSize: 13, marginBottom: 10, fontWeight: 600 }}>
                  Total at risk: KES {displayStats.totalPotentialLoss.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                </p>
              )}
              {!displayStats?.potentialLossItems?.length ? (
                <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
                  No loss-making products found.
                </p>
              ) : (
                <>
                  {displayStats.potentialLossItems.map((p) => {
                    const lossLabel =
                      p.lossType === "EXPIRED"
                        ? { text: "Expired", color: "var(--danger-700)" }
                        : p.lossType === "BELOW_COST"
                          ? { text: "Below cost", color: "var(--danger)" }
                          : { text: "Expiring risk", color: "var(--warning)" };
                    return (
                      <div
                        key={p._id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 6,
                          fontSize: 13,
                        }}
                      >
                        <span>
                          {p.name} (x{p.stock})
                          <span
                            className={`dashboard-loss-tag dashboard-loss-tag--${p.lossType.toLowerCase()}`}
                          >
                            {lossLabel.text}
                          </span>
                        </span>
                        <strong className={`dashboard-loss-amount dashboard-loss-amount--${p.lossType.toLowerCase()}`}>
                          KES {Number(p.lossAmount).toFixed(2)}
                        </strong>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="card dashboard-panel dashboard-enter" style={{ marginBottom: 16 }}>
          <div className="card-header dashboard-panel-header">
            <div>
              <span className="dashboard-section-kicker">NEEDS ATTENTION</span>
              <h2>Inventory Alerts</h2>
            </div>
          </div>
          <div
            className="card-body"
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
              gap: 14,
            }}
          >
            <div className="dashboard-insight dashboard-insight-risk">
              <h3
                className="dashboard-insight-title--stock"
                style={{
                  marginBottom: 8,
                  color: "var(--warning)",
                  fontSize: 16,
                }}
              >
                Critical Stock Levels
              </h3>
              {!displayStats?.criticalStockItems?.length ? (
                <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
                  All stock levels are healthy.
                </p>
              ) : (
                displayStats.criticalStockItems.map((p) => (
                  <div
                    key={p._id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 6,
                      fontSize: 13,
                    }}
                  >
                    <span>{p.name}</span>
                    <strong style={{ color: "var(--warning)" }}>
                      {p.stock} units left
                    </strong>
                  </div>
                ))
              )}
            </div>
            <div className="dashboard-insight dashboard-insight-expired">
              <h3
                className="dashboard-insight-title--expired"
                style={{
                  marginBottom: 8,
                  color: "var(--danger)",
                  fontSize: 16,
                }}
              >
                Expired Items
              </h3>
              {!displayStats?.expiredItems?.length ? (
                <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
                  No expired items found.
                </p>
              ) : (
                displayStats.expiredItems.slice(0, 5).map((p) => (
                  <div
                    key={p._id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 6,
                      fontSize: 13,
                    }}
                  >
                    <span>{p.name}</span>
                    <strong style={{ color: "var(--danger)" }}>
                      Expired {format(new Date(p.expiryDate), "MMM dd, yyyy")}
                    </strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card dashboard-panel dashboard-transactions dashboard-enter">
        <div className="card-header dashboard-panel-header">
          <div>
            <span className="dashboard-section-kicker">LATEST ACTIVITY</span>
            <h2>Recent Transactions</h2>
          </div>
          <button
            className="btn btn-secondary btn-sm dashboard-view-all"
            onClick={() => navigate("/sales")}
          >
            View All
          </button>
        </div>
        <div className="table-wrap table-responsive-cards dashboard-table-wrap">
          {showSkeletons ? (
            <div className="loader-fade-in">
              <SkeletonTable rows={5} cols={isAdmin ? 4 : 3} />
            </div>
          ) : isInitialLoading ? null : !displayStats?.recentSales?.length ? (
            <div className="empty-state">
              <div className="empty-icon">
                <AppIcon icon={faMoneyBillTrendUp} size="xl" tone="muted" />
              </div>
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
                {displayStats.recentSales.map((sale) => (
                  <tr key={sale._id}>
                    <td data-label="Date">
                      {format(new Date(sale.createdAt), "dd MMM yyyy, HH:mm")}
                    </td>
                    <td data-label="Items">
                      {sale.items.slice(0, 2).map((i) => (
                        <span
                          key={i.medicineName}
                          className="badge badge-blue"
                          style={{ marginRight: 4, marginBottom: 2 }}
                        >
                          {i.medicineName} ×{i.quantity}
                        </span>
                      ))}
                      {sale.items.length > 2 && (
                        <span className="badge badge-gray">
                          +{sale.items.length - 2} more
                        </span>
                      )}
                    </td>
                    <td
                      data-label="Served By"
                      style={{ color: "var(--gray-500)", fontSize: 13 }}
                    >
                      {sale.servedBy?.username || "–"}
                    </td>
                    {isAdmin && (
                      <td data-label="Total">
                        <strong style={{ color: "var(--secondary)" }}>
                          KES{" "}
                          {sale.total.toLocaleString("en-KE", {
                            minimumFractionDigits: 2,
                          })}
                        </strong>
                      </td>
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
