import React, { useState } from 'react';
import { X, UserPlus, UserMinus, Crown, LogOut, Trash2, Edit2 } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function GroupInfoModal({ group, onClose, onUpdate }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(group.members.some(m => m.user._id === user.id && m.role === 'admin'));

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

  const removeMember = async (userId) => {
    if (!confirm('Remove this member?')) return;
    try {
      await api.delete(`/groups/${group._id}/members/${userId}`);
      onUpdate();
      // refresh group data
    } catch (err) {
      console.error(err);
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

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#202c33] rounded-lg p-4 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-white font-medium">Group Info</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="text-center mb-4">
          <div className="w-16 h-16 rounded-full bg-whatsapp-teal flex items-center justify-center text-white font-semibold text-2xl mx-auto">
            {group.name?.[0]?.toUpperCase() || 'G'}
          </div>
          <p className="text-white text-lg font-semibold mt-2">{group.name}</p>
          <p className="text-gray-400 text-sm">{group.members.length} members</p>
        </div>

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
                      <button onClick={() => demote(m.user._id)} className="text-xs text-gray-400 hover:text-white">Demote</button>
                    ) : (
                      <button onClick={() => promote(m.user._id)} className="text-xs text-gray-400 hover:text-white">Promote</button>
                    )}
                    <button onClick={() => removeMember(m.user._id)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 space-y-2">
          {isAdmin && (
            <button
              onClick={() => {/* open edit group modal */}}
              className="w-full bg-[#2a3942] text-white rounded-md py-2 flex items-center justify-center gap-2 hover:bg-[#3b4a54]"
            >
              <Edit2 size={16} /> Edit Group
            </button>
          )}
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