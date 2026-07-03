import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import api from '../api/axios';

export default function CreateGroupModal({ onClose, onGroupCreated }) {
  const [groupName, setGroupName] = useState('');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (search.trim()) {
      api.get(`/friends/search?q=${search}`)
        .then(res => setUsers(res.data))
        .catch(err => console.error(err));
    } else {
      setUsers([]);
    }
  }, [search]);

  const toggleSelect = (user) => {
    if (selected.find(u => u._id === user._id)) {
      setSelected(selected.filter(u => u._id !== user._id));
    } else {
      setSelected([...selected, user]);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim() || selected.length === 0) return;
    setLoading(true);
    try {
      const res = await api.post('/groups', {
        name: groupName,
        members: selected.map(u => u._id),
      });
      onGroupCreated(res.data);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#202c33] rounded-lg p-4 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-white font-medium">New Group</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <input
          type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Group name"
          className="w-full bg-[#2a3942] text-white rounded-lg px-4 py-2 outline-none mb-4"
        />

        <div className="flex items-center gap-2 bg-[#2a3942] rounded-lg px-3 py-2 mb-2">
          <Search size={16} className="text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="bg-transparent outline-none text-sm text-white w-full"
          />
        </div>

        <div className="max-h-60 overflow-y-auto">
          {users.map(u => (
            <div
              key={u._id}
              onClick={() => toggleSelect(u)}
              className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${
                selected.find(s => s._id === u._id) ? 'bg-[#2a3942] border border-whatsapp-green' : ''
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-whatsapp-teal flex items-center justify-center text-white font-semibold text-xs">
                {u.name?.[0]?.toUpperCase() || '?'}
              </div>
              <p className="text-white text-sm">{u.name}</p>
            </div>
          ))}
        </div>

        <button
          onClick={createGroup}
          disabled={!groupName.trim() || selected.length === 0 || loading}
          className="w-full mt-3 bg-whatsapp-green text-black font-medium rounded-md py-2 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Group'}
        </button>
      </div>
    </div>
  );
}