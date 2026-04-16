const AuditLog = require('../models/AuditLog');

const auditLog = (action, resourceType) => {
  return async (req, res, next) => {
    // Store original res.json and res.status methods
    const originalJson = res.json;
    const originalStatus = res.status;

    let statusCode = 200;
    let responseData = null;

    // Override res.status to capture status code
    res.status = function(code) {
      statusCode = code;
      return originalStatus.call(this, code);
    };

    // Override res.json to capture response data
    res.json = function(data) {
      responseData = data;
      return originalJson.call(this, data);
    };

    // Continue to the next middleware/route handler
    res.on('finish', async () => {
      // Only log successful actions (2xx status codes)
      if (statusCode >= 200 && statusCode < 300 && req.user) {
        try {
          const description = generateDescription(action, req, responseData);
          const metadata = generateMetadata(action, req, responseData);

          await AuditLog.create({
            user: req.user._id,
            action,
            resourceType,
            resourceId: getResourceId(req),
            description,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            metadata,
          });
        } catch (error) {
          console.error('Audit log error:', error);
          // Don't block the response if audit logging fails
        }
      }
    });

    next();
  };
};

function generateDescription(action, req, responseData) {
  const { user, body, params } = req;
  const username = user?.username || 'Unknown';
  
  switch (action) {
    case 'USER_LOGIN':
      return `User ${username} logged in`;
    case 'USER_CREATED':
      return `User ${username} created new user: ${body?.username || 'Unknown'}`;
    case 'USER_UPDATED':
      return `User ${username} updated user: ${params?.id || 'Unknown'}`;
    case 'USER_DELETED':
      return `User ${username} deleted user: ${params?.id || 'Unknown'}`;
    case 'USER_PASSWORD_RESET':
      return `User ${username} reset password for user: ${params?.id || 'Unknown'}`;
    case 'MEDICINE_CREATED':
      return `User ${username} created new medicine: ${body?.name || 'Unknown'}`;
    case 'MEDICINE_UPDATED':
      return `User ${username} updated medicine: ${body?.name || 'Unknown'}`;
    case 'MEDICINE_DEACTIVATED':
      return `User ${username} deactivated medicine: ${params?.id || 'Unknown'}`;
    case 'MEDICINE_REACTIVATED':
      return `User ${username} reactivated medicine: ${params?.id || 'Unknown'}`;
    case 'MEDICINE_DELETED':
      return `User ${username} permanently deleted medicine: ${params?.id || 'Unknown'}`;
    case 'SALE_CREATED':
      return `User ${username} created sale with ${body?.items?.length || 0} items`;
    case 'SALE_RETURNED':
      return `User ${username} processed return for sale: ${body?.originalSaleId || 'Unknown'}`;
    case 'SALE_REFUNDED':
      return `User ${username} processed refund for sale: ${body?.originalSaleId || 'Unknown'}`;
    case 'MEDICINES_IMPORTED':
      return `User ${username} imported medicines from file`;
    case 'SETTINGS_UPDATED':
      return `User ${username} updated system settings`;
    default:
      return `User ${username} performed ${action}`;
  }
}

function generateMetadata(action, req, responseData) {
  const { body, params, query } = req;
  const metadata = {};

  switch (action) {
    case 'USER_CREATED':
    case 'USER_UPDATED':
      metadata.changes = {
        username: body?.username,
        role: body?.role,
        status: body?.status,
      };
      break;
    case 'MEDICINE_CREATED':
    case 'MEDICINE_UPDATED':
      metadata.changes = {
        name: body?.name,
        price: body?.price,
        stock: body?.stock,
        status: body?.status,
      };
      break;
    case 'SALE_CREATED':
      metadata.saleDetails = {
        itemCount: body?.items?.length,
        total: body?.total,
        profit: body?.totalProfit,
      };
      break;
    case 'SALE_RETURNED':
    case 'SALE_REFUNDED':
      metadata.returnDetails = {
        originalSaleId: body?.originalSaleId,
        itemCount: body?.items?.length,
        totalRefund: responseData?.data?.totalRefund,
      };
      break;
    case 'MEDICINES_IMPORTED':
      metadata.importDetails = {
        fileProcessed: true,
        timestamp: new Date().toISOString(),
      };
      break;
  }

  return metadata;
}

function getResourceId(req) {
  const { params } = req;
  
  // Try to get resource ID from params
  if (params.id) return params.id;
  if (params.medicineId) return params.medicineId;
  if (params.saleId) return params.saleId;
  if (params.userId) return params.userId;
  
  return null;
}

module.exports = auditLog;
