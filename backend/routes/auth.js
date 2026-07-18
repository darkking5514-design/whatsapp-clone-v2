const express = require('express');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const { sendOTP, verifyOTP, verifyOTPWithVerify } = require('../services/otpService');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'meri_super_secret_key_123456789';

// ============================================
// 1. REQUEST OTP - Via SMS (Twilio Verify)
// ============================================
router.post('/request-otp', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ 
        success: false,
        message: 'Phone number is required' 
      });
    }

    const cleanedPhone = phoneNumber.trim();
    
    if (!cleanedPhone.match(/^\+[0-9]{10,15}$/)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid phone number format. Use international format like +923001234567' 
      });
    }

    // Generate OTP for database (fallback verification only)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    console.log(`🔍 Checking user with phone: ${cleanedPhone}`);

    let user = await User.findOne({ phoneNumber: cleanedPhone });
    let isNewUser = false;

    if (user) {
      user.otp = otp;
      user.otpExpiry = otpExpiry;
      await user.save();
      console.log(`✅ Existing user found: ${user.name}`);
    } else {
      isNewUser = true;
      user = new User({
        phoneNumber: cleanedPhone,
        name: 'User',
        otp,
        otpExpiry,
      });
      await user.save();
      console.log(`✅ New user created with phone: ${cleanedPhone}`);
    }

    // ============================================
    // SEND OTP VIA SMS (TWILIO VERIFY)
    // ============================================
    console.log(`📱 Sending OTP to ${cleanedPhone} via SMS...`);
    const result = await sendOTP(cleanedPhone);
    
    if (result.success) {
      console.log('✅ OTP sent successfully via SMS!');
    } else {
      console.log(`⚠️ SMS failed for ${cleanedPhone}`);
      console.log(`❌ Error: ${result.error}`);
    }

    // ✅ Testing OTP included for development purposes
    res.json({
      success: true,
      message: result.success ? 'OTP sent via SMS!' : 'OTP generated (SMS failed, check console)',
      isNewUser,
      devOtp: otp,  // 👈 Testing OTP - remove in production
      phoneNumber: cleanedPhone,
    });
    
  } catch (err) {
    console.error('❌ Request OTP error:', err.message);
    console.error('📋 Stack:', err.stack);
    res.status(500).json({ 
      success: false,
      message: 'Server error while sending OTP',
      error: err.message 
    });
  }
});

// ============================================
// 2. VERIFY OTP & LOGIN/REGISTER
// ============================================
router.post('/verify-otp', async (req, res) => {
  try {
    const { phoneNumber, otp, name } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({ 
        success: false,
        message: 'Phone number and OTP are required' 
      });
    }

    const cleanedPhone = phoneNumber.trim();

    // Find user
    const user = await User.findOne({ phoneNumber: cleanedPhone });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found. Please request OTP first.' 
      });
    }

    // ============================================
    // VERIFY OTP using Twilio Verify (primary)
    // ============================================
    let verificationResult = await verifyOTPWithVerify(cleanedPhone, otp);
    
    // If Twilio Verify fails, fallback to local verification
    if (!verificationResult.success) {
      console.log('⚠️ Twilio Verify failed, trying local verification...');
      const localVerification = verifyOTP(user, otp);
      if (!localVerification.success) {
        return res.status(400).json({
          success: false,
          message: localVerification.message
        });
      }
      verificationResult = { success: true };
    }

    // Clear OTP after verification
    user.otp = undefined;
    user.otpExpiry = undefined;

    // If user is new (name is placeholder), update name
    if (name && name.trim() && user.name === 'User') {
      user.name = name.trim();
      console.log(`✅ User name updated to: ${user.name}`);
    }

    user.onlineStatus = true;
    user.lastSeen = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });

    console.log(`✅ User logged in: ${user.name} (${user.phoneNumber})`);

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        profilePic: user.profilePic || '',
        onlineStatus: user.onlineStatus,
        lastSeen: user.lastSeen,
      },
    });
    
  } catch (err) {
    console.error('❌ Verify OTP error:', err.message);
    console.error('📋 Stack:', err.stack);
    res.status(500).json({ 
      success: false,
      message: 'Server error during verification',
      error: err.message 
    });
  }
});

// ============================================
// 3. GET CURRENT USER (me)
// ============================================
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-otp -otpExpiry');
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    res.json({ 
      success: true,
      user 
    });
  } catch (err) {
    console.error('❌ Me error:', err.message);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// ============================================
// 4. RESEND OTP
// ============================================
router.post('/resend-otp', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ 
        success: false,
        message: 'Phone number is required' 
      });
    }

    const cleanedPhone = phoneNumber.trim();

    // Find user
    let user = await User.findOne({ phoneNumber: cleanedPhone });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found. Please register first.' 
      });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // Send OTP via Twilio Verify
    const result = await sendOTP(cleanedPhone);

    if (result.success) {
      console.log('✅ OTP resent successfully!');
    } else {
      console.log(`⚠️ SMS resend failed for ${cleanedPhone}`);
    }

    res.json({
      success: true,
      message: result.success ? 'OTP resent successfully!' : 'Failed to resend OTP. Please try again.',
      devOtp: otp,  // 👈 Testing OTP for resend
    });
    
  } catch (err) {
    console.error('❌ Resend OTP error:', err.message);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

module.exports = router;