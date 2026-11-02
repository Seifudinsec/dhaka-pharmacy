import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  faChartLine,
  faChartBar,
  faDownload,
  faCoins,
  faArrowTrendUp,
  faRotateLeft,
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
  dailySeries: [],
  previousDailySeries: [],
  saleOutcomes: { completed: 0, partiallyReturned: 0, fullyRefunded: 0 },
  topMedicines: [],
  lowPerformingMedicines: [],
  refundCount: 0,
  period: null,
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
    growthComparable: false,
    previousRevenue: 0,
  },
};

const numberOrZero = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const createSampleReportData = (source) => {
  const sourceDays = source.dailySeries;
  if (!sourceDays.length) return source;

  let partialReturnCount = 0;
  let fullyRefundedCount = 0;
  let refundProfitLoss = 0;
  const dailySeries = sourceDays.map(({ date }, index) => {
    const active = index % 9 !== 0 && index % 13 !== 0;
    const grossSales = active ? 1 + ((index * 7) % 5) : 0;
    const unitRevenue = grossSales ? 95 + ((index * 43) % 165) : 0;
    const grossRevenue = grossSales * unitRevenue;
    const margin = 0.2 + ((index % 4) * 0.035);
    const fullyRefunded = grossSales > 0 && index % 17 === 9 ? 1 : 0;
    const partialReturn =
      grossSales > fullyRefunded && index % 11 === 5
        ? Number((grossRevenue * 0.12).toFixed(2))
        : 0;
    const fullRefund = fullyRefunded ? unitRevenue : 0;
    const refunds = Number((partialReturn + fullRefund).toFixed(2));
    const dayRefundProfitLoss = Number(
      (partialReturn * margin + fullRefund * margin).toFixed(2),
    );
    if (partialReturn > 0) partialReturnCount += 1;
    if (fullyRefunded) fullyRefundedCount += 1;
    refundProfitLoss += dayRefundProfitLoss;
    return {
      date,
      sales: grossSales - fullyRefunded,
      revenue: Number((grossRevenue - refunds).toFixed(2)),
      profit: Number(
        (grossRevenue * margin - dayRefundProfitLoss).toFixed(2),
      ),
      refunds,
    };
  });
  const previousDailySeries = source.previousDailySeries.map(({ date }, index) => {
    const active = index % 8 !== 0 && index % 12 !== 0;
    const sales = active ? 1 + ((index * 5 + 2) % 4) : 0;
    const revenue = sales ? sales * (82 + ((index * 37 + 29) % 145)) : 0;
    const refunds = index % 13 === 4 ? Number((revenue * 0.08).toFixed(2)) : 0;
    return {
      date,
      revenue: Number((revenue - refunds).toFixed(2)),
    };
  });
  const totalRevenue = Number(
    dailySeries.reduce((sum, day) => sum + day.revenue, 0).toFixed(2),
  );
  const totalProfit = Number(
    dailySeries.reduce((sum, day) => sum + day.profit, 0).toFixed(2),
  );
  const totalRefunds = Number(
    dailySeries.reduce((sum, day) => sum + day.refunds, 0).toFixed(2),
  );
  const previousRevenue = Number(
    previousDailySeries.reduce((sum, day) => sum + day.revenue, 0).toFixed(2),
  );
  const totalSales = dailySeries.reduce((sum, day) => sum + day.sales, 0);
  const refundCount = partialReturnCount + fullyRefundedCount;
  const topMedicines = [
    { name: "Amoxicillin 500mg", share: 0.28, unitShare: 0.23, refundRate: 1.2 },
    { name: "Paracetamol 500mg", share: 0.19, unitShare: 0.2, refundRate: 0.4 },
    { name: "Cetirizine 10mg", share: 0.15, unitShare: 0.16, refundRate: 0 },
    { name: "Omeprazole 20mg", share: 0.11, unitShare: 0.12, refundRate: 0.8 },
    { name: "Vitamin C 500mg", share: 0.07, unitShare: 0.1, refundRate: 0 },
  ].map((medicine) => {
    const revenue = Number((totalRevenue * medicine.share).toFixed(2));
    const profit = Number((revenue * 0.3).toFixed(2));
    return {
      name: medicine.name,
      unitsSold: Math.max(1, Math.round(totalSales * medicine.unitShare)),
      revenue,
      profit,
      profitMargin: 30,
      refundRate: medicine.refundRate,
    };
  });
  const lowPerformingMedicines = [
    { name: "Salbutamol Inhaler", unitsSold: Math.max(0, Math.round(totalSales * 0.045)), revenue: Number((totalRevenue * 0.025).toFixed(2)), refundRate: 0, stockStatus: "ok", lastSale: dailySeries[Math.max(0, dailySeries.length - 3)]?.date },
    { name: "Ferrous Sulfate 200mg", unitsSold: Math.max(0, Math.round(totalSales * 0.03)), revenue: Number((totalRevenue * 0.015).toFixed(2)), refundRate: 0, stockStatus: "low", lastSale: dailySeries[Math.max(0, dailySeries.length - 6)]?.date },
    { name: "Calcium + Vitamin D", unitsSold: Math.max(0, Math.round(totalSales * 0.015)), revenue: Number((totalRevenue * 0.008).toFixed(2)), refundRate: 0, stockStatus: "out_of_stock", lastSale: dailySeries[Math.max(0, dailySeries.length - 10)]?.date },
  ];

  return {
    ...source,
    dailySeries,
    previousDailySeries,
    topMedicines,
    lowPerformingMedicines,
    refundCount,
    saleOutcomes: {
      completed: Math.max(0, totalSales - partialReturnCount),
      partiallyReturned: partialReturnCount,
      fullyRefunded: fullyRefundedCount,
    },
    summary: {
      ...source.summary,
      totalRevenue,
      totalProfit,
      totalSales,
      totalRefunds,
      grossRevenue: Number((totalRevenue + totalRefunds).toFixed(2)),
      grossProfit: Number((totalProfit + refundProfitLoss).toFixed(2)),
      refundProfitLoss: Number(refundProfitLoss.toFixed(2)),
      averageSaleValue: totalSales ? Number((totalRevenue / totalSales).toFixed(2)) : 0,
      profitMargin: totalRevenue ? Number(((totalProfit / totalRevenue) * 100).toFixed(2)) : 0,
      growthComparable: previousRevenue > 0,
      previousRevenue,
      growthRate: previousRevenue
        ? Number((((totalRevenue - previousRevenue) / previousRevenue) * 100).toFixed(2))
        : 0,
    },
  };
};

const formatKes = (value, compact = false) =>
  `KES ${Number(value || 0).toLocaleString("en-KE", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: compact ? 0 : 2,
  })}`;

const formatTrendDate = (date, interval) => {
  const parsed = parseISO(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return format(parsed, interval === "month" ? "MMM yy" : "dd MMM");
};

const getTrendInterval = (range, dayCount) => {
  if (range === "1y" || (range === "custom" && dayCount > 366)) return "month";
  if (["90d", "6m"].includes(range) || (range === "custom" && dayCount > 90)) {
    return "week";
  }
  return "day";
};

const buildTrendPoints = (dailySeries, range) => {
  const daily = Array.isArray(dailySeries) ? dailySeries : [];
  const interval = getTrendInterval(range, daily.length);
  const groups = new Map();

  daily.forEach((entry) => {
    const date = parseISO(entry.date);
    if (Number.isNaN(date.getTime())) return;
    const bucket =
      interval === "month"
        ? startOfMonth(date)
        : interval === "week"
          ? startOfWeek(date, { weekStartsOn: 1 })
          : date;
    const key = format(bucket, "yyyy-MM-dd");
    const point = groups.get(key) || {
      date: key,
      revenue: 0,
      profit: 0,
      sales: 0,
      refunds: 0,
    };
    point.revenue += numberOrZero(entry.revenue);
    point.profit += numberOrZero(entry.profit);
    point.sales += numberOrZero(entry.sales);
    point.refunds += numberOrZero(entry.refunds);
    groups.set(key, point);
  });

  return [...groups.values()].map((point) => ({
    ...point,
    interval,
    label: formatTrendDate(point.date, interval),
    activityLabel: format(
      parseISO(point.date),
      interval === "month" ? "MMM" : interval === "week" ? "dd MMM" : "d",
    ),
    revenue: Number(point.revenue.toFixed(2)),
    profit: Number(point.profit.toFixed(2)),
    refunds: Number(point.refunds.toFixed(2)),
  }));
};

const compactPoints = (points, limit = 14) => {
  if (points.length <= limit) return points;
  const bucketCount = Math.min(limit, points.length);
  return Array.from({ length: bucketCount }, (_, index) => {
    const start = Math.floor((index * points.length) / bucketCount);
    const end = Math.floor(((index + 1) * points.length) / bucketCount);
    const group = points.slice(start, end);
    const totals = group.reduce(
      (result, point) => {
        result.revenue += numberOrZero(point.revenue);
        result.profit += numberOrZero(point.profit);
        result.sales += numberOrZero(point.sales);
        result.refunds += numberOrZero(point.refunds);
        result.previousRevenue += numberOrZero(point.previousRevenue);
        return result;
      },
      { revenue: 0, profit: 0, sales: 0, refunds: 0, previousRevenue: 0 },
    );
    const first = group[0];
    const last = group[group.length - 1];
    return {
      ...totals,
      date: first.date,
      label: first.label === last.label ? first.label : `${first.label}–${last.label}`,
      activityLabel: first.activityLabel,
    };
  });
};

function RevenueBarChart({ points }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const width = 760;
  const height = 270;
  const plot = { left: 58, right: 18, top: 20, bottom: 42 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const bars = compactPoints(points);
  const values = bars.map((point) => point.revenue);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const spread = maxValue - minValue || 1;
  const scaleMax = maxValue + spread * 0.12;
  const scaleMin = minValue < 0 ? minValue - spread * 0.12 : 0;
  const scaleRange = scaleMax - scaleMin || 1;
  const y = (value) => plot.top + ((scaleMax - value) / scaleRange) * plotHeight;
  const baseline = y(0);
  const tickValues = Array.from({ length: 5 }, (_, index) => scaleMin + (scaleRange * index) / 4);
  const labelIndexes = [...new Set(
    [0, Math.round((bars.length - 1) / 2), bars.length - 1].filter(
      (index) => index >= 0,
    ),
  )];
  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      setActiveIndex(null);
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setActiveIndex((index) => {
      const current = index ?? 0;
      const direction = event.key === "ArrowRight" ? 1 : -1;
      return (current + direction + bars.length) % bars.length;
    });
  };
  const activePoint = activeIndex === null ? null : bars[activeIndex];
  const tooltipLeft =
    activeIndex === null
      ? null
      : Math.max(
          12,
          Math.min(88, ((plot.left + (plotWidth / bars.length) * (activeIndex + 0.5)) / width) * 100),
        );

  if (!points.length || !values.some((value) => value !== 0)) {
    return <div className="reports-empty-chart">No revenue recorded in this period yet.</div>;
  }

  return (
    <div className="reports-svg-wrap reports-chart-hover-wrap">
      <svg
        className="reports-trend-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        tabIndex={0}
        aria-label="Net revenue by day, week, or month in the selected period"
        onKeyDown={handleKeyDown}
        onPointerMove={(event) => {
          if (event.pointerType === "touch") return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const viewBoxX = ((event.clientX - bounds.left) / bounds.width) * width;
          const index = Math.max(
            0,
            Math.min(
              bars.length - 1,
              Math.floor(((viewBoxX - plot.left) / plotWidth) * bars.length),
            ),
          );
          setActiveIndex(index);
        }}
        onPointerLeave={() => setActiveIndex(null)}
      >
        <defs>
          <linearGradient id="reports-revenue-bar-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#52b79a" />
            <stop offset="100%" stopColor="#23816c" />
          </linearGradient>
        </defs>
        {tickValues.map((value, index) => {
          const tickY = y(value);
          return (
            <g key={index}>
              <line
                x1={plot.left}
                x2={width - plot.right}
                y1={tickY}
                y2={tickY}
                className="reports-chart-grid"
              />
              <text x={plot.left - 10} y={tickY + 4} textAnchor="end" className="reports-chart-axis">
                {formatKes(value, true).replace("KES ", "")}
              </text>
            </g>
          );
        })}
        <line x1={plot.left} x2={width - plot.right} y1={baseline} y2={baseline} className="reports-chart-baseline" />
        {activeIndex !== null && (
          <line
            x1={plot.left + (plotWidth / bars.length) * (activeIndex + 0.5)}
            x2={plot.left + (plotWidth / bars.length) * (activeIndex + 0.5)}
            y1={plot.top}
            y2={plot.top + plotHeight}
            className="reports-chart-crosshair"
          />
        )}
        {bars.map((point, index) => {
          const slotWidth = plotWidth / bars.length;
          const barWidth = Math.min(30, slotWidth * 0.56);
          const valueY = y(point.revenue);
          const barHeight = Math.max(1, Math.abs(baseline - valueY));
          return (
            <g key={`${point.date}-${index}`} className={activeIndex === index ? "reports-chart-active" : ""}>
              <rect
                x={plot.left + slotWidth * index + (slotWidth - barWidth) / 2}
                y={Math.min(baseline, valueY)}
                width={barWidth}
                height={Math.max(1, barHeight)}
                rx="4"
                className={`${point.revenue < 0 ? "reports-revenue-bar negative" : "reports-revenue-bar"}${point.revenue === 0 ? " zero" : ""}`}
                style={{ "--bar-delay": `${index * 35}ms` }}
              />
              <rect
                x={plot.left + slotWidth * index}
                y={plot.top}
                width={slotWidth}
                height={plotHeight}
                fill="transparent"
                className="reports-chart-hit-area"
                aria-label={`${point.label}: ${formatKes(point.revenue)} net revenue, ${point.sales} sales, ${formatKes(point.profit)} profit, ${formatKes(point.refunds)} refunds`}
                onPointerEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                tabIndex={0}
                role="button"
              />
            </g>
          );
        })}
        {labelIndexes.map((index) => (
          <text
            key={bars[index]?.date || index}
            x={plot.left + (plotWidth / bars.length) * (index + 0.5)}
            y={height - 12}
            textAnchor="middle"
            className="reports-chart-axis"
          >
            {bars[index].label}
          </text>
        ))}
      </svg>
      {activePoint && (
        <div className="reports-chart-tooltip" style={{ left: `${tooltipLeft}%` }} role="status">
          <strong>{activePoint.label}</strong>
          <span><i className="selected-period" />Revenue · {formatKes(activePoint.revenue)}</span>
          <span><i className="profit-period" />Profit · {formatKes(activePoint.profit)}</span>
          <span><i className="refund-period" />Refunds · {formatKes(activePoint.refunds)}</span>
          <span><i className="sales-period" />Transactions · {activePoint.sales}</span>
        </div>
      )}
    </div>
  );
}

function Sparkline({ points, metric, color, label, emptyMessage }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const values = points.map((point) => numberOrZero(point[metric]));
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const spread = max - min || 1;
  const width = 260;
  const height = 70;
  const sparkX = (index) =>
    values.length <= 1 ? width / 2 : (index / (values.length - 1)) * width;
  const sparkY = (value) => 8 + ((max - value) / spread) * (height - 16);
  const activeIndexes = values.flatMap((value, index) =>
    value === 0 ? [] : [index],
  );
  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      setActiveIndex(null);
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setActiveIndex((index) => {
      const current = index ?? 0;
      const direction = event.key === "ArrowRight" ? 1 : -1;
      return (current + direction + values.length) % values.length;
    });
  };
  const activePoint = activeIndex === null ? null : points[activeIndex];
  const path = values
    .map((value, index) => {
      return `${index === 0 ? "M" : "L"} ${sparkX(index)} ${sparkY(value)}`;
    })
    .join(" ");
  const areaPath =
    values.length > 1 && activeIndexes.length > 1
      ? `${path} L ${width} ${height - 5} L 0 ${height - 5} Z`
      : null;
  if (!values.length || !values.some((value) => value !== 0)) {
    return <div className="reports-empty-sparkline">{emptyMessage}</div>;
  }
  return (
    <div className="reports-sparkline-wrap">
    <svg
      className="reports-sparkline"
      viewBox={`0 0 ${width} ${height}`}
      role="group"
      tabIndex={0}
      aria-label={label}
      onKeyDown={handleKeyDown}
      onPointerMove={(event) => {
        if (event.pointerType === "touch") return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const viewBoxX = ((event.clientX - bounds.left) / bounds.width) * width;
        const index = Math.max(
          0,
          Math.min(
            points.length - 1,
            Math.round((viewBoxX / width) * (points.length - 1)),
          ),
        );
        setActiveIndex(index);
      }}
      onPointerLeave={() => setActiveIndex(null)}
      onFocus={() => setActiveIndex((index) => index ?? 0)}
    >
      <defs>
        <linearGradient id={`reports-spark-fill-${metric}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".17" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {areaPath && <path d={areaPath} fill={`url(#reports-spark-fill-${metric})`} />}
      {activeIndexes.length > 1 && (
        <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength="1" className="reports-chart-line" />
      )}
      {activeIndexes.length === 1 && (
        <circle
          cx={sparkX(activeIndexes[0])}
          cy={sparkY(values[activeIndexes[0]])}
          r="5"
          fill="var(--workspace-panel)"
          stroke={color}
          strokeWidth="3"
          className="reports-sparkline-point"
        >
          <title>{label}: {numberOrZero(values[activeIndexes[0]])}</title>
        </circle>
      )}
      {activeIndex !== null && (
        <g className="reports-sparkline-active">
          <line
            x1={sparkX(activeIndex)}
            x2={sparkX(activeIndex)}
            y1="4"
            y2={height - 4}
            className="reports-chart-crosshair"
          />
          <circle
            cx={sparkX(activeIndex)}
            cy={sparkY(values[activeIndex])}
            r="5"
            fill="var(--workspace-panel)"
            stroke={color}
            strokeWidth="3"
          />
        </g>
      )}
    </svg>
    {activePoint && (
      <div className="reports-sparkline-tooltip" role="status">
        <strong>{activePoint.label}</strong>
        <span>{metric === "sales" ? `${numberOrZero(activePoint[metric])} transactions` : formatKes(activePoint[metric])}</span>
      </div>
    )}
    </div>
  );
}

function ComparisonChart({ points }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const chartPoints = compactPoints(points);
  const width = 760;
  const height = 270;
  const plot = { left: 58, right: 18, top: 20, bottom: 42 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const values = chartPoints.flatMap((point) => [point.revenue, point.previousRevenue]);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const spread = maxValue - minValue || 1;
  const scaleMin = minValue < 0 ? minValue - spread * 0.12 : 0;
  const scaleMax = maxValue + spread * 0.12;
  const scaleRange = scaleMax - scaleMin || 1;
  const x = (index) =>
    plot.left +
    (chartPoints.length <= 1 ? plotWidth / 2 : (index / (chartPoints.length - 1)) * plotWidth);
  const y = (value) => plot.top + ((scaleMax - value) / scaleRange) * plotHeight;
  const curvePath = (key) => {
    if (chartPoints.length < 3) {
      return chartPoints
        .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point[key])}`)
        .join(" ");
    }

    return chartPoints.reduce((path, point, index) => {
      if (index === 0) return `M ${x(0)} ${y(point[key])}`;
      const previous = chartPoints[index - 1];
      const beforePrevious = chartPoints[Math.max(0, index - 2)];
      const next = chartPoints[Math.min(chartPoints.length - 1, index + 1)];
      const control1X = x(index - 1) + (x(index) - x(index - 1)) / 3;
      const control1YUnclamped =
        y(previous[key]) + (y(point[key]) - y(beforePrevious[key])) / 6;
      const control2X = x(index) - (x(index) - x(index - 1)) / 3;
      const control2YUnclamped =
        y(point[key]) - (y(next[key]) - y(previous[key])) / 6;
      const segmentMinY = Math.min(y(previous[key]), y(point[key]));
      const segmentMaxY = Math.max(y(previous[key]), y(point[key]));
      const control1Y = Math.max(
        segmentMinY,
        Math.min(segmentMaxY, control1YUnclamped),
      );
      const control2Y = Math.max(
        segmentMinY,
        Math.min(segmentMaxY, control2YUnclamped),
      );
      return `${path} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${x(index)} ${y(point[key])}`;
    }, "");
  };
  const revenuePath = curvePath("revenue");
  const revenueArea =
    chartPoints.length > 1
      ? `${revenuePath} L ${x(chartPoints.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`
      : null;
  const series = [
    { key: "revenue", color: "#23816c", label: "Selected period", dashed: false },
    { key: "previousRevenue", color: "#5277d5", label: "Previous period", dashed: true },
  ];
  const labelIndexes = [...new Set([0, Math.round((chartPoints.length - 1) / 2), chartPoints.length - 1].filter((index) => index >= 0))];
  if (
    !chartPoints.length ||
    !values.some((value) => value !== 0)
  ) {
    return <div className="reports-empty-chart">Period comparisons appear after sales are recorded.</div>;
  }
  const handlePointerMove = (event) => {
    if (chartPoints.length < 2) {
      setHoveredIndex(0);
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const viewBoxX = ((event.clientX - bounds.left) / bounds.width) * width;
    const nearest = chartPoints.reduce(
      (best, point, index) =>
        Math.abs(x(index) - viewBoxX) < Math.abs(x(best) - viewBoxX)
          ? index
          : best,
      0,
    );
    setHoveredIndex(nearest);
  };
  const hoveredPoint =
    hoveredIndex === null ? null : chartPoints[hoveredIndex];
  const tooltipLeft =
    hoveredIndex === null
      ? null
      : Math.max(14, Math.min(86, (x(hoveredIndex) / width) * 100));
  return (
    <div className="reports-svg-wrap reports-chart-hover-wrap">
      <svg
        className="reports-trend-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        tabIndex={0}
        aria-label="Net revenue grouped by the selected interval, compared with the previous period of the same length"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setHoveredIndex(null);
            return;
          }
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          setHoveredIndex((index) => {
            const current = index ?? 0;
            const direction = event.key === "ArrowRight" ? 1 : -1;
            return (current + direction + chartPoints.length) % chartPoints.length;
          });
        }}
        onFocus={() => setHoveredIndex((index) => index ?? 0)}
        onMouseMove={handlePointerMove}
        onMouseLeave={() => setHoveredIndex(null)}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <linearGradient id="reports-comparison-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#23816c" stopOpacity=".22" />
            <stop offset="90%" stopColor="#23816c" stopOpacity=".02" />
          </linearGradient>
        </defs>
        {Array.from({ length: 5 }, (_, index) => {
          const value = scaleMin + (scaleRange * index) / 4;
          const tickY = y(value);
          return (
            <g key={index}>
              <line x1={plot.left} x2={width - plot.right} y1={tickY} y2={tickY} className="reports-chart-grid" />
              <text x={plot.left - 10} y={tickY + 4} textAnchor="end" className="reports-chart-axis">{formatKes(value, true).replace("KES ", "")}</text>
            </g>
          );
        })}
        {revenueArea && <path d={revenueArea} fill="url(#reports-comparison-fill)" />}
        {hoveredIndex !== null && (
          <line
            x1={x(hoveredIndex)}
            x2={x(hoveredIndex)}
            y1={plot.top}
            y2={plot.top + plotHeight}
            className="reports-chart-crosshair"
          />
        )}
        {series.map((item) => {
          const path = curvePath(item.key);
          return (
            <g key={item.key}>
              <path
                d={path}
                fill="none"
                stroke={item.color}
                strokeWidth={item.dashed ? "2.5" : "3"}
                strokeDasharray={item.dashed ? "6 7" : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={item.dashed ? undefined : "1"}
                className={item.dashed ? "reports-comparison-dashed" : "reports-chart-line"}
              />
              {chartPoints.map((point, index) => {
                const showPoint =
                  hoveredIndex === index ||
                  (item.key === "revenue" && point.revenue !== 0);
                if (!showPoint) return null;
                return (
                <g key={`${item.key}-${point.date}`}>
                  <circle
                    cx={x(index)}
                    cy={y(point[item.key])}
                    r={hoveredIndex === index ? "5" : "2.5"}
                    fill={hoveredIndex === index ? "var(--workspace-panel)" : item.color}
                    stroke={item.color}
                    strokeWidth={hoveredIndex === index ? "2.5" : "0"}
                    className="reports-comparison-point"
                  >
                    <title>{point.label}: {item.label} · {formatKes(point[item.key])}</title>
                  </circle>
                </g>
                );
              })}
            </g>
          );
        })}
        {labelIndexes.map((index) => (
          <text key={chartPoints[index]?.date || index} x={x(index)} y={height - 12} textAnchor={index === 0 ? "start" : index === chartPoints.length - 1 ? "end" : "middle"} className="reports-chart-axis">{chartPoints[index].label}</text>
        ))}
      </svg>
      {hoveredPoint && (
        <div className="reports-chart-tooltip" style={{ left: `${tooltipLeft}%` }}>
          <strong>{hoveredPoint.label}</strong>
          <span><i className="selected-period" />Selected · {formatKes(hoveredPoint.revenue)}</span>
          <span><i className="previous-period" />Previous · {formatKes(hoveredPoint.previousRevenue)}</span>
        </div>
      )}
    </div>
  );
}

function SalesOutcomeChart({ outcomes }) {
  const [activeKey, setActiveKey] = useState(null);
  const segments = [
    { key: "completed", label: "Completed", color: "#23816c" },
    { key: "partiallyReturned", label: "Partially returned", color: "#d49a3a" },
    { key: "fullyRefunded", label: "Fully refunded", color: "#c75b56" },
  ].map((segment) => ({ ...segment, count: numberOrZero(outcomes[segment.key]) }));
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  const circumference = 2 * Math.PI * 72;
  let offset = 0;
  const slices = segments.map((segment) => {
    const length = total ? (segment.count / total) * circumference : 0;
    const slice = { ...segment, length, offset };
    offset += length;
    return slice;
  });
  const activeSegment = slices.find((segment) => segment.key === activeKey);
  return (
    <div className="reports-outcome-content">
      <div className="reports-donut-wrap">
        <svg
          className="reports-outcome-donut"
          viewBox="0 0 200 200"
          role="group"
          aria-label={`Sale outcomes: ${segments.map((segment) => `${segment.count} ${segment.label.toLowerCase()}`).join(", ")}`}
        >
          <circle
            cx="100"
            cy="100"
            r="72"
            fill="none"
            stroke="var(--workspace-panel-soft)"
            strokeWidth="24"
          />
          {slices.filter((segment) => segment.count > 0).map((segment) => (
            <circle
              key={segment.key}
              cx="100"
              cy="100"
              r="72"
              fill="none"
              stroke={segment.color}
              strokeWidth={activeKey === segment.key ? "31" : "24"}
              strokeDasharray={`${Math.max(0, segment.length - 4)} ${circumference}`}
              strokeDashoffset={-segment.offset}
              transform="rotate(-90 100 100)"
              className="reports-outcome-slice"
              role="button"
              tabIndex={0}
              aria-label={`${segment.label}: ${segment.count} sales, ${total ? ((segment.count / total) * 100).toFixed(1) : 0}%`}
              onPointerEnter={() => setActiveKey(segment.key)}
              onPointerLeave={() => setActiveKey(null)}
              onFocus={() => setActiveKey(segment.key)}
              onBlur={() => setActiveKey(null)}
              onClick={() => setActiveKey((key) => key === segment.key ? null : segment.key)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setActiveKey((key) => key === segment.key ? null : segment.key);
                }
                if (event.key === "Escape") setActiveKey(null);
              }}
            >
              <title>{segment.label}: {segment.count} sales</title>
            </circle>
          ))}
          <text x="100" y="96" textAnchor="middle" className="reports-donut-total">
            {total.toLocaleString()}
          </text>
          <text x="100" y="116" textAnchor="middle" className="reports-donut-label">
            Recorded sales
          </text>
        </svg>
        {activeSegment && (
          <div className="reports-donut-tooltip" role="status">
            <strong>{activeSegment.label}</strong>
            <span>{activeSegment.count.toLocaleString()} sales · {total ? ((activeSegment.count / total) * 100).toFixed(1) : 0}%</span>
          </div>
        )}
        {!total && (
          <div className="reports-donut-empty">No sales recorded</div>
        )}
      </div>
      <div className="reports-outcome-legend">
        {segments.map((segment) => (
          <button
            className={`reports-outcome-item${activeKey === segment.key ? " active" : ""}`}
            key={segment.key}
            type="button"
            onPointerEnter={() => setActiveKey(segment.key)}
            onPointerLeave={() => setActiveKey(null)}
            onFocus={() => setActiveKey(segment.key)}
            onBlur={() => setActiveKey(null)}
            onClick={() => setActiveKey((key) => key === segment.key ? null : segment.key)}
            aria-pressed={activeKey === segment.key}
            title={`${segment.label}: ${segment.count} sales`}
          >
            <span><i style={{ background: segment.color }} />{segment.label}</span>
            <strong>{segment.count.toLocaleString()}<small>{total ? ` · ${((segment.count / total) * 100).toFixed(1)}%` : ""}</small></strong>
          </button>
        ))}
      </div>
    </div>
  );
}

const resolveRangePayload = (range, customStartDate, customEndDate) => {
  if (range !== "custom") return { range };

  if (!customStartDate || !customEndDate) {
    return null;
  }
  if (
    Number.isNaN(new Date(customStartDate).getTime()) ||
    Number.isNaN(new Date(customEndDate).getTime()) ||
    customStartDate > customEndDate
  ) {
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
  const dailySeries = Array.isArray(source.dailySeries) ? source.dailySeries : [];
  const previousDailySeries = Array.isArray(source.previousDailySeries)
    ? source.previousDailySeries
    : [];
  const saleOutcomes = source.saleOutcomes || {};

  return {
    dailySeries,
    previousDailySeries,
    saleOutcomes: {
      completed: numberOrZero(saleOutcomes.completed),
      partiallyReturned: numberOrZero(saleOutcomes.partiallyReturned),
      fullyRefunded: numberOrZero(saleOutcomes.fullyRefunded),
    },
    period: source.range || payload.range || null,
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
    refundCount: numberOrZero(refundSummary.count),
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
        growthComparable: Boolean(summary.growthComparable),
        previousRevenue: numberOrZero(summary.previousRevenue),
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
  const [samplePreview, setSamplePreview] = useState(
    () => new URLSearchParams(window.location.search).get("preview") === "sample",
  );

  const queryParams = useMemo(
    () => resolveRangePayload(dateRange, customStartDate, customEndDate),
    [dateRange, customStartDate, customEndDate],
  );

  const setSamplePreviewMode = (enabled) => {
    setSamplePreview(enabled);
    const url = new URL(window.location.href);
    if (enabled) url.searchParams.set("preview", "sample");
    else url.searchParams.delete("preview");
    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  };

  const fetchReportData = useCallback(async () => {
    if (!queryParams) {
      setReportData(DEFAULT_REPORT_DATA);
      setLoading(false);
      return;
    }

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

      const fileRangeStart = format(
        new Date(queryParams.startDate || reportData.period?.start || new Date()),
        "yyyy-MM-dd",
      );
      const fileRangeEnd = format(
        new Date(queryParams.endDate || reportData.period?.end || new Date()),
        "yyyy-MM-dd",
      );
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

  const displayedReportData = useMemo(
    () => (samplePreview ? createSampleReportData(reportData) : reportData),
    [reportData, samplePreview],
  );
  const trendPoints = useMemo(
    () => buildTrendPoints(displayedReportData.dailySeries, dateRange),
    [displayedReportData.dailySeries, dateRange],
  );
  const previousTrendPoints = useMemo(
    () => buildTrendPoints(displayedReportData.previousDailySeries, dateRange),
    [displayedReportData.previousDailySeries, dateRange],
  );
  const comparisonPoints = useMemo(
    () =>
      trendPoints.map((point, index) => ({
        ...point,
        previousRevenue: numberOrZero(previousTrendPoints[index]?.revenue),
      })),
    [trendPoints, previousTrendPoints],
  );
  const trendInterval = trendPoints[0]?.interval || "day";
  const summary = displayedReportData.summary;
  const bestDay = displayedReportData.dailySeries
    .filter((day) => numberOrZero(day.sales) > 0)
    .reduce(
      (best, day) =>
        !best || numberOrZero(day.revenue) > numberOrZero(best.revenue)
          ? day
          : best,
      null,
    );
  const topMedicine = displayedReportData.topMedicines[0];
  const refundRate =
    summary.grossRevenue > 0
      ? (summary.totalRefunds / summary.grossRevenue) * 100
      : 0;
  const topMedicineShare =
    summary.totalRevenue > 0 && topMedicine
      ? Math.min(100, (numberOrZero(topMedicine.revenue) / summary.totalRevenue) * 100)
      : 0;
  const periodLabel =
    dateRange === "custom"
      ? customStartDate && customEndDate
        ? `${format(parseISO(customStartDate), "dd MMM yyyy")} – ${format(parseISO(customEndDate), "dd MMM yyyy")}`
        : "Choose a start and end date"
      : RANGE_OPTIONS.find((range) => range.value === dateRange)?.label;
  const storyHeadline =
    summary.totalSales === 0
      ? "No sales were recorded in this period."
      : !summary.growthComparable
        ? "Revenue activity is new; there is no positive prior-period baseline."
        : summary.growthRate > 0
          ? `Revenue is up ${summary.growthRate.toFixed(1)}% against the previous period.`
          : summary.growthRate < 0
            ? `Revenue is down ${Math.abs(summary.growthRate).toFixed(1)}% against the previous period.`
            : "Revenue is holding steady against the previous period.";

  return (
    <div className="reports-page">
      <section className="reports-story">
        <div className="reports-story-copy">
          <span className="reports-eyebrow">PERFORMANCE BRIEF · {periodLabel}</span>
          <h2>{storyHeadline}</h2>
          <p>
            Net sales, profit and customer returns at a glance. Compare the
            current period with the previous period of the same length.
          </p>
        </div>
        <div className="reports-story-highlight">
          <span>Top medicine</span>
          <strong>{topMedicine?.name || "No leading item yet"}</strong>
          <small>
            {topMedicine
              ? `${numberOrZero(topMedicine.unitsSold).toLocaleString()} units · ${topMedicineShare.toFixed(1)}% of net revenue`
              : "Product rankings appear after sales"}
          </small>
        </div>
      </section>

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
            type="button"
            className="btn btn-secondary reports-preview-button"
            onClick={() => setSamplePreviewMode(!samplePreview)}
            disabled={loading}
            aria-pressed={samplePreview}
          >
            <AppIcon
              icon={samplePreview ? faRotateLeft : faChartBar}
              className="btn-icon"
            />
            {samplePreview ? "Show actual data" : "Preview sample data"}
          </button>
          <button
            onClick={exportExcel}
            className="btn btn-primary"
            disabled={exportLoading || loading || samplePreview}
            title={samplePreview ? "Switch to actual data before exporting." : undefined}
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

      {samplePreview && (
        <div className="reports-sample-banner" role="status">
          <strong>Sample data preview</strong>
          <span>
            Illustrative chart and medicine data only. No sales or stock were
            created or changed.
          </span>
        </div>
      )}

      {!queryParams ? (
        <div className="reports-range-message" role="status">
          {dateRange !== "custom"
            ? "Choose a valid reporting period."
            : customStartDate && customEndDate
              ? "The end date must be on or after the start date."
              : "Select both dates to view this custom report."}
        </div>
      ) : (
      <>
      {loading ? (
        <SkeletonSummaryCards count={6} />
      ) : (
        <div className="summary-cards reports-kpis">
          <div className="summary-card reports-kpi">
            <div className="card-icon revenue">
              <AppIcon icon={faCoins} />
            </div>
            <div className="card-content">
              <h3>Net revenue</h3>
              <p className="card-value">
                {formatKes(summary.totalRevenue)}
              </p>
              <span className={`reports-kpi-note ${summary.growthComparable && summary.growthRate < 0 ? "negative" : ""}`}>
                {summary.growthComparable ? (
                  <>
                    <AppIcon icon={faArrowTrendUp} /> {summary.growthRate > 0 ? "+" : ""}
                    {summary.growthRate.toFixed(1)}% vs previous
                  </>
                ) : "No positive prior-period baseline"}
              </span>
            </div>
          </div>

          <div className="summary-card reports-kpi">
            <div className="card-icon profit">
              <AppIcon icon={faChartLine} />
            </div>
            <div className="card-content">
              <h3>Net profit</h3>
              <p className="card-value">{formatKes(summary.totalProfit)}</p>
              <span className="reports-kpi-note">After refund profit loss</span>
            </div>
          </div>

          <div className="summary-card reports-kpi">
            <div className="card-icon sales">
              <AppIcon icon={faChartBar} />
            </div>
            <div className="card-content">
              <h3>Sales transactions</h3>
              <p className="card-value">{summary.totalSales.toLocaleString()}</p>
              <span className="reports-kpi-note">Avg. net sale {formatKes(summary.averageSaleValue)}</span>
            </div>
          </div>

          <div className="summary-card reports-kpi">
            <div className="card-icon refunds">
              <AppIcon icon={faRotateLeft} />
            </div>
            <div className="card-content">
              <h3>Refunds</h3>
              <p className="card-value">{formatKes(summary.totalRefunds)}</p>
              <span className="reports-kpi-note">{refundRate.toFixed(1)}% of gross revenue</span>
            </div>
          </div>

          <div className="summary-card reports-kpi">
            <div className="card-icon margin">
              <AppIcon icon={faChartLine} />
            </div>
            <div className="card-content">
              <h3>Profit margin</h3>
              <p className="card-value">{summary.profitMargin.toFixed(1)}%</p>
              <span className="reports-kpi-note">Net profit / net revenue</span>
            </div>
          </div>

          <div className="summary-card reports-kpi">
            <div className="card-icon performance">
              <AppIcon icon={faBox} />
            </div>
            <div className="card-content">
              <h3>Best net revenue day</h3>
              <p className="card-value reports-kpi-day">
                {bestDay ? format(parseISO(bestDay.date), "EEE, dd MMM") : "—"}
              </p>
              <span className="reports-kpi-note">
                {bestDay ? formatKes(bestDay.revenue) : "No recorded sales"}
              </span>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonCard lines={3} showHeader />
      ) : (
        <section className="reports-bridge">
          <div className="reports-bridge-heading">
            <span className="reports-eyebrow">THE BOTTOM LINE</span>
            <h3>How returns affect performance</h3>
          </div>
          <div className="reports-bridge-metric">
            <span>Gross revenue</span>
            <strong>{formatKes(summary.grossRevenue)}</strong>
            <small>Before refunds</small>
          </div>
          <span className="reports-bridge-minus" aria-hidden="true">−</span>
          <div className="reports-bridge-metric reports-bridge-loss">
            <span>Refunds</span>
            <strong>{formatKes(summary.totalRefunds)}</strong>
            <small>{refundRate.toFixed(1)}% of gross revenue</small>
          </div>
          <span className="reports-bridge-equals" aria-hidden="true">=</span>
          <div className="reports-bridge-metric reports-bridge-total">
            <span>Net revenue</span>
            <strong>{formatKes(summary.totalRevenue)}</strong>
            <small>After refunds</small>
          </div>
          <div className="reports-bridge-divider" />
          <div className="reports-bridge-metric">
            <span>Gross profit</span>
            <strong>{formatKes(summary.grossProfit)}</strong>
            <small>Before refund losses</small>
          </div>
          <span className="reports-bridge-minus" aria-hidden="true">−</span>
          <div className="reports-bridge-metric reports-bridge-loss">
            <span>Refund profit loss</span>
            <strong>{formatKes(summary.refundProfitLoss)}</strong>
            <small>Profit reversed</small>
          </div>
          <span className="reports-bridge-equals" aria-hidden="true">=</span>
          <div className="reports-bridge-metric reports-bridge-total">
            <span>Net profit</span>
            <strong>{formatKes(summary.totalProfit)}</strong>
            <small>After returns</small>
          </div>
        </section>
      )}

      {loading ? (
        <div className="reports-dashboard-grid loader-fade-in">
          <div className="chart-container reports-panel reports-earnings-panel">
            <SkeletonChart />
          </div>
          <div className="reports-mini-stack">
            <div className="chart-container reports-panel"><SkeletonChart /></div>
            <div className="chart-container reports-panel"><SkeletonChart /></div>
          </div>
          <div className="chart-container reports-panel"><SkeletonChart /></div>
          <div className="chart-container reports-panel"><SkeletonChart /></div>
        </div>
      ) : (
        <div className="reports-dashboard-grid">
          <section className="chart-container reports-panel reports-earnings-panel">
            <div className="reports-panel-heading">
              <div>
                <span className="reports-eyebrow">REVENUE · {periodLabel}</span>
                <h3>Net revenue over time</h3>
                <p>Sales minus approved refunds, grouped by {trendInterval}.</p>
              </div>
              <div className="reports-earnings-total">
                <span>Period total</span>
                <strong>{formatKes(summary.totalRevenue, true)}</strong>
              </div>
            </div>
            <RevenueBarChart points={trendPoints} />
            <p className="reports-chart-explainer">Bars show net revenue per labeled interval; negative bars mean refunds exceeded sales.</p>
          </section>

          <div className="reports-mini-stack">
            <section className="chart-container reports-panel reports-mini-card">
              <div className="reports-mini-heading">
                <div>
                  <span className="reports-eyebrow">SALES ACTIVITY</span>
                  <h3>Sales transactions</h3>
                </div>
                <strong>{summary.totalSales.toLocaleString()}</strong>
              </div>
              <Sparkline points={trendPoints} metric="sales" color="#d45a78" label="Sales transactions over time" emptyMessage="No sales in this period" />
              <p>Counted by sale date · fully refunded sales are excluded.</p>
            </section>
            <section className="chart-container reports-panel reports-mini-card">
              <div className="reports-mini-heading">
                <div>
                  <span className="reports-eyebrow">PROFITABILITY</span>
                  <h3>Net profit</h3>
                </div>
                <strong>{formatKes(summary.totalProfit, true)}</strong>
              </div>
              <Sparkline points={trendPoints} metric="profit" color="#55a95d" label="Net profit over time" emptyMessage="No net profit in this period" />
              <p>Profit after approved refund losses · {periodLabel}.</p>
            </section>
          </div>

          <section className="chart-container reports-panel reports-comparison-panel">
            <div className="reports-panel-heading">
              <div>
                <span className="reports-eyebrow">PERIOD COMPARISON</span>
                <h3>Revenue vs. previous period</h3>
                <p>Same number of days immediately before the selected range.</p>
              </div>
            </div>
            <div className="reports-legend">
              <span><i className="revenue" /> Selected period</span>
              <span><i className="profit" /> Previous period</span>
            </div>
            <ComparisonChart points={comparisonPoints} />
          </section>

          <section className="chart-container reports-panel reports-outcomes-panel">
            <div className="reports-panel-heading">
              <div>
                <span className="reports-eyebrow">TRANSACTION MIX</span>
                <h3>Sale outcomes</h3>
                <p>Recorded sale status · includes refunded transactions.</p>
              </div>
            </div>
            <SalesOutcomeChart outcomes={displayedReportData.saleOutcomes} />
          </section>

          <section className="reports-product-analysis">
            <div className="reports-product-heading">
              <div>
                <span className="reports-eyebrow">PRODUCT MIX</span>
                <h3>What is moving most?</h3>
                <p>Ranked by net units sold; the bars show each item’s net revenue share.</p>
              </div>
              <strong>{displayedReportData.topMedicines.length} leading products</strong>
            </div>
            {displayedReportData.topMedicines.length ? (
              <div className="reports-product-list">
                {displayedReportData.topMedicines.slice(0, 5).map((medicine, index) => {
                  const share =
                    summary.totalRevenue > 0
                      ? Math.min(100, Math.max(0, (numberOrZero(medicine.revenue) / summary.totalRevenue) * 100))
                      : 0;
                  return (
                    <div className="reports-product-row" key={medicine.name || index}>
                      <span className="reports-product-rank">{String(index + 1).padStart(2, "0")}</span>
                      <div className="reports-product-info">
                        <div className="reports-product-label">
                          <strong>{medicine.name || "Unknown medicine"}</strong>
                          <span>{numberOrZero(medicine.unitsSold).toLocaleString()} units · {formatKes(medicine.revenue)}</span>
                        </div>
                        <div
                          className="reports-product-track"
                          role="img"
                          tabIndex={0}
                          aria-label={`${medicine.name}: ${share.toFixed(1)} percent of net revenue`}
                          title={`${medicine.name} · ${numberOrZero(medicine.unitsSold).toLocaleString()} net units · ${formatKes(medicine.revenue)} revenue · ${share.toFixed(1)}% of total`}
                          data-tooltip={`${formatKes(medicine.revenue)} · ${share.toFixed(1)}% of net revenue`}
                        >
                          <span style={{ "--bar-width": `${share}%`, "--bar-delay": `${index * 80}ms` }} />
                        </div>
                      </div>
                      <strong className="reports-product-share">{share.toFixed(1)}%</strong>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="reports-empty-chart">Medicine rankings will appear after sales are recorded.</div>
            )}
          </section>
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
                    <th>Net Units</th>
                    <th>Revenue</th>
                    <th>Profit</th>
                    <th>Profit Margin</th>
                    <th>Refund Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedReportData.topMedicines.length ? displayedReportData.topMedicines.map((medicine, index) => (
                    <tr key={index}>
                      <td data-label="Medicine">
                        {medicine.name || "Unknown"}
                      </td>
                      <td data-label="Net Units">{medicine.unitsSold || 0}</td>
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
                      <td data-label="Refund Rate">
                        {(medicine.refundRate || 0).toFixed(1)}%
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="6">Sales rankings will appear when medicines are sold in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="table-container">
            <h3>Low Performing Items</h3>
            <p className="reports-table-note">Bottom of the sold-item ranking; medicines shown in Top Selling are excluded.</p>
            <div className="table-wrap table-responsive-cards">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medicine Name</th>
                    <th>Net Units</th>
                    <th>Revenue</th>
                    <th>Refund Rate</th>
                    <th>Stock Status</th>
                    <th>Last Sale in Period</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedReportData.lowPerformingMedicines.length ? displayedReportData.lowPerformingMedicines.map(
                    (medicine, index) => (
                      <tr key={index}>
                        <td data-label="Medicine">
                          {medicine.name || "Unknown"}
                        </td>
                        <td data-label="Net Units">
                          {medicine.unitsSold || 0}
                        </td>
                        <td data-label="Revenue">
                          KES{" "}
                          {(medicine.revenue || 0).toLocaleString("en-KE", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td data-label="Refund Rate">
                          {(medicine.refundRate || 0).toFixed(1)}%
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
                                      : medicine.stockStatus === "inactive"
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
                                    ? "Not in Inventory"
                                    : medicine.stockStatus === "inactive"
                                      ? "Inactive"
                                    : "Unknown"}
                          </span>
                        </td>
                        <td data-label="Last Sale in Period">
                          {medicine.lastSale
                            ? format(
                                new Date(medicine.lastSale),
                                "MMM dd, yyyy",
                              )
                            : "None in period"}
                        </td>
                      </tr>
                    ),
                  ) : (
                    <tr><td colSpan="6">No lower-ranked items outside the leading group for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default ReportsPage;
