import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Video } from 'lucide-react';
import api from '../api/axios';
import { useSocket } from '../context/SocketContext';
import Sidebar from '../components/Sidebar';

// This is a lightweight "Calls" tab for the test app. Since no call-history
// model was requested, it simply lets you start a fresh audio/video call
// with any user. Add a Call model + route later if you want persisted call logs.
export default function Calls() {
  const [users, setUsers] = useState([]);
  const { onlineUsers } = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await api.get('/users');
        setUsers(res.data);
      } catch (err) {
        console.error(err);
      }
    }
    fetchUsers();
  }, []);

  function call(userId, username, callType) {
    navigate(`/call/${userId}`, { state: { isCaller: true, callType, calleeName: username } });
  }

  return (
    <div className="flex h-screen bg-[#111b21]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <div className="bg-[#202c33] px-4 py-3">
          <h1 className="text-white text-lg font-semibold">Calls</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {users.length === 0 && (
            <p className="text-gray-400 text-center mt-6">No users to call yet.</p>
          )}
          {users.map((u) => (
            <div
              key={u._id}
              className="flex items-center justify-between px-4 py-3 border-b border-black/20"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-whatsapp-teal flex items-center justify-center text-white font-semibold">
                  {u.username[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{u.username}</p>
                  <p className="text-xs text-gray-400">
                    {onlineUsers[u._id] ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-gray-300">
                <button onClick={() => call(u._id, u.username, 'audio')} title="Voice call">
                  <Phone size={20} />
                </button>
                <button onClick={() => call(u._id, u.username, 'video')} title="Video call">
                  <Video size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
