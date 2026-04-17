const express = require("express");
const { format } = require("date-fns");
const { protect, adminOnly } = require("../middleware/auth");
const Sale = require("../models/Sale");
const Medicine = require("../models/Medicine");
const Return = require("../models/Return");
const XLSX = require("xlsx");

const router = express.Router();

router.use(protect);
router.use(adminOnly);

const round2 = (n) => Number((Number(n) || 0).toFixed(2));
const toDate = (v) => new Date(v);
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

const getRange = (startDate, endDate) => {
  const start = startDate
    ? startOfDay(toDate(startDate))
    : startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const end = endDate ? endOfDay(toDate(endDate)) : endOfDay(new Date());
  return { start, end };
};

const rangeToDayKeys = (start, end) => {
  const keys = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  while (cur <= end) {
    keys.push(dateKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
};

// GET /api/reports/analytics
// Event-based accounting by date:
// - Sales add revenue/profit on sale.createdAt day
// - Returns subtract revenue/profit on return.createdAt day
router.get("/analytics", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = getRange(startDate, endDate);

    const [sales, returns] = await Promise.all([
      Sale.find({ createdAt: { $gte: start, $lte: end } })
        .populate("servedBy", "username")
        .lean(),
      Return.find({ createdAt: { $gte: start, $lte: end } }).lean(),
    ]);

    const dayKeys = rangeToDayKeys(start, end);
    const revenueByDay = new Map(dayKeys.map((k) => [k, 0]));
    const profitByDay = new Map(dayKeys.map((k) => [k, 0]));
    const salesCountByDay = new Map(dayKeys.map((k) => [k, 0]));

    const medicineSales = {};
    const medicineReturns = {};

    const ensureMedicine = (container, medName) => {
      if (!container[medName]) {
        container[medName] = { name: medName, units: 0, revenue: 0, profit: 0 };
      }
      return container[medName];
    };

    // Sales events (+)
    for (const sale of sales) {
      const k = dateKey(sale.createdAt);
      const saleRevenue = round2(
        Array.isArray(sale.items)
          ? sale.items.reduce(
              (sum, it) => sum + Number(it?.subtotal ?? it?.total ?? 0),
              0,
            )
          : Number(sale.total || 0),
      );
      const saleProfit = round2(
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

      revenueByDay.set(k, round2((revenueByDay.get(k) || 0) + saleRevenue));
      profitByDay.set(k, round2((profitByDay.get(k) || 0) + saleProfit));
      salesCountByDay.set(k, (salesCountByDay.get(k) || 0) + 1);

      for (const item of sale.items || []) {
        const medName = item.medicineName || "Unknown";
        const row = ensureMedicine(medicineSales, medName);
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

    // Return/refund events (-) on return date
    for (const ret of returns) {
      const k = dateKey(ret.createdAt);
      const refund = round2(ret.totalRefund ?? 0);
      const profitLoss = round2(ret.totalProfitLoss ?? 0);

      revenueByDay.set(k, round2((revenueByDay.get(k) || 0) - refund));
      profitByDay.set(k, round2((profitByDay.get(k) || 0) - profitLoss));

      for (const item of ret.items || []) {
        const medName = item.medicineName || "Unknown";
        const row = ensureMedicine(medicineReturns, medName);
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

    const dailyRevenue = dayKeys.map((k) => round2(revenueByDay.get(k) || 0));
    const dailyProfit = dayKeys.map((k) => round2(profitByDay.get(k) || 0));
    const dailySales = dayKeys.map((k) => Number(salesCountByDay.get(k) || 0));

    const weeklyRevenue = [];
    for (let i = 0; i < dailyRevenue.length; i += 7) {
      weeklyRevenue.push(
        round2(dailyRevenue.slice(i, i + 7).reduce((a, b) => a + b, 0)),
      );
    }

    const monthlyRevenue = [];
    for (let i = 0; i < dailyRevenue.length; i += 30) {
      monthlyRevenue.push(
        round2(dailyRevenue.slice(i, i + 30).reduce((a, b) => a + b, 0)),
      );
    }

    const allMedNames = new Set([
      ...Object.keys(medicineSales),
      ...Object.keys(medicineReturns),
    ]);

    const medicineNet = [];
    for (const medName of allMedNames) {
      const s = medicineSales[medName] || { units: 0, revenue: 0, profit: 0 };
      const r = medicineReturns[medName] || { units: 0, revenue: 0, profit: 0 };

      const netUnits = round2(s.units - r.units);
      const netRevenue = round2(s.revenue - r.revenue);
      const netProfit = round2(s.profit - r.profit);

      medicineNet.push({
        name: medName,
        unitsSold: netUnits,
        revenue: netRevenue,
        profit: netProfit,
        profitMargin: netRevenue !== 0 ? (netProfit / netRevenue) * 100 : 0,
      });
    }

    const topMedicines = medicineNet
      .filter((m) => m.unitsSold > 0 || m.revenue !== 0 || m.profit !== 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const lowPerformingMedicines = medicineNet
      .filter((m) => m.unitsSold >= 0 && m.unitsSold < 10)
      .sort((a, b) => a.unitsSold - b.unitsSold)
      .slice(0, 10);

    for (const med of lowPerformingMedicines) {
      const medicine = await Medicine.findOne({ name: med.name }).lean();
      if (medicine) {
        med.stockStatus = medicine.stockStatus;
      }

      const lastSale = sales
        .filter((sale) =>
          (sale.items || []).some((item) => item.medicineName === med.name),
        )
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

      med.lastSale = lastSale?.createdAt;
    }

    const totalRevenue = round2(dailyRevenue.reduce((a, b) => a + b, 0));
    const totalProfit = round2(dailyProfit.reduce((a, b) => a + b, 0));
    const totalSales = sales.length; // number of sale events in period
    const averageSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0;
    const profitMargin =
      totalRevenue !== 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Growth rate using same event-based definition
    const periodDays = Math.max(
      1,
      Math.ceil((end - start) / (1000 * 60 * 60 * 24)),
    );
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - periodDays);
    prevStart.setHours(0, 0, 0, 0);
    const prevEnd = new Date(start);
    prevEnd.setMilliseconds(-1);

    const [prevSales, prevReturns] = await Promise.all([
      Sale.find({ createdAt: { $gte: prevStart, $lte: prevEnd } }).lean(),
      Return.find({ createdAt: { $gte: prevStart, $lte: prevEnd } }).lean(),
    ]);

    const prevSalesRevenue = prevSales.reduce((sum, s) => {
      const grossFromItems = Array.isArray(s.items)
        ? s.items.reduce(
            (itemSum, it) => itemSum + Number(it?.subtotal ?? it?.total ?? 0),
            0,
          )
        : Number(s.total || 0);
      return sum + grossFromItems;
    }, 0);
    const prevReturnsRefund = prevReturns.reduce(
      (sum, r) => sum + Number(r.totalRefund || 0),
      0,
    );
    const prevRevenue = round2(prevSalesRevenue - prevReturnsRefund);

    const growthRate =
      prevRevenue !== 0
        ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
        : 0;

    res.json({
      success: true,
      data: {
        revenue: {
          daily: dailyRevenue,
          weekly: weeklyRevenue,
          monthly: monthlyRevenue,
        },
        profit: {
          daily: dailyProfit,
          weekly: [],
          monthly: [],
        },
        sales: {
          daily: dailySales,
          weekly: [],
          monthly: [],
        },
        topMedicines,
        lowPerformingMedicines,
        summary: {
          totalRevenue: round2(totalRevenue),
          totalProfit: round2(totalProfit),
          totalSales,
          averageSaleValue: round2(averageSaleValue),
          profitMargin: round2(profitMargin),
          growthRate: round2(growthRate),
        },
      },
    });
  } catch (error) {
    console.error("Reports analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate analytics report",
    });
  }
});

// GET /api/reports/export
// Exports sale events in range (kept aligned with Sales history export style)
router.get("/export", async (req, res) => {
  try {
    const { startDate, endDate, format: exportFormat } = req.query;
    const { start, end } = getRange(startDate, endDate);

    const sales = await Sale.find({
      createdAt: { $gte: start, $lte: end },
    }).populate("servedBy", "username");

    if (exportFormat === "csv") {
      const csvHeader =
        "Date,Transaction ID,Items,Total,Profit,Served By,Status\n";
      const csvData = sales
        .map((sale) => {
          const items = (sale.items || [])
            .map((item) => `${item.medicineName}×${item.quantity}`)
            .join("; ");

          const saleProfit = Number(
            sale.totalProfit ??
              sale.profit ??
              (Array.isArray(sale.items)
                ? sale.items.reduce(
                    (sum, it) => sum + Number(it?.profit || 0),
                    0,
                  )
                : 0),
          );

          return `"${format(new Date(sale.createdAt), "yyyy-MM-dd HH:mm")}",${sale._id},"${items}",${Number(sale.total || 0)},${saleProfit},"${sale.servedBy?.username || "N/A"}",${sale.status || "completed"}`;
        })
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="pharmacy-report-${format(start, "yyyy-MM-dd")}-to-${format(end, "yyyy-MM-dd")}.csv"`,
      );
      return res.send(csvHeader + csvData);
    }

    if (exportFormat === "xlsx") {
      const reportData = sales.map((sale) => ({
        Date: new Date(sale.createdAt).toLocaleString(),
        "Transaction ID": sale._id.toString(),
        Items: (sale.items || [])
          .map((i) => `${i.medicineName} (x${i.quantity})`)
          .join(", "),
        "Total (KES)": Number(sale.total || 0),
        "Profit (KES)": Number(
          sale.totalProfit ??
            sale.profit ??
            (Array.isArray(sale.items)
              ? sale.items.reduce((sum, it) => sum + Number(it?.profit || 0), 0)
              : 0),
        ),
        "Served By": sale.servedBy?.username || "N/A",
        Status: sale.status || "completed",
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(reportData);
      ws["!cols"] = [
        { wch: 25 },
        { wch: 25 },
        { wch: 40 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Sales Report");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="pharmacy-report-${format(start, "yyyy-MM-dd")}-to-${format(end, "yyyy-MM-dd")}.xlsx"`,
      );
      return res.send(buf);
    }

    return res.status(400).json({
      success: false,
      message: "Unsupported export format",
    });
  } catch (error) {
    console.error("Export error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to export report",
    });
  }
});

module.exports = router;
