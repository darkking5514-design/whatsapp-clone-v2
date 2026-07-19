const express = require('express');
const Message = require('../models/Message');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// ============================================
// GET MESSAGES BETWEEN TWO USERS
// ============================================
router.get('/:userId/:otherUserId', authMiddleware, async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;

    console.log(`🔍 Fetching messages between: ${userId} and ${otherUserId}`);

    if (!userId || !otherUserId || userId === 'undefined' || otherUserId === 'undefined') {
      console.log('❌ Invalid user IDs');
      return res.status(400).json({
        success: false,
        message: 'Invalid user IDs',
      });
    }

    const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);
    if (!isValidObjectId(userId) || !isValidObjectId(otherUserId)) {
      console.log('❌ Invalid ObjectId format');
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format',
      });
    }

    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId },
      ],
      deletedFor: { $ne: userId },
    }).sort({ timestamp: 1 });

    console.log(`✅ Found ${messages.length} messages`);
    res.json(messages);

  } catch (err) {
    console.error('❌ Get messages error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// ============================================
// UPLOAD MEDIA – DIRECT MULTER APPROACH
// ============================================
router.post('/upload', authMiddleware, upload.single('media'), async (req, res) => {
  try {
    console.log('📥 Upload request received');
    console.log('📋 Content-Type:', req.headers['content-type']);
    console.log('📋 User ID:', req.userId);

    if (!req.file) {
      console.error('❌ No file uploaded');
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    if (req.file.size === 0) {
      console.error('❌ File is empty');
      return res.status(400).json({
        success: false,
        message: 'File is empty',
      });
    }

    console.log('📁 File uploaded successfully:');
    console.log('📋 Filename:', req.file.filename);
    console.log('📋 Original name:', req.file.originalname);
    console.log('📋 Size:', req.file.size, 'bytes');
    console.log('📋 MIME type:', req.file.mimetype);

    const mediaUrl = `/uploads/${req.file.filename}`;

    res.json({
      success: true,
      mediaUrl: mediaUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });

  } catch (error) {
    console.error('❌ Upload error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during upload',
      error: error.message,
    });
  }
});

// ============================================
// DELETE MESSAGE
// ============================================
router.delete('/:messageId', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deleteFor } = req.query;

    console.log(`🗑️ Deleting message ${messageId} for ${deleteFor}`);

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (message.sender.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (deleteFor === 'everyone') {
      message.deleted = true;
      await message.save();
      return res.json({ success: true, message: 'Message deleted for everyone' });
    } else {
      if (!message.deletedFor.includes(req.userId)) {
        message.deletedFor.push(req.userId);
        await message.save();
      }
      return res.json({ success: true, message: 'Message deleted for you' });
    }
  } catch (err) {
    console.error('❌ Delete message error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// FORWARD MESSAGE
// ============================================
router.post('/forward', authMiddleware, async (req, res) => {
  try {
    const { messageId, receiverIds } = req.body;

    if (!messageId || !receiverIds || receiverIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    const originalMessage = await Message.findById(messageId);
    if (!originalMessage) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const forwardedMessages = [];
    for (const receiverId of receiverIds) {
      const newMessage = new Message({
        sender: req.userId,
        receiver: receiverId,
        content: originalMessage.content,
        mediaUrl: originalMessage.mediaUrl,
        messageType: originalMessage.messageType,
        forwarded: true,
        originalSender: originalMessage.sender,
        timestamp: new Date(),
      });
      await newMessage.save();
      forwardedMessages.push(newMessage);
    }

    res.json({
      success: true,
      message: `Forwarded to ${forwardedMessages.length} users`,
      forwardedMessages,
    });
  } catch (err) {
    console.error('❌ Forward error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;