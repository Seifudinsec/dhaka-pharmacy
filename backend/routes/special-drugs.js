const express = require('express');
const router = express.Router();
const SpecialDrug = require('../models/SpecialDrug');
const { protect, adminOnly } = require('../middleware/auth');
const auditLog = require('../middleware/audit');

router.use(protect);

// GET /api/special-drugs - Fetch all with search
router.get('/', async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { drugName: { $regex: search, $options: 'i' } },
        { buyerName: { $regex: search, $options: 'i' } },
        { buyerIdNumber: { $regex: search, $options: 'i' } },
        { buyerPhoneNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const skip = (safePage - 1) * safeLimit;

    const [total, records] = await Promise.all([
      SpecialDrug.countDocuments(query),
      SpecialDrug.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('recordedBy', 'username')
        .populate('sale')
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
    const record = await SpecialDrug.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!record) return res.status(404).json({ success: false, message: 'Record not found.' });
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
