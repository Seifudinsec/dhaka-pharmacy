const express = require('express');
const router = express.Router();
const SpecialDrug = require('../models/SpecialDrug');
const { protect, adminOnly } = require('../middleware/auth');
const { ownerScope } = require('../middleware/authorization');
const auditLog = require('../middleware/audit');

router.use(protect);

// GET /api/special-drugs - Fetch all with search
router.get('/', async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query = ownerScope(req.user, 'recordedBy');
    const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (search) {
      const searchPattern = { $regex: escapeRegex(search), $options: 'i' };
      query.$or = [
        { drugName: searchPattern },
        { buyerName: searchPattern },
        { buyerIdNumber: searchPattern },
        { buyerPhoneNumber: searchPattern }
      ];
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const skip = (safePage - 1) * safeLimit;

    const saleFields = req.user.role === 'pharmacist' ? 'total createdAt' : undefined;
    const [total, records] = await Promise.all([
      SpecialDrug.countDocuments(query),
      SpecialDrug.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('recordedBy', 'username')
        .populate('sale', saleFields)
    ]);

    res.json({
      success: true,
      data: records,
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        pages: Math.ceil(total / safeLimit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch records.' });
  }
});

// POST /api/special-drugs - Manual entry
router.post('/', auditLog('SPECIAL_DRUG_RECORD_CREATED', 'SpecialDrug'), async (req, res) => {
  try {
    const { drugName, buyerName, buyerIdNumber, buyerPhoneNumber } = req.body;

    if (!drugName || !buyerName || !buyerIdNumber || !buyerPhoneNumber) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const record = await SpecialDrug.create({
      drugName,
      buyerName,
      buyerIdNumber,
      buyerPhoneNumber,
      recordedBy: req.user._id
    });

    res.status(201).json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create record.' });
  }
});

// PUT /api/special-drugs/:id
router.put('/:id', auditLog('SPECIAL_DRUG_RECORD_UPDATED', 'SpecialDrug'), async (req, res) => {
  try {
    const record = await SpecialDrug.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Record not found.' });
    if (
      req.user.role === 'pharmacist' &&
      String(record.recordedBy) !== String(req.user._id)
    ) {
      return res.status(403).json({ success: false, message: 'You can only update your own records.' });
    }

    const allowedFields = ['drugName', 'buyerName', 'buyerIdNumber', 'buyerPhoneNumber', 'prescription'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (Object.keys(updates).length !== Object.keys(req.body).length) {
      return res.status(400).json({ success: false, message: 'Unsupported record field.' });
    }

    Object.assign(record, updates);
    await record.save();
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update record.' });
  }
});

// DELETE /api/special-drugs/:id
router.delete('/:id', adminOnly, auditLog('SPECIAL_DRUG_RECORD_DELETED', 'SpecialDrug'), async (req, res) => {
  try {
    const record = await SpecialDrug.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Record not found.' });
    res.json({ success: true, message: 'Record deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete record.' });
  }
});

module.exports = router;
