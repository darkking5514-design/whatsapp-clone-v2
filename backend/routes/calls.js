const express = require('express');
const Call = require('../models/Call');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ============================================
// GET CALL HISTORY (for logged-in user)
// ============================================
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    // Find calls where user is caller or receiver
    const calls = await Call.find({
      $or: [{ caller: userId }, { receiver: userId }],
    })
      .populate('caller', 'name phoneNumber profilePic')
      .populate('receiver', 'name phoneNumber profilePic')
      .sort({ timestamp: -1 }); // newest first

    res.json(calls);
  } catch (err) {
    console.error('❌ Call history error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// LOG A CALL (when call ends)
// ============================================
router.post('/log', authMiddleware, async (req, res) => {
  try {
    const { receiverId, type, duration, status } = req.body;

    if (!receiverId || !type) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const call = new Call({
      caller: req.userId,
      receiver: receiverId,
      type,
      duration: duration || 0,
      status: status || 'missed',
      timestamp: new Date(),
    });

    await call.save();
    res.json({ success: true, call });
  } catch (err) {
    console.error('❌ Log call error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;