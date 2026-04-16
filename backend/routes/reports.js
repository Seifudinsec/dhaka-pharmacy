const express = require("express");
const { format } = require("date-fns");
const { protect, adminOnly } = require("../middleware/auth");
const Sale = require("../models/Sale");
const Medicine = require("../models/Medicine");
const Return = require("../models/Return");
const XLSX = require("xlsx");
const router = express.Router();

// Apply authentication and admin-only middleware to all routes
router.use(protect);
router.use(adminOnly);

// Get analytics data for reports
router.get("/analytics", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = new Date(
      startDate || new Date().setDate(new Date().getDate() - 30),
    );
    const end = new Date(endDate || new Date());
    end.setHours(23, 59, 59, 999);

    // Get sales AND returns for the period
    const [sales, returns] = await Promise.all([
      Sale.find({ createdAt: { $gte: start, $lte: end } }).populate(
        "servedBy",
        "username",
      ),
      Return.find({ createdAt: { $gte: start, $lte: end } }),
    ]);

    const dailyRevenue = [];
    const dailyProfit = [];
    const dailySales = [];

    const dateRange = [];
    let currentDate = new Date(start);
    while (currentDate <= end) {
      dateRange.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Daily buckets
    for (const date of dateRange) {
      const dStart = new Date(date).setHours(0, 0, 0, 0);
      const dEnd = new Date(date).setHours(23, 59, 59, 999);

      const dSales = sales.filter(
        (s) => s.createdAt >= dStart && s.createdAt <= dEnd,
      );
      const dReturns = returns.filter(
        (r) => r.createdAt >= dStart && r.createdAt <= dEnd,
      );

      // Sale documents already reflect net values after returns,
      // so do not subtract returns again in analytics buckets.
      const revenue = dSales.reduce((sum, s) => sum + s.total, 0);
      const profit = dSales.reduce(
        (sum, s) =>
          sum +
          (s.totalProfit ??
            s.profit ??
            s.items.reduce((itemSum, item) => itemSum + (item.profit || 0), 0)),
        0,
      );

      dailyRevenue.push(Number(revenue.toFixed(2)));
      dailyProfit.push(Number(profit.toFixed(2)));
      dailySales.push(dSales.length);
    }

    // Weekly/Monthly aggregation logic
    const weeklyRevenue = [];
    const monthlyRevenue = [];

    // Simple 7-day chunking for weekly trend
    for (let i = 0; i < dailyRevenue.length; i += 7) {
      weeklyRevenue.push(
        dailyRevenue.slice(i, i + 7).reduce((a, b) => a + b, 0),
      );
    }

    // Simple 30-day chunking for monthly trend
    for (let i = 0; i < dailyRevenue.length; i += 30) {
      monthlyRevenue.push(
        dailyRevenue.slice(i, i + 30).reduce((a, b) => a + b, 0),
      );
    }

    const medicineSales = {};
    sales.forEach((sale) => {
      sale.items.forEach((item) => {
        const medName = item.medicineName;
        if (!medicineSales[medName]) {
          medicineSales[medName] = {
            name: medName,
            unitsSold: 0,
            revenue: 0,
            profit: 0,
          };
        }
        medicineSales[medName].unitsSold += item.quantity;
        medicineSales[medName].revenue += item.subtotal;
        medicineSales[medName].profit += item.profit || 0;
      });
    });

    // Do NOT subtract returns again here.
    // Returned items were already reflected in Sale totals at sale-level.
    // Subtracting return rows again would understate medicine performance.

    const topMedicines = Object.values(medicineSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((med) => ({
        ...med,
        profitMargin: med.revenue > 0 ? (med.profit / med.revenue) * 100 : 0,
      }));

    const lowPerformingMedicines = Object.values(medicineSales)
      .filter((med) => med.unitsSold < 10) // Changed from 5 to 10 for better tracking
      .sort((a, b) => a.unitsSold - b.unitsSold)
      .slice(0, 10);

    for (const med of lowPerformingMedicines) {
      const medicine = await Medicine.findOne({ name: med.name });
      if (medicine) {
        med.stockStatus = medicine.stockStatus;
        med.lastSale = sales
          .filter((sale) =>
            sale.items.some((item) => item.medicineName === med.name),
          )
          .sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
          )[0]?.createdAt;
      }
    }

    // IMPORTANT:
    // Sale.total is already reduced when a return is processed in returns route.
    // So subtracting Return.totalRefund again here would double-count returns.
    const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);

    // Sale.totalProfit is also already decremented on returns.
    // Keep a legacy fallback for old records where totalProfit may not exist.
    const totalProfit = sales.reduce(
      (sum, s) =>
        sum +
        (s.totalProfit ??
          s.profit ??
          s.items.reduce((itemSum, item) => itemSum + (item.profit || 0), 0)),
      0,
    );

    const totalSales = sales.length;
    const averageSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0;
    const profitMargin =
      totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Growth Rate
    const periodDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - periodDays);
    const prevEnd = new Date(start);
    prevEnd.setSeconds(prevEnd.getSeconds() - 1);

    const prevSales = await Sale.find({
      createdAt: { $gte: prevStart, $lte: prevEnd },
    });
    const prevRevenue = prevSales.reduce((sum, s) => sum + s.total, 0);
    const growthRate =
      prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    res.json({
      success: true,
      data: {
        revenue: {
          daily: dailyRevenue,
          weekly: weeklyRevenue,
          monthly: monthlyRevenue,
        },
        profit: { daily: dailyProfit, weekly: [], monthly: [] },
        sales: { daily: dailySales, weekly: [], monthly: [] },
        topMedicines,
        lowPerformingMedicines,
        summary: {
          totalRevenue: Number(totalRevenue.toFixed(2)),
          totalProfit: Number(totalProfit.toFixed(2)),
          totalSales,
          averageSaleValue: Number(averageSaleValue.toFixed(2)),
          profitMargin: Number(profitMargin.toFixed(2)),
          growthRate: Number(growthRate.toFixed(2)),
        },
      },
    });
  } catch (error) {
    console.error("Reports analytics error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to generate analytics report" });
  }
});

// Export reports (CSV/Excel)
router.get("/export", async (req, res) => {
  try {
    const { startDate, endDate, format: exportFormat } = req.query;
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const sales = await Sale.find({
      createdAt: { $gte: start, $lte: end },
    }).populate("servedBy", "username");

    if (exportFormat === "csv") {
      const csvHeader =
        "Date,Transaction ID,Items,Total,Profit,Served By,Status\n";
      const csvData = sales
        .map((sale) => {
          const items = sale.items
            .map((item) => `${item.medicineName}×${item.quantity}`)
            .join("; ");
          return `"${format(new Date(sale.createdAt), "yyyy-MM-dd HH:mm")}",${sale._id},"${items}",${sale.total},${sale.totalProfit || 0},"${sale.servedBy?.username || "N/A"}",${sale.status || "completed"}`;
        })
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="pharmacy-report-${startDate}-to-${endDate}.csv"`,
      );
      res.send(csvHeader + csvData);
    } else if (exportFormat === "xlsx") {
      const reportData = sales.map((sale) => ({
        Date: new Date(sale.createdAt).toLocaleString(),
        "Transaction ID": sale._id.toString(),
        Items: sale.items
          .map((i) => `${i.medicineName} (x${i.quantity})`)
          .join(", "),
        "Total (KES)": sale.total,
        "Profit (KES)": sale.totalProfit || 0,
        "Served By": sale.servedBy?.username || "N/A",
        Status: sale.status || "completed",
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(reportData);

      // Auto-size columns roughly
      const wscols = [
        { wch: 25 },
        { wch: 25 },
        { wch: 40 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
      ];
      ws["!cols"] = wscols;

      XLSX.utils.book_append_sheet(wb, ws, "Sales Report");

      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="pharmacy-report-${startDate}-to-${endDate}.xlsx"`,
      );
      res.send(buf);
    } else {
      res
        .status(400)
        .json({ success: false, message: "Unsupported export format" });
    }
  } catch (error) {
    console.error("Export error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to export report" });
  }
});

module.exports = router;
