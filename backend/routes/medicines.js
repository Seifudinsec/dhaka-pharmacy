const express = require('express');
const router = express.Router();
const Medicine = require('../models/Medicine');
const { protect, adminOnly } = require('../middleware/auth');

// All medicine routes require authentication
router.use(protect);

const pharmacistOrAdminOnly = (req, res, next) => {
  if (!['admin', 'pharmacist'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }
  next();
};

// GET /api/medicines
router.get('/', async (req, res) => {
  try {
    const { search, filter, status = 'active', page = 1, limit = 50 } = req.query;

    let query = {};

    if (status === 'active' || status === 'inactive') {
      query.status = status;
    }

    // Text search
    if (search && search.trim()) {
      query.name = { $regex: search.trim(), $options: 'i' };
    }

    // Stock/expiry filters
    if (filter === 'low_stock') {
      query.stock = { $gt: 0, $lt: 10 };
    } else if (filter === 'in_stock') {
      query.stock = { $gte: 10 };
    } else if (filter === 'out_of_stock') {
      query.stock = 0;
    } else if (filter === 'expired') {
      query.expiryDate = { $lt: new Date() };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Medicine.countDocuments(query);
    const medicines = await Medicine.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      data: medicines,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    console.error('Get medicines error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch medicines.' });
  }
});

// GET /api/medicines/:id
router.get('/:id', async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found.' });
    }
    res.json({ success: true, data: medicine });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid medicine ID.' });
    }
    res.status(500).json({ success: false, message: 'Failed to fetch medicine.' });
  }
});

// POST /api/medicines
router.post('/', pharmacistOrAdminOnly, async (req, res) => {
  try {
    const { name, price, buyingPrice, batchNumber, stock, expiryDate } = req.body;

    // Validate
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Medicine name is required.' });
    }
    if (price === undefined || price === null || isNaN(Number(price)) || Number(price) <= 0) {
      return res.status(400).json({ success: false, message: 'Price must be a positive number.' });
    }
    if (buyingPrice === undefined || buyingPrice === null || isNaN(Number(buyingPrice)) || Number(buyingPrice) <= 0) {
      return res.status(400).json({ success: false, message: 'Buying price must be a positive number.' });
    }
    if (!batchNumber || !String(batchNumber).trim()) {
      return res.status(400).json({ success: false, message: 'Batch number is required.' });
    }
    if (stock === undefined || stock === null || isNaN(Number(stock)) || Number(stock) < 0) {
      return res.status(400).json({ success: false, message: 'Stock must be 0 or greater.' });
    }
    if (!expiryDate || isNaN(Date.parse(expiryDate))) {
      return res.status(400).json({ success: false, message: 'A valid expiry date is required.' });
    }

    // Duplicate check
    const existing = await Medicine.findOne({ name: { $regex: `^${String(name).trim()}$`, $options: 'i' } });
    if (existing) {
      return res.status(409).json({ success: false, message: `Medicine "${name.trim()}" already exists.` });
    }

    const medicine = await Medicine.create({
      name: String(name).trim(),
      price: Number(price),
      buyingPrice: Number(buyingPrice),
      batchNumber: String(batchNumber).trim(),
      stock: Math.floor(Number(stock)),
      expiryDate: new Date(expiryDate),
      status: 'active',
    });

    res.status(201).json({ success: true, message: 'Medicine added successfully.', data: medicine });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Medicine name already exists.' });
    }
    console.error('Create medicine error:', error);
    res.status(500).json({ success: false, message: 'Failed to add medicine.' });
  }
});

// PUT /api/medicines/:id
router.put('/:id', pharmacistOrAdminOnly, async (req, res) => {
  try {
    const { name, price, buyingPrice, batchNumber, stock, expiryDate } = req.body;

    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Medicine name cannot be empty.' });
    }
    if (price !== undefined && (isNaN(Number(price)) || Number(price) <= 0)) {
      return res.status(400).json({ success: false, message: 'Price must be a positive number.' });
    }
    if (buyingPrice !== undefined && (isNaN(Number(buyingPrice)) || Number(buyingPrice) <= 0)) {
      return res.status(400).json({ success: false, message: 'Buying price must be a positive number.' });
    }
    if (batchNumber !== undefined && !String(batchNumber).trim()) {
      return res.status(400).json({ success: false, message: 'Batch number cannot be empty.' });
    }
    if (stock !== undefined && (isNaN(Number(stock)) || Number(stock) < 0)) {
      return res.status(400).json({ success: false, message: 'Stock must be 0 or greater.' });
    }
    if (expiryDate !== undefined && isNaN(Date.parse(expiryDate))) {
      return res.status(400).json({ success: false, message: 'Invalid expiry date.' });
    }

    // Check for name duplicate (excluding self)
    if (name) {
      const duplicate = await Medicine.findOne({
        name: { $regex: `^${String(name).trim()}$`, $options: 'i' },
        _id: { $ne: req.params.id },
      });
      if (duplicate) {
        return res.status(409).json({ success: false, message: `Medicine "${name.trim()}" already exists.` });
      }
    }

    const updates = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (price !== undefined) updates.price = Number(price);
    if (buyingPrice !== undefined) updates.buyingPrice = Number(buyingPrice);
    if (batchNumber !== undefined) updates.batchNumber = String(batchNumber).trim();
    if (stock !== undefined) updates.stock = Math.floor(Number(stock));
    if (expiryDate !== undefined) updates.expiryDate = new Date(expiryDate);

    const medicine = await Medicine.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found.' });
    }

    res.json({ success: true, message: 'Medicine updated successfully.', data: medicine });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid medicine ID.' });
    }
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Medicine name already exists.' });
    }
    console.error('Update medicine error:', error);
    res.status(500).json({ success: false, message: 'Failed to update medicine.' });
  }
});

// PATCH /api/medicines/:id/deactivate
router.patch('/:id/deactivate', pharmacistOrAdminOnly, async (req, res) => {
  try {
    const medicine = await Medicine.findByIdAndUpdate(
      req.params.id,
      { status: 'inactive' },
      { new: true, runValidators: true }
    );
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found.' });
    }
    res.json({ success: true, message: `"${medicine.name}" deactivated successfully.`, data: medicine });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid medicine ID.' });
    }
    console.error('Deactivate medicine error:', error);
    res.status(500).json({ success: false, message: 'Failed to deactivate medicine.' });
  }
});

// PATCH /api/medicines/:id/reactivate (admin only)
router.patch('/:id/reactivate', adminOnly, async (req, res) => {
  try {
    const medicine = await Medicine.findByIdAndUpdate(
      req.params.id,
      { status: 'active' },
      { new: true, runValidators: true }
    );
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found.' });
    }
    res.json({ success: true, message: `"${medicine.name}" reactivated successfully.`, data: medicine });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid medicine ID.' });
    }
    console.error('Reactivate medicine error:', error);
    res.status(500).json({ success: false, message: 'Failed to reactivate medicine.' });
  }
});

// DELETE /api/medicines/:id/permanent (admin only, inactive records only)
router.delete('/:id/permanent', adminOnly, async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found.' });
    }
    if (medicine.status !== 'inactive') {
      return res.status(400).json({ success: false, message: 'Only inactive medicines can be permanently deleted.' });
    }

    await Medicine.deleteOne({ _id: medicine._id });
    res.json({ success: true, message: `"${medicine.name}" permanently deleted.` });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid medicine ID.' });
    }
    console.error('Permanent delete medicine error:', error);
    res.status(500).json({ success: false, message: 'Failed to permanently delete medicine.' });
  }
});

// POST /api/medicines/bulk-deactivate
router.post('/bulk-deactivate', pharmacistOrAdminOnly, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide at least one medicine ID.' });
    }

    const uniqueIds = [...new Set(ids.map(String))];
    const result = await Medicine.updateMany({ _id: { $in: uniqueIds } }, { $set: { status: 'inactive' } });
    res.json({
      success: true,
      message: `${result.modifiedCount} medicine(s) deactivated successfully.`,
      deactivatedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Bulk deactivate medicines error:', error);
    res.status(500).json({ success: false, message: 'Failed to deactivate selected medicines.' });
  }
});

module.exports = router;
