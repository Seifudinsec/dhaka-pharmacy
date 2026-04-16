const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');
const auditLog = require('../middleware/audit');

router.use(protect, adminOnly);

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ success: false, message: 'Failed to load users.' });
  }
});

// GET /api/users/check/:username
router.get('/check/:username', async (req, res) => {
  try {
    const username = String(req.params.username).trim().toLowerCase();
    const user = await User.findOne({ username });
    res.json({ success: true, exists: !!user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Check error' });
  }
});

// POST /api/users
router.post('/', auditLog('USER_CREATED', 'User'), async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }
    const normalizedUsername = String(username).trim().toLowerCase();
    if (normalizedUsername.length < 3) {
      return res.status(400).json({ success: false, message: 'Username must be at least 3 characters.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }
    if (!['admin', 'pharmacist'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role provided.' });
    }

    const exists = await User.findOne({ username: normalizedUsername });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Username already taken.' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(String(password), salt);
    const user = await User.create({ username: normalizedUsername, password: hashedPassword, role });
    res.status(201).json({ success: true, message: 'User created successfully.', data: { id: user._id, username: user.username, role: user.role } });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: 'Failed to create user.' });
  }
});

// PUT /api/users/:id
router.put('/:id', auditLog('USER_UPDATED', 'User'), async (req, res) => {
  try {
    const { username, role, notificationPreferences } = req.body;
    const updates = {};

    if (username !== undefined) {
      const normalizedUsername = String(username).trim().toLowerCase();
      if (normalizedUsername.length < 3) {
        return res.status(400).json({ success: false, message: 'Username must be at least 3 characters.' });
      }
      
      // Check if username is already taken by another user
      const existingUser = await User.findOne({ username: normalizedUsername, _id: { $ne: req.params.id } });
      if (existingUser) {
        return res.status(409).json({ success: false, message: 'Username already taken.' });
      }
      
      updates.username = normalizedUsername;
    }

    if (role !== undefined) {
      if (!['admin', 'pharmacist'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role provided.' });
      }
      updates.role = role;
    }

    if (notificationPreferences !== undefined) {
      updates.notificationPreferences = notificationPreferences;
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, message: 'User updated successfully.', data: user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user.' });
  }
});

// POST /api/users/:id/reset-password
router.post('/:id/reset-password', auditLog('USER_PASSWORD_RESET', 'User'), async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;
    
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    if (!confirmPassword) {
      return res.status(400).json({ success: false, message: 'Your original password is required to confirm this change.' });
    }

    // Verify the password of the admin who is performing the reset
    const admin = await User.findById(req.user._id).select('+password');
    const isMatch = await bcrypt.compare(confirmPassword, admin.password);
    
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Confirmation password incorrect. Authorization failed.' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(String(newPassword), salt);
    
    const user = await User.findByIdAndUpdate(
      req.params.id, 
      { 
        password: hashedPassword,
        tokenVersion: (await User.findById(req.params.id).select('tokenVersion'))?.tokenVersion + 1 || 1
      }, 
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
});

// POST /api/users/verify-password
// Used to verify admin credentials before sensitive steps in the management UI
router.post('/verify-password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required for verification.' });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      res.json({ success: true, message: 'Password verified.' });
    } else {
      res.status(401).json({ success: false, message: 'Incorrect password verification failed.' });
    }
  } catch (error) {
    console.error('Verify password error:', error);
    res.status(500).json({ success: false, message: 'Error verifying password.' });
  }
});

// PUT /api/users/:id/toggle-status
router.put('/:id/toggle-status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status provided.' });
    }

    // Prevent deactivating the last admin
    if (status === 'inactive') {
      const user = await User.findById(req.params.id);
      if (user.role === 'admin') {
        const adminCount = await User.countDocuments({ role: 'admin', status: 'active' });
        if (adminCount <= 1) {
          return res.status(400).json({ success: false, message: 'Cannot deactivate the last admin user.' });
        }
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id, 
      { status, lastActive: new Date() }, 
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!updatedUser) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, message: `User ${status} successfully.`, data: updatedUser });
  } catch (error) {
    console.error('Toggle status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user status.' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  try {
    if (String(req.user._id) === String(req.params.id)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user.' });
  }
});

module.exports = router;
