import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users } from 'lucide-react';
import api, { getFullUrl } from '../api/axios';
import { useSocket } from '../context/SocketContext';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import CreateGroupModal from '../components/CreateGroupModal';

export default function ChatList() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const { onlineUsers, socket, connected } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchUnified = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await api.get('/chat/unified');
      setItems(res.data);
    } catch (err) {
      console.error('Failed to fetch unified chat:', err);
      try {
        const fallbackRes = await api.get('/chat/partners');
        const converted = fallbackRes.data.map((u) => ({
          type: 'private',
          id: u._id,
          name: u.name || u.phoneNumber,
          profilePic: u.profilePic,
          onlineStatus: u.onlineStatus,
          lastMessage: null,
          unreadCount: 0,
        }));
        setItems(converted);
      } catch (fallbackErr) {
        console.error('Fallback also failed:', fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnified();
  }, [user]);

  useEffect(() => {
    if (!socket || !connected) return;
    const onNewMessage = () => setTimeout(fetchUnified, 500);
    socket.on('receive_message', onNewMessage);
    socket.on('receive_group_message', onNewMessage);
    return () => {
      socket.off('receive_message', onNewMessage);
      socket.off('receive_group_message', onNewMessage);
    };
  }, [socket, connected]);

  const openChat = (item) => {
    if (item.type === 'private') {
      navigate(`/chat/${item.id}`);
    } else {
      navigate(`/group/${item.id}`);
    }
  };

  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const getLastMsgPreview = (item) => {
    const msg = item.lastMessage;
    if (!msg) return 'No messages yet';
    if (msg.messageType === 'image') return '📷 Photo';
    if (msg.messageType === 'video') return '🎥 Video';
    if (msg.messageType === 'audio') return '🎵 Voice message';
    if (msg.messageType === 'file') return '📄 File';
    return msg.content || 'Media';
  };

  return (
    <div className="flex h-screen bg-[#111b21]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <div className="bg-[#202c33] px-4 py-3 flex justify-between items-center">
          <h1 className="text-white text-lg font-semibold">Chats</h1>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="bg-whatsapp-green text-black p-2 rounded-full hover:opacity-90 transition-opacity"
            title="New Group"
          >
            <Users size={20} />
          </button>
        </div>

        <div className="px-3 py-2 bg-[#111b21]">
          <div className="flex items-center gap-2 bg-[#202c33] rounded-lg px-3 py-2">
            <Search size={16} className="text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats..."
              className="bg-transparent outline-none text-sm text-white w-full placeholder-gray-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-24 md:pb-0">
          {loading && <p className="text-gray-400 text-center mt-6">Loading...</p>}
          {!loading && items.length === 0 && (
            <p className="text-gray-400 text-center mt-6">
              No chats yet. Start a new chat or group!
            </p>
          )}
          {filtered.map((item) => {
            const isOnline = item.type === 'private' && onlineUsers[item.id];
            const unread = item.unreadCount || 0;
            return (
              <button
                key={item.type + item.id}
                onClick={() => openChat(item)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#202c33] transition-colors text-left border-b border-black/20"
              >
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-whatsapp-teal flex items-center justify-center text-white font-semibold text-lg overflow-hidden">
                    {item.profilePic ? (
                      <img
                        src={getFullUrl(item.profilePic)}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      item.name?.[0]?.toUpperCase() || '?'
                    )}
                  </div>
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-whatsapp-green border-2 border-[#111b21] rounded-full" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="text-white font-medium truncate">{item.name}</p>
                    {item.lastMessage && (
                      <p className="text-xs text-gray-400 whitespace-nowrap ml-2">
                        {new Date(item.lastMessage.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{getLastMsgPreview(item)}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {item.type === 'group'
                      ? `👥 ${item.members?.length || 0} members`
                      : isOnline
                      ? '🟢 Online'
                      : '⚪ Offline'}
                  </p>
                </div>

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

      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onGroupCreated={fetchUnified}
        />
      )}
    </div>
  );
}