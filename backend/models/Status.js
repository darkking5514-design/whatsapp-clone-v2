const mongoose = require('mongoose');

const statusSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  text: {
    type: String,
    default: '',
  },
  mediaUrl: {
    type: String,
    default: '',
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'image_text', 'video_text'],
    required: true,
  },
  backgroundColor: {
    type: String,
    default: '#075E54', // WhatsApp dark green
  },
  textColor: {
    type: String,
    default: '#FFFFFF',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  viewedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
});

// TTL index - auto delete after 24 hours
statusSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Status', statusSchema);