const Message = require('../models/Message');
const User = require('../models/User');
const Group = require('../models/Group');

const userSocketMap = {};

function getSocketId(userId) {
  return userSocketMap[userId];
}

function initSocket(io) {
  io.on('connection', (socket) => {
    console.log(`✅ Socket connected: ${socket.id}`);

    let currentUserId = null;

    // ---- JOIN ----
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

      // ✅ Send current online users list to the newly joined user
      const onlineUserIds = Object.keys(userSocketMap);
      console.log(`📋 Sending online users list to ${userId}:`, onlineUserIds);

      // ✅ Send to self – list of all online users
      socket.emit('online_users', { users: onlineUserIds });

      // ✅ Broadcast to ALL users (including self) that this user is online
      io.emit('user_online', { userId });
    });

    // ---- PRIVATE MESSAGE ----
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
          duration,
          statusReply,
        } = data;

        console.log(`📤 Private message from ${senderId} to ${receiverId}`);

        if (!senderId || !receiverId) {
          if (ack) ack({ success: false, error: 'Invalid IDs' });
          return;
        }

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
          duration: duration || 0,
          statusReply: statusReply || null,
          timestamp: new Date(),
        });
        await message.save();

        const populated = await Message.findById(message._id).populate('sender', 'name phoneNumber');

        const receiverSocketId = getSocketId(receiverId);
        if (receiverSocketId) {
          message.status = 'delivered';
          await message.save();
          io.to(receiverSocketId).emit('receive_message', populated);
          console.log(`📨 Message delivered to ${receiverId}`);
        }

        if (typeof ack === 'function') {
          ack({ success: true, message: populated });
        }
      } catch (err) {
        console.error('❌ send_message error:', err.message);
        if (ack) ack({ success: false, error: err.message });
      }
    });

    // ---- GROUP MESSAGE ----
    socket.on('send_group_message', async (data, ack) => {
      try {
        const {
          groupId,
          senderId,
          content,
          mediaUrl,
          messageType,
          replyTo,
          forwarded,
          originalSender,
          duration,
        } = data;

        console.log(`📤 Group message from ${senderId} in group ${groupId}`);

        const group = await Group.findOne({ _id: groupId, 'members.user': senderId });
        if (!group) {
          if (ack) ack({ success: false, error: 'Not a member' });
          return;
        }

        const message = new Message({
          sender: senderId,
          groupId,
          content: content || '',
          mediaUrl: mediaUrl || '',
          messageType: messageType || 'text',
          status: 'sent',
          replyTo: replyTo || null,
          forwarded: forwarded || false,
          originalSender: originalSender || null,
          duration: duration || 0,
          timestamp: new Date(),
        });
        await message.save();

        const populated = await Message.findById(message._id)
          .populate('sender', 'name phoneNumber');

        console.log(`✅ Group message saved: ${message._id}`);

        const memberIds = group.members.map((m) => m.user.toString());
        for (const uid of memberIds) {
          const socketId = getSocketId(uid);
          if (socketId) {
            io.to(socketId).emit('receive_group_message', populated);
          }
        }

        if (typeof ack === 'function') {
          ack({ success: true, message: populated });
        }
      } catch (err) {
        console.error('❌ send_group_message error:', err.message);
        if (ack) ack({ success: false, error: err.message });
      }
    });

    // ---- TYPING INDICATOR ----
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

    // ---- READ RECEIPTS ----
    socket.on('mark_read', async ({ senderId, receiverId }) => {
      try {
        console.log(`📖 Marking messages as read from ${senderId} to ${receiverId}`);

        const result = await Message.updateMany(
          { sender: senderId, receiver: receiverId, status: { $ne: 'read' } },
          { $set: { status: 'read' } }
        );

        console.log(`✅ ${result.modifiedCount} messages marked as read`);

        const senderSocketId = getSocketId(senderId);
        if (senderSocketId) {
          io.to(senderSocketId).emit('messages_read', { by: receiverId });
        }
      } catch (err) {
        console.error('❌ mark_read error:', err.message);
      }
    });

    // ---- DELETE MESSAGE ----
    socket.on('delete_message', async ({ messageId, deleteFor, senderId, receiverId }) => {
      try {
        console.log(`🗑️ Deleting message ${messageId} for ${deleteFor}`);

        const message = await Message.findById(messageId);
        if (!message) return;

        if (deleteFor === 'everyone') {
          message.deleted = true;
          await message.save();

          const senderSocket = getSocketId(senderId);
          const receiverSocket = getSocketId(receiverId);
          if (senderSocket) {
            io.to(senderSocket).emit('message_deleted', { messageId, deleteFor: 'everyone' });
          }
          if (receiverSocket) {
            io.to(receiverSocket).emit('message_deleted', { messageId, deleteFor: 'everyone' });
          }
        } else {
          if (!message.deletedFor.includes(receiverId)) {
            message.deletedFor.push(receiverId);
            await message.save();
          }
          const receiverSocket = getSocketId(receiverId);
          if (receiverSocket) {
            io.to(receiverSocket).emit('message_deleted', { messageId, deleteFor: 'me' });
          }
        }
      } catch (err) {
        console.error('❌ delete_message error:', err.message);
      }
    });

    // ---- WEBRTC CALL SIGNALING ----
    socket.on('call_offer', ({ to, from, offer, callType, callerName }) => {
      console.log(`📞 Call offer from ${from} to ${to} (${callType})`);
      const targetSocketId = getSocketId(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call_offer', { from, offer, callType, callerName });
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
      console.log(`🧊 ICE candidate from ${from} to ${to}`);
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

    // ---- DISCONNECT ----
    socket.on('disconnect', async () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);

      if (currentUserId && userSocketMap[currentUserId] === socket.id) {
        delete userSocketMap[currentUserId];

        try {
          await User.findByIdAndUpdate(currentUserId, {
            onlineStatus: false,
            lastSeen: new Date(),
          });
          console.log(`👤 ${currentUserId} is now offline`);

          // ✅ Broadcast to all users that this user is offline
          io.emit('user_offline', { userId: currentUserId });
        } catch (err) {
          console.error('❌ Failed to update offline status:', err.message);
        }
      }
    });
  });
}

module.exports = { initSocket, getSocketId, userSocketMap };