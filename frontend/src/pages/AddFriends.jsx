import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, Check, X, UserMinus, MessageCircle } from 'lucide-react';
import api, { getFullUrl } from '../api/axios';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function AddFriends() {
  const { user } = useAuth();
  const { onlineUsers } = useSocket();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [searching, setSearching] = useState(false);

  const loadData = async () => {
    try {
      const [friendsRes, pendingRes] = await Promise.all([
        api.get('/friends'),
        api.get('/friends/pending'),
      ]);
      setFriends(friendsRes.data || []);
      setPendingRequests(pendingRes.data || []);
    } catch (err) {
      console.error('Load data error:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setMessage('Please enter a name or phone number');
      return;
    }

    setSearching(true);
    setMessage('');
    try {
      const res = await api.get(`/friends/search?q=${searchQuery}`);
      const filtered = res.data.filter(u => u._id !== user.id);
      setSearchResults(filtered);
      if (filtered.length === 0) {
        setMessage('No users found');
      }
    } catch (err) {
      console.error('Search error:', err);
      setMessage('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (friendId, username) => {
    setMessage('');
    try {
      await api.post('/friends/request', { friendId });
      setMessage(`✅ Friend request sent to ${username}!`);
      await loadData();
      setSearchResults(prev => prev.filter(u => u._id !== friendId));
    } catch (err) {
      setMessage(`❌ ${err.response?.data?.message || 'Request failed'}`);
    }
  };

  const acceptRequest = async (requestId, username) => {
    try {
      await api.put(`/friends/accept/${requestId}`);
      setMessage(`✅ ${username} is now your friend!`);
      await loadData();
    } catch (err) {
      setMessage('❌ Failed to accept request');
    }
  };

  const rejectRequest = async (requestId, username) => {
    try {
      await api.delete(`/friends/reject/${requestId}`);
      setMessage(`❌ Rejected request from ${username}`);
      await loadData();
    } catch (err) {
      setMessage('❌ Failed to reject request');
    }
  };

  const removeFriend = async (friendId, username) => {
    if (!confirm(`Remove ${username} from your friends?`)) return;
    try {
      await api.delete(`/friends/remove/${friendId}`);
      setMessage(`❌ ${username} removed from friends`);
      await loadData();
    } catch (err) {
      setMessage('❌ Failed to remove friend');
    }
  };

  const isFriend = (userId) => {
    return friends.some((f) => f._id === userId);
  };

  const hasPendingRequest = (userId) => {
    return pendingRequests.some(
      (p) => p.userId?._id === userId || p.userId === userId
    );
  };

  const isPendingFrom = (userId) => {
    return pendingRequests.some(
      (p) => p.friendId?._id === userId || p.friendId === userId
    );
  };

  const openChat = (friendId) => {
    navigate(`/chat/${friendId}`);
  };

  const getRequestStatus = (userId) => {
    if (isFriend(userId)) return 'friend';
    if (hasPendingRequest(userId)) return 'pending_sent';
    if (isPendingFrom(userId)) return 'pending_received';
    return 'none';
  };

  return (
    <div className="flex h-screen bg-[#111b21]">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-[#202c33] px-4 py-3">
          <h1 className="text-white text-lg font-semibold">👥 Add Friends</h1>
        </div>

        {message && (
          <div className={`px-4 py-2 text-sm ${
            message.includes('✅') ? 'bg-green-600/20 text-green-400' :
            message.includes('❌') ? 'bg-red-600/20 text-red-400' :
            'bg-[#2a3942] text-white'
          }`}>
            {message}
          </div>
        )}

        <div className="px-4 py-3 bg-[#111b21] border-b border-black/20">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-[#202c33] rounded-lg px-3 py-2">
              <Search size={18} className="text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or phone number..."
                className="bg-transparent outline-none text-sm text-white w-full placeholder-gray-500"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="bg-whatsapp-green text-black font-medium px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        {searchResults.length > 0 && (
          <div className="px-4 py-2 bg-[#1f2a30] border-b border-black/20 overflow-y-auto max-h-60">
            <h2 className="text-xs text-gray-400 uppercase tracking-wider mb-2">Search Results</h2>
            {searchResults.map((u) => {
              const status = getRequestStatus(u._id);
              const isOnline = !!onlineUsers[u._id];

              return (
                <div key={u._id} className="flex items-center justify-between py-2 border-b border-black/10 last:border-0">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-whatsapp-teal flex items-center justify-center text-white font-semibold flex-shrink-0 overflow-hidden">
                      {u.profilePic ? (
                        <img
                          src={getFullUrl(u.profilePic)}
                          alt={u.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        u.name?.[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {u.name || u.username || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {u.phoneNumber || 'No phone'}
                        {isOnline && ' • 🟢 Online'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {status === 'friend' ? (
                      <span className="text-xs bg-green-600/30 text-green-400 px-3 py-1 rounded-full flex items-center gap-1">
                        <Check size={14} /> Friend
                      </span>
                    ) : status === 'pending_sent' ? (
                      <span className="text-xs bg-yellow-600/30 text-yellow-400 px-3 py-1 rounded-full">
                        Pending
                      </span>
                    ) : status === 'pending_received' ? (
                      <span className="text-xs bg-blue-600/30 text-blue-400 px-3 py-1 rounded-full">
                        Request Received
                      </span>
                    ) : (
                      <button
                        onClick={() => sendRequest(u._id, u.name || u.username)}
                        className="text-xs bg-whatsapp-green text-black px-3 py-1 rounded-full hover:opacity-90 flex items-center gap-1"
                      >
                        <UserPlus size={14} /> Add
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {pendingRequests.length > 0 && (
          <div className="px-4 py-2 bg-[#1f2a30] border-b border-black/20">
            <h2 className="text-xs text-gray-400 uppercase tracking-wider">
              📩 Pending Requests ({pendingRequests.length})
            </h2>
            {pendingRequests.map((req) => {
              const sender = req.userId;
              return (
                <div key={req._id} className="flex items-center justify-between py-2 border-b border-black/10 last:border-0">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-yellow-600 flex items-center justify-center text-white font-semibold flex-shrink-0 overflow-hidden">
                      {sender?.profilePic ? (
                        <img
                          src={getFullUrl(sender.profilePic)}
                          alt={sender?.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        sender?.name?.[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {sender?.name || sender?.username || 'Unknown'}
                      </p>
                      <p className="text-xs text-yellow-400">⏳ Pending request</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => acceptRequest(req._id, sender?.name || sender?.username)}
                      className="bg-whatsapp-green text-black p-1.5 rounded-full hover:opacity-90"
                      title="Accept"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => rejectRequest(req._id, sender?.name || sender?.username)}
                      className="bg-red-600 text-white p-1.5 rounded-full hover:opacity-90"
                      title="Reject"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-2">
          <h2 className="text-xs text-gray-400 uppercase tracking-wider mb-2">
            👫 My Friends ({friends.length})
          </h2>
          {friends.length === 0 && (
            <p className="text-gray-400 text-sm text-center mt-4">
              No friends yet. Search and add someone! 😊
            </p>
          )}
          {friends.map((f) => {
            const isOnline = !!onlineUsers[f._id];
            return (
              <div
                key={f._id}
                className="flex items-center justify-between py-2 border-b border-black/10 hover:bg-[#202c33] px-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-whatsapp-teal flex items-center justify-center text-white font-semibold flex-shrink-0 overflow-hidden">
                    {f.profilePic ? (
                      <img
                        src={getFullUrl(f.profilePic)}
                        alt={f.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      f.name?.[0]?.toUpperCase() || '?'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {f.name || f.username || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {f.phoneNumber || 'No phone'}
                      {isOnline && ' • 🟢 Online'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => openChat(f._id)}
                    className="text-xs bg-whatsapp-green text-black px-3 py-1 rounded-full hover:opacity-90 flex items-center gap-1"
                  >
                    <MessageCircle size={14} /> Chat
                  </button>
                  <button
                    onClick={() => removeFriend(f._id, f.name || f.username)}
                    className="text-xs bg-red-600/30 text-red-400 px-3 py-1 rounded-full hover:bg-red-600/50 flex items-center gap-1"
                  >
                    <UserMinus size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}