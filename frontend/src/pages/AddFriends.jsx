import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, Check, X, UserMinus } from 'lucide-react';
import api from '../api/axios';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

export default function AddFriends() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Load friends and pending requests
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
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
  }

  // Search users
  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setMessage('');
    try {
      const res = await api.get(`/friends/search?q=${searchQuery}`);
      setSearchResults(res.data);
      if (res.data.length === 0) {
        setMessage('❌ No users found');
      }
    } catch (err) {
      console.error('Search error:', err);
      setMessage('❌ Search failed');
    } finally {
      setLoading(false);
    }
  }

  // Send friend request
  async function sendRequest(friendId, username) {
    setMessage('');
    try {
      await api.post('/friends/request', { friendId });
      setMessage(`✅ Friend request sent to ${username}!`);
      await loadData();
      setSearchResults([]);
      setSearchQuery('');
    } catch (err) {
      setMessage(`❌ ${err.response?.data?.message || 'Request failed'}`);
    }
  }

  // Accept friend request
  async function acceptRequest(requestId, username) {
    try {
      await api.put(`/friends/accept/${requestId}`);
      setMessage(`✅ ${username} is now your friend!`);
      await loadData();
    } catch (err) {
      setMessage('❌ Failed to accept request');
    }
  }

  // Reject friend request
  async function rejectRequest(requestId, username) {
    try {
      await api.delete(`/friends/reject/${requestId}`);
      setMessage(`❌ Rejected request from ${username}`);
      await loadData();
    } catch (err) {
      setMessage('❌ Failed to reject request');
    }
  }

  // Remove friend
  async function removeFriend(friendId, username) {
    if (!confirm(`Remove ${username} from your friends?`)) return;
    try {
      await api.delete(`/friends/remove/${friendId}`);
      setMessage(`❌ ${username} removed from friends`);
      await loadData();
    } catch (err) {
      setMessage('❌ Failed to remove friend');
    }
  }

  // Check if user is already friend
  function isFriend(userId) {
    return friends.some((f) => f._id === userId);
  }

  // Check if request already sent
  function hasPendingRequest(userId) {
    return pendingRequests.some(
      (p) => p.userId?._id === userId || p.userId === userId
    );
  }

  // Navigate to chat
  function openChat(friendId) {
    navigate(`/chat/${friendId}`);
  }

  return (
    <div className="flex h-screen bg-[#111b21]">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#202c33] px-4 py-3">
          <h1 className="text-white text-lg font-semibold">👥 Add Friends</h1>
        </div>

        {/* Message */}
        {message && (
          <div className="px-4 py-2 bg-[#2a3942] text-sm text-white">
            {message}
          </div>
        )}

        {/* Search Bar */}
        <div className="px-4 py-3 bg-[#111b21] border-b border-black/20">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-[#202c33] rounded-lg px-3 py-2">
              <Search size={18} className="text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by username..."
                className="bg-transparent outline-none text-sm text-white w-full placeholder-gray-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-whatsapp-green text-black font-medium px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              Search
            </button>
          </form>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="px-4 py-2 bg-[#1f2a30] border-b border-black/20">
            <h2 className="text-xs text-gray-400 uppercase tracking-wider">Search Results</h2>
            {searchResults.map((u) => (
              <div key={u._id} className="flex items-center justify-between py-2 border-b border-black/10 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-whatsapp-teal flex items-center justify-center text-white font-semibold">
                    {u.username[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{u.username}</p>
                    <p className="text-xs text-gray-400">
                      {u.onlineStatus ? '🟢 Online' : '⚪ Offline'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => sendRequest(u._id, u.username)}
                  disabled={isFriend(u._id) || hasPendingRequest(u._id)}
                  className={`text-xs px-3 py-1 rounded-full flex items-center gap-1 ${
                    isFriend(u._id)
                      ? 'bg-green-600/30 text-green-400 cursor-default'
                      : hasPendingRequest(u._id)
                      ? 'bg-yellow-600/30 text-yellow-400 cursor-default'
                      : 'bg-whatsapp-green text-black hover:opacity-90'
                  }`}
                >
                  {isFriend(u._id) ? (
                    <Check size={14} />
                  ) : hasPendingRequest(u._id) ? (
                    'Pending'
                  ) : (
                    <UserPlus size={14} />
                  )}
                  {isFriend(u._id) ? 'Friend' : hasPendingRequest(u._id) ? 'Pending' : 'Add'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pending Requests Section */}
        {pendingRequests.length > 0 && (
          <div className="px-4 py-2 bg-[#1f2a30] border-b border-black/20">
            <h2 className="text-xs text-gray-400 uppercase tracking-wider">
              📩 Pending Requests ({pendingRequests.length})
            </h2>
            {pendingRequests.map((req) => {
              const sender = req.userId;
              return (
                <div key={req._id} className="flex items-center justify-between py-2 border-b border-black/10 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-600 flex items-center justify-center text-white font-semibold">
                      {sender?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{sender?.username || 'Unknown'}</p>
                      <p className="text-xs text-yellow-400">⏳ Pending request</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptRequest(req._id, sender?.username)}
                      className="bg-whatsapp-green text-black p-1.5 rounded-full hover:opacity-90"
                      title="Accept"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => rejectRequest(req._id, sender?.username)}
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

        {/* Friends List */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <h2 className="text-xs text-gray-400 uppercase tracking-wider mb-2">
            👫 My Friends ({friends.length})
          </h2>
          {friends.length === 0 && (
            <p className="text-gray-400 text-sm text-center mt-4">
              No friends yet. Search and add someone! 😊
            </p>
          )}
          {friends.map((f) => (
            <div
              key={f._id}
              className="flex items-center justify-between py-2 border-b border-black/10 hover:bg-[#202c33] px-2 rounded-lg transition-colors cursor-pointer"
              onClick={() => openChat(f._id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-whatsapp-teal flex items-center justify-center text-white font-semibold">
                  {f.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{f.username || 'Unknown'}</p>
                  <p className="text-xs text-gray-400">
                    {f.onlineStatus ? '🟢 Online' : '⚪ Offline'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openChat(f._id);
                  }}
                  className="text-xs bg-whatsapp-green text-black px-3 py-1 rounded-full hover:opacity-90"
                >
                  💬 Chat
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFriend(f._id, f.username);
                  }}
                  className="text-xs bg-red-600/30 text-red-400 px-3 py-1 rounded-full hover:bg-red-600/50"
                >
                  <UserMinus size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}