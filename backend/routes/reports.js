const express = require("express");
const { format, subMonths, subYears } = require("date-fns");
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

const parseRangeDate = (value) => {
  if (typeof value !== "string") return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsed = dateOnly
    ? new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      )
    : new Date(value);

  if (Number.isNaN(parsed.getTime())) return null;
  if (
    dateOnly &&
    (parsed.getFullYear() !== Number(dateOnly[1]) ||
      parsed.getMonth() + 1 !== Number(dateOnly[2]) ||
      parsed.getDate() !== Number(dateOnly[3]))
  ) {
    return null;
  }
  return parsed;
};

const getReturnDateQuery = (start, end) => ({
  $or: [
    { refundDate: { $gte: start, $lte: end } },
    {
      $or: [{ refundDate: { $exists: false } }, { refundDate: null }],
      createdAt: { $gte: start, $lte: end },
    },
  ],
  $and: [
    {
      $or: [
        { status: "approved" },
        { status: { $exists: false } },
      ],
    },
  ],
});

const getRangeBounds = ({ range, startDate, endDate }) => {
  const now = new Date();
  const todayEnd = endOfDay(now);

  if (range === "custom") {
    if (!startDate || !endDate) {
      return { start: null, end: null };
    }
    const parsedStart = parseRangeDate(startDate);
    const parsedEnd = parseRangeDate(endDate);
    if (!parsedStart || !parsedEnd || parsedStart > parsedEnd) {
      return { start: null, end: null };
    }
    return {
      start: startOfDay(parsedStart),
      end: endOfDay(parsedEnd),
    };
  }

  const map = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
  };

  const start =
    range === "6m"
      ? startOfDay(subMonths(todayEnd, 6))
      : range === "1y"
        ? startOfDay(subYears(todayEnd, 1))
        : new Date(todayEnd);
  if (map[range]) {
    start.setDate(start.getDate() - (map[range] - 1));
    start.setHours(0, 0, 0, 0);
  }

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
  if (!["7d", "30d", "90d", "6m", "1y", "custom"].includes(range)) {
    return { ok: false, message: "Unsupported report date range." };
  }

  const { start, end } = getRangeBounds({ range, startDate, endDate });
  if (!start || !end) {
    return {
      ok: false,
      message:
        "Custom reports require valid start and end dates, with the start on or before the end.",
    };
  }

  // Filter by createdAt for sales and refundDate (fallback createdAt) for refunds
  const [sales, returns] = await Promise.all([
    Sale.find({ createdAt: { $gte: start, $lte: end } }).lean(),
    Return.find(getReturnDateQuery(start, end)).lean(),
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

  const excludedFullyRefunded = new Set(
    returns
      .filter((r) => String(r?.status || "").toLowerCase() !== "rejected")
      .map((r) => String(r.originalSale)),
  );

  // medicine-level (gross sales side)
  const medSales = Object.create(null);
  const medReturns = Object.create(null);

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
    if (
      sale.status !== "fully_refunded" ||
      !excludedFullyRefunded.has(String(sale._id))
    ) {
      salesCountByDay.set(k, (salesCountByDay.get(k) || 0) + 1);
    }

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
  const dailySeries = keys.map((date, index) => ({
    date,
    revenue: revenueTrends[index],
    profit: profitTrends[index],
    sales: salesDailyCounts[index],
    refunds: refundsDaily[index],
  }));

  const totalRevenue = round2(revenueTrends.reduce((a, b) => a + b, 0));
  const totalProfit = round2(profitTrends.reduce((a, b) => a + b, 0));
  const totalRefunds = round2(refundsDaily.reduce((a, b) => a + b, 0));

  // "Total Sales Count" rule:
  // exclude fully refunded sales if they have return records tied to them and status says fully_refunded
  const totalSales = sales.filter((s) => {
    if (
      s.status === "fully_refunded" &&
      excludedFullyRefunded.has(String(s._id))
    ) {
      return false;
    }
    return true;
  }).length;
  const saleOutcomes = sales.reduce(
    (outcomes, sale) => {
      if (sale.status === "fully_refunded") outcomes.fullyRefunded += 1;
      else if (sale.status === "partially_returned") outcomes.partiallyReturned += 1;
      else outcomes.completed += 1;
      return outcomes;
    },
    { completed: 0, partiallyReturned: 0, fullyRefunded: 0 },
  );

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

    const netUnits = Math.round(s.units - r.units);
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

  const rankedMedicines = medicineNet
    .filter((m) => m.unitsSold > 0 || m.revenue !== 0 || m.profit !== 0)
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
  const topSellingCount = Math.min(
    5,
    Math.max(1, Math.ceil(rankedMedicines.length / 2)),
  );
  const topSelling = rankedMedicines.slice(0, topSellingCount);
  const topSellingNames = new Set(topSelling.map((medicine) => medicine.name));

  let lowPerforming = medicineNet
    .filter((m) => !topSellingNames.has(m.name))
    .sort((a, b) => {
      // prioritize high refund rate, then low units
      if (b.refundRate !== a.refundRate) return b.refundRate - a.refundRate;
      return a.unitsSold - b.unitsSold;
    })
    .slice(0, 10);

  const lowPerformingNames = lowPerforming.map((medicine) => medicine.name);
  const inventoryByName = lowPerformingNames.length
    ? await Medicine.aggregate([
        { $match: { name: { $in: lowPerformingNames } } },
        {
          $group: {
            _id: "$name",
            activeStock: {
              $sum: {
                $cond: [{ $eq: ["$status", "active"] }, "$stock", 0],
              },
            },
            activeBatches: {
              $sum: {
                $cond: [{ $eq: ["$status", "active"] }, 1, 0],
              },
            },
          },
        },
      ])
    : [];
  const stockByName = new Map(
    inventoryByName.map((medicine) => [medicine._id, medicine]),
  );
  const lastSaleByMedicine = new Map();
  for (const sale of [...sales].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  )) {
    for (const item of sale.items || []) {
      if (!lastSaleByMedicine.has(item.medicineName)) {
        lastSaleByMedicine.set(item.medicineName, sale.createdAt);
      }
    }
  }

  for (const medicine of lowPerforming) {
    const inventory = stockByName.get(medicine.name);
    if (!inventory) medicine.stockStatus = "not_found";
    else if (!inventory.activeBatches) medicine.stockStatus = "inactive";
    else if (inventory.activeStock === 0) medicine.stockStatus = "out_of_stock";
    else if (inventory.activeStock < 10) medicine.stockStatus = "low";
    else medicine.stockStatus = "ok";

    medicine.lastSale = lastSaleByMedicine.get(medicine.name);
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
    Return.find(
      getReturnDateQuery(startOfDay(prevStart), endOfDay(prevEnd)),
    ).lean(),
  ]);

  const prevRevenueFromSales = round2(
    prevSales.reduce((sum, s) => sum + getSaleGrossRevenue(s), 0),
  );
  const prevRefunds = round2(
    prevReturns.reduce((sum, r) => sum + getReturnRevenue(r), 0),
  );
  const prevRevenue = round2(prevRevenueFromSales - prevRefunds);
  const previousKeys = [];
  const previousCursor = startOfDay(prevStart);
  for (let index = 0; index < keys.length; index += 1) {
    previousKeys.push(dateKey(previousCursor));
    previousCursor.setDate(previousCursor.getDate() + 1);
  }
  const previousRevenueByDay = new Map(previousKeys.map((key) => [key, 0]));
  for (const sale of prevSales) {
    const key = dateKey(sale.createdAt);
    previousRevenueByDay.set(
      key,
      round2((previousRevenueByDay.get(key) || 0) + getSaleGrossRevenue(sale)),
    );
  }
  for (const ret of prevReturns) {
    const key = dateKey(getRefundDate(ret));
    previousRevenueByDay.set(
      key,
      round2((previousRevenueByDay.get(key) || 0) - getReturnRevenue(ret)),
    );
  }
  const previousDailySeries = keys.map((date, index) => ({
    date,
    revenue: round2(previousRevenueByDay.get(previousKeys[index]) || 0),
  }));

  const growthComparable = prevRevenue > 0;
  const growthRate =
    growthComparable
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
      growthComparable,
      previousRevenue: prevRevenue,
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
    dailySeries,
    previousDailySeries,
    saleOutcomes,
    topSelling,
    lowPerforming,
    refundSummary: {
      count: returns.length,
      totalRefunds,
      dailyRefunds: refundsDaily,
    },
    // Backward-compatible shape for existing frontend
    legacy: {
      dailySeries,
      previousDailySeries,
      saleOutcomes,
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
        growthComparable,
        previousRevenue: prevRevenue,
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
      salesCounts: computed.salesCounts,
      dailySeries: computed.dailySeries,
      previousDailySeries: computed.previousDailySeries,
      saleOutcomes: computed.saleOutcomes,
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
      dailySeries,
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
    rows.push(["Average Sale Value (KES)", summary.averageSaleValue]);
    rows.push([
      "Revenue Growth (%)",
      summary.growthComparable ? summary.growthRate : "N/A (no positive baseline)",
    ]);
    rows.push(["Previous Period Net Revenue (KES)", summary.previousRevenue]);
    rows.push([
      "Refund Rate (% of gross revenue)",
      summary.grossRevenue > 0
        ? round2((summary.totalRefunds / summary.grossRevenue) * 100)
        : 0,
    ]);
    rows.push([]);

    // Top Selling table
    const boldRowIndexes = [0, 1, 3, 4, rows.length];
    rows.push(["Top Selling Medicines (Net Values)"]);
    boldRowIndexes.push(rows.length);
    rows.push([
      "Medicine Name",
      "Net Units",
      "Revenue (KES)",
      "Profit (KES)",
      "Margin (%)",
      "Refund Rate (%)",
    ]);
    for (const m of topSelling) {
      rows.push([
        m.name,
        m.unitsSold,
        round2(m.revenue),
        round2(m.profit),
        round2(m.profitMargin),
        round2(m.refundRate),
      ]);
    }
    rows.push([]);

    // Low Performing table
    boldRowIndexes.push(rows.length);
    rows.push(["Low Performing Items"]);
    boldRowIndexes.push(rows.length);
    rows.push([
      "Medicine Name",
      "Net Units",
      "Revenue (KES)",
      "Profit (KES)",
      "Margin (%)",
      "Refund Rate (%)",
      "Stock Status",
      "Last Sale in Period",
    ]);
    for (const m of lowPerforming) {
      const stockLabel =
        m.stockStatus === "out_of_stock"
          ? "Out of Stock"
          : m.stockStatus === "low"
            ? "Low Stock"
            : m.stockStatus === "ok"
              ? "In Stock"
              : m.stockStatus === "inactive"
                ? "Inactive"
              : m.stockStatus === "not_found"
              ? "Not in Inventory"
              : "Unknown";
      rows.push([
        m.name,
        m.unitsSold,
        round2(m.revenue),
        round2(m.profit),
        round2(m.profitMargin),
        round2(m.refundRate),
        stockLabel,
        m.lastSale
          ? format(new Date(m.lastSale), "yyyy-MM-dd")
          : "None in period",
      ]);
    }
    rows.push([]);

    // Refund summary
    boldRowIndexes.push(rows.length);
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
      { wch: 18 },
    ];

    // Merge title and period rows across columns A:G
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
    ];

    // Bold style helper
    const boldStyle = { font: { bold: true } };

    // Apply bold to notable rows
    // Apply style to each cell in these rows if exists
    for (const r of boldRowIndexes) {
      for (let c = 0; c <= 7; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (ws[cellRef]) {
          ws[cellRef].s = { ...(ws[cellRef].s || {}), ...boldStyle };
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, "Reports & Analytics");

    const trendRows = [
      ["Date", "Net Revenue (KES)", "Net Profit (KES)", "Sales", "Refunds (KES)"],
      ...dailySeries.map((day) => [
        day.date,
        round2(day.revenue),
        round2(day.profit),
        Number(day.sales || 0),
        round2(day.refunds),
      ]),
    ];
    const trendsSheet = XLSX.utils.aoa_to_sheet(trendRows);
    trendsSheet["!cols"] = [
      { wch: 16 },
      { wch: 22 },
      { wch: 22 },
      { wch: 12 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, trendsSheet, "Daily Trends");

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
