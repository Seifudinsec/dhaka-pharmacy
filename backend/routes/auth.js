const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');
const { ROLES, isSupportedRole } = require('../middleware/authorization');

const generateToken = (id, tokenVersion = 0) =>
  jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const trimmedUsername = String(username).trim().toLowerCase();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      return res.status(400).json({ success: false, message: 'Invalid credentials.' });
    }

    const user = await User.findOne({ username: trimmedUsername }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const isMatch = await bcrypt.compare(String(password), user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const normalizedRole = user.role === 'cashier' ? 'pharmacist' : user.role;
    if (!isSupportedRole(normalizedRole)) {
      return res.status(403).json({ success: false, message: 'This account has an unsupported role.' });
    }
    if (user.role === 'cashier') {
      user.role = 'pharmacist';
      await user.save();
    }
    const token = generateToken(user._id, user.tokenVersion);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        role: normalizedRole,
        isMainAdmin: !!user.isMainAdmin,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// POST /api/auth/register (admin only)
router.post('/register', protect, adminOnly, async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!ROLES.includes(role) || role === 'main_admin') {
      return res.status(400).json({ success: false, message: 'A valid assignable role is required.' });
    }
    if (req.user.role === 'admin' && role !== 'pharmacist') {
      return res.status(403).json({ success: false, message: 'Admins can only register pharmacists.' });
    }

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const trimmedUsername = String(username).trim().toLowerCase();
    if (trimmedUsername.length < 3) {
      return res.status(400).json({ success: false, message: 'Username must be at least 3 characters.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const exists = await User.findOne({ username: trimmedUsername });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Username already taken.' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(String(password), salt);

    const user = await User.create({
      username: trimmedUsername,
      password: hashedPassword,
      role,
    });

    const token = generateToken(user._id, user.tokenVersion);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: { id: user._id, username: user.username, role: user.role },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// GET /api/auth/me
router.get('/me', protect, (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
