const express = require('express');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get all users except logged-in user (direct contacts)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } })
      .select('-otp -otpExpiry')
      .sort({ name: 1 });
    res.json(users);
  } catch (err) {
    console.error('Get users error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;