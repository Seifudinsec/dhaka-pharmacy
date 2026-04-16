const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Medicine name is required'],
    trim: true,
    unique: true,
    maxlength: [200, 'Medicine name must not exceed 200 characters'],
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0.01, 'Price must be greater than 0'],
  },
  buyingPrice: {
    type: Number,
    required: [true, 'Buying price is required'],
    min: [0.01, 'Buying price must be greater than 0'],
  },
  batchNumber: {
    type: String,
    required: [true, 'Batch number is required'],
    trim: true,
    maxlength: [100, 'Batch number must not exceed 100 characters'],
  },
  stock: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0,
  },
  expiryDate: {
    type: Date,
    required: [true, 'Expiry date is required'],
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
    index: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual: isExpired
medicineSchema.virtual('isExpired').get(function () {
  return new Date() > new Date(this.expiryDate);
});

// Virtual: isLowStock
medicineSchema.virtual('isLowStock').get(function () {
  return this.stock > 0 && this.stock < 10;
});

// Virtual: stockStatus
medicineSchema.virtual('stockStatus').get(function () {
  if (this.stock === 0) return 'out_of_stock';
  if (this.stock < 10) return 'low';
  return 'ok';
});

medicineSchema.virtual('unitProfit').get(function () {
  return Number((this.price - this.buyingPrice).toFixed(2));
});

medicineSchema.virtual('estimatedStockProfit').get(function () {
  return Number(((this.price - this.buyingPrice) * this.stock).toFixed(2));
});

// Index for search
medicineSchema.index({ name: 'text' });

module.exports = mongoose.model('Medicine', medicineSchema);
