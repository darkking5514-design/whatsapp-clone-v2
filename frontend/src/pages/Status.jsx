import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Download, Trash2, Eye, Reply, Camera, Type, Video, Send } from 'lucide-react';
import api, { SOCKET_URL, getFullUrl } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';

export default function Status() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [statusType, setStatusType] = useState('text');
  const [statusColor, setStatusColor] = useState('#075E54');
  const [statusFile, setStatusFile] = useState(null);
  const [statusPreview, setStatusPreview] = useState(null);
  const [showViewers, setShowViewers] = useState(false);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const colors = ['#075E54', '#128C7E', '#25D366', '#1A1A2E', '#16213E', '#0F3460', '#533483', '#E94560', '#F5A623'];

  async function loadStatuses() {
    try {
      const res = await api.get('/status');
      setStatuses(res.data);
    } catch (err) {
      console.error('Failed to load statuses', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatuses();
    const interval = setInterval(loadStatuses, 30000);
    return () => clearInterval(interval);
  }, []);

  const isMyStatus = (status) => {
    const uid = status.userId?._id || status.userId;
    return uid === user.id;
  };

  async function viewStatus(status) {
    setViewing(status);
    if (isMyStatus(status)) {
      return;
    }
    if (!status.isViewed) {
      try {
        await api.post(`/status/view/${status._id}`);
        setStatuses(prev =>
          prev.map(group => ({
            ...group,
            statuses: group.statuses.map(s =>
              s._id === status._id ? { ...s, isViewed: true, viewedBy: [...s.viewedBy, { _id: user.id }] } : s
            )
          }))
        );
      } catch (err) {
        console.error('Failed to mark status as viewed', err);
      }
    }
  }

  async function deleteStatus(statusId) {
    if (!confirm('Delete this status?')) return;
    try {
      await api.delete(`/status/${statusId}`);
      await loadStatuses();
      if (viewing?._id === statusId) setViewing(null);
    } catch (err) {
      console.error('Failed to delete status', err);
    }
  }

  function downloadStatus(mediaUrl, type) {
    const fullUrl = `${SOCKET_URL}${mediaUrl}`;
    const link = document.createElement('a');
    link.href = fullUrl;
    const ext = type === 'image' ? 'jpg' : 'mp4';
    link.download = `status_${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function replyToStatus(status) {
    const userId = status.userId?._id || status.userId;
    if (userId) {
      navigate(`/chat/${userId}`, {
        state: {
          replyToStatus: {
            text: status.text || '',
            mediaUrl: status.mediaUrl || '',
            type: status.type || 'text',
            username: status.userId?.name || 'Unknown',
            userId: userId,
          }
        }
      });
    }
  }

  function getViewers(status) {
    return status.viewedBy || [];
  }

  const createTextStatus = async (e) => {
    e.preventDefault();
    if (!statusText.trim()) return;
    setUploading(true);
    try {
      await api.post('/status/create', {
        text: statusText,
        type: 'text',
        backgroundColor: statusColor,
        textColor: '#FFFFFF',
      });
      await loadStatuses();
      setShowCreateModal(false);
      setStatusText('');
      setStatusColor('#075E54');
    } catch (err) {
      console.error('Failed to create status', err);
    } finally {
      setUploading(false);
    }
  };

  const uploadMediaStatus = async (e) => {
    e.preventDefault();
    if (!statusFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('media', statusFile);
      if (statusText.trim()) formData.append('text', statusText);
      const fileType = statusFile.type.startsWith('video') ? 'video' : 'image';
      formData.append('type', fileType);
      await api.post('/status/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await loadStatuses();
      setShowCreateModal(false);
      setStatusText('');
      setStatusFile(null);
      setStatusPreview(null);
    } catch (err) {
      console.error('Failed to upload status', err);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatusFile(file);
    const reader = new FileReader();
    reader.onload = () => setStatusPreview(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex h-screen bg-[#111b21]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <div className="bg-[#202c33] px-4 py-3 flex items-center justify-between">
          <h1 className="text-white text-lg font-semibold">Status</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-whatsapp-green text-black p-2 rounded-full hover:opacity-90 transition-opacity"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-black/20 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-whatsapp-teal flex items-center justify-center text-white font-semibold text-lg overflow-hidden">
            {user?.profilePic ? (
              <img
                src={getFullUrl(user.profilePic)}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              user?.name?.[0]?.toUpperCase() || '?'
            )}
          </div>
          <div>
            <p className="text-white font-medium">My Status</p>
            <p className="text-xs text-gray-400">Tap to add status update</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="text-gray-400 text-center mt-6">Loading statuses...</p>}
          {!loading && statuses.length === 0 && (
            <p className="text-gray-400 text-center mt-6">No active statuses. Statuses disappear after 24 hours.</p>
          )}
          {statuses.map((group) => {
            const userStatuses = group.statuses || [];
            const userInfo = group.user || {};
            return (
              <div key={userInfo._id || Math.random()} className="px-4 py-2 border-b border-black/10">
                <p className="text-xs text-gray-400 mb-2">
                  {userInfo.name || 'Unknown'}
                  {userInfo._id === user.id && ' (You)'}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {userStatuses.map((s) => (
                    <button
                      key={s._id}
                      onClick={() => viewStatus(s)}
                      className="relative flex-shrink-0 group"
                    >
                      <div className={`w-16 h-16 rounded-full overflow-hidden border-2 ${
                        s.isViewed ? 'border-gray-500' : 'border-whatsapp-green'
                      } hover:border-whatsapp-teal transition-colors`}>
                        {s.type === 'text' || s.type === 'image_text' || s.type === 'video_text' ? (
                          <div
                            className="w-full h-full flex items-center justify-center text-white text-xs font-bold p-1 text-center"
                            style={{ backgroundColor: s.backgroundColor || '#075E54' }}
                          >
                            {s.text ? s.text.substring(0, 2).toUpperCase() : '📝'}
                          </div>
                        ) : s.type === 'image' ? (
                          <img src={getFullUrl(s.mediaUrl)} alt="status" className="w-full h-full object-cover" />
                        ) : s.type === 'video' ? (
                          <video src={getFullUrl(s.mediaUrl)} className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      {isMyStatus(s) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteStatus(s._id); }}
                          className="absolute -top-1 -right-1 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {viewing && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center">
          <button
            onClick={() => { setViewing(null); setShowViewers(false); }}
            className="absolute top-4 right-4 text-white z-10"
          >
            <X size={28} />
          </button>

          <div className="max-w-lg w-full px-4 relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-whatsapp-teal flex items-center justify-center text-white font-semibold overflow-hidden">
                {viewing.userId?.profilePic ? (
                  <img
                    src={getFullUrl(viewing.userId.profilePic)}
                    alt={viewing.userId?.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  viewing.userId?.name?.[0]?.toUpperCase() || '?'
                )}
              </div>
              <div>
                <p className="text-white font-medium">{viewing.userId?.name || 'Unknown'}</p>
                <p className="text-xs text-gray-400">
                  {new Date(viewing.createdAt).toLocaleString()}
                  {isMyStatus(viewing) && ' (You)'}
                </p>
              </div>
            </div>

            <div
              className="rounded-lg min-h-[300px] flex items-center justify-center p-4 relative"
              style={{ backgroundColor: viewing.backgroundColor || '#075E54' }}
            >
              {viewing.type === 'text' && (
                <p className="text-white text-2xl text-center font-medium">{viewing.text}</p>
              )}
              {(viewing.type === 'image' || viewing.type === 'image_text') && viewing.mediaUrl && (
                <div className="relative w-full">
                  <img
                    src={getFullUrl(viewing.mediaUrl)}
                    alt="status"
                    className="w-full max-h-[500px] object-contain rounded-lg"
                  />
                  {viewing.text && (
                    <p className="absolute bottom-4 left-0 right-0 text-white text-lg text-center font-medium p-4 bg-black/30">
                      {viewing.text}
                    </p>
                  )}
                </div>
              )}
              {(viewing.type === 'video' || viewing.type === 'video_text') && viewing.mediaUrl && (
                <div className="relative w-full">
                  <video
                    src={getFullUrl(viewing.mediaUrl)}
                    controls
                    autoPlay
                    className="w-full max-h-[500px] object-contain rounded-lg"
                  />
                  {viewing.text && (
                    <p className="absolute bottom-4 left-0 right-0 text-white text-lg text-center font-medium p-4 bg-black/30">
                      {viewing.text}
                    </p>
                  )}
                </div>
              )}
            </div>

            {viewing.viewedBy && viewing.viewedBy.length > 0 && (
              <div className="text-center text-gray-400 text-sm mt-3">
                Viewed by {viewing.viewedBy.length} people
              </div>
            )}

            <div className="flex justify-center gap-4 mt-2">
              {viewing.mediaUrl && (
                <button
                  onClick={() => downloadStatus(viewing.mediaUrl, viewing.type)}
                  className="bg-white/20 hover:bg-white/30 text-white p-3 rounded-full transition-colors"
                  title="Download"
                >
                  <Download size={20} />
                </button>
              )}
              {!isMyStatus(viewing) && (
                <button
                  onClick={() => replyToStatus(viewing)}
                  className="bg-whatsapp-green hover:bg-whatsapp-teal text-black p-3 rounded-full transition-colors"
                  title="Reply"
                >
                  <Reply size={20} />
                </button>
              )}
              {isMyStatus(viewing) && (
                <button
                  onClick={() => setShowViewers(!showViewers)}
                  className="bg-white/20 hover:bg-white/30 text-white p-3 rounded-full transition-colors"
                  title="Viewers"
                >
                  <Eye size={20} />
                </button>
              )}
              {isMyStatus(viewing) && (
                <button
                  onClick={() => deleteStatus(viewing._id)}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 p-3 rounded-full transition-colors"
                  title="Delete"
                >
                  <Trash2 size={20} />
                </button>
              )}
            </div>

            {isMyStatus(viewing) && showViewers && (
              <div className="mt-4 bg-[#202c33] rounded-lg p-4 max-h-48 overflow-y-auto">
                <h3 className="text-white font-medium mb-2">Viewed by ({getViewers(viewing).length})</h3>
                {getViewers(viewing).length === 0 && (
                  <p className="text-gray-400 text-sm">No one has viewed this status yet.</p>
                )}
                {getViewers(viewing).map((viewer) => (
                  <div key={viewer._id} className="flex items-center gap-3 py-2 border-b border-black/10 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-whatsapp-teal flex items-center justify-center text-white font-semibold text-xs overflow-hidden">
                      {viewer.profilePic ? (
                        <img
                          src={getFullUrl(viewer.profilePic)}
                          alt={viewer.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        viewer.name?.[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    <p className="text-white text-sm">{viewer.name || viewer.phoneNumber}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#202c33] rounded-lg p-4 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-white font-medium">Add Status</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setStatusText('');
                  setStatusFile(null);
                  setStatusPreview(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setStatusType('text')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusType === 'text' ? 'bg-whatsapp-green text-black' : 'bg-[#2a3942] text-gray-400'
                }`}
              >
                <Type size={16} className="inline mr-1" /> Text
              </button>
              <button
                onClick={() => { setStatusType('image'); document.getElementById('fileInput')?.click(); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusType === 'image' ? 'bg-whatsapp-green text-black' : 'bg-[#2a3942] text-gray-400'
                }`}
              >
                <Camera size={16} className="inline mr-1" /> Photo
              </button>
              <button
                onClick={() => { setStatusType('video'); document.getElementById('videoInput')?.click(); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusType === 'video' ? 'bg-whatsapp-green text-black' : 'bg-[#2a3942] text-gray-400'
                }`}
              >
                <Video size={16} className="inline mr-1" /> Video
              </button>
            </div>

            <input
              id="fileInput"
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileSelect}
            />
            <input
              id="videoInput"
              type="file"
              ref={videoInputRef}
              className="hidden"
              accept="video/*"
              onChange={handleFileSelect}
            />

            <div className="flex gap-1 mb-3 flex-wrap">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setStatusColor(c)}
                  className={`w-8 h-8 rounded-full border-2 ${
                    statusColor === c ? 'border-white' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            {statusType === 'text' && (
              <div
                className="rounded-lg p-4 mb-3 min-h-[150px] flex items-center justify-center"
                style={{ backgroundColor: statusColor }}
              >
                <textarea
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  placeholder="What's on your mind?"
                  className="w-full bg-transparent text-white text-lg text-center outline-none resize-none"
                  rows={3}
                  style={{ color: '#FFFFFF' }}
                />
              </div>
            )}

            {(statusType === 'image' || statusType === 'video') && statusPreview && (
              <div className="relative rounded-lg overflow-hidden mb-3">
                {statusType === 'image' ? (
                  <img src={statusPreview} alt="preview" className="w-full max-h-[300px] object-contain" />
                ) : (
                  <video src={statusPreview} className="w-full max-h-[300px] object-contain" controls />
                )}
                <textarea
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  placeholder="Add caption..."
                  className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-sm p-2 outline-none resize-none"
                  rows={2}
                />
              </div>
            )}

            <button
              onClick={statusType === 'text' ? createTextStatus : uploadMediaStatus}
              disabled={uploading || (!statusText.trim() && !statusFile)}
              className="w-full bg-whatsapp-green text-black font-medium rounded-md py-2 hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
            >
              {uploading ? 'Posting...' : (
                <>
                  <Send size={18} /> Post Status
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}