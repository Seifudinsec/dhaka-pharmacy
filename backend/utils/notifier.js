const { getIO } = require('../config/socket');

/**
 * Sends a real-time notification to all connected clients
 * @param {Object} notification - The notification object
 * @param {string} notification.type - 'info', 'warning', 'error', 'success'
 * @param {string} notification.title - Short title
 * @param {string} notification.description - Detailed message
 * @param {Object} [notification.meta] - Extra data (e.g. route, id)
 */
const notify = (notification) => {
  try {
    const io = getIO();
    const payload = {
      id: `${notification.type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
      isRead: false,
      ...notification
    };
    
    io.emit('notification', payload);
  } catch (error) {
    console.error('Failed to emit socket notification:', error.message);
  }
};

/**
 * Specifically checks and notifies if a medicine stock is low
 * @param {Object} medicine - The medicine document
 */
const notifyLowStock = (medicine) => {
  if (medicine.stock > 0 && medicine.stock < 10) {
    notify({
      type: 'warning',
      title: 'Low Stock Alert',
      description: `${medicine.name} is running low (${medicine.stock} left).`,
      meta: { 
        medicineId: medicine._id,
        route: `/inventory?highlight=${medicine._id}`
      }
    });
  } else if (medicine.stock === 0) {
    notify({
      type: 'error',
      title: 'Out of Stock',
      description: `${medicine.name} is completely out of stock!`,
      meta: { 
        medicineId: medicine._id,
        route: `/inventory?highlight=${medicine._id}&filter=out_of_stock`
      }
    });
  }
};

module.exports = {
  notify,
  notifyLowStock
};
