const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
      // User actions
      'USER_LOGIN', 'USER_LOGOUT', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'USER_PASSWORD_RESET',
      // Medicine actions
      'MEDICINE_CREATED', 'MEDICINE_UPDATED', 'MEDICINE_DEACTIVATED', 'MEDICINE_REACTIVATED', 'MEDICINE_DELETED',
      // Sale actions
      'SALE_CREATED', 'SALE_RETURNED', 'SALE_REFUNDED',
      // Import actions
      'MEDICINES_IMPORTED',
      // System actions
      'SYSTEM_BACKUP', 'SYSTEM_EXPORT', 'SETTINGS_UPDATED'
    ],
  },
  resourceType: {
    type: String,
    required: true,
    enum: ['User', 'Medicine', 'Sale', 'Return', 'System', 'Settings'],
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
  description: {
    type: String,
    required: true,
    maxlength: 500,
  },
  ipAddress: {
    type: String,
    required: true,
  },
  userAgent: {
    type: String,
    maxlength: 500,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

// Index for efficient queries
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
