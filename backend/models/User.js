const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username must not exceed 30 characters'],
    lowercase: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false, // Never return password in queries
  },
  role: {
    type: String,
    enum: ['main_admin', 'admin', 'pharmacist'],
    default: 'pharmacist',
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  lastActive: {
    type: Date,
    default: Date.now,
  },
  tokenVersion: {
    type: Number,
    default: 0,
  },
  notificationPreferences: {
    lowStock: { type: Boolean, default: true },
    expiry: { type: Boolean, default: true },
    dailySales: { type: Boolean, default: false },
  },
  isMainAdmin: {
    type: Boolean,
    default: false,
    select: false,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
