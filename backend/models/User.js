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
    profilePic: {
      type: String,
      default: '',
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
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);