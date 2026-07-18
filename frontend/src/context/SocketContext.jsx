import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { SOCKET_URL } from '../api/axios';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    if (!user) {
      console.log('⚠️ No user in SocketContext - disconnecting');
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    console.log(`🔌 Connecting to socket server: ${SOCKET_URL}`);
    console.log(`👤 User ID: ${user.id}`);

    if (!user.id) {
      console.error('❌ User ID is undefined - cannot connect socket');
      return;
    }

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      path: '/socket.io',
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socketRef.current = socket;
    window.__socket = socket;

    // ---- Connect ----
    socket.on('connect', () => {
      console.log(`✅ Socket connected! ID: ${socket.id}`);
      setConnected(true);
      socket.emit('join', user.id);
      console.log(`📤 Emitted join event for user: ${user.id}`);
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Socket connection error:', err.message);
      setConnected(false);
    });

    socket.on('disconnect', (reason) => {
      console.log(`❌ Socket disconnected: ${reason}`);
      setConnected(false);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Socket reconnected after ${attemptNumber} attempts`);
      setConnected(true);
      if (user?.id) {
        socket.emit('join', user.id);
      }
    });

    // ---- User Presence ----
    socket.on('user_online', ({ userId }) => {
      console.log(`🟢 User online: ${userId}`);
      setOnlineUsers((prev) => ({ ...prev, [userId]: true }));
    });

    socket.on('user_offline', ({ userId }) => {
      console.log(`🔴 User offline: ${userId}`);
      setOnlineUsers((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    });

    // ---- Messages ----
    socket.on('receive_message', (message) => {
      console.log('📩 Received message:', message);
      // ChatWindow component handles this via its own listener
    });

    socket.on('receive_group_message', (message) => {
      console.log('📩 Received group message:', message);
      // GroupChat component handles this via its own listener
    });

    // ---- Calls ----
    socket.on('call_offer', ({ from, offer, callType, callerName }) => {
      console.log(`📞 Incoming call from: ${callerName}`);
      setIncomingCall({ from, offer, callType, callerName });
    });

    socket.on('call_end', ({ from }) => {
      console.log(`📞 Call ended by: ${from}`);
      setIncomingCall(null);
    });

    socket.on('call_reject', ({ from }) => {
      console.log(`📞 Call rejected by: ${from}`);
      setIncomingCall(null);
    });

    socket.on('call_answer', ({ from, answer }) => {
      console.log(`📞 Call answered by: ${from}`);
      // Handled by Call.jsx component
    });

    socket.on('call_ice_candidate', ({ from, candidate }) => {
      console.log(`🧊 ICE candidate from: ${from}`);
      // Handled by Call.jsx component
    });

    // ---- Message Read Receipts ----
    socket.on('messages_read', ({ by }) => {
      console.log(`📖 Messages read by: ${by}`);
      // Handled by ChatWindow component
    });

    socket.on('message_deleted', ({ messageId, deleteFor }) => {
      console.log(`🗑️ Message deleted: ${messageId} for ${deleteFor}`);
      // Handled by ChatWindow component
    });

    // ---- Typing ----
    socket.on('typing', ({ from }) => {
      console.log(`✍️ ${from} is typing...`);
      // Handled by ChatWindow component
    });

    socket.on('stop_typing', ({ from }) => {
      console.log(`✍️ ${from} stopped typing`);
      // Handled by ChatWindow component
    });

    // ---- Cleanup ----
    return () => {
      console.log('🔌 Cleaning up socket...');
      socket.disconnect();
      socketRef.current = null;
      window.__socket = null;
    };
  }, [user]);

  // ---- Clear incoming call ----
  function clearIncomingCall() {
    setIncomingCall(null);
  }

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        connected,
        onlineUsers,
        incomingCall,
        clearIncomingCall,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return ctx;
}