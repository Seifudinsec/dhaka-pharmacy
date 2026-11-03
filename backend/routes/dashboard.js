const express = require('express');
const router = express.Router();
const Medicine = require('../models/Medicine');
const Sale = require('../models/Sale');
const { protect } = require('../middleware/auth');
const { ownerScope } = require('../middleware/authorization');

router.use(protect);

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const isAdmin = req.user.role === 'admin' || req.user.role === 'main_admin';
    const saleScope = ownerScope(req.user, 'servedBy');
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nairobiDateParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .reduce((parts, part) => {
        if (part.type !== "literal") parts[part.type] = Number(part.value);
        return parts;
      }, {});
    const nairobiTodayUtc = Date.UTC(
      nairobiDateParts.year,
      nairobiDateParts.month - 1,
      nairobiDateParts.day,
    );
    const salesTrendStart = new Date(nairobiTodayUtc - 6 * 86400000 - 3 * 3600000);
    const salesTrendEnd = new Date(nairobiTodayUtc + 21 * 3600000);
    const salesTrendKeys = Array.from({ length: 7 }, (_, index) =>
      new Date(nairobiTodayUtc - (6 - index) * 86400000)
        .toISOString()
        .slice(0, 10),
    );

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
      totalPotentialLossAgg,
      stockHealthAgg,
      salesTrendAgg,
    ] = await Promise.all([
      Medicine.countDocuments({ status: 'active' }),
      Medicine.countDocuments({ status: 'active', stock: { $gt: 0, $lt: 10 } }),
      Medicine.countDocuments({ status: 'active', stock: 0 }),
      Medicine.countDocuments({ status: 'active', expiryDate: { $lt: now } }),
      Medicine.countDocuments({ status: 'active', expiryDate: { $gte: now, $lte: nextMonth } }),
      Sale.aggregate([
        { $match: { ...saleScope, createdAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),
      isAdmin
        ? Sale.aggregate([
            { $match: { createdAt: { $gte: todayStart } } },
            { $group: { _id: null, totalProfit: { $sum: '$totalProfit' } } },
          ])
        : Promise.resolve([]),
      isAdmin
        ? Sale.aggregate([
            { $group: { _id: null, total: { $sum: '$total' } } },
          ])
        : Promise.resolve([]),
      isAdmin ? Medicine.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, totalValue: { $sum: { $multiply: ['$buyingPrice', '$stock'] } } } },
      ]) : Promise.resolve([]),
      Medicine.aggregate([{ $match: { status: 'active' } }, { $group: { _id: null, total: { $sum: '$stock' } } }]),
      Sale.find(saleScope)
        .select(isAdmin ? '' : '-items.buyingPrice -items.profit -totalProfit')
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('servedBy', 'username'),
      isAdmin ? Medicine.aggregate([
        {
          $addFields: {
            estimatedStockProfit: { $multiply: [{ $subtract: ['$price', '$buyingPrice'] }, '$stock'] },
          },
        },
        { $match: { status: 'active', estimatedStockProfit: { $gt: 0 } } },
        { $sort: { estimatedStockProfit: -1 } },
        { $limit: 5 },
        { $project: { name: 1, stock: 1, price: 1, buyingPrice: 1, estimatedStockProfit: 1, _id: 1 } },
      ]) : Promise.resolve([]),
      isAdmin ? Medicine.aggregate([
        { $match: { status: 'active', stock: { $gt: 0 } } },
        {
          $addFields: {
            isExpired: { $lt: ['$expiryDate', now] },
            isExpiringSoon: { $and: [{ $gte: ['$expiryDate', now] }, { $lte: ['$expiryDate', nextMonth] }] },
            sellsBelowCost: { $lt: ['$price', '$buyingPrice'] },
          },
        },
        {
          $addFields: {
            lossType: {
              $cond: [
                '$isExpired',
                'EXPIRED',
                {
                  $cond: [
                    '$sellsBelowCost',
                    'BELOW_COST',
                    {
                      $cond: [{ $and: ['$isExpiringSoon', { $gte: ['$stock', 10] }] }, 'EXPIRING_RISK', null],
                    },
                  ],
                },
              ],
            },
            lossAmount: {
              $cond: [
                '$isExpired',
                { $multiply: ['$buyingPrice', '$stock'] },
                {
                  $cond: [
                    '$sellsBelowCost',
                    { $multiply: [{ $subtract: ['$buyingPrice', '$price'] }, '$stock'] },
                    { $multiply: ['$buyingPrice', '$stock'] },
                  ],
                },
              ],
            },
          },
        },
        { $match: { lossType: { $ne: null } } },
        { $sort: { lossAmount: -1 } },
        { $limit: 10 },
        {
          $project: {
            name: 1, stock: 1, price: 1, buyingPrice: 1, expiryDate: 1,
            lossType: 1, lossAmount: 1, _id: 1,
          },
        },
      ]) : Promise.resolve([]),
      Medicine.find({ status: 'active', stock: { $lt: 10 } })
        .select(isAdmin ? '' : 'name stock expiryDate')
        .limit(5),
      Medicine.find({ status: 'active', expiryDate: { $lt: now } })
        .select(isAdmin ? '' : 'name stock expiryDate')
        .limit(5),
      isAdmin ? Medicine.aggregate([
        { $match: { status: 'active', stock: { $gt: 0 } } },
        {
          $addFields: {
            isExpired: { $lt: ['$expiryDate', now] },
            sellsBelowCost: { $lt: ['$price', '$buyingPrice'] },
            isExpiringSoon: { $and: [{ $gte: ['$expiryDate', now] }, { $lte: ['$expiryDate', nextMonth] }] },
          },
        },
        {
          $addFields: {
            lossAmount: {
              $cond: [
                '$isExpired',
                { $multiply: ['$buyingPrice', '$stock'] },
                {
                  $cond: [
                    '$sellsBelowCost',
                    { $multiply: [{ $subtract: ['$buyingPrice', '$price'] }, '$stock'] },
                    {
                      $cond: [
                        { $and: ['$isExpiringSoon', { $gte: ['$stock', 10] }] },
                        { $multiply: ['$buyingPrice', '$stock'] },
                        0,
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
        { $group: { _id: null, total: { $sum: '$lossAmount' } } },
      ]) : Promise.resolve([]),
      Medicine.aggregate([
        { $match: { status: "active" } },
        {
          $group: {
            _id: null,
            healthy: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$stock", 10] },
                      { $gte: ["$expiryDate", now] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            low: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ["$stock", 0] },
                      { $lt: ["$stock", 10] },
                      { $gte: ["$expiryDate", now] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            out: {
              $sum: { $cond: [{ $eq: ["$stock", 0] }, 1, 0] },
            },
            expired: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ["$stock", 0] },
                      { $lt: ["$expiryDate", now] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      Sale.aggregate([
        {
          $match: {
            ...saleScope,
            createdAt: { $gte: salesTrendStart, $lt: salesTrendEnd },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: "Africa/Nairobi",
              },
            },
            total: { $sum: "$total" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);
    const salesTrendByDate = new Map(
      salesTrendAgg.map((day) => [day._id, day]),
    );

    const data = {
      totalMedicines,
      lowStockCount,
      outOfStockCount,
      expiredCount,
      expiringSoonCount,
      totalStockUnits: totalStockUnitsAgg[0]?.total || 0,
      stockHealth: {
        healthy: stockHealthAgg[0]?.healthy || 0,
        low: stockHealthAgg[0]?.low || 0,
        out: stockHealthAgg[0]?.out || 0,
        expired: stockHealthAgg[0]?.expired || 0,
      },
      salesTrend: salesTrendKeys.map((date) => ({
        date,
        total: Number((salesTrendByDate.get(date)?.total || 0).toFixed(2)),
        count: salesTrendByDate.get(date)?.count || 0,
      })),
      todaySales: {
        count: todaySalesAgg[0]?.count || 0,
        ...(isAdmin
          ? { total: Number((todaySalesAgg[0]?.total || 0).toFixed(2)) }
          : {}),
      },
      recentSales,
      criticalStockItems,
      expiredItems,
    };

    if (isAdmin) {
      Object.assign(data, {
        inventoryValue: Number((inventoryValueAgg[0]?.totalValue || 0).toFixed(2)),
        totalRevenue: Number((totalRevenueAgg[0]?.total || 0).toFixed(2)),
        todayProfit: Number((todayProfitAgg[0]?.totalProfit || 0).toFixed(2)),
        topProfitProducts,
        potentialLossItems: topLossProducts,
        totalPotentialLoss: Number((totalPotentialLossAgg[0]?.total || 0).toFixed(2)),
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats.' });
  }
});

module.exports = router;
