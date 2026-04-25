const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper: generate a signed JWT with user profile embedded
const generateToken = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    linkedPhone: user.linkedPhone || null,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// ─── POST /api/auth/register/driver ─────────────────────────────────────────
router.post('/register/driver', async (req, res) => {
  try {
    const { email, password, phone } = req.body;

    if (!email || !password || !phone) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already in use.' });
    }

    const user = await User.create({ email, password, phone, role: 'driver' });
    const token = generateToken(user);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        linkedPhone: user.linkedPhone,
      },
    });
  } catch (err) {
    console.error('[Register Driver]', err);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// ─── POST /api/auth/register/family ─────────────────────────────────────────
router.post('/register/family', async (req, res) => {
  try {
    const { email, password, phone, linkedDriverPhone } = req.body;

    if (!email || !password || !phone || !linkedDriverPhone) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already in use.' });
    }

    const user = await User.create({
      email,
      password,
      phone,
      role: 'family',
      linkedPhone: linkedDriverPhone,
    });

    const token = generateToken(user);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        linkedPhone: user.linkedPhone,
      },
    });
  } catch (err) {
    console.error('[Register Family]', err);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        linkedPhone: user.linkedPhone,
      },
    });
  } catch (err) {
    console.error('[Login]', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
// Validates a stored JWT and returns the user profile (used on app reload)
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        linkedPhone: user.linkedPhone,
      },
    });
  } catch (err) {
    res.status(401).json({ message: 'Token is invalid or expired.' });
  }
});

module.exports = router;
