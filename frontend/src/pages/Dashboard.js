import React, { useEffect, useState, useCallback } from "react";
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

  return (
    <section className="dashboard-chart-card dashboard-chart-donut" aria-labelledby="stock-health-title">
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
          role="img"
          aria-label={`Inventory health across ${total} medicine batches`}
        >
          <svg viewBox="0 0 180 180" aria-hidden="true">
            <circle className="dashboard-donut-track" cx="90" cy="90" r="72" />
            {segments.map((segment) =>
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
                />
              ) : null,
            )}
          </svg>
          <div className="dashboard-donut-center">
            <span>Total</span>
            <strong>{total.toLocaleString()}</strong>
            <small>medicines</small>
          </div>
        </div>
        <ul className="dashboard-chart-legend">
          {segments.map((segment) => (
            <li key={segment.key}>
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
  const scaleMax = maxTotal || 1;

  return (
    <section className="dashboard-chart-card dashboard-chart-sales" aria-labelledby="weekly-sales-title">
      <div className="dashboard-chart-heading">
        <div>
          <span className="dashboard-section-kicker">SALES ACTIVITY</span>
          <h2 id="weekly-sales-title">Sales this week</h2>
        </div>
        <span className="dashboard-chart-period">Last 7 days</span>
      </div>
      <div
        className="dashboard-sales-chart"
        role="img"
        aria-label={`Daily sales revenue for the last seven days. Highest day: ${formatKes(maxTotal)}.`}
      >
        <div className="dashboard-chart-y-axis" aria-hidden="true">
          {[1, 0.75, 0.5, 0.25, 0].map((fraction) => (
            <span key={fraction}>
              {maxTotal ? formatKes(maxTotal * fraction) : formatKes(0)}
            </span>
          ))}
        </div>
        <div className="dashboard-sales-columns">
          {[1, 0.75, 0.5, 0.25, 0].map((fraction) => (
            <span
              key={fraction}
              className="dashboard-chart-gridline"
              style={{ bottom: `${fraction * 100}%` }}
              aria-hidden="true"
            />
          ))}
          {salesTrend.map((day) => {
            const value = Number(day.total || 0);
            const dayDate = new Date(`${day.date}T12:00:00`);
            const label = Number.isNaN(dayDate.getTime())
              ? day.date
              : format(dayDate, "EEE");
            const height = value ? Math.max((value / scaleMax) * 100, 4) : 0;

            return (
              <div
                className="dashboard-sales-column"
                key={day.date}
                title={`${format(dayDate, "EEEE, dd MMM")}: ${formatKes(value)} · ${day.count || 0} sales`}
              >
                <div className="dashboard-sales-bar-track">
                  <div
                    className="dashboard-sales-bar"
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className="dashboard-sales-day">{label}</span>
                <span className="dashboard-sales-value">{formatKes(value)}</span>
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin" || user?.role === "main_admin";
  const showLoader = useDelayedLoading(loading);

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
    <div className="dashboard-page">
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

      <section className="dashboard-overview-panel dashboard-enter" aria-labelledby="dashboard-overview-title">
        <div className="dashboard-section-heading">
          <div>
            <span className="dashboard-section-kicker">LIVE SNAPSHOT</span>
            <h2 id="dashboard-overview-title">Pharmacy Sales Results</h2>
          </div>
          <span className="dashboard-updated-label">
            <span className="dashboard-live-dot" />
            Current overview
          </span>
        </div>
      {showLoader ? (
        <SkeletonMetricRow count={isAdmin ? 8 : 6} gridClassName="stats-grid dashboard-metrics-grid" />
      ) : (
        <div className="stats-grid dashboard-metrics-grid">
          {/* Common metrics for all roles */}
          <div
            onClick={() => navigate("/medicines")}
            style={{ cursor: "pointer" }}
          >
            <MetricCard
              icon={faPills}
              label="Total Medicines"
              value={stats?.totalMedicines}
              sub="In database"
              tone="primary"
              className="dashboard-metric--catalog"
            />
          </div>
          <div
            onClick={() => navigate("/inventory?filter=low_stock")}
            style={{ cursor: "pointer" }}
          >
            <MetricCard
              icon={faTriangleExclamation}
              label="Low Stock"
              value={stats?.lowStockCount}
              sub="Below 10 units"
              tone="warning"
              className="dashboard-metric--low"
            />
          </div>
          <div
            onClick={() => navigate("/inventory?filter=out_of_stock")}
            style={{ cursor: "pointer" }}
          >
            <MetricCard
              icon={faCircleExclamation}
              label="Out of Stock"
              value={stats?.outOfStockCount}
              sub="Zero units left"
              tone="danger"
              className="dashboard-metric--out"
            />
          </div>
          <div
            onClick={() => navigate("/inventory?filter=expired")}
            style={{ cursor: "pointer" }}
          >
            <MetricCard
              icon={faBan}
              label="Expired"
              value={stats?.expiredCount}
              sub="Past expiry date"
              tone="danger"
              className="dashboard-metric--expired"
            />
          </div>

          {/* Role-specific metrics */}
          <div onClick={() => navigate("/sales")} style={{ cursor: "pointer" }}>
            <MetricCard
              icon={faFileInvoiceDollar}
              label="Today's Sales"
              value={
                isAdmin
                  ? `KES ${(stats?.todaySales?.total || 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`
                  : `${stats?.todaySales?.count || 0} transaction${stats?.todaySales?.count !== 1 ? "s" : ""}`
              }
              sub={
                isAdmin
                  ? `${stats?.todaySales?.count || 0} transaction${stats?.todaySales?.count !== 1 ? "s" : ""}`
                  : "Completed today"
              }
              tone="success"
              className="dashboard-metric--sales"
            />
          </div>

          {isAdmin && (
            <>
              <MetricCard
                icon={faChartLine}
                label="Today's Profit"
                value={`KES ${(stats?.todayProfit || 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`}
                sub="From completed sales"
                tone="success"
                className="dashboard-metric--profit"
              />
              <MetricCard
                icon={faCoins}
                label="Total Revenue"
                value={`KES ${(stats?.totalRevenue || 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`}
                sub="All time"
                tone="primary"
                className="dashboard-metric--revenue"
              />
              <MetricCard
                icon={faBox}
                label="Inventory Value"
                value={`KES ${(stats?.inventoryValue || 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`}
                sub="Current stock value"
                tone="info"
                className="dashboard-metric--inventory-value"
              />
            </>
          )}

          {!isAdmin && (
            <>
              <MetricCard
                icon={faExclamationTriangle}
                label="Expiring Soon"
                value={stats?.expiringSoonCount || 0}
                sub="Next 30 days"
                tone="warning"
                className="dashboard-metric--expiring"
              />
              <MetricCard
                icon={faBox}
                label="Total Stock"
                value={stats?.totalStockUnits || 0}
                sub="Units in inventory"
                tone="info"
                className="dashboard-metric--stock"
              />
            </>
          )}
        </div>
      )}
      </section>

      {!showLoader && (
        <div className="dashboard-charts-grid dashboard-enter">
          <StockHealthChart stockHealth={stats?.stockHealth} />
          <WeeklySalesChart salesTrend={stats?.salesTrend} />
        </div>
      )}

      {showLoader ? (
        <SkeletonCard lines={4} showHeader={true} />
      ) : isAdmin ? (
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
                style={{
                  marginBottom: 8,
                  color: "var(--secondary)",
                  fontSize: 16,
                }}
              >
                Top Potential Profit (in stock)
              </h3>
              {!stats?.topProfitProducts?.length ? (
                <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
                  No profit-leading products yet.
                </p>
              ) : (
                stats.topProfitProducts.map((p) => (
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
                style={{
                  marginBottom: 8,
                  color: "var(--danger)",
                  fontSize: 16,
                }}
              >
                Potential Loss Items (in stock)
              </h3>
              {stats?.totalPotentialLoss > 0 && (
                <p style={{ fontSize: 13, color: "var(--danger-700)", marginBottom: 10, fontWeight: 600 }}>
                  Total at risk: KES {stats.totalPotentialLoss.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                </p>
              )}
              {!stats?.potentialLossItems?.length ? (
                <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
                  No loss-making products found.
                </p>
              ) : (
                <>
                  {stats.potentialLossItems.map((p) => {
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
                            style={{
                              display: "inline-block",
                              marginLeft: 6,
                              padding: "0 6px",
                              fontSize: 10,
                              fontWeight: 600,
                              borderRadius: 4,
                              background: lossLabel.color,
                              color: "#fff",
                            }}
                          >
                            {lossLabel.text}
                          </span>
                        </span>
                        <strong style={{ color: lossLabel.color }}>
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
                style={{
                  marginBottom: 8,
                  color: "var(--warning)",
                  fontSize: 16,
                }}
              >
                Critical Stock Levels
              </h3>
              {!stats?.criticalStockItems?.length ? (
                <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
                  All stock levels are healthy.
                </p>
              ) : (
                stats.criticalStockItems.map((p) => (
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
                style={{
                  marginBottom: 8,
                  color: "var(--danger)",
                  fontSize: 16,
                }}
              >
                Expired Items
              </h3>
              {!stats?.expiredItems?.length ? (
                <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
                  No expired items found.
                </p>
              ) : (
                stats.expiredItems.slice(0, 5).map((p) => (
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
          {showLoader ? (
            <div className="loader-fade-in">
              <SkeletonTable rows={5} cols={isAdmin ? 4 : 3} />
            </div>
          ) : !stats?.recentSales?.length ? (
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
                {stats.recentSales.map((sale) => (
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
