const Message = require('../models/Message');
const User = require('../models/User');

// In-memory map of userId -> socketId
const userSocketMap = {};

function getSocketId(userId) {
  return userSocketMap[userId];
}

function initSocket(io) {
  io.on('connection', (socket) => {
    console.log(`✅ Socket connected: ${socket.id}`);

    let currentUserId = null;

    // ============================================
    // JOIN - User online ho gaya
    // ============================================
    socket.on('join', async (userId) => {
      if (!userId) {
        console.log('❌ Join event: No userId provided');
        return;
      }

      console.log(`👤 User ${userId} joined with socket ${socket.id}`);
      currentUserId = userId;
      userSocketMap[userId] = socket.id;
      socket.join(userId);

      try {
        await User.findByIdAndUpdate(userId, { onlineStatus: true, lastSeen: new Date() });
        console.log(`✅ ${userId} is now online`);
      } catch (err) {
        console.error('❌ Failed to update onlineStatus:', err.message);
      }

      // Broadcast to all users that this user is online
      io.emit('user_online', { userId });
    });

    // ============================================
    // SEND MESSAGE (with duration for audio)
    // ============================================
    socket.on('send_message', async (data, ack) => {
      try {
        const {
          senderId,
          receiverId,
          content,
          mediaUrl,
          messageType,
          replyTo,
          forwarded,
          originalSender,
          duration, // 👈 new field
        } = data;

        console.log(`📤 Sending message from ${senderId} to ${receiverId}`);

        // Validate IDs
        if (!senderId || !receiverId || senderId === 'undefined' || receiverId === 'undefined') {
          console.error('❌ Invalid sender or receiver ID');
          if (typeof ack === 'function') {
            ack({ success: false, error: 'Invalid sender or receiver ID' });
          }
          return;
        }

        // Create message
        const message = new Message({
          sender: senderId,
          receiver: receiverId,
          content: content || '',
          mediaUrl: mediaUrl || '',
          messageType: messageType || 'text',
          status: 'sent',
          replyTo: replyTo || null,
          forwarded: forwarded || false,
          originalSender: originalSender || null,
          duration: duration || 0, // store duration
          timestamp: new Date(),
        });

        await message.save();

        // Populate replyTo if exists
        let populatedMessage = message.toObject();
        if (replyTo) {
          const replyMsg = await Message.findById(replyTo);
          populatedMessage.replyMessage = replyMsg;
        }

        console.log(`✅ Message saved: ${message._id}`);

        // Check if receiver is online
        const receiverSocketId = getSocketId(receiverId);
        if (receiverSocketId) {
          message.status = 'delivered';
          await message.save();
          io.to(receiverSocketId).emit('receive_message', populatedMessage);
          console.log(`📨 Message delivered to ${receiverId}`);
        } else {
          console.log(`⚠️ Receiver ${receiverId} is offline`);
        }

        // Send acknowledgment back to sender
        if (typeof ack === 'function') {
          ack({ success: true, message: populatedMessage });
        }

      } catch (err) {
        console.error('❌ send_message error:', err.message);
        if (typeof ack === 'function') {
          ack({ success: false, error: err.message });
        }
      }
    });

    // ============================================
    // DELETE MESSAGE (Real-time)
    // ============================================
    socket.on('delete_message', async ({ messageId, deleteFor, senderId, receiverId }) => {
      try {
        console.log(`🗑️ Deleting message ${messageId} for ${deleteFor}`);
        
        const message = await Message.findById(messageId);
        if (!message) {
          console.log('❌ Message not found');
          return;
        }

        if (deleteFor === 'everyone') {
          message.deleted = true;
          await message.save();
          
          // Notify both users
          const senderSocket = getSocketId(senderId);
          const receiverSocket = getSocketId(receiverId);
          
          if (senderSocket) {
            io.to(senderSocket).emit('message_deleted', { messageId, deleteFor: 'everyone' });
          }
          if (receiverSocket) {
            io.to(receiverSocket).emit('message_deleted', { messageId, deleteFor: 'everyone' });
          }
        } else {
          // Delete for me only
          if (!message.deletedFor.includes(receiverId)) {
            message.deletedFor.push(receiverId);
            await message.save();
          }
          
          const receiverSocket = getSocketId(receiverId);
          if (receiverSocket) {
            io.to(receiverSocket).emit('message_deleted', { messageId, deleteFor: 'me' });
          }
        }
        console.log('✅ Message deleted successfully');
      } catch (err) {
        console.error('❌ Delete message socket error:', err.message);
      }
    });

    // ============================================
    // TYPING INDICATOR
    // ============================================
    socket.on('typing', ({ to, from }) => {
      const targetSocketId = getSocketId(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('typing', { from });
      }
    });

    socket.on('stop_typing', ({ to, from }) => {
      const targetSocketId = getSocketId(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('stop_typing', { from });
      }
    });

    // ============================================
    // READ RECEIPTS - WITH UNREAD COUNT
    // ============================================
    socket.on('mark_read', async ({ senderId, receiverId }) => {
      try {
        console.log(`📖 Marking messages as read from ${senderId} to ${receiverId}`);

        const result = await Message.updateMany(
          { sender: senderId, receiver: receiverId, status: { $ne: 'read' } },
          { $set: { status: 'read' } }
        );

        console.log(`✅ ${result.modifiedCount} messages marked as read`);

        // Tell sender that messages are read (for unread badge clearing)
        const senderSocketId = getSocketId(senderId);
        if (senderSocketId) {
          io.to(senderSocketId).emit('messages_read', { by: receiverId });
        }

      } catch (err) {
        console.error('❌ mark_read error:', err.message);
      }
    });

    // ============================================
    // WEBRTC CALL SIGNALING
    // ============================================
    socket.on('call_offer', ({ to, from, offer, callType, callerName }) => {
      console.log(`📞 Call offer from ${from} to ${to} (${callType})`);
      const targetSocketId = getSocketId(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call_offer', { from, offer, callType, callerName });
      } else {
        console.log(`⚠️ Call target ${to} is offline`);
      }
    });

    socket.on('call_answer', ({ to, from, answer }) => {
      console.log(`📞 Call answer from ${from} to ${to}`);
      const targetSocketId = getSocketId(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call_answer', { from, answer });
      }
    });

    socket.on('call_ice_candidate', ({ to, from, candidate }) => {
      const targetSocketId = getSocketId(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call_ice_candidate', { from, candidate });
      }
    });

    socket.on('call_end', ({ to, from }) => {
      console.log(`📞 Call ended between ${from} and ${to}`);
      const targetSocketId = getSocketId(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call_end', { from });
      }
    });

    socket.on('call_reject', ({ to, from }) => {
      console.log(`📞 Call rejected by ${from} for ${to}`);
      const targetSocketId = getSocketId(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call_reject', { from });
      }
    });

    // ============================================
    // DISCONNECT
    // ============================================
    socket.on('disconnect', async () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);

      if (currentUserId && userSocketMap[currentUserId] === socket.id) {
        delete userSocketMap[currentUserId];

        try {
          const lastSeen = new Date();
          await User.findByIdAndUpdate(currentUserId, {
            onlineStatus: false,
            lastSeen,
          });
          console.log(`👤 ${currentUserId} is now offline`);

          // Broadcast to all users
          io.emit('user_offline', { userId: currentUserId, lastSeen });
        } catch (err) {
          console.error('❌ Failed to update offline status:', err.message);
        }
      }
    });
  });
}

module.exports = {
  initSocket,
  getSocketId,
  userSocketMap,
};