const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    profilePic: {
      type: String,
      default: '',
    },
    about: {
      type: String,
      default: 'Hey there! I am using WhatsApp Clone',
    },
    onlineStatus: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    otp: {
      type: String,
    },
    otpExpiry: {
      type: Date,
    },
    // ---- Privacy Settings ----
    privacy: {
      lastSeen: {
        type: String,
        enum: ['everyone', 'contacts', 'nobody'],
        default: 'everyone',
      },
      online: {
        type: String,
        enum: ['everyone', 'same_as_last_seen'],
        default: 'everyone',
      },
      profilePhoto: {
        type: String,
        enum: ['everyone', 'contacts', 'nobody'],
        default: 'everyone',
      },
      about: {
        type: String,
        enum: ['everyone', 'contacts', 'nobody'],
        default: 'everyone',
      },
      status: {
        type: String,
        enum: ['everyone', 'contacts', 'nobody'],
        default: 'everyone',
      },
      disappearingMessages: {
        enabled: { type: Boolean, default: false },
        duration: { type: Number, default: 86400 }, // 24 hours in seconds
      },
    },
    // ---- Account settings ----
    passkey: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);