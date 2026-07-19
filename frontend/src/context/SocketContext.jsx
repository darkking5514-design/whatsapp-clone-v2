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
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    console.log(`🔌 Connecting to: ${SOCKET_URL}`);

    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      withCredentials: true,
      path: '/socket.io',
      reconnectionAttempts: 20,
      reconnectionDelay: 2000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`✅ Socket connected! ID: ${socket.id}`);
      setConnected(true);
      socket.emit('join', user.id);
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Socket error:', err.message);
      setConnected(false);
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      setConnected(false);
    });

    socket.on('user_online', ({ userId }) => {
      setOnlineUsers((prev) => ({ ...prev, [userId]: true }));
    });

    socket.on('user_offline', ({ userId }) => {
      setOnlineUsers((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    });

    socket.on('call_offer', ({ from, offer, callType, callerName }) => {
      setIncomingCall({ from, offer, callType, callerName });
    });

    socket.on('call_end', () => setIncomingCall(null));
    socket.on('call_reject', () => setIncomingCall(null));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  const clearIncomingCall = () => setIncomingCall(null);

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
  if (!ctx) throw new Error('useSocket must be within SocketProvider');
  return ctx;
}