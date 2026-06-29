import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SOCKET_URL = 'http://localhost:5000';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    if (!user) {
      console.log('⚠️ No user in SocketContext');
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    console.log(`🔌 Connecting to socket server: ${SOCKET_URL}`);
    console.log(`👤 User ID: ${user.id}`);
    console.log(`👤 Full User:`, user);

    if (!user.id) {
      console.error('❌ User ID is undefined! Cannot connect socket.');
      return;
    }

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;
    window.__socket = socket;

    socket.on('connect', () => {
      console.log(`✅ Socket connected! ID: ${socket.id}`);
      setConnected(true);
      socket.emit('join', user.id);
      console.log(`📤 Emitted join event for user: ${user.id}`);
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Socket connection error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.log(`❌ Socket disconnected: ${reason}`);
      setConnected(false);
    });

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

    socket.on('receive_message', (message) => {
      console.log('📩 Received message:', message);
    });

    socket.on('call_offer', ({ from, offer, callType, callerName }) => {
      console.log(`📞 Incoming call from: ${callerName}`);
      setIncomingCall({ from, offer, callType, callerName });
    });

    return () => {
      console.log('🔌 Cleaning up socket...');
      socket.disconnect();
      socketRef.current = null;
      window.__socket = null;
    };
  }, [user]);

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
  if (!ctx) throw new Error('useSocket must be used within a SocketProvider');
  return ctx;
}