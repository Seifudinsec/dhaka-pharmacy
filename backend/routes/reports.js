const express = require("express");
const { format } = require("date-fns");
const XLSX = require("xlsx");

const { protect, adminOnly } = require("../middleware/auth");
const Sale = require("../models/Sale");
const Return = require("../models/Return");
const Medicine = require("../models/Medicine");

const router = express.Router();

router.use(protect);
router.use(adminOnly);

/* ----------------------------- Helpers ----------------------------- */

const round2 = (n) => Number((Number(n) || 0).toFixed(2));

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const dateKey = (d) => format(new Date(d), "yyyy-MM-dd");

const getRangeBounds = ({ range, startDate, endDate }) => {
  const now = new Date();
  const todayEnd = endOfDay(now);

  if (range === "custom") {
    if (!startDate || !endDate) {
      return { start: null, end: null };
    }
    return {
      start: startOfDay(new Date(startDate)),
      end: endOfDay(new Date(endDate)),
    };
  }

  const map = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "6m": 183,
    "1y": 365,
  };

  const days = map[range] || 30;
  const start = new Date(todayEnd);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  return { start, end: todayEnd };
};

const getPeriodLabel = ({ range, start, end }) => {
  const prettyStart = format(start, "MMM dd, yyyy");
  const prettyEnd = format(end, "MMM dd, yyyy");

  const named = {
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    "90d": "Last 90 Days",
    "6m": "Last 6 Months",
    "1y": "Last 1 Year",
    custom: "Custom Range",
  };

  const prefix = named[range] || "Selected Range";
  return `${prefix} (${prettyStart} – ${prettyEnd})`;
};

const getSaleGrossRevenue = (sale) =>
  round2(
    Array.isArray(sale.items)
      ? sale.items.reduce(
          (sum, it) => sum + Number(it?.subtotal ?? it?.total ?? 0),
          0,
        )
      : Number(sale.total || 0),
  );

const getSaleGrossProfit = (sale) =>
  round2(
    Array.isArray(sale.items)
      ? sale.items.reduce((sum, it) => {
          const qty = Number(it?.quantity || 0);
          const unitPrice = Number(it?.unitPrice || 0);
          const buyingPrice = Number(it?.buyingPrice || 0);
          const itemProfit = it?.profit ?? (unitPrice - buyingPrice) * qty;
          return sum + Number(itemProfit || 0);
        }, 0)
      : Number(sale.totalProfit ?? sale.profit ?? 0),
  );

const getReturnRevenue = (ret) => round2(ret?.totalRefund ?? 0);

const getReturnProfitLoss = (ret) => round2(ret?.totalProfitLoss ?? 0);

const getRefundDate = (ret) => {
  // prefer explicit refundDate if available, fallback to createdAt
  return ret?.refundDate ? new Date(ret.refundDate) : new Date(ret.createdAt);
};

const chunkSums = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(round2(arr.slice(i, i + size).reduce((a, b) => a + b, 0)));
  }
  return out;
};

const computeRangeData = async ({ range, startDate, endDate }) => {
  const { start, end } = getRangeBounds({ range, startDate, endDate });
  if (!start || !end) {
    return {
      ok: false,
      message: "For custom range, startDate and endDate are required.",
    };
  }

  // Filter by createdAt for sales and refundDate (fallback createdAt) for refunds
  const [sales, returns] = await Promise.all([
    Sale.find({ createdAt: { $gte: start, $lte: end } })
      .populate("servedBy", "username")
      .lean(),
    Return.find({
      $or: [
        { refundDate: { $gte: start, $lte: end } },
        {
          refundDate: { $exists: false },
          createdAt: { $gte: start, $lte: end },
        },
      ],
    }).lean(),
  ]);

  const keys = [];
  const cursor = startOfDay(start);
  while (cursor <= end) {
    keys.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const revenueByDay = new Map(keys.map((k) => [k, 0]));
  const profitByDay = new Map(keys.map((k) => [k, 0]));
  const salesCountByDay = new Map(keys.map((k) => [k, 0]));
  const refundsByDay = new Map(keys.map((k) => [k, 0]));

  // medicine-level (gross sales side)
  const medSales = {};
  const medReturns = {};

  const ensureMed = (bucket, name) => {
    if (!bucket[name]) {
      bucket[name] = {
        name,
        units: 0,
        revenue: 0,
        profit: 0,
      };
    }
    return bucket[name];
  };

  // Sales add values on sale day
  for (const sale of sales) {
    const k = dateKey(sale.createdAt);
    const grossRevenue = getSaleGrossRevenue(sale);
    const grossProfit = getSaleGrossProfit(sale);

    revenueByDay.set(k, round2((revenueByDay.get(k) || 0) + grossRevenue));
    profitByDay.set(k, round2((profitByDay.get(k) || 0) + grossProfit));
    salesCountByDay.set(k, (salesCountByDay.get(k) || 0) + 1);

    for (const item of sale.items || []) {
      const medName = item.medicineName || "Unknown";
      const row = ensureMed(medSales, medName);

      const qty = Number(item.quantity || 0);
      const rev = Number(item.subtotal ?? item.total ?? 0);
      const prof =
        Number(item.profit) ||
        (Number(item.unitPrice || 0) - Number(item.buyingPrice || 0)) * qty;

      row.units += qty;
      row.revenue += rev;
      row.profit += prof;
    }
  }

  // Refunds subtract values on refund day (refundDate)
  for (const ret of returns) {
    const refundDate = getRefundDate(ret);
    const k = dateKey(refundDate);

    const refundRevenue = getReturnRevenue(ret);
    const refundProfitLoss = getReturnProfitLoss(ret);

    revenueByDay.set(k, round2((revenueByDay.get(k) || 0) - refundRevenue));
    profitByDay.set(k, round2((profitByDay.get(k) || 0) - refundProfitLoss));
    refundsByDay.set(k, round2((refundsByDay.get(k) || 0) + refundRevenue));

    for (const item of ret.items || []) {
      const medName = item.medicineName || "Unknown";
      const row = ensureMed(medReturns, medName);

      const qty = Number(item.quantity || 0);
      const rev = Number(item.subtotal ?? item.total ?? 0);
      const prof =
        Number(item.profit) ||
        (Number(item.unitPrice || 0) - Number(item.buyingPrice || 0)) * qty;

      row.units += qty;
      row.revenue += rev;
      row.profit += prof;
    }
  }

  const revenueTrends = keys.map((k) => round2(revenueByDay.get(k) || 0));
  const profitTrends = keys.map((k) => round2(profitByDay.get(k) || 0));
  const salesDailyCounts = keys.map((k) => Number(salesCountByDay.get(k) || 0));
  const refundsDaily = keys.map((k) => round2(refundsByDay.get(k) || 0));

  const totalRevenue = round2(revenueTrends.reduce((a, b) => a + b, 0));
  const totalProfit = round2(profitTrends.reduce((a, b) => a + b, 0));
  const totalRefunds = round2(refundsDaily.reduce((a, b) => a + b, 0));

  // "Total Sales Count" rule:
  // exclude fully refunded sales if they have return records tied to them and status says fully_refunded
  const excludedFullyRefunded = new Set(
    returns
      .filter((r) => String(r?.status || "").toLowerCase() !== "rejected")
      .map((r) => String(r.originalSale)),
  );

  const totalSales = sales.filter((s) => {
    if (
      s.status === "fully_refunded" &&
      excludedFullyRefunded.has(String(s._id))
    ) {
      return false;
    }
    return true;
  }).length;

  const averageSaleValue =
    totalSales > 0 ? round2(totalRevenue / totalSales) : 0;
  const profitMargin =
    totalRevenue !== 0 ? round2((totalProfit / totalRevenue) * 100) : 0;

  // medicine net performance: gross sales - refunded portions
  const medNames = new Set([
    ...Object.keys(medSales),
    ...Object.keys(medReturns),
  ]);
  const medicineNet = [];

  for (const name of medNames) {
    const s = medSales[name] || { units: 0, revenue: 0, profit: 0 };
    const r = medReturns[name] || { units: 0, revenue: 0, profit: 0 };

    const netUnits = round2(s.units - r.units);
    const netRevenue = round2(s.revenue - r.revenue);
    const netProfit = round2(s.profit - r.profit);
    const refundRate =
      s.units > 0 ? round2((Math.max(0, r.units) / s.units) * 100) : 0;

    medicineNet.push({
      name,
      unitsSold: netUnits,
      revenue: netRevenue,
      profit: netProfit,
      refundRate,
      profitMargin:
        netRevenue !== 0 ? round2((netProfit / netRevenue) * 100) : 0,
    });
  }

  const topSelling = medicineNet
    .filter((m) => m.unitsSold > 0 || m.revenue !== 0 || m.profit !== 0)
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
    .slice(0, 10);

  let lowPerforming = medicineNet
    .filter((m) => m.unitsSold >= 0 && m.unitsSold < 10)
    .sort((a, b) => {
      // prioritize high refund rate, then low units
      if (b.refundRate !== a.refundRate) return b.refundRate - a.refundRate;
      return a.unitsSold - b.unitsSold;
    })
    .slice(0, 10);

  // enrich low performers with stockStatus and lastSale
  for (const med of lowPerforming) {
    const doc = await Medicine.findOne({ name: med.name }).lean();
    if (doc) med.stockStatus = doc.stockStatus;

    const lastSale = sales
      .filter((s) => (s.items || []).some((it) => it.medicineName === med.name))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

    med.lastSale = lastSale?.createdAt;
  }

  // growth rate over previous equivalent period (event-based)
  const periodDays = Math.max(
    1,
    Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1,
  );

  const prevEnd = new Date(start);
  prevEnd.setMilliseconds(-1);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - periodDays);

  const [prevSales, prevReturns] = await Promise.all([
    Sale.find({
      createdAt: { $gte: startOfDay(prevStart), $lte: endOfDay(prevEnd) },
    }).lean(),
    Return.find({
      $or: [
        {
          refundDate: { $gte: startOfDay(prevStart), $lte: endOfDay(prevEnd) },
        },
        {
          refundDate: { $exists: false },
          createdAt: { $gte: startOfDay(prevStart), $lte: endOfDay(prevEnd) },
        },
      ],
    }).lean(),
  ]);

  const prevRevenueFromSales = round2(
    prevSales.reduce((sum, s) => sum + getSaleGrossRevenue(s), 0),
  );
  const prevRefunds = round2(
    prevReturns.reduce((sum, r) => sum + getReturnRevenue(r), 0),
  );
  const prevRevenue = round2(prevRevenueFromSales - prevRefunds);

  const growthRate =
    prevRevenue !== 0
      ? round2(((totalRevenue - prevRevenue) / prevRevenue) * 100)
      : 0;

  return {
    ok: true,
    range: { start, end, label: getPeriodLabel({ range, start, end }) },
    summary: {
      totalRevenue,
      totalProfit,
      totalSales,
      totalRefunds,
      grossRevenue: round2(totalRevenue + totalRefunds),
      grossProfit: round2(
        totalProfit +
          returns.reduce((sum, r) => sum + getReturnProfitLoss(r), 0),
      ),
      refundProfitLoss: round2(
        returns.reduce((sum, r) => sum + getReturnProfitLoss(r), 0),
      ),
      averageSaleValue,
      profitMargin,
      growthRate,
    },
    revenueTrends: {
      daily: revenueTrends,
      weekly: chunkSums(revenueTrends, 7),
      monthly: chunkSums(revenueTrends, 30),
    },
    profitTrends: {
      daily: profitTrends,
      weekly: chunkSums(profitTrends, 7),
      monthly: chunkSums(profitTrends, 30),
    },
    salesCounts: {
      daily: salesDailyCounts,
      weekly: chunkSums(salesDailyCounts, 7),
      monthly: chunkSums(salesDailyCounts, 30),
    },
    topSelling,
    lowPerforming,
    refundSummary: {
      count: returns.length,
      totalRefunds,
      dailyRefunds: refundsDaily,
    },
    // Backward-compatible shape for existing frontend
    legacy: {
      revenue: {
        daily: revenueTrends,
        weekly: chunkSums(revenueTrends, 7),
        monthly: chunkSums(revenueTrends, 30),
      },
      profit: {
        daily: profitTrends,
        weekly: chunkSums(profitTrends, 7),
        monthly: chunkSums(profitTrends, 30),
      },
      sales: {
        daily: salesDailyCounts,
        weekly: chunkSums(salesDailyCounts, 7),
        monthly: chunkSums(salesDailyCounts, 30),
      },
      topMedicines: topSelling,
      lowPerformingMedicines: lowPerforming,
      summary: {
        totalRevenue,
        totalProfit,
        totalSales,
        totalRefunds,
        grossRevenue: round2(totalRevenue + totalRefunds),
        grossProfit: round2(
          totalProfit +
            returns.reduce((sum, r) => sum + getReturnProfitLoss(r), 0),
        ),
        refundProfitLoss: round2(
          returns.reduce((sum, r) => sum + getReturnProfitLoss(r), 0),
        ),
        averageSaleValue,
        profitMargin,
        growthRate,
      },
    },
  };
};

/* ----------------------------- API: Reports ----------------------------- */

// New structure endpoint requested:
// GET /api/reports?range=...&startDate=...&endDate=...
router.get("/", async (req, res) => {
  try {
    const { range = "30d", startDate, endDate } = req.query;
    const computed = await computeRangeData({ range, startDate, endDate });

    if (!computed.ok) {
      return res.status(400).json({
        success: false,
        message: computed.message,
      });
    }

    return res.json({
      success: true,
      summary: computed.summary,
      revenueTrends: computed.revenueTrends,
      profitTrends: computed.profitTrends,
      topSelling: computed.topSelling,
      lowPerforming: computed.lowPerforming,
      refundSummary: computed.refundSummary,
      range: computed.range,
    });
  } catch (error) {
    console.error("Reports endpoint error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate reports.",
    });
  }
});

// Backward-compatible analytics endpoint used by current frontend
router.get("/analytics", async (req, res) => {
  try {
    const { range = "30d", startDate, endDate } = req.query;
    const computed = await computeRangeData({ range, startDate, endDate });

    if (!computed.ok) {
      return res.status(400).json({
        success: false,
        message: computed.message,
      });
    }

    return res.json({
      success: true,
      data: computed.legacy,
    });
  } catch (error) {
    console.error("Reports analytics error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate analytics report.",
    });
  }
});

/* ----------------------------- API: Excel export ----------------------------- */

// Excel-only export (CSV removed)
router.get("/export", async (req, res) => {
  try {
    const {
      range = "30d",
      startDate,
      endDate,
      format: exportFormat = "xlsx",
    } = req.query;

    if (String(exportFormat).toLowerCase() !== "xlsx") {
      return res.status(400).json({
        success: false,
        message: "Only Excel export is supported.",
      });
    }

    const computed = await computeRangeData({ range, startDate, endDate });
    if (!computed.ok) {
      return res.status(400).json({
        success: false,
        message: computed.message,
      });
    }

    const {
      summary,
      topSelling,
      lowPerforming,
      refundSummary,
      range: period,
    } = computed;

    const wb = XLSX.utils.book_new();

    const rows = [];

    // Title
    rows.push(["Dhaka Pharmacy Reports & Analytics"]);
    rows.push([`Report Period: ${period.label}`]);
    rows.push([]);

    // Summary section
    rows.push(["Summary"]);
    rows.push(["Metric", "Value"]);
    rows.push([
      "Gross Revenue (Before refunds)",
      round2(
        summary.grossRevenue ?? summary.totalRevenue + summary.totalRefunds,
      ),
    ]);
    rows.push(["Total Revenue (NET after refunds)", summary.totalRevenue]);
    rows.push([
      "Gross Profit (Before refunds)",
      round2(
        summary.grossProfit ?? summary.totalProfit + summary.refundProfitLoss,
      ),
    ]);
    rows.push(["Refund Profit Loss", round2(summary.refundProfitLoss ?? 0)]);
    rows.push(["Total Profit (NET after refunds)", summary.totalProfit]);
    rows.push(["Total Sales", summary.totalSales]);
    rows.push(["Total Refunds", summary.totalRefunds]);
    rows.push(["Profit Margin (%)", summary.profitMargin]);
    rows.push([]);

    // Top Selling table
    rows.push(["Top Selling Medicines (Net Values)"]);
    rows.push([
      "Medicine Name",
      "Net Units Sold",
      "Net Revenue (KES)",
      "Net Profit (KES)",
      "Profit Margin (%)",
      "Refund Rate (%)",
    ]);
    for (const m of topSelling) {
      rows.push([
        m.name,
        round2(m.unitsSold),
        round2(m.revenue),
        round2(m.profit),
        round2(m.profitMargin),
        round2(m.refundRate),
      ]);
    }
    rows.push([]);

    // Low Performing table
    rows.push(["Low Performing Items"]);
    rows.push([
      "Medicine Name",
      "Net Units Sold",
      "Net Revenue (KES)",
      "Net Profit (KES)",
      "Refund Rate (%)",
      "Stock Status",
      "Last Sale",
    ]);
    for (const m of lowPerforming) {
      rows.push([
        m.name,
        round2(m.unitsSold),
        round2(m.revenue),
        round2(m.profit),
        round2(m.refundRate),
        m.stockStatus || "Unknown",
        m.lastSale ? format(new Date(m.lastSale), "yyyy-MM-dd") : "Never",
      ]);
    }
    rows.push([]);

    // Refund summary
    rows.push(["Refund Summary"]);
    rows.push(["Total Refund Transactions", refundSummary.count]);
    rows.push(["Total Refunded Amount (KES)", refundSummary.totalRefunds]);

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Basic formatting and layout
    ws["!cols"] = [
      { wch: 45 },
      { wch: 24 },
      { wch: 24 },
      { wch: 24 },
      { wch: 20 },
      { wch: 18 },
      { wch: 16 },
    ];

    // Merge title and period rows across columns A:G
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
    ];

    // Bold style helper
    const boldStyle = { font: { bold: true } };

    // Apply bold to notable rows
    const boldRowIndexes = [
      0, // title
      1, // period
      3, // Summary heading
      4, // Summary columns
      12, // Top selling heading (depends on static row layout)
      13, // Top selling columns
    ];

    // Low-performing heading row index is dynamic
    const lowPerfHeadingRow = 14 + topSelling.length + 1;
    const lowPerfColumnsRow = lowPerfHeadingRow + 1;

    boldRowIndexes.push(lowPerfHeadingRow, lowPerfColumnsRow);

    // Refund summary heading row dynamic
    const refundHeadingRow = lowPerfColumnsRow + lowPerforming.length + 2;
    boldRowIndexes.push(refundHeadingRow);

    // Apply style to each cell in these rows if exists
    for (const r of boldRowIndexes) {
      for (let c = 0; c <= 6; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (ws[cellRef]) {
          ws[cellRef].s = { ...(ws[cellRef].s || {}), ...boldStyle };
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, "Reports & Analytics");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const filename = `dhaka-pharmacy-reports-${format(period.start, "yyyy-MM-dd")}-to-${format(period.end, "yyyy-MM-dd")}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    console.error("Report export error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to export Excel report.",
    });
  }
});

module.exports = router;
