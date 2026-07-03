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
      default: null,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      default: null,
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
    duration: {
      type: Number,
      default: 0,
    },
    statusReply: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

messageSchema.index({ sender: 1, receiver: 1, groupId: 1, timestamp: 1 });

module.exports = mongoose.model('Message', messageSchema);