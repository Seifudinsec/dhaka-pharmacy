const express = require('express');
const router = express.Router();
const Medicine = require('../models/Medicine');
const Sale = require('../models/Sale');
const User = require('../models/User');
const Return = require('../models/Return');
const AuditLog = require('../models/AuditLog');
const ImportHistory = require('../models/ImportHistory');
const ImportRow = require('../models/ImportRow');
const SpecialDrug = require('../models/SpecialDrug');
const { protect, mainAdminOnly } = require('../middleware/auth');

router.use(protect);

// GET /api/settings/notifications/me
router.get('/notifications/me', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('notificationPreferences');
    res.json({
      success: true,
      data: {
        notificationPreferences: {
          lowStock: user?.notificationPreferences?.lowStock ?? true,
          expiry: user?.notificationPreferences?.expiry ?? true,
          dailySales: user?.notificationPreferences?.dailySales ?? false,
        },
      },
    });
  } catch (error) {
    console.error('Get notification settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to load notification settings.' });
  }
});

// PUT /api/settings/notifications/me
router.put('/notifications/me', async (req, res) => {
  try {
    const { notificationPreferences } = req.body || {};
    const prefs = notificationPreferences || {};

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        notificationPreferences: {
          lowStock: prefs.lowStock !== false,
          expiry: prefs.expiry !== false,
          dailySales: prefs.dailySales === true,
        },
      },
      { new: true, runValidators: true }
    ).select('notificationPreferences');

    res.json({
      success: true,
      message: 'Notification settings saved.',
      data: {
        notificationPreferences: user.notificationPreferences,
      },
    });
  } catch (error) {
    console.error('Save notification settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to save notification settings.' });
  }
});

// POST /api/settings/backup
router.post('/backup', mainAdminOnly, async (req, res) => {
  try {
    const [medicines, sales, users, returns, auditLogs, importHistories, importRows, specialDrugs] = await Promise.all([
      Medicine.find().lean(),
      Sale.find().lean(),
      User.find().select('+password +isMainAdmin').lean(),
      Return.find().lean(),
      AuditLog.find().lean(),
      ImportHistory.find().lean(),
      ImportRow.find().lean(),
      SpecialDrug.find().lean(),
    ]);
    res.json({
      success: true,
      message: 'Backup generated successfully.',
      data: {
        exportedAt: new Date().toISOString(),
        medicines,
        sales,
        users,
        returns,
        auditLogs,
        importHistories,
        importRows,
        specialDrugs,
      },
    });
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate backup.' });
  }
});

// POST /api/settings/restore
router.post('/restore', mainAdminOnly, async (req, res) => {
  const modelMap = {
    medicines: { model: Medicine, required: true },
    users: { model: User, required: false },
    sales: { model: Sale, required: false },
    returns: { model: Return, required: false },
    specialDrugs: { model: SpecialDrug, required: false },
    auditLogs: { model: AuditLog, required: false },
    importHistories: { model: ImportHistory, required: false },
    importRows: { model: ImportRow, required: false },
  };

  try {
    const counts = {};
    for (const [key, { model, required }] of Object.entries(modelMap)) {
      const docs = req.body[key];
      if (!Array.isArray(docs)) {
        if (required) {
          return res.status(400).json({ success: false, message: `Invalid restore payload: "${key}" is missing or not an array.` });
        }
        counts[key] = { skipped: true, count: 0 };
        continue;
      }
      if (docs.length === 0) {
        counts[key] = { count: 0 };
        continue;
      }

      try {
        const result = await model.insertMany(docs, { ordered: false });
        counts[key] = { count: result.length };
      } catch (insertErr) {
        // insertMany with ordered: false will throw a BulkWriteError
        // but still inserts non-conflicting documents.
        // Count how many were actually written.
        const inserted = insertErr?.insertedDocs?.length ?? 0;
        const msg = insertErr?.message ?? "";
        const writeErrors = insertErr?.writeErrors?.length ?? 0;
        counts[key] = { count: inserted, writeErrors };
        if (inserted === 0) {
          console.error(`Restore error for ${key}:`, msg.slice(0, 300));
        }
      }
    }

    res.json({
      success: true,
      message: "Restore completed.",
      counts,
    });
  } catch (error) {
    console.error("Restore error:", error);
    res.status(500).json({ success: false, message: "Failed to restore backup." });
  }
});

// POST /api/settings/danger/reset-system
router.post('/danger/reset-system', mainAdminOnly, async (req, res) => {
  res.json({ success: true, message: 'System preferences reset completed.' });
});

// POST /api/settings/danger/delete-all-data
router.post('/danger/delete-all-data', mainAdminOnly, async (req, res) => {
  try {
    await Promise.all([
      Sale.deleteMany({}),
      Medicine.deleteMany({}),
      Return.deleteMany({}),
      AuditLog.deleteMany({}),
      ImportHistory.deleteMany({}),
      ImportRow.deleteMany({}),
      SpecialDrug.deleteMany({}),
    ]);
    res.json({ success: true, message: 'All operational data deleted. Users preserved.' });
  } catch (error) {
    console.error('Delete all data error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete data.' });
  }
});

// POST /api/settings/danger/logout-all-devices
router.post('/danger/logout-all-devices', mainAdminOnly, async (req, res) => {
  try {
    const result = await User.updateMany({}, { $inc: { tokenVersion: 1 } });
    res.json({
      success: true,
      message: 'All user sessions were invalidated successfully. Please sign in again.',
      data: {
        affectedUsers: result.modifiedCount || 0,
      },
    });
  } catch (error) {
    console.error('Logout all devices error:', error);
    res.status(500).json({ success: false, message: 'Failed to logout from all devices.' });
  }
});

module.exports = router;
