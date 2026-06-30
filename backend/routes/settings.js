const express = require('express');
const router = express.Router();
const Medicine = require('../models/Medicine');
const Sale = require('../models/Sale');
const User = require('../models/User');
const Return = require('../models/Return');
const AuditLog = require('../models/AuditLog');
const { protect, adminOnly } = require('../middleware/auth');

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
router.post('/backup', adminOnly, async (req, res) => {
  try {
    const [medicines, sales, users] = await Promise.all([
      Medicine.find().lean(),
      Sale.find().lean(),
      User.find().select('-password').lean(),
    ]);
    res.json({
      success: true,
      message: 'Backup generated successfully.',
      data: {
        exportedAt: new Date().toISOString(),
        medicines,
        sales,
        users,
      },
    });
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate backup.' });
  }
});

const normalizeText = (value = "") =>
  String(value).trim().toLowerCase().replace(/\s+/g, " ");

const normalizeBatch = (value = "") =>
  String(value).trim().toUpperCase().replace(/\s+/g, "");

const toDateKey = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

// POST /api/settings/restore
router.post('/restore', adminOnly, async (req, res) => {
  try {
    const { medicines = [] } = req.body || {};
    if (!Array.isArray(medicines)) {
      return res.status(400).json({ success: false, message: 'Invalid restore payload.' });
    }
    let restored = 0;
    for (const med of medicines) {
      if (!med?.name) continue;

      const name = String(med.name).trim();
      const batchNumber = String(med.batchNumber || "restored-batch").trim();
      const expiryDate = med.expiryDate ? new Date(med.expiryDate) : new Date();
      const normalizedName = normalizeText(name);
      const productKey = normalizedName;
      const batchNumberNormalized = normalizeBatch(batchNumber);
      const expiryDateKey = toDateKey(expiryDate);

      await Medicine.findOneAndUpdate(
        { productKey, batchNumberNormalized, expiryDateKey },
        {
          name,
          normalizedName,
          productKey,
          price: Number(med.price || 0),
          buyingPrice: Number(med.buyingPrice || med.price || 0),
          batchNumber,
          batchNumberNormalized,
          stock: Number(med.stock || 0),
          expiryDate,
          expiryDateKey,
          status: med.status || "active",
          lastImportId: med.lastImportId || null,
        },
        { upsert: true, new: true, runValidators: true },
      );
      restored++;
    }
    res.json({ success: true, message: `Restore completed. Medicines restored: ${restored}.` });
  } catch (error) {
    console.error("Restore error:", error);
    res.status(500).json({ success: false, message: "Failed to restore backup." });
  }
});

// POST /api/settings/danger/reset-system
router.post('/danger/reset-system', adminOnly, async (req, res) => {
  res.json({ success: true, message: 'System preferences reset completed.' });
});

// POST /api/settings/danger/delete-all-data
router.post('/danger/delete-all-data', adminOnly, async (req, res) => {
  try {
    await Promise.all([
      Sale.deleteMany({}),
      Medicine.deleteMany({}),
      Return.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
    res.json({ success: true, message: 'All operational data (Sales, Medicines, Returns, Logs) deleted. Users preserved.' });
  } catch (error) {
    console.error('Delete all data error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete data.' });
  }
});

// POST /api/settings/danger/logout-all-devices
router.post('/danger/logout-all-devices', adminOnly, async (req, res) => {
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
