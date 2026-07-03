import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Video, PhoneOff, ArrowLeft } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Sidebar from '../components/Sidebar';

export default function Calls() {
  const { user } = useAuth();
  const { onlineUsers } = useSocket();
  const navigate = useNavigate();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCallHistory() {
      try {
        const res = await api.get('/calls/history');
        setCalls(res.data);
      } catch (err) {
        console.error('Failed to fetch call history:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCallHistory();
  }, []);

  // Format time
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 172800000) return 'Yesterday';
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getOtherUser = (call) => {
    return call.caller._id === user.id ? call.receiver : call.caller;
  };

  const getCallType = (call) => {
    if (call.caller._id === user.id) return 'outgoing';
    return call.status === 'missed' ? 'missed' : 'incoming';
  };

  const getIcon = (call) => {
    const type = call.type === 'video' ? <Video size={16} /> : <Phone size={16} />;
    if (call.caller._id === user.id) {
      return <span className="text-green-400">{type}</span>;
    }
    if (call.status === 'missed') {
      return <span className="text-red-400"><PhoneOff size={16} /></span>;
    }
    return <span className="text-blue-400">{type}</span>;
  };

  const getStatusText = (call) => {
    if (call.caller._id === user.id) {
      return call.status === 'answered' ? 'Outgoing' : 'Cancelled';
    }
    if (call.status === 'missed') return 'Missed';
    if (call.status === 'answered') return 'Incoming';
    return call.status;
  };

  const startCall = (userId, callType) => {
    // Navigate to call page
    const otherUser = getOtherUser(calls.find(c => c.caller._id === userId || c.receiver._id === userId));
    if (otherUser) {
      navigate(`/call/${otherUser._id}`, {
        state: { isCaller: true, callType, calleeName: otherUser.name },
      });
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-[#111b21]">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400">Loading call history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#111b21]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-[#202c33] px-4 py-3">
          <h1 className="text-white text-lg font-semibold">Calls</h1>
        </div>

        {/* Call List */}
        <div className="flex-1 overflow-y-auto">
          {calls.length === 0 ? (
            <p className="text-gray-400 text-center mt-6">No call history yet.</p>
          ) : (
            calls.map((call) => {
              const otherUser = getOtherUser(call);
              const callType = getCallType(call);
              const isOnline = !!onlineUsers[otherUser._id];

              return (
                <div
                  key={call._id}
                  className="flex items-center justify-between px-4 py-3 border-b border-black/20 hover:bg-[#202c33] transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-whatsapp-teal flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
                      {otherUser.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">
                        {otherUser.name || otherUser.phoneNumber}
                      </p>
                      <div className="flex items-center gap-1 text-xs">
                        {getIcon(call)}
                        <span className={`${callType === 'missed' ? 'text-red-400' : 'text-gray-400'}`}>
                          {getStatusText(call)}
                          {call.duration > 0 && ` · ${formatDuration(call.duration)}`}
                        </span>
                        <span className="text-gray-500 ml-1">·</span>
                        <span className="text-gray-500">{formatTime(call.timestamp)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Call back buttons */}
                  <div className="flex items-center gap-2 text-gray-300 flex-shrink-0 ml-2">
                    <button
                      onClick={() => startCall(otherUser._id, 'audio')}
                      className="p-2 hover:bg-[#2a3942] rounded-full transition-colors"
                      title="Voice call"
                    >
                      <Phone size={18} />
                    </button>
                    <button
                      onClick={() => startCall(otherUser._id, 'video')}
                      className="p-2 hover:bg-[#2a3942] rounded-full transition-colors"
                      title="Video call"
                    >
                      <Video size={18} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}