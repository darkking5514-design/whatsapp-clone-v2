import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import ChatList from './pages/ChatList';
import ChatWindow from './pages/ChatWindow';
import GroupChat from './pages/GroupChat';
import Status from './pages/Status';
import Calls from './pages/Calls';
import Call from './pages/Call';
import AddFriends from './pages/AddFriends';
import ProtectedRoute from './components/ProtectedRoute';
import IncomingCallBanner from './components/IncomingCallBanner';
import MobileNav from './components/MobileNav';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { user } = useAuth();

  return (
    <>
      {user && <IncomingCallBanner />}
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/chats"
          element={
            <ProtectedRoute>
              <ChatList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat/:userId"
          element={
            <ProtectedRoute>
              <ChatWindow />
            </ProtectedRoute>
          }
        />
        <Route
          path="/group/:groupId"
          element={
            <ProtectedRoute>
              <GroupChat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/status"
          element={
            <ProtectedRoute>
              <Status />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calls"
          element={
            <ProtectedRoute>
              <Calls />
            </ProtectedRoute>
          }
        />
        <Route
          path="/call/:userId"
          element={
            <ProtectedRoute>
              <Call />
            </ProtectedRoute>
          }
        />
        <Route
          path="/friends"
          element={
            <ProtectedRoute>
              <AddFriends />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/chats" replace />} />
        <Route path="*" element={<Navigate to="/chats" replace />} />
      </Routes>

      {user && <MobileNav />}
    </>
  );
}