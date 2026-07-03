const mongoose = require('mongoose');

const callSchema = new mongoose.Schema(
  {
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['audio', 'video'],
      required: true,
    },
    duration: {
      type: Number,
      default: 0, // seconds
    },
    status: {
      type: String,
      enum: ['missed', 'answered', 'rejected', 'cancelled'],
      default: 'missed',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

callSchema.index({ caller: 1, receiver: 1, timestamp: -1 });

module.exports = mongoose.model('Call', callSchema);