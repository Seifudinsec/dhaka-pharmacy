const express = require('express');
const router = express.Router();
const Medicine = require('../models/Medicine');
const Sale = require('../models/Sale');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const [
      totalMedicines,
      lowStockCount,
      outOfStockCount,
      expiredCount,
      expiringSoonCount,
      todaySalesAgg,
      todayProfitAgg,
      totalRevenueAgg,
      inventoryValueAgg,
      totalStockUnitsAgg,
      recentSales,
      topProfitProducts,
      topLossProducts,
      criticalStockItems,
      expiredItems,
    ] = await Promise.all([
      Medicine.countDocuments({ status: 'active' }),
      Medicine.countDocuments({ status: 'active', stock: { $gt: 0, $lt: 10 } }),
      Medicine.countDocuments({ status: 'active', stock: 0 }),
      Medicine.countDocuments({ status: 'active', expiryDate: { $lt: now } }),
      Medicine.countDocuments({ status: 'active', expiryDate: { $gte: now, $lte: nextMonth } }),
      Sale.aggregate([
        { $match: { createdAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),
      Sale.aggregate([
        { $match: { createdAt: { $gte: todayStart } } },
        { $group: { _id: null, totalProfit: { $sum: '$totalProfit' } } },
      ]),
      Sale.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]),
      Medicine.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, totalValue: { $sum: { $multiply: ['$buyingPrice', '$stock'] } } } },
      ]),
      Medicine.aggregate([{ $match: { status: 'active' } }, { $group: { _id: null, total: { $sum: '$stock' } } }]),
      Sale.find().sort({ createdAt: -1 }).limit(5).populate('servedBy', 'username'),
      Medicine.aggregate([
        {
          $addFields: {
            estimatedStockProfit: { $multiply: [{ $subtract: ['$price', '$buyingPrice'] }, '$stock'] },
          },
        },
        { $match: { status: 'active', estimatedStockProfit: { $gt: 0 } } },
        { $sort: { estimatedStockProfit: -1 } },
        { $limit: 5 },
        { $project: { name: 1, stock: 1, price: 1, buyingPrice: 1, estimatedStockProfit: 1, _id: 1 } },
      ]),
      Medicine.aggregate([
        {
          $addFields: {
            estimatedStockProfit: { $multiply: [{ $subtract: ['$price', '$buyingPrice'] }, '$stock'] },
          },
        },
        { $match: { status: 'active', estimatedStockProfit: { $lt: 0 } } },
        { $sort: { estimatedStockProfit: 1 } },
        { $limit: 5 },
        { $project: { name: 1, stock: 1, price: 1, buyingPrice: 1, estimatedStockProfit: 1, _id: 1 } },
      ]),
      Medicine.find({ status: 'active', stock: { $lt: 10 } }).limit(5),
      Medicine.find({ status: 'active', expiryDate: { $lt: now } }).limit(5),
    ]);

    res.json({
      success: true,
      data: {
        totalMedicines,
        lowStockCount,
        outOfStockCount,
        expiredCount,
        expiringSoonCount,
        totalStockUnits: totalStockUnitsAgg[0]?.total || 0,
        inventoryValue: Number((inventoryValueAgg[0]?.totalValue || 0).toFixed(2)),
        totalRevenue: Number((totalRevenueAgg[0]?.total || 0).toFixed(2)),
        todaySales: {
          count: todaySalesAgg[0]?.count || 0,
          total: Number((todaySalesAgg[0]?.total || 0).toFixed(2)),
        },
        todayProfit: Number((todayProfitAgg[0]?.totalProfit || 0).toFixed(2)),
        topProfitProducts,
        topLossProducts,
        recentSales,
        criticalStockItems,
        expiredItems,
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats.' });
  }
});

module.exports = router;
