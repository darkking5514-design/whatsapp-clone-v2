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

    socket.on('join', async (userId) => {
      if (!userId) return;
      console.log(`👤 User ${userId} joined`);
      currentUserId = userId;
      userSocketMap[userId] = socket.id;
      socket.join(userId);

      try {
        await User.findByIdAndUpdate(userId, { onlineStatus: true, lastSeen: new Date() });
      } catch (err) {
        console.error('Failed to update onlineStatus', err);
      }
      io.emit('user_online', { userId });
    });

    // ---- Private message ----
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
        }
        if (ack) ack({ success: true, message: populated });
      } catch (err) {
        console.error('send_message error:', err);
        if (ack) ack({ success: false, error: err.message });
      }
    });

    // ---- Group message ----
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

        const memberIds = group.members.map(m => m.user.toString());
        for (const uid of memberIds) {
          const socketId = getSocketId(uid);
          if (socketId) {
            io.to(socketId).emit('receive_group_message', populated);
          }
        }
        if (ack) ack({ success: true, message: populated });
      } catch (err) {
        console.error('Group message error:', err);
        if (ack) ack({ success: false, error: err.message });
      }
    });

    // ---- Other events (typing, read receipts, calls) ----
    socket.on('typing', ({ to, from }) => {
      const targetSocketId = getSocketId(to);
      if (targetSocketId) io.to(targetSocketId).emit('typing', { from });
    });

    socket.on('stop_typing', ({ to, from }) => {
      const targetSocketId = getSocketId(to);
      if (targetSocketId) io.to(targetSocketId).emit('stop_typing', { from });
    });

    socket.on('mark_read', async ({ senderId, receiverId }) => {
      try {
        await Message.updateMany(
          { sender: senderId, receiver: receiverId, status: { $ne: 'read' } },
          { $set: { status: 'read' } }
        );
        const senderSocketId = getSocketId(senderId);
        if (senderSocketId) io.to(senderSocketId).emit('messages_read', { by: receiverId });
      } catch (err) {
        console.error('mark_read error:', err);
      }
    });

    // WebRTC signaling
    socket.on('call_offer', ({ to, from, offer, callType, callerName }) => {
      const targetSocketId = getSocketId(to);
      if (targetSocketId) io.to(targetSocketId).emit('call_offer', { from, offer, callType, callerName });
    });
    socket.on('call_answer', ({ to, from, answer }) => {
      const targetSocketId = getSocketId(to);
      if (targetSocketId) io.to(targetSocketId).emit('call_answer', { from, answer });
    });
    socket.on('call_ice_candidate', ({ to, from, candidate }) => {
      const targetSocketId = getSocketId(to);
      if (targetSocketId) io.to(targetSocketId).emit('call_ice_candidate', { from, candidate });
    });
    socket.on('call_end', ({ to, from }) => {
      const targetSocketId = getSocketId(to);
      if (targetSocketId) io.to(targetSocketId).emit('call_end', { from });
    });
    socket.on('call_reject', ({ to, from }) => {
      const targetSocketId = getSocketId(to);
      if (targetSocketId) io.to(targetSocketId).emit('call_reject', { from });
    });

    socket.on('disconnect', async () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
      if (currentUserId && userSocketMap[currentUserId] === socket.id) {
        delete userSocketMap[currentUserId];
        try {
          await User.findByIdAndUpdate(currentUserId, { onlineStatus: false, lastSeen: new Date() });
          io.emit('user_offline', { userId: currentUserId });
        } catch (err) {
          console.error('Failed to update offline status', err);
        }
      }
    });
  });
}

module.exports = { initSocket, getSocketId, userSocketMap };