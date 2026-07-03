const express = require('express');
const Message = require('../models/Message');
const User = require('../models/User');
const Friend = require('../models/Friend');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET chat partners – users with whom you have exchanged messages OR are friends
router.get('/partners', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    // 1. Users from messages (sent or received)
    const senderIds = await Message.distinct('sender', {
      $or: [{ sender: userId }, { receiver: userId }]
    });
    const receiverIds = await Message.distinct('receiver', {
      $or: [{ sender: userId }, { receiver: userId }]
    });
    const messageUserIds = [...new Set([...senderIds, ...receiverIds])]
      .filter(id => id.toString() !== userId);

    // 2. Accepted friends
    const friends = await Friend.find({
      $or: [{ userId, status: 'accepted' }, { friendId: userId, status: 'accepted' }]
    });
    const friendIds = friends.map(f =>
      f.userId.toString() === userId ? f.friendId.toString() : f.userId.toString()
    );

    // 3. Combine unique IDs
    const allUserIds = [...new Set([...messageUserIds, ...friendIds])];

    // 4. Fetch user details
    const users = await User.find({ _id: { $in: allUserIds } })
      .select('name username phoneNumber profilePic onlineStatus lastSeen');

    res.json(users);
  } catch (err) {
    console.error('❌ Chat partners error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;