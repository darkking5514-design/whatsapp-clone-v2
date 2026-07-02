import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Check, CheckCheck, Paperclip, Phone, Send, Video, 
  MoreVertical, Reply, Forward, Trash2, Download, X, Mic, Square, Play, Pause
} from 'lucide-react';
import api, { SOCKET_URL } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Sidebar from '../components/Sidebar';

let typingTimeout = null;

export default function ChatWindow() {
  const { userId: otherUserId } = useParams();
  const { user } = useAuth();
  const { socket, connected, onlineUsers } = useSocket();
  const navigate = useNavigate();

  const [otherUser, setOtherUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [showMessageMenu, setShowMessageMenu] = useState(null);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioURL, setAudioURL] = useState('');
  const [audioPlaying, setAudioPlaying] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioRefs = useRef({});

  // ---- Load other user ----
  useEffect(() => {
    async function loadUser() {
      try {
        const res = await api.get('/users');
        setUsers(res.data);
        const found = res.data.find((u) => u._id === otherUserId);
        setOtherUser(found || null);
      } catch (err) {
        console.error('Failed to load user:', err);
      }
    }
    if (otherUserId) loadUser();
  }, [otherUserId]);

  // ---- Load chat history ----
  useEffect(() => {
    async function loadHistory() {
      try {
        if (!user?.id || !otherUserId || otherUserId === 'undefined') return;
        const res = await api.get(`/messages/${user.id}/${otherUserId}`);
        setMessages(res.data);
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    }
    if (user && otherUserId) loadHistory();
  }, [otherUserId, user]);

  // ---- Mark messages as read ----
  useEffect(() => {
    if (socket && connected && user && otherUserId) {
      socket.emit('mark_read', { senderId: otherUserId, receiverId: user.id });
    }
  }, [socket, connected, otherUserId, user]);

  // ---- Socket listeners ----
  useEffect(() => {
    if (!socket || !connected) return;

    const onReceiveMessage = (message) => {
      if (message.sender === otherUserId || message.receiver === otherUserId) {
        setMessages((prev) => [...prev, message]);
        if (message.sender === otherUserId) {
          socket.emit('mark_read', { senderId: otherUserId, receiverId: user.id });
        }
      }
    };
    const onTyping = ({ from }) => { if (from === otherUserId) setIsTyping(true); };
    const onStopTyping = ({ from }) => { if (from === otherUserId) setIsTyping(false); };
    const onMessagesRead = ({ by }) => {
      if (by === otherUserId) {
        setMessages((prev) =>
          prev.map((m) => (m.sender === user.id ? { ...m, status: 'read' } : m))
        );
      }
    };
    const onMessageDeleted = ({ messageId, deleteFor }) => {
      if (deleteFor === 'everyone') {
        setMessages((prev) =>
          prev.map((m) => (m._id === messageId ? { ...m, deleted: true } : m))
        );
      } else {
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
      }
    };

    socket.on('receive_message', onReceiveMessage);
    socket.on('typing', onTyping);
    socket.on('stop_typing', onStopTyping);
    socket.on('messages_read', onMessagesRead);
    socket.on('message_deleted', onMessageDeleted);

    return () => {
      socket.off('receive_message', onReceiveMessage);
      socket.off('typing', onTyping);
      socket.off('stop_typing', onStopTyping);
      socket.off('messages_read', onMessagesRead);
      socket.off('message_deleted', onMessageDeleted);
    };
  }, [socket, connected, otherUserId, user]);

  // ---- Scroll to bottom ----
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  // ---- Typing ----
  const handleTextChange = (e) => {
    setText(e.target.value);
    if (!socket || !connected) return;
    socket.emit('typing', { to: otherUserId, from: user.id });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit('stop_typing', { to: otherUserId, from: user.id });
    }, 1500);
  };

  // ---- Send message ----
  const sendMessage = (payload) => {
    if (!socket || !connected) {
      console.error('Socket not connected');
      return;
    }
    if (!user?.id || !otherUserId) return;

    const messageData = {
      senderId: user.id,
      receiverId: otherUserId,
      ...payload,
    };
    if (replyTo) messageData.replyTo = replyTo._id;

    socket.emit('send_message', messageData, (response) => {
      if (response?.success) {
        setMessages((prev) => [...prev, response.message]);
        setReplyTo(null);
      } else {
        console.error('Failed to send message:', response?.error);
      }
    });
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage({ content: text.trim(), messageType: 'text' });
    setText('');
    socket?.emit('stop_typing', { to: otherUserId, from: user.id });
  };

  // ---- File upload ----
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('media', file);
      const res = await api.post('/messages/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const messageType = file.type.startsWith('image') ? 'image' :
                          file.type.startsWith('video') ? 'video' :
                          file.type.startsWith('audio') ? 'audio' : 'file';
      sendMessage({ mediaUrl: res.data.mediaUrl, messageType, content: '' });
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // ---- Voice Recording ----
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioURL(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Could not access microphone:', err);
      alert('Please allow microphone access to record voice messages.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      clearInterval(recordingTimerRef.current);
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      clearInterval(recordingTimerRef.current);
      setIsRecording(false);
      setAudioBlob(null);
      setAudioURL('');
      audioChunksRef.current = [];
    }
  };

  const sendVoiceMessage = async () => {
    if (!audioBlob) return;
    setUploading(true);
    try {
      const audio = new Audio();
      audio.src = audioURL;
      await new Promise((resolve) => {
        audio.onloadedmetadata = () => resolve();
      });
      const duration = Math.round(audio.duration);

      const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('media', file);
      const res = await api.post('/messages/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      sendMessage({ mediaUrl: res.data.mediaUrl, messageType: 'audio', content: '', duration });
      setAudioBlob(null);
      setAudioURL('');
    } catch (err) {
      console.error('Voice upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const toggleAudioPlay = (messageId, url) => {
    if (audioPlaying === messageId) {
      const audio = audioRefs.current[messageId];
      if (audio) {
        audio.pause();
        setAudioPlaying(null);
      }
    } else {
      if (audioPlaying) {
        const prev = audioRefs.current[audioPlaying];
        if (prev) prev.pause();
      }
      const audio = audioRefs.current[messageId];
      if (audio) {
        audio.play().catch(() => {});
        setAudioPlaying(messageId);
      }
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ---- Reply / Forward / Delete / Download ----
  const handleReply = (message) => {
    setReplyTo(message);
    setShowMessageMenu(null);
    document.getElementById('messageInput')?.focus();
  };

  const handleForward = (message) => {
    setForwardMessage(message);
    setShowMessageMenu(null);
    setShowForwardModal(true);
  };

  const handleDelete = (message, deleteFor) => {
    if (!message) return;
    socket.emit('delete_message', {
      messageId: message._id,
      deleteFor,
      senderId: user.id,
      receiverId: otherUserId,
    });
    api.delete(`/messages/${message._id}?deleteFor=${deleteFor}`)
      .then(() => {
        if (deleteFor === 'everyone') {
          setMessages(prev => prev.map(m =>
            m._id === message._id ? { ...m, deleted: true } : m
          ));
        } else {
          setMessages(prev => prev.filter(m => m._id !== message._id));
        }
      })
      .catch(err => console.error('Delete error:', err));
    setShowMessageMenu(null);
  };

  const downloadMedia = (mediaUrl, messageType) => {
    const fullUrl = `${SOCKET_URL}${mediaUrl}`;
    const link = document.createElement('a');
    link.href = fullUrl;
    const ext = messageType === 'image' ? 'jpg' : messageType === 'video' ? 'mp4' : 'file';
    link.download = `download_${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const startCall = (callType) => {
    navigate(`/call/${otherUserId}`, {
      state: { isCaller: true, callType, calleeName: otherUser?.name },
    });
  };

  const isOnline = !!onlineUsers[otherUserId];

  const renderTicks = (status) => {
    if (status === 'read') return <CheckCheck size={16} className="text-blue-400" />;
    if (status === 'delivered') return <CheckCheck size={16} className="text-gray-400" />;
    return <Check size={16} className="text-gray-400" />;
  };

  return (
    <div className="flex h-screen bg-[#111b21] overflow-hidden">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <div className="flex flex-col h-full w-full bg-whatsapp-chatbg relative">
        {/* ===== HEADER - FIXED ===== */}
        <div className="sticky top-0 z-30 bg-[#202c33] px-2 py-2 md:px-4 md:py-3 flex items-center justify-between gap-2 min-h-[56px] border-b border-[#2f3b41] flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button onClick={() => navigate('/chats')} className="text-gray-300 md:hidden p-1">
              <ArrowLeft size={22} />
            </button>
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-whatsapp-teal flex items-center justify-center text-white font-semibold shrink-0 text-sm md:text-base">
              {otherUser?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white font-medium truncate text-sm md:text-base">
                {otherUser?.name || 'Loading...'}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {isTyping ? '✍️ typing...' : isOnline ? '🟢 Online' : '⚪ Offline'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-2 text-gray-300 shrink-0">
            <button onClick={() => startCall('audio')} className="p-2 hover:bg-[#2a3942] rounded-full">
              <Phone size={18} />
            </button>
            <button onClick={() => startCall('video')} className="p-2 hover:bg-[#2a3942] rounded-full">
              <Video size={18} />
            </button>
          </div>
        </div>

        {/* ===== REPLY PREVIEW ===== */}
        {replyTo && (
          <div className="bg-[#2a3942] px-3 py-2 flex items-center justify-between border-b border-[#3b4a54] flex-shrink-0">
            <div className="flex-1">
              <p className="text-xs text-whatsapp-green font-medium">
                Replying to {replyTo.sender === user.id ? 'yourself' : otherUser?.name}
              </p>
              <p className="text-sm text-gray-300 truncate max-w-[200px]">
                {replyTo.messageType === 'text' ? replyTo.content : '📎 Media'}
              </p>
            </div>
            <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-white p-1">
              <X size={18} />
            </button>
          </div>
        )}

        {/* ===== MESSAGES ===== */}
        <div className="flex-1 overflow-y-auto px-3 md:px-10 py-4 space-y-2">
          {messages.length === 0 && (
            <p className="text-gray-400 text-center mt-10 text-sm">No messages yet. Say hello! 👋</p>
          )}
          {messages.map((m) => {
            if (m.deleted) {
              return (
                <div key={m._id} className="flex justify-center">
                  <p className="text-gray-500 text-xs italic">This message was deleted</p>
                </div>
              );
            }
            const isSent = m.sender === user.id;
            const isReply = m.replyTo;
            const isForwarded = m.forwarded;
            const replyMessage = isReply ? messages.find(msg => msg._id === m.replyTo) : null;

            return (
              <div key={m._id} className={`flex ${isSent ? 'justify-end' : 'justify-start'} group`}>
                <div className="relative max-w-[75%]">
                  {isReply && replyMessage && !replyMessage.deleted && (
                    <div className="border-l-2 border-whatsapp-green pl-2 mb-1 text-xs text-gray-400">
                      <p className="font-medium text-whatsapp-green">
                        {replyMessage.sender === user.id ? 'You' : otherUser?.name}
                      </p>
                      <p className="truncate max-w-[200px]">
                        {replyMessage.messageType === 'text' ? replyMessage.content : '📎 Media'}
                      </p>
                    </div>
                  )}
                  {isForwarded && (
                    <p className="text-[10px] text-gray-400 italic mb-1">Forwarded</p>
                  )}

                  <div
                    className={`rounded-lg px-3 py-2 text-sm shadow ${
                      isSent ? 'bg-whatsapp-bubbleSent text-white' : 'bg-whatsapp-bubbleReceived text-white'
                    }`}
                  >
                    {/* Image, Video, File */}
                    {m.messageType === 'image' && m.mediaUrl && (
                      <div className="relative group/image">
                        <img
                          src={`${SOCKET_URL}${m.mediaUrl}`}
                          alt="shared"
                          className="rounded-md mb-1 max-h-64 object-cover"
                        />
                        <button
                          onClick={() => downloadMedia(m.mediaUrl, 'image')}
                          className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full hover:bg-black/70 opacity-0 group-hover/image:opacity-100 transition-opacity"
                          title="Download Image"
                        >
                          <Download size={16} className="text-white" />
                        </button>
                      </div>
                    )}
                    {m.messageType === 'video' && m.mediaUrl && (
                      <div className="relative group/video">
                        <video src={`${SOCKET_URL}${m.mediaUrl}`} controls className="rounded-md mb-1 max-h-64" />
                        <button
                          onClick={() => downloadMedia(m.mediaUrl, 'video')}
                          className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full hover:bg-black/70 opacity-0 group-hover/video:opacity-100 transition-opacity"
                          title="Download Video"
                        >
                          <Download size={16} className="text-white" />
                        </button>
                      </div>
                    )}
                    {m.messageType === 'file' && m.mediaUrl && (
                      <a
                        href={`${SOCKET_URL}${m.mediaUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline block mb-1"
                      >
                        📄 Download file
                      </a>
                    )}

                    {/* ===== VOICE MESSAGE ===== */}
                    {m.messageType === 'audio' && m.mediaUrl && (
                      <div className="flex items-center gap-3 min-w-[160px]">
                        <button
                          onClick={() => toggleAudioPlay(m._id, `${SOCKET_URL}${m.mediaUrl}`)}
                          className="text-white hover:opacity-80"
                        >
                          {audioPlaying === m._id ? <Pause size={18} /> : <Play size={18} />}
                        </button>
                        <div className="flex-1 h-1 bg-gray-500 rounded-full">
                          <div
                            className="h-1 bg-whatsapp-green rounded-full transition-all duration-300"
                            style={{ width: '0%' }}
                            id={`progress-${m._id}`}
                          />
                        </div>
                        <span className="text-xs text-gray-300 whitespace-nowrap">
                          {formatDuration(m.duration)}
                        </span>
                        <audio
                          ref={(el) => { audioRefs.current[m._id] = el; }}
                          src={`${SOCKET_URL}${m.mediaUrl}`}
                          onTimeUpdate={(e) => {
                            const progress = e.target.currentTime / e.target.duration * 100;
                            const bar = document.getElementById(`progress-${m._id}`);
                            if (bar) bar.style.width = `${progress}%`;
                          }}
                          onEnded={() => setAudioPlaying(null)}
                          onError={(e) => console.error('Audio load error:', e)}
                          className="hidden"
                        />
                      </div>
                    )}

                    {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] text-gray-300">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isSent && renderTicks(m.status)}
                    </div>
                  </div>

                  {/* ===== MESSAGE MENU ===== */}
                  <button
                    onClick={() => setShowMessageMenu(showMessageMenu === m._id ? null : m._id)}
                    className="absolute -top-2 -right-2 p-1 bg-[#202c33] rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical size={16} className="text-gray-300" />
                  </button>
                  {showMessageMenu === m._id && (
                    <div className="absolute -top-8 right-6 bg-[#202c33] rounded-lg shadow-lg p-1 z-10 flex gap-1 border border-[#3b4a54]">
                      <button onClick={() => handleReply(m)} className="p-1.5 hover:bg-[#2a3942] rounded">
                        <Reply size={14} className="text-gray-300" />
                      </button>
                      <button onClick={() => handleForward(m)} className="p-1.5 hover:bg-[#2a3942] rounded">
                        <Forward size={14} className="text-gray-300" />
                      </button>
                      {isSent && (
                        <>
                          <button onClick={() => handleDelete(m, 'me')} className="p-1.5 hover:bg-[#2a3942] rounded">
                            <Trash2 size={14} className="text-gray-300" />
                          </button>
                          <button onClick={() => handleDelete(m, 'everyone')} className="p-1.5 hover:bg-red-500/20 rounded">
                            <Trash2 size={14} className="text-red-400" />
                          </button>
                        </>
                      )}
                      {!isSent && (
                        <button onClick={() => handleDelete(m, 'me')} className="p-1.5 hover:bg-[#2a3942] rounded">
                          <Trash2 size={14} className="text-gray-300" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* ===== INPUT AREA ===== */}
        <div className="bg-[#202c33] px-3 py-2 flex items-center gap-2 flex-shrink-0">
          {/* Attachment */}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
            accept="image/*,video/*,audio/*"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-gray-300 p-2 hover:text-white transition-colors"
            disabled={uploading}
          >
            <Paperclip size={20} />
          </button>

          {/* Voice Recording UI */}
          {!isRecording && !audioURL && (
            <button
              type="button"
              onClick={startRecording}
              className="text-gray-300 p-2 hover:text-white transition-colors"
              title="Voice message"
            >
              <Mic size={20} />
            </button>
          )}

          {isRecording && (
            <div className="flex items-center gap-2 bg-[#2a3942] rounded-full px-3 py-1 flex-1">
              <span className="text-red-400 animate-pulse text-sm">● Recording</span>
              <span className="text-white text-sm font-mono">{String(Math.floor(recordingTime / 60)).padStart(2, '0')}:{String(recordingTime % 60).padStart(2, '0')}</span>
              <button onClick={cancelRecording} className="text-red-400 hover:text-red-300 p-1">
                <X size={18} />
              </button>
              <button onClick={stopRecording} className="bg-whatsapp-green text-black rounded-full p-1">
                <Square size={16} fill="black" />
              </button>
            </div>
          )}

          {audioURL && !isRecording && (
            <div className="flex items-center gap-2 bg-[#2a3942] rounded-full px-3 py-1 flex-1">
              <button onClick={() => { const audio = document.getElementById('voice-preview'); if (audio.paused) audio.play(); else audio.pause(); }} className="text-white p-1">
                <Play size={18} />
              </button>
              <audio id="voice-preview" src={audioURL} className="hidden" />
              <span className="text-white text-sm">Voice message</span>
              <button onClick={cancelRecording} className="text-red-400 hover:text-red-300 p-1">
                <X size={18} />
              </button>
              <button onClick={sendVoiceMessage} className="bg-whatsapp-green text-black rounded-full p-1">
                <Send size={16} />
              </button>
            </div>
          )}

          {/* Text Input */}
          {!isRecording && !audioURL && (
            <input
              id="messageInput"
              value={text}
              onChange={handleTextChange}
              placeholder={uploading ? 'Uploading...' : 'Type a message'}
              className="flex-1 bg-[#2a3942] text-white rounded-full px-4 py-2 outline-none text-sm"
            />
          )}

          {/* Send Button */}
          {!isRecording && !audioURL && text.trim() && (
            <button
              type="submit"
              onClick={handleSend}
              className="bg-whatsapp-green text-black rounded-full p-2 hover:opacity-90 transition-opacity"
            >
              <Send size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Forward Modal */}
      {showForwardModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="bg-[#202c33] rounded-lg p-4 max-w-md w-full max-h-[80vh]">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-white font-medium">Forward to...</h2>
              <button onClick={() => { setShowForwardModal(false); setForwardMessage(null); }} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {users.filter(u => u._id !== user.id).map((u) => (
                <button
                  key={u._id}
                  onClick={() => {
                    setSelectedUsers(prev =>
                      prev.includes(u._id) ? prev.filter(id => id !== u._id) : [...prev, u._id]
                    );
                  }}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[#2a3942] transition-colors ${
                    selectedUsers.includes(u._id) ? 'bg-[#2a3942] border border-whatsapp-green' : ''
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-whatsapp-teal flex items-center justify-center text-white font-semibold text-sm">
                    {u.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <p className="text-white text-sm">{u.name || u.phoneNumber}</p>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                if (!forwardMessage || selectedUsers.length === 0) return;
                selectedUsers.forEach((userId) => {
                  socket.emit('send_message', {
                    senderId: user.id,
                    receiverId: userId,
                    content: forwardMessage.content || '',
                    mediaUrl: forwardMessage.mediaUrl || '',
                    messageType: forwardMessage.messageType || 'text',
                    forwarded: true,
                    originalSender: forwardMessage.sender,
                  });
                });
                api.post('/messages/forward', {
                  messageId: forwardMessage._id,
                  receiverIds: selectedUsers,
                }).catch(err => console.error('Forward error:', err));
                setShowForwardModal(false);
                setForwardMessage(null);
                setSelectedUsers([]);
              }}
              disabled={selectedUsers.length === 0}
              className="w-full mt-3 bg-whatsapp-green text-black font-medium rounded-md py-2 disabled:opacity-50"
            >
              Send ({selectedUsers.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}