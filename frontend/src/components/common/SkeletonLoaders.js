import React from "react";

const COL_W = [
  "45%",
  "75%",
  "60%",
  "70%",
  "65%",
  "55%",
  "80%",
  "50%",
  "65%",
  "72%",
  "58%",
  "68%",
];
const BAR_H = [65, 45, 80, 55, 70, 40, 60];

const Bone = ({ width = "80%", height = 14, style = {} }) => (
  <div
    className="skeleton-shimmer"
    style={{ width, height, borderRadius: 4, ...style }}
    aria-hidden="true"
  />
);

export function SkeletonTable({ rows = 6, cols = 5 }) {
  return (
    <table
      style={{ width: "100%", borderCollapse: "collapse" }}
      aria-hidden="true"
    >
      <thead>
        <tr>
          {Array.from({ length: cols }).map((_, i) => (
            <th
              key={i}
              style={{
                padding: "12px 16px",
                textAlign: "left",
                borderBottom: "1px solid var(--gray-200)",
              }}
            >
              <Bone
                width={i === 0 ? "50%" : COL_W[i % COL_W.length]}
                height={12}
              />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r} style={{ borderBottom: "1px solid var(--gray-100)" }}>
            {Array.from({ length: cols }).map((_, c) => (
              <td key={c} style={{ padding: "14px 16px" }}>
                <Bone
                  width={c === cols - 1 ? "55%" : COL_W[(r + c) % COL_W.length]}
                  height={13}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SkeletonMetricRow({
  count = 4,
  gridClassName = "inventory-summary-grid",
}) {
  return (
    <div className={gridClassName} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="metric-card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 20px",
          }}
        >
          <div
            className="skeleton-shimmer"
            style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <Bone width="55%" height={11} style={{ marginBottom: 8 }} />
            <Bone width="40%" height={22} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonSummaryCards({ count = 4 }) {
  return (
    <div className="summary-cards" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="summary-card"
          style={{ display: "flex", gap: 14, alignItems: "center" }}
        >
          <div
            className="skeleton-shimmer"
            style={{ width: 48, height: 48, borderRadius: 10, flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <Bone width="50%" height={12} style={{ marginBottom: 10 }} />
            <Bone width="70%" height={24} style={{ marginBottom: 8 }} />
            <Bone width="40%" height={11} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div style={{ padding: "0 4px" }} aria-hidden="true">
      <Bone width="45%" height={14} style={{ marginBottom: 16 }} />
      <div
        style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}
      >
        {BAR_H.map((h, i) => (
          <div
            key={i}
            className="skeleton-shimmer"
            style={{ flex: 1, height: `${h}%`, borderRadius: "3px 3px 0 0" }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
        }}
      >
        <Bone width="30%" height={11} />
        <Bone width="30%" height={11} />
      </div>
    </div>
  );
}

export function SkeletonCard({ lines = 3, showHeader = true }) {
  return (
    <div className="card" aria-hidden="true">
      {showHeader && (
        <div className="card-header">
          <Bone width="40%" height={16} />
        </div>
      )}
      <div className="card-body" style={{ display: "grid", gap: 14 }}>
        {Array.from({ length: lines }).map((_, i) => (
          <Bone key={i} width={COL_W[i % COL_W.length]} height={13} />
        ))}
      </div>
    </div>
  );
}
