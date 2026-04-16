const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const Sale = require('../models/Sale');
const Medicine = require('../models/Medicine');
const router = express.Router();

// Apply authentication and admin-only middleware to all routes
router.use(protect);
router.use(adminOnly);

// Get analytics data for reports
router.get('/analytics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include end date

    // Get sales data for the period
    const sales = await Sale.find({
      createdAt: { $gte: start, $lte: end }
    }).populate('servedBy', 'username');

    // Calculate daily, weekly, monthly data
    const dailyRevenue = [];
    const dailyProfit = [];
    const dailySales = [];

    // Create date range array
    const dateRange = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      dateRange.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate metrics for each day
    for (const date of dateRange) {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const daySales = sales.filter(sale => 
        sale.createdAt >= dayStart && sale.createdAt <= dayEnd
      );

      const revenue = daySales.reduce((sum, sale) => sum + sale.total, 0);
      const profit = daySales.reduce((sum, sale) => sum + (sale.profit || 0), 0);

      dailyRevenue.push(revenue);
      dailyProfit.push(profit);
      dailySales.push(daySales.length);
    }

    // Get top selling medicines
    const medicineSales = {};
    sales.forEach(sale => {
      sale.items.forEach(item => {
        if (!medicineSales[item.medicineName]) {
          medicineSales[item.medicineName] = {
            name: item.medicineName,
            unitsSold: 0,
            revenue: 0,
            profit: 0
          };
        }
        medicineSales[item.medicineName].unitsSold += item.quantity;
        medicineSales[item.medicineName].revenue += item.total;
        medicineSales[item.medicineName].profit += (item.profit || 0);
      });
    });

    const topMedicines = Object.values(medicineSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(med => ({
        ...med,
        profitMargin: med.revenue > 0 ? (med.profit / med.revenue) * 100 : 0
      }));

    // Get low performing medicines (sold less than 5 units in period)
    const lowPerformingMedicines = Object.values(medicineSales)
      .filter(med => med.unitsSold < 5)
      .sort((a, b) => a.unitsSold - b.unitsSold)
      .slice(0, 10);

    // Add stock status to low performing medicines
    for (const med of lowPerformingMedicines) {
      const medicine = await Medicine.findOne({ name: med.name });
      if (medicine) {
        med.stockStatus = medicine.stockStatus;
        med.lastSale = sales
          .filter(sale => sale.items.some(item => item.medicineName === med.name))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]?.createdAt;
      }
    }

    // Calculate summary metrics
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
    const totalProfit = sales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
    const totalSales = sales.length;
    const averageSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Calculate growth rate (compare with previous period)
    const previousPeriodStart = new Date(start);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - (dateRange.length - 1));
    const previousPeriodEnd = new Date(end);
    previousPeriodEnd.setDate(previousPeriodEnd.getDate() - (dateRange.length - 1));

    const previousSales = await Sale.find({
      createdAt: { $gte: previousPeriodStart, $lte: previousPeriodEnd }
    });

    const previousRevenue = previousSales.reduce((sum, sale) => sum + sale.total, 0);
    const growthRate = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    res.json({
      success: true,
      data: {
        revenue: { daily: dailyRevenue, weekly: [], monthly: [] },
        profit: { daily: dailyProfit, weekly: [], monthly: [] },
        sales: { daily: dailySales, weekly: [], monthly: [] },
        topMedicines,
        lowPerformingMedicines,
        summary: {
          totalRevenue,
          totalProfit,
          totalSales,
          averageSaleValue,
          profitMargin,
          growthRate
        }
      }
    });
  } catch (error) {
    console.error('Reports analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate analytics report'
    });
  }
});

// Export reports (CSV/Excel)
router.get('/export', async (req, res) => {
  try {
    const { startDate, endDate, format } = req.query;
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const sales = await Sale.find({
      createdAt: { $gte: start, $lte: end }
    }).populate('servedBy', 'username');

    if (format === 'csv') {
      // Generate CSV
      const csvHeader = 'Date,Transaction ID,Items,Total,Profit,Served By\n';
      const csvData = sales.map(sale => {
        const items = sale.items.map(item => `${item.medicineName}×${item.quantity}`).join(';');
        return `${new Date(sale.createdAt).toISOString()},${sale._id},"${items}",${sale.total},${sale.profit || 0},${sale.servedBy?.username || 'N/A'}`;
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="pharmacy-report-${startDate}-to-${endDate}.csv"`);
      res.send(csvHeader + csvData);
    } else if (format === 'xlsx') {
      // For Excel export, we'd need a library like xlsx
      // For now, return CSV format
      const csvHeader = 'Date,Transaction ID,Items,Total,Profit,Served By\n';
      const csvData = sales.map(sale => {
        const items = sale.items.map(item => `${item.medicineName}×${item.quantity}`).join(';');
        return `${new Date(sale.createdAt).toISOString()},${sale._id},"${items}",${sale.total},${sale.profit || 0},${sale.servedBy?.username || 'N/A'}`;
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="pharmacy-report-${startDate}-to-${endDate}.csv"`);
      res.send(csvHeader + csvData);
    } else {
      res.status(400).json({
        success: false,
        message: 'Unsupported export format'
      });
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export report'
    });
  }
});

module.exports = router;
