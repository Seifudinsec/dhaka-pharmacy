const mongoose = require('mongoose');

const returnItemSchema = new mongoose.Schema({
  medicine: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medicine',
    required: true,
  },
  medicineName: { type: String, required: true },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
  },
  unitPrice: {
    type: Number,
    required: true,
    min: [0, 'Unit price cannot be negative'],
  },
  buyingPrice: {
    type: Number,
    required: true,
    min: [0, 'Buying price cannot be negative'],
  },
  subtotal: {
    type: Number,
    required: true,
  },
  profit: {
    type: Number,
    required: true,
  },
}, { _id: false });

const returnSchema = new mongoose.Schema({
  originalSale: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: true,
  },
  items: {
    type: [returnItemSchema],
    validate: {
      validator: (v) => v.length > 0,
      message: 'A return must have at least one item',
    },
  },
  totalRefund: {
    type: Number,
    required: true,
    min: [0, 'Total refund cannot be negative'],
  },
  totalProfitLoss: {
    type: Number,
    required: true,
    default: 0,
  },
  reason: {
    type: String,
    maxlength: 500,
    trim: true,
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved', // Auto-approve for pharmacists, admin can override
  },
}, {
  timestamps: true,
});

returnSchema.pre('save', async function(next) {
  // Calculate totals only if items have changed
  if (this.isModified('items')) {
    this.totalRefund = this.items.reduce((sum, item) => sum + item.subtotal, 0);
    this.totalProfitLoss = this.items.reduce((sum, item) => sum + item.profit, 0);
  }
  next();
});

module.exports = mongoose.model('Return', returnSchema);
