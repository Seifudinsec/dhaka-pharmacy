const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');
const router = express.Router();

// Apply authentication and admin-only middleware to all routes
router.use(protect);
router.use(adminOnly);

// GET /api/audit - Get audit logs with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      resourceType,
      userId,
      startDate,
      endDate,
      search
    } = req.query;

    // Build query
    let query = {};

    if (action) {
      query.action = action;
    }

    if (resourceType) {
      query.resourceType = resourceType;
    }

    if (userId) {
      query.user = userId;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Search in description
    if (search) {
      query.$text = { $search: search };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await AuditLog.countDocuments(query);

    const logs = await AuditLog.find(query)
      .populate('user', 'username role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs'
    });
  }
});

// GET /api/audit/stats - Get audit statistics
router.get('/stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.createdAt.$lte = new Date(endDate);
      }
    }

    // Action counts
    const actionStats = await AuditLog.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // User activity counts
    const userStats = await AuditLog.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$user', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userInfo' } },
      { $unwind: '$userInfo' },
      { $project: { username: '$userInfo.username', role: '$userInfo.role', count: 1 } }
    ]);

    // Resource type counts
    const resourceStats = await AuditLog.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$resourceType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Daily activity (last 30 days)
    const dailyStats = await AuditLog.aggregate([
      { $match: { 
        ...dateFilter,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }},
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        actionStats,
        userStats,
        resourceStats,
        dailyStats
      }
    });
  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit statistics'
    });
  }
});

// GET /api/audit/export - Export audit logs (CSV)
router.get('/export', async (req, res) => {
  try {
    const { startDate, endDate, action, resourceType } = req.query;
    
    let query = {};
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    if (action) {
      query.action = action;
    }

    if (resourceType) {
      query.resourceType = resourceType;
    }

    const logs = await AuditLog.find(query)
      .populate('user', 'username role')
      .sort({ createdAt: -1 })
      .limit(10000); // Limit to prevent huge exports

    // Generate CSV
    const csvHeader = 'Date,User,Action,Resource Type,Description,IP Address,User Agent\n';
    const csvData = logs.map(log => {
      const date = new Date(log.createdAt).toISOString();
      const user = log.user?.username || 'Unknown';
      const action = log.action;
      const resourceType = log.resourceType;
      const description = `"${log.description.replace(/"/g, '""')}"`;
      const ipAddress = log.ipAddress || 'Unknown';
      const userAgent = `"${(log.userAgent || '').replace(/"/g, '""')}"`;
      
      return `${date},${user},${action},${resourceType},${description},${ipAddress},${userAgent}`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${startDate || 'all'}-to-${endDate || 'all'}.csv"`);
    res.send(csvHeader + csvData);
  } catch (error) {
    console.error('Export audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export audit logs'
    });
  }
});

module.exports = router;
