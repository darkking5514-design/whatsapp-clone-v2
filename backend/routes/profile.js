const express = require('express');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');
const bcrypt = require('bcryptjs');

const router = express.Router();

// ============================================
// GET PROFILE
// ============================================
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-otp -otpExpiry');
    res.json(user);
  } catch (err) {
    console.error('❌ Profile error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// UPDATE PROFILE
// ============================================
router.put('/update', authMiddleware, async (req, res) => {
  try {
    const { name, username, about } = req.body;
    const updates = {};

    if (name) updates.name = name.trim();
    if (about !== undefined) updates.about = about.trim();
    if (username) {
      const existing = await User.findOne({ username: username.trim(), _id: { $ne: req.userId } });
      if (existing) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      updates.username = username.trim();
    }

    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true })
      .select('-otp -otpExpiry');

    res.json({ success: true, user });
  } catch (err) {
    console.error('❌ Update profile error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// UPLOAD PROFILE PICTURE
// ============================================
router.post('/upload-dp', authMiddleware, upload.single('profilePic'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const profilePic = `/uploads/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(
      req.userId,
      { profilePic },
      { new: true }
    ).select('-otp -otpExpiry');

    res.json({ success: true, user });
  } catch (err) {
    console.error('❌ Upload DP error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// REMOVE PROFILE PICTURE
// ============================================
router.delete('/remove-dp', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      { profilePic: '' },
      { new: true }
    ).select('-otp -otpExpiry');

    res.json({ success: true, user });
  } catch (err) {
    console.error('❌ Remove DP error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// UPDATE PRIVACY SETTINGS
// ============================================
router.put('/privacy', authMiddleware, async (req, res) => {
  try {
    const { lastSeen, online, profilePhoto, about, status, disappearingMessages } = req.body;

    const privacy = {};
    if (lastSeen) privacy['privacy.lastSeen'] = lastSeen;
    if (online) privacy['privacy.online'] = online;
    if (profilePhoto) privacy['privacy.profilePhoto'] = profilePhoto;
    if (about) privacy['privacy.about'] = about;
    if (status) privacy['privacy.status'] = status;
    if (disappearingMessages !== undefined) {
      privacy['privacy.disappearingMessages.enabled'] = disappearingMessages.enabled;
      if (disappearingMessages.duration) {
        privacy['privacy.disappearingMessages.duration'] = disappearingMessages.duration;
      }
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: privacy },
      { new: true }
    ).select('-otp -otpExpiry');

    res.json({ success: true, user });
  } catch (err) {
    console.error('❌ Privacy update error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// CHANGE PHONE NUMBER
// ============================================
router.post('/change-phone', authMiddleware, async (req, res) => {
  try {
    const { newPhoneNumber, otp } = req.body;

    if (!newPhoneNumber || !otp) {
      return res.status(400).json({ message: 'Phone and OTP required' });
    }

    // Verify OTP (simplified – use proper verification)
    const user = await User.findById(req.userId);
    if (user.otp !== otp || user.otpExpiry < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const existing = await User.findOne({ phoneNumber: newPhoneNumber });
    if (existing) {
      return res.status(400).json({ message: 'Phone number already registered' });
    }

    user.phoneNumber = newPhoneNumber;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    res.json({ success: true, message: 'Phone number updated successfully' });
  } catch (err) {
    console.error('❌ Change phone error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// SET PASSKEY
// ============================================
router.post('/set-passkey', authMiddleware, async (req, res) => {
  try {
    const { passkey } = req.body;

    if (!passkey || passkey.length < 4) {
      return res.status(400).json({ message: 'Passkey must be at least 4 digits' });
    }

    const hashedPasskey = await bcrypt.hash(passkey, 10);
    await User.findByIdAndUpdate(req.userId, { passkey: hashedPasskey });

    res.json({ success: true, message: 'Passkey set successfully' });
  } catch (err) {
    console.error('❌ Set passkey error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// VERIFY PASSKEY
// ============================================
router.post('/verify-passkey', authMiddleware, async (req, res) => {
  try {
    const { passkey } = req.body;
    const user = await User.findById(req.userId);

    if (!user.passkey) {
      return res.status(400).json({ message: 'No passkey set' });
    }

    const isValid = await bcrypt.compare(passkey, user.passkey);
    if (!isValid) {
      return res.status(400).json({ message: 'Invalid passkey' });
    }

    res.json({ success: true, message: 'Passkey verified' });
  } catch (err) {
    console.error('❌ Verify passkey error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// DELETE ACCOUNT
// ============================================
router.delete('/delete', authMiddleware, async (req, res) => {
  try {
    const { passkey } = req.body;
    const user = await User.findById(req.userId);

    // Verify passkey if set
    if (user.passkey) {
      const isValid = await bcrypt.compare(passkey, user.passkey);
      if (!isValid) {
        return res.status(400).json({ message: 'Invalid passkey' });
      }
    }

    // Soft delete – mark as inactive
    user.isActive = false;
    user.deletedAt = new Date();
    user.onlineStatus = false;
    await user.save();

    // Socket.IO: emit user offline
    const io = req.app.get('io');
    if (io) {
      io.emit('user_offline', { userId: req.userId });
    }

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (err) {
    console.error('❌ Delete account error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// LOGOUT (Clear token)
// ============================================
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, { onlineStatus: false, lastSeen: new Date() });

    const io = req.app.get('io');
    if (io) {
      io.emit('user_offline', { userId: req.userId });
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('❌ Logout error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;