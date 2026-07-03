const express = require('express');
const Status = require('../models/Status');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// ---- CREATE TEXT STATUS ----
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { text, type, backgroundColor, textColor } = req.body;
    if (!text && type === 'text') {
      return res.status(400).json({ message: 'Text is required for text status' });
    }
    const now = new Date();
    const status = new Status({
      userId: req.userId,
      text: text || '',
      type: type || 'text',
      backgroundColor: backgroundColor || '#075E54',
      textColor: textColor || '#FFFFFF',
      mediaUrl: '',
      createdAt: now,
      expiresAt: new Date(now.getTime() + TWENTY_FOUR_HOURS_MS),
      viewedBy: [],
    });
    await status.save();
    res.status(201).json({ success: true, message: 'Status posted successfully!', status });
  } catch (err) {
    console.error('❌ Create status error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- UPLOAD MEDIA STATUS ----
router.post('/upload', authMiddleware, upload.single('media'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const { text, type } = req.body;
    const mediaUrl = `/uploads/${req.file.filename}`;
    const now = new Date();
    let statusType = type || 'image';
    if (text && type === 'image') statusType = 'image_text';
    else if (text && type === 'video') statusType = 'video_text';
    else if (!text && type === 'image') statusType = 'image';
    else if (!text && type === 'video') statusType = 'video';
    const status = new Status({
      userId: req.userId,
      text: text || '',
      mediaUrl,
      type: statusType,
      backgroundColor: '#075E54',
      textColor: '#FFFFFF',
      createdAt: now,
      expiresAt: new Date(now.getTime() + TWENTY_FOUR_HOURS_MS),
      viewedBy: [],
    });
    await status.save();
    res.status(201).json({ success: true, message: 'Status posted successfully!', status });
  } catch (err) {
    console.error('❌ Status upload error:', err.message);
    res.status(500).json({ message: 'Server error during upload' });
  }
});

// ---- GET ALL ACTIVE STATUSES ----
router.get('/', authMiddleware, async (req, res) => {
  try {
    const statuses = await Status.find({
      expiresAt: { $gt: new Date() },
    })
      .populate('userId', 'name phoneNumber profilePic onlineStatus')
      .populate('viewedBy', 'name phoneNumber profilePic')
      .sort({ createdAt: -1 });

    const grouped = {};
    statuses.forEach((s) => {
      const uid = s.userId._id.toString();
      if (!grouped[uid]) {
        grouped[uid] = {
          user: s.userId,
          statuses: [],
        };
      }
      const statusObj = s.toObject();
      statusObj.viewedBy = s.viewedBy || [];
      grouped[uid].statuses.push(statusObj);
    });

    const result = Object.values(grouped).map((group) => {
      const statusesWithView = group.statuses.map((s) => {
        const isViewed = s.viewedBy.some((v) => v._id.toString() === req.userId);
        return {
          ...s,
          isViewed,
        };
      });
      return {
        ...group,
        statuses: statusesWithView,
      };
    });

    res.json(result);
  } catch (err) {
    console.error('❌ Get statuses error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- MARK STATUS AS VIEWED (self‑view prevented) ----
router.post('/view/:statusId', authMiddleware, async (req, res) => {
  try {
    const { statusId } = req.params;
    const userId = req.userId;

    const status = await Status.findById(statusId);
    if (!status) {
      return res.status(404).json({ message: 'Status not found' });
    }

    // Prevent self-view counting
    if (status.userId.toString() === userId) {
      return res.json({ success: true, message: 'Self-view ignored' });
    }

    if (!status.viewedBy.includes(userId)) {
      status.viewedBy.push(userId);
      await status.save();
    }

    res.json({ success: true, message: 'Status marked as viewed' });
  } catch (err) {
    console.error('❌ View status error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- DELETE STATUS ----
router.delete('/:statusId', authMiddleware, async (req, res) => {
  try {
    const { statusId } = req.params;
    const status = await Status.findOne({ _id: statusId, userId: req.userId });
    if (!status) {
      return res.status(404).json({ message: 'Status not found or not yours' });
    }
    await Status.findByIdAndDelete(statusId);
    res.json({ success: true, message: 'Status deleted successfully!' });
  } catch (err) {
    console.error('❌ Delete status error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- DOWNLOAD STATUS MEDIA ----
router.get('/download/:statusId', authMiddleware, async (req, res) => {
  try {
    const { statusId } = req.params;
    const status = await Status.findById(statusId);
    if (!status) return res.status(404).json({ message: 'Status not found' });
    if (!status.mediaUrl) return res.status(400).json({ message: 'No media to download' });
    res.json({ success: true, mediaUrl: status.mediaUrl, type: status.type });
  } catch (err) {
    console.error('❌ Download status error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;