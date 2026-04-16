const express = require('express');
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const auditLog = require('../middleware/audit');
const Sale = require('../models/Sale');
const Return = require('../models/Return');
const Medicine = require('../models/Medicine');
const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// POST /api/returns - Create a return/refund
router.post('/', auditLog('SALE_RETURNED', 'Return'), async (req, res) => {
  try {
    const { originalSaleId, items, reason } = req.body;
    const userId = req.user._id;

    console.log('Return request received:', { originalSaleId, items, reason, userId });

    // Validate input
    if (!originalSaleId || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Original sale ID and at least one item are required'
      });
    }

    // Get the original sale with populated medicine details
    const originalSale = await Sale.findById(originalSaleId)
      .populate('items.medicine', 'name stock');
    
    console.log('Original sale found:', originalSale);
    
    if (!originalSale) {
      return res.status(404).json({
        success: false,
        message: 'Original sale not found'
      });
    }

    // Validate return items against original sale
    const returnItems = [];
    const stockUpdates = [];

    for (const returnItem of items) {
      // Find the item in the original sale
      const originalItem = originalSale.items.find(
        item => item.medicine._id.toString() === returnItem.medicineId
      );

      if (!originalItem) {
        return res.status(400).json({
          success: false,
          message: `Item not found in original sale`
        });
      }

      // Validate return quantity
      if (returnItem.quantity <= 0 || returnItem.quantity > originalItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `Invalid return quantity for ${originalItem.medicineName}`
        });
      }

      // Check if return quantity exceeds original quantity considering previous returns
      const existingReturns = await Return.find({
        originalSale: originalSaleId,
        'items.medicine': returnItem.medicineId
      });

      const totalReturnedQuantity = existingReturns.reduce((sum, ret) => {
        const returnedItem = ret.items.find(item => item.medicine.toString() === returnItem.medicineId);
        return sum + (returnedItem ? returnedItem.quantity : 0);
      }, 0);

      if (totalReturnedQuantity + returnItem.quantity > originalItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `Cannot return ${returnItem.quantity} units of ${originalItem.medicineName}. Only ${originalItem.quantity - totalReturnedQuantity} units available for return.`
        });
      }

      // Calculate return item details
      const subtotal = returnItem.quantity * originalItem.unitPrice;
      const profit = returnItem.quantity * (originalItem.unitPrice - originalItem.buyingPrice);

      returnItems.push({
        medicine: returnItem.medicineId,
        medicineName: originalItem.medicineName,
        quantity: returnItem.quantity,
        unitPrice: originalItem.unitPrice,
        buyingPrice: originalItem.buyingPrice,
        subtotal,
        profit
      });

      // Prepare stock update
      stockUpdates.push({
        medicineId: returnItem.medicineId,
        quantity: returnItem.quantity
      });
    }

    // Calculate totals for the return record
    const totalRefund = returnItems.reduce((sum, item) => sum + item.subtotal, 0);
    const totalProfitLoss = returnItems.reduce((sum, item) => sum + item.profit, 0);

    // Create the return record
    const returnRecord = await Return.create({
      originalSale: originalSaleId,
      items: returnItems,
      totalRefund,
      totalProfitLoss,
      reason: reason || 'Customer return',
      processedBy: userId,
      status: 'approved' // Auto-approve all returns
    });

    // Update medicine stock for all returned items (atomic operations)
    const stockUpdatePromises = stockUpdates.map(stockUpdate =>
      Medicine.findByIdAndUpdate(
        stockUpdate.medicineId,
        { $inc: { stock: stockUpdate.quantity } }
      )
    );

    await Promise.all(stockUpdatePromises);

    // Update original sale status and link return transaction
    const allReturns = await Return.find({ originalSale: originalSaleId });
    const totalReturnedValue = allReturns.reduce((sum, ret) => sum + ret.totalRefund, 0);

    let newStatus = 'completed';
    if (totalReturnedValue > 0 && totalReturnedValue < originalSale.total) {
      newStatus = 'partially_returned';
    } else if (totalReturnedValue >= originalSale.total) {
      newStatus = 'fully_refunded';
    }

    // Decrement the original sale's totals so dashboard aggregations (today's sales/profit)
    // immediately reflect the refund without needing separate return-aware queries.
    await Sale.findByIdAndUpdate(originalSaleId, {
      status: newStatus,
      $push: { returnTransactions: returnRecord._id },
      $inc: {
        total: -totalRefund,
        totalProfit: -totalProfitLoss,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Return processed successfully',
      data: returnRecord
    });

  } catch (error) {
    console.error('Return processing error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process return'
    });
  }
});

// GET /api/returns - Get all returns (admin can see all, pharmacist sees their own)
router.get('/', async (req, res) => {
  try {
    let query = {};
    
    // Pharmacists can only see returns they processed
    if (req.user.role === 'pharmacist') {
      query.processedBy = req.user._id;
    }

    const returns = await Return.find(query)
      .populate('originalSale', 'total createdAt')
      .populate('processedBy', 'username')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: returns
    });

  } catch (error) {
    console.error('Get returns error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch returns'
    });
  }
});

// GET /api/returns/:id - Get specific return details
router.get('/:id', async (req, res) => {
  try {
    const returnRecord = await Return.findById(req.params.id)
      .populate('originalSale')
      .populate('processedBy', 'username');

    if (!returnRecord) {
      return res.status(404).json({
        success: false,
        message: 'Return not found'
      });
    }

    // Check permissions
    if (req.user.role === 'pharmacist' && returnRecord.processedBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: returnRecord
    });

  } catch (error) {
    console.error('Get return error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch return'
    });
  }
});

// PUT /api/returns/:id/status - Update return status (admin only)
router.put('/:id/status', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admins only.'
      });
    }

    const { status } = req.body;
    
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const returnRecord = await Return.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).populate('processedBy', 'username');

    if (!returnRecord) {
      return res.status(404).json({
        success: false,
        message: 'Return not found'
      });
    }

    res.json({
      success: true,
      message: `Return ${status} successfully`,
      data: returnRecord
    });

  } catch (error) {
    console.error('Update return status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update return status'
    });
  }
});

module.exports = router;
