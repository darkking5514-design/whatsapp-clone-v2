const express = require('express');
const Friend = require('../models/Friend');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ============================================
// 1. SEARCH USERS BY NAME / PHONE / USERNAME
// ============================================
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 1) {
      return res.json([]);
    }

    const users = await User.find({
      _id: { $ne: req.userId },
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { username: { $regex: q, $options: 'i' } },
        { phoneNumber: { $regex: q, $options: 'i' } }
      ]
    })
      .select('name username phoneNumber profilePic onlineStatus')
      .limit(20);

    res.json(users);
  } catch (err) {
    console.error('❌ Search error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// 2. SEND FRIEND REQUEST
// ============================================
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const { friendId } = req.body;

    if (!friendId) {
      return res.status(400).json({ message: 'Friend ID is required' });
    }

    // Check if friend exists
    const friend = await User.findById(friendId);
    if (!friend) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already friends or request exists
    const existing = await Friend.findOne({
      $or: [
        { userId: req.userId, friendId },
        { userId: friendId, friendId: req.userId },
      ],
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ message: 'You are already friends!' });
      }
      if (existing.status === 'pending') {
        return res.status(400).json({ message: 'Friend request already sent!' });
      }
    }

    // Create friend request
    const friendRequest = await Friend.create({
      userId: req.userId,
      friendId,
      status: 'pending',
    });

    res.status(201).json({
      message: 'Friend request sent successfully!',
      friendRequest,
    });
  } catch (err) {
    console.error('❌ Friend request error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// 3. GET ALL FRIENDS (Accepted)
// ============================================
router.get('/', authMiddleware, async (req, res) => {
  try {
    const friends = await Friend.find({
      $or: [{ userId: req.userId }, { friendId: req.userId }],
      status: 'accepted',
    })
      .populate('userId', 'name username phoneNumber profilePic onlineStatus')
      .populate('friendId', 'name username phoneNumber profilePic onlineStatus');

    // Extract friend details
    const friendList = friends.map((f) => {
      const isUser = f.userId._id.toString() === req.userId;
      return isUser ? f.friendId : f.userId;
    });

    res.json(friendList);
  } catch (err) {
    console.error('❌ Get friends error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// 4. GET PENDING REQUESTS (Received)
// ============================================
router.get('/pending', authMiddleware, async (req, res) => {
  try {
    const pending = await Friend.find({
      friendId: req.userId,
      status: 'pending',
    }).populate('userId', 'name username phoneNumber profilePic');

    res.json(pending);
  } catch (err) {
    console.error('❌ Pending requests error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// 5. ACCEPT FRIEND REQUEST
// ============================================
router.put('/accept/:requestId', authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await Friend.findOne({
      _id: requestId,
      friendId: req.userId, // Only receiver can accept
      status: 'pending',
    });

    if (!request) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    request.status = 'accepted';
    await request.save();

    res.json({ message: 'Friend request accepted!', request });
  } catch (err) {
    console.error('❌ Accept error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// 6. REJECT FRIEND REQUEST
// ============================================
router.delete('/reject/:requestId', authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await Friend.findOneAndDelete({
      _id: requestId,
      friendId: req.userId,
      status: 'pending',
    });

    if (!request) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    res.json({ message: 'Friend request rejected!' });
  } catch (err) {
    console.error('❌ Reject error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// 7. REMOVE FRIEND
// ============================================
router.delete('/remove/:friendId', authMiddleware, async (req, res) => {
  try {
    const { friendId } = req.params;

    await Friend.findOneAndDelete({
      $or: [
        { userId: req.userId, friendId },
        { userId: friendId, friendId: req.userId },
      ],
      status: 'accepted',
    });

    res.json({ message: 'Friend removed successfully!' });
  } catch (err) {
    console.error('❌ Remove friend error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;