import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import api from '../api/axios';
import { useSocket } from '../context/SocketContext';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

export default function ChatList() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastMessages, setLastMessages] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const { onlineUsers, socket, connected } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();

  // ============================================
  // 1. FETCH USERS & LAST MESSAGES
  // ============================================
  useEffect(() => {
    async function fetchUsers() {
      if (!user) return;
      
      try {
        console.log('🔍 Fetching users...');
        const res = await api.get('/users');
        console.log('✅ Users loaded:', res.data);
        setUsers(res.data);

        // Fetch last message and unread count for each user
        const messages = {};
        const unread = {};
        
        for (const u of res.data) {
          try {
            const msgRes = await api.get(`/messages/${user.id}/${u._id}`);
            const msgs = msgRes.data || [];
            
            // Last message
            if (msgs.length > 0) {
              messages[u._id] = msgs[msgs.length - 1];
            }
            
            // Unread count (messages from other user that are not read)
            const unreadMsgs = msgs.filter(m => 
              m.sender === u._id && m.status !== 'read'
            );
            if (unreadMsgs.length > 0) {
              unread[u._id] = unreadMsgs.length;
            }
            
          } catch (err) {
            console.error(`❌ Failed to fetch messages for ${u._id}:`, err);
          }
        }
        
        setLastMessages(messages);
        setUnreadCounts(unread);
        
      } catch (err) {
        console.error('❌ Failed to fetch users:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, [user]);

  // ============================================
  // 2. SOCKET - REAL-TIME UNREAD UPDATES
  // ============================================
  useEffect(() => {
    if (!socket || !connected) return;

    // When a new message arrives
    function onReceiveMessage(message) {
      console.log('📩 New message received:', message);
      
      // Update last message
      setLastMessages(prev => ({
        ...prev,
        [message.sender]: message
      }));

      // If message is from someone else, increment unread count
      if (message.sender !== user?.id) {
        setUnreadCounts(prev => ({
          ...prev,
          [message.sender]: (prev[message.sender] || 0) + 1
        }));
      }
    }

    // When messages are marked as read
    function onMessagesRead({ by }) {
      console.log('📖 Messages read by:', by);
      // Clear unread count for this user
      setUnreadCounts(prev => ({
        ...prev,
        [by]: 0
      }));
    }

    socket.on('receive_message', onReceiveMessage);
    socket.on('messages_read', onMessagesRead);

    return () => {
      socket.off('receive_message', onReceiveMessage);
      socket.off('messages_read', onMessagesRead);
    };
  }, [socket, connected, user]);

  // ============================================
  // 3. CLEAR UNREAD WHEN CHAT IS OPENED
  // ============================================
  function openChat(userId) {
    // Clear unread count for this user
    setUnreadCounts(prev => ({
      ...prev,
      [userId]: 0
    }));
    
    // Navigate to chat
    navigate(`/chat/${userId}`);
  }

  // ============================================
  // 4. SORT USERS BY LAST MESSAGE TIME
  // ============================================
  const sortedUsers = [...users].sort((a, b) => {
    const msgA = lastMessages[a._id];
    const msgB = lastMessages[b._id];
    if (!msgA && !msgB) return 0;
    if (!msgA) return 1;
    if (!msgB) return -1;
    return new Date(msgB.timestamp) - new Date(msgA.timestamp);
  });

  // ============================================
  // 5. SEARCH FILTER
  // ============================================
  const filtered = sortedUsers.filter((u) => {
    const name = (u.name || u.username || '').toLowerCase();
    const phone = u.phoneNumber || '';
    const query = search.toLowerCase();
    return name.includes(query) || phone.includes(query);
  });

  // ============================================
  // 6. FORMAT UNREAD COUNT
  // ============================================
  function formatUnreadCount(count) {
    if (!count || count === 0) return null;
    if (count > 99) return '99+';
    return count;
  }

  return (
    <div className="flex h-screen bg-[#111b21]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-[#202c33] px-4 py-3">
          <h1 className="text-white text-lg font-semibold">Chats</h1>
        </div>

        {/* Search Bar */}
        <div className="px-3 py-2 bg-[#111b21]">
          <div className="flex items-center gap-2 bg-[#202c33] rounded-lg px-3 py-2">
            <Search size={16} className="text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone number..."
              className="bg-transparent outline-none text-sm text-white w-full placeholder-gray-500"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <p className="text-gray-400 text-center mt-6">Loading...</p>
          )}

          {!loading && users.length === 0 && (
            <p className="text-gray-400 text-center mt-6">
              No users registered yet. Create another account to chat!
            </p>
          )}

          {!loading && users.length > 0 && filtered.length === 0 && (
            <p className="text-gray-400 text-center mt-6">
              No user found matching "{search}"
            </p>
          )}

          {filtered.map((u) => {
            const isOnline = !!onlineUsers[u._id];
            const lastMsg = lastMessages[u._id];
            const unread = unreadCounts[u._id] || 0;
            
            // Message preview
            let lastMsgPreview = 'No messages yet';
            if (lastMsg) {
              if (lastMsg.messageType === 'image') lastMsgPreview = '📷 Photo';
              else if (lastMsg.messageType === 'video') lastMsgPreview = '🎥 Video';
              else if (lastMsg.messageType === 'audio') lastMsgPreview = '🎵 Voice message';
              else if (lastMsg.messageType === 'file') lastMsgPreview = '📄 File';
              else if (lastMsg.content) {
                lastMsgPreview = lastMsg.content.length > 35 
                  ? lastMsg.content.substring(0, 35) + '...' 
                  : lastMsg.content;
              }
            }

            // Check if last message is from current user
            const isSentByMe = lastMsg?.sender === user?.id;
            const msgPrefix = isSentByMe ? 'You: ' : '';

            return (
              <button
                key={u._id}
                onClick={() => openChat(u._id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#202c33] transition-colors text-left border-b border-black/20 relative"
              >
                {/* Profile Picture */}
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-whatsapp-teal flex items-center justify-center text-white font-semibold text-lg">
                    {(u.name || u.username || '?')[0].toUpperCase()}
                  </div>
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-whatsapp-green border-2 border-[#111b21] rounded-full"></span>
                  )}
                </div>

                {/* Chat Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="text-white font-medium truncate">
                      {u.name || u.username || 'Unknown'}
                    </p>
                    {lastMsg && (
                      <p className="text-xs text-gray-400 whitespace-nowrap ml-2">
                        {new Date(lastMsg.timestamp).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    {msgPrefix}{lastMsgPreview}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {isOnline ? '🟢 Online' : '⚪ Offline'}
                  </p>
                </div>

                {/* Unread Badge - Like WhatsApp! */}
                {unread > 0 && (
                  <div className="min-w-[20px] h-5 bg-whatsapp-green text-black text-xs font-bold rounded-full flex items-center justify-center px-1.5">
                    {unread > 99 ? '99+' : unread}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}