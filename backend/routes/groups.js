const express = require('express');
const Group = require('../models/Group');
const Message = require('../models/Message');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// ---- Create Group ----
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description, members } = req.body;
    if (!name) return res.status(400).json({ message: 'Group name is required' });

    const memberList = [
      { user: req.userId, role: 'admin' },
      ...members.map(id => ({ user: id, role: 'member' }))
    ];

    const group = new Group({
      name,
      description: description || '',
      createdBy: req.userId,
      members: memberList,
    });

    await group.save();
    res.status(201).json(group);
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- Get user's groups ----
router.get('/my-groups', authMiddleware, async (req, res) => {
  try {
    const groups = await Group.find({
      'members.user': req.userId,
      isActive: true,
    }).populate('members.user', 'name phoneNumber profilePic');
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- Get group details ----
router.get('/:groupId', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findOne({
      _id: req.params.groupId,
      'members.user': req.userId,
      isActive: true,
    }).populate('members.user', 'name phoneNumber profilePic onlineStatus');
    if (!group) return res.status(404).json({ message: 'Group not found' });
    res.json(group);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- Update group info (admin only) ----
router.put('/:groupId', authMiddleware, async (req, res) => {
  try {
    const { name, description, profilePic } = req.body;
    const group = await Group.findOne({
      _id: req.params.groupId,
      'members.user': req.userId,
      'members.role': 'admin',
    });
    if (!group) return res.status(403).json({ message: 'Not authorized' });
    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (profilePic) group.profilePic = profilePic;
    await group.save();
    res.json(group);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- Add members (admin only) ----
router.post('/:groupId/members', authMiddleware, async (req, res) => {
  try {
    const { userIds } = req.body;
    const group = await Group.findOne({
      _id: req.params.groupId,
      'members.user': req.userId,
      'members.role': 'admin',
    });
    if (!group) return res.status(403).json({ message: 'Not authorized' });

    const existing = group.members.map(m => m.user.toString());
    const toAdd = userIds.filter(id => !existing.includes(id));
    for (const id of toAdd) {
      group.members.push({ user: id, role: 'member' });
    }
    await group.save();
    res.json(group);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- Remove member (admin only) ----
router.delete('/:groupId/members/:userId', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findOne({
      _id: req.params.groupId,
      'members.user': req.userId,
      'members.role': 'admin',
    });
    if (!group) return res.status(403).json({ message: 'Not authorized' });

    const target = req.params.userId;
    group.members = group.members.filter(m => m.user.toString() !== target);
    await group.save();
    res.json(group);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- Change role (admin only) ----
router.put('/:groupId/members/:userId/role', authMiddleware, async (req, res) => {
  try {
    const { role } = req.body;
    const group = await Group.findOne({
      _id: req.params.groupId,
      'members.user': req.userId,
      'members.role': 'admin',
    });
    if (!group) return res.status(403).json({ message: 'Not authorized' });

    const member = group.members.find(m => m.user.toString() === req.params.userId);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    member.role = role;
    await group.save();
    res.json(group);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- Leave group ----
router.post('/:groupId/leave', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    group.members = group.members.filter(m => m.user.toString() !== req.userId);
    if (group.members.length === 0) {
      await Group.findByIdAndDelete(req.params.groupId);
      return res.json({ message: 'Group deleted' });
    }
    // Assign new admin if no admins left
    const remainingAdmins = group.members.filter(m => m.role === 'admin');
    if (remainingAdmins.length === 0) {
      group.members[0].role = 'admin';
    }
    await group.save();
    res.json({ message: 'Left group' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- Delete group (admin only) ----
router.delete('/:groupId', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findOne({
      _id: req.params.groupId,
      'members.user': req.userId,
      'members.role': 'admin',
    });
    if (!group) return res.status(403).json({ message: 'Not authorized' });
    await Group.findByIdAndDelete(req.params.groupId);
    res.json({ message: 'Group deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- Get group messages ----
router.get('/:groupId/messages', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findOne({
      _id: req.params.groupId,
      'members.user': req.userId,
    });
    if (!group) return res.status(403).json({ message: 'Not a member' });
    const messages = await Message.find({ groupId: req.params.groupId })
      .sort({ timestamp: 1 })
      .populate('sender', 'name phoneNumber');
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;