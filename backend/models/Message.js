const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      default: '',
    },
    mediaUrl: {
      type: String,
      default: '',
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'file'],
      default: 'text',
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    // ---- Reply, Forward, Delete ----
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    forwarded: {
      type: Boolean,
      default: false,
    },
    originalSender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedFor: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },
    // ---- NEW: Duration for voice messages ----
    duration: {
      type: Number,
      default: 0, // seconds
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for efficient message retrieval
messageSchema.index({ sender: 1, receiver: 1, timestamp: 1 });

module.exports = mongoose.model('Message', messageSchema);