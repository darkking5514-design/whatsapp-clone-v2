import React, { useState } from 'react';
import { X, UserPlus, UserMinus, Crown, LogOut, Trash2, Edit2, Camera } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function GroupInfoModal({ group, onClose, onUpdate }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showAddMember, setShowAddMember] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(
    group.members.some(m => m.user._id === user.id && m.role === 'admin')
  );

  // ---- Profile pic upload ----
  const handleProfilePicUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('profilePic', file);
      // We'll use a generic upload endpoint or directly update group.
      // For simplicity, we'll update via PUT with a base64 or use a separate upload route.
      // Since we don't have a dedicated group pic upload, we can convert to base64 and send.
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          await api.put(`/groups/${group._id}`, { profilePic: event.target.result });
          onUpdate();
          setUploading(false);
        } catch (err) {
          console.error('Failed to update profile pic', err);
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setUploading(false);
    }
  };

  // ---- Add member ----
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    try {
      const res = await api.get(`/friends/search?q=${search}`);
      // Filter out existing members
      const existingIds = group.members.map(m => m.user._id);
      const filtered = res.data.filter(u => !existingIds.includes(u._id));
      setSearchResults(filtered);
    } catch (err) {
      console.error(err);
    }
  };

  const addMember = async (userId) => {
    try {
      await api.post(`/groups/${group._id}/members`, { userIds: [userId] });
      onUpdate();
      setSearchResults([]);
      setSearch('');
      setShowAddMember(false);
    } catch (err) {
      console.error(err);
      alert('Failed to add member');
    }
  };

  const removeMember = async (userId) => {
    if (!confirm('Remove this member?')) return;
    try {
      await api.delete(`/groups/${group._id}/members/${userId}`);
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('Failed to remove member');
    }
  };

  const promote = async (userId) => {
    try {
      await api.put(`/groups/${group._id}/members/${userId}/role`, { role: 'admin' });
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const demote = async (userId) => {
    try {
      await api.put(`/groups/${group._id}/members/${userId}/role`, { role: 'member' });
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeave = async () => {
    if (!confirm('Leave this group?')) return;
    try {
      await api.post(`/groups/${group._id}/leave`);
      onClose();
      navigate('/chats');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this group permanently?')) return;
    try {
      await api.delete(`/groups/${group._id}`);
      onClose();
      navigate('/chats');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#202c33] rounded-lg p-4 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-white font-medium">Group Info</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Group avatar with upload */}
        <div className="flex flex-col items-center mb-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-whatsapp-teal flex items-center justify-center text-white font-semibold text-3xl">
              {group.profilePic ? (
                <img src={group.profilePic} alt="group" className="w-full h-full rounded-full object-cover" />
              ) : (
                group.name?.[0]?.toUpperCase() || 'G'
              )}
            </div>
            {isAdmin && (
              <label
                htmlFor="group-pic-upload"
                className="absolute bottom-0 right-0 bg-whatsapp-green text-black p-1.5 rounded-full cursor-pointer hover:opacity-90"
                title="Change group photo"
              >
                <Camera size={16} />
                <input
                  id="group-pic-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleProfilePicUpload}
                  disabled={uploading}
                />
              </label>
            )}
          </div>
          <p className="text-white text-lg font-semibold mt-2">{group.name}</p>
          <p className="text-gray-400 text-sm">{group.members.length} members</p>
        </div>

        {/* Add member */}
        {isAdmin && (
          <div className="mb-3">
            <button
              onClick={() => setShowAddMember(!showAddMember)}
              className="w-full bg-[#2a3942] text-white rounded-md py-2 flex items-center justify-center gap-2 hover:bg-[#3b4a54]"
            >
              <UserPlus size={16} /> Add Member
            </button>
            {showAddMember && (
              <div className="mt-2">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search users..."
                    className="flex-1 bg-[#2a3942] text-white rounded-lg px-3 py-1 outline-none text-sm"
                  />
                  <button type="submit" className="bg-whatsapp-green text-black px-3 py-1 rounded-lg text-sm">
                    Search
                  </button>
                </form>
                <div className="mt-2 max-h-40 overflow-y-auto">
                  {searchResults.map(u => (
                    <div key={u._id} className="flex items-center justify-between py-1 border-b border-black/10">
                      <span className="text-white text-sm">{u.name}</span>
                      <button
                        onClick={() => addMember(u._id)}
                        className="text-whatsapp-green text-xs hover:underline"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Members list */}
        <div className="border-t border-[#3b4a54] pt-3">
          <p className="text-gray-400 text-xs mb-2">Members</p>
          {group.members.map(m => {
            const isCreator = m.user._id === group.createdBy;
            const isMe = m.user._id === user.id;
            return (
              <div key={m.user._id} className="flex items-center justify-between py-2 border-b border-black/10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-whatsapp-teal flex items-center justify-center text-white font-semibold text-xs">
                    {m.user.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <p className="text-white text-sm">{m.user.name}{isMe && ' (You)'}</p>
                  {m.role === 'admin' && <Crown size={14} className="text-yellow-500" />}
                </div>
                {isAdmin && !isMe && (
                  <div className="flex gap-2">
                    {m.role === 'admin' ? (
                      <button onClick={() => demote(m.user._id)} className="text-xs text-gray-400 hover:text-white">
                        Demote
                      </button>
                    ) : (
                      <button onClick={() => promote(m.user._id)} className="text-xs text-gray-400 hover:text-white">
                        Promote
                      </button>
                    )}
                    <button onClick={() => removeMember(m.user._id)} className="text-xs text-red-400 hover:text-red-300">
                      Remove
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="mt-4 space-y-2">
          <button
            onClick={handleLeave}
            className="w-full bg-red-600/20 text-red-400 rounded-md py-2 flex items-center justify-center gap-2 hover:bg-red-600/30"
          >
            <LogOut size={16} /> Leave Group
          </button>
          {isAdmin && (
            <button
              onClick={handleDelete}
              className="w-full bg-red-600/20 text-red-400 rounded-md py-2 flex items-center justify-center gap-2 hover:bg-red-600/30"
            >
              <Trash2 size={16} /> Delete Group
            </button>
          )}
        </div>
      </div>
    </div>
  );
}