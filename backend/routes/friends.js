const express = require('express');
const Friend = require('../models/Friend');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Search users (used in AddFriends page)
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 1) return res.json([]);
    const users = await User.find({
      _id: { $ne: req.userId },
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } },
        { phoneNumber: { $regex: q, $options: 'i' } }
      ]
    }).select('name username phoneNumber profilePic onlineStatus').limit(20);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Send friend request
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const { friendId } = req.body;
    const existing = await Friend.findOne({
      $or: [
        { userId: req.userId, friendId },
        { userId: friendId, friendId: req.userId }
      ]
    });
    if (existing) {
      if (existing.status === 'accepted') return res.status(400).json({ message: 'Already friends' });
      if (existing.status === 'pending') return res.status(400).json({ message: 'Request already sent' });
    }
    const friendRequest = new Friend({ userId: req.userId, friendId, status: 'pending' });
    await friendRequest.save();
    res.json({ message: 'Friend request sent' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pending requests
router.get('/pending', authMiddleware, async (req, res) => {
  try {
    const pending = await Friend.find({ friendId: req.userId, status: 'pending' })
      .populate('userId', 'name username phoneNumber');
    res.json(pending);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Accept request
router.put('/accept/:requestId', authMiddleware, async (req, res) => {
  try {
    const request = await Friend.findOne({ _id: req.params.requestId, friendId: req.userId, status: 'pending' });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    request.status = 'accepted';
    await request.save();
    res.json({ message: 'Friend request accepted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject request
router.delete('/reject/:requestId', authMiddleware, async (req, res) => {
  try {
    await Friend.findOneAndDelete({ _id: req.params.requestId, friendId: req.userId, status: 'pending' });
    res.json({ message: 'Request rejected' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove friend
router.delete('/remove/:friendId', authMiddleware, async (req, res) => {
  try {
    await Friend.findOneAndDelete({
      $or: [
        { userId: req.userId, friendId: req.params.friendId },
        { userId: req.params.friendId, friendId: req.userId }
      ],
      status: 'accepted'
    });
    res.json({ message: 'Friend removed' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get my friends list
router.get('/', authMiddleware, async (req, res) => {
  try {
    const friends = await Friend.find({
      $or: [{ userId: req.userId }, { friendId: req.userId }],
      status: 'accepted'
    }).populate('userId friendId', 'name username phoneNumber profilePic onlineStatus');
    const friendList = friends.map(f =>
      f.userId._id.toString() === req.userId ? f.friendId : f.userId
    );
    res.json(friendList);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;