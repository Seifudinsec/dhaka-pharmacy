const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Medicine = require('../models/Medicine');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET /api/sales — sales history with optional date range
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 20 } = req.query;
    let query = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Sale.countDocuments(query);
    const sales = await Sale.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('servedBy', 'username')
      .populate('items.medicine', 'name');

    // Total revenue for the filtered period
    const revenue = await Sale.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]);

    res.json({
      success: true,
      data: sales,
      totalRevenue: revenue[0]?.total || 0,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sales.' });
  }
});

// POST /api/sales — create a new sale
router.post('/', async (req, res) => {
  try {
    const { items, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Sale must contain at least one item.' });
    }

    let saleItems = [];
    let totalAmount = 0;
    let totalProfit = 0;
    const errors = [];

    for (const item of items) {
      const { medicineId, quantity } = item;

      if (!medicineId || !quantity || isNaN(Number(quantity)) || Number(quantity) < 1) {
        errors.push(`Invalid item: medicineId=${medicineId}, quantity=${quantity}`);
        continue;
      }

      const medicine = await Medicine.findById(medicineId);
      if (!medicine) {
        errors.push(`Medicine with ID "${medicineId}" not found.`);
        continue;
      }
      if (medicine.status === 'inactive') {
        errors.push(`"${medicine.name}" is inactive and cannot be sold.`);
        continue;
      }

      const qty = Math.floor(Number(quantity));

      // Check expiry
      if (new Date() > new Date(medicine.expiryDate)) {
        errors.push(`"${medicine.name}" is expired and cannot be sold.`);
        continue;
      }

      // Check stock
      if (medicine.stock < qty) {
        errors.push(`Insufficient stock for "${medicine.name}". Available: ${medicine.stock}, requested: ${qty}.`);
        continue;
      }

      const effectiveBuyingPrice = Number(medicine.buyingPrice || medicine.price);
      const subtotal = medicine.price * qty;
      const itemProfit = (medicine.price - effectiveBuyingPrice) * qty;
      saleItems.push({
        medicine: medicine._id,
        medicineName: medicine.name,
        quantity: qty,
        unitPrice: medicine.price,
        buyingPrice: effectiveBuyingPrice,
        subtotal,
        profit: Number(itemProfit.toFixed(2)),
      });
      totalAmount += subtotal;
      totalProfit += itemProfit;

      // Deduct stock without re-validating entire document (important for legacy records)
      const stockUpdate = await Medicine.updateOne(
        { _id: medicine._id, stock: { $gte: qty } },
        { $inc: { stock: -qty } }
      );
      if (!stockUpdate.modifiedCount) {
        errors.push(`Failed to deduct stock for "${medicine.name}". Please retry.`);
        saleItems.pop();
        totalAmount -= subtotal;
        totalProfit -= itemProfit;
        continue;
      }
    }

    if (errors.length > 0 && saleItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Sale failed.', errors });
    }

    const sale = await Sale.create({
      items: saleItems,
      total: Number(totalAmount.toFixed(2)),
      totalProfit: Number(totalProfit.toFixed(2)),
      servedBy: req.user._id,
      notes: notes ? String(notes).trim().slice(0, 500) : undefined,
    });

    res.status(201).json({
      success: true,
      message: 'Sale recorded successfully.',
      data: sale,
      warnings: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid medicine ID in sale.' });
    }
    console.error('Create sale error:', error);
    res.status(500).json({ success: false, message: 'Failed to process sale.' });
  }
});

// GET /api/sales/today — today's sales summary
router.get('/today', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const sales = await Sale.find({ createdAt: { $gte: today, $lt: tomorrow } });
    const total = sales.reduce((sum, s) => sum + s.total, 0);

    res.json({ success: true, count: sales.length, total: Number(total.toFixed(2)) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch today sales.' });
  }
});

module.exports = router;
