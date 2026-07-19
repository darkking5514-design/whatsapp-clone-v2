import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Camera, Edit3, Lock, LogOut, Trash2, Phone,
  Eye, EyeOff, Clock, Palette, Download, FileText, Type,
  Users, ChevronRight, Moon, Sun, Circle, CheckCircle
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('account');

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await api.get('/profile/me');
        setProfile(res.data);
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const tabs = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'profile', label: 'Profile', icon: Edit3 },
    { id: 'privacy', label: 'Privacy', icon: Lock },
    { id: 'chats', label: 'Chats', icon: FileText },
  ];

  if (loading) {
    return (
      <div className="flex h-screen bg-[#111b21]">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#111b21]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-[#202c33] px-4 py-3">
          <h1 className="text-white text-lg font-semibold">Settings</h1>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto bg-[#1f2a30] border-b border-black/20 px-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-whatsapp-green text-whatsapp-green'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'account' && <AccountSettings profile={profile} onLogout={logout} />}
          {activeTab === 'profile' && <ProfileSettings profile={profile} setProfile={setProfile} />}
          {activeTab === 'privacy' && <PrivacySettings profile={profile} setProfile={setProfile} />}
          {activeTab === 'chats' && <ChatSettings />}
        </div>
      </div>
    </div>
  );
}

// ============================================
// ACCOUNT SETTINGS
// ============================================
function AccountSettings({ profile, onLogout }) {
  const navigate = useNavigate();
  const [showChangePhone, setShowChangePhone] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showPasskey, setShowPasskey] = useState(false);
  const [passkey, setPasskey] = useState('');
  const [confirmPasskey, setConfirmPasskey] = useState('');

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete your account? This cannot be undone.')) return;
    try {
      await api.delete('/profile/delete');
      onLogout();
      navigate('/login');
    } catch (err) {
      alert('Failed to delete account');
    }
  };

  const handleChangePhone = async () => {
    try {
      await api.post('/profile/change-phone', { newPhoneNumber: newPhone, otp });
      alert('Phone number updated successfully!');
      setShowChangePhone(false);
      setNewPhone('');
      setOtp('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to change phone number');
    }
  };

  const handleSetPasskey = async () => {
    if (passkey.length < 4) {
      alert('Passkey must be at least 4 digits');
      return;
    }
    if (passkey !== confirmPasskey) {
      alert('Passkeys do not match');
      return;
    }
    try {
      await api.post('/profile/set-passkey', { passkey });
      alert('Passkey set successfully!');
      setShowPasskey(false);
      setPasskey('');
      setConfirmPasskey('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to set passkey');
    }
  };

  return (
    <div className="space-y-4">
      {/* Phone Number */}
      <div className="bg-[#202c33] rounded-lg p-4">
        <h2 className="text-white font-medium mb-3">Phone Number</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">{profile?.phoneNumber}</p>
            <p className="text-xs text-gray-400">Your current phone number</p>
          </div>
          <button
            onClick={() => setShowChangePhone(!showChangePhone)}
            className="text-whatsapp-green text-sm hover:underline"
          >
            Change
          </button>
        </div>
        {showChangePhone && (
          <div className="mt-3 space-y-2">
            <input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="New phone number +923001234567"
              className="w-full bg-[#2a3942] text-white rounded-lg px-3 py-2 outline-none text-sm"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="OTP"
                className="flex-1 bg-[#2a3942] text-white rounded-lg px-3 py-2 outline-none text-sm"
              />
              <button className="bg-whatsapp-green text-black px-3 py-2 rounded-lg text-sm font-medium">
                Send OTP
              </button>
            </div>
            <button
              onClick={handleChangePhone}
              className="w-full bg-whatsapp-green text-black rounded-lg py-2 text-sm font-medium hover:opacity-90"
            >
              Update Phone
            </button>
          </div>
        )}
      </div>

      {/* Security */}
      <div className="bg-[#202c33] rounded-lg p-4">
        <h2 className="text-white font-medium mb-3">Security</h2>
        <button
          onClick={() => setShowPasskey(!showPasskey)}
          className="w-full flex items-center justify-between py-2 border-b border-black/10"
        >
          <div className="flex items-center gap-3">
            <Lock size={18} className="text-gray-400" />
            <span className="text-white">Passkey</span>
          </div>
          <ChevronRight size={18} className="text-gray-400" />
        </button>
        {showPasskey && (
          <div className="mt-2 space-y-2">
            <input
              type="password"
              value={passkey}
              onChange={(e) => setPasskey(e.target.value)}
              placeholder="Enter 4+ digit passkey"
              className="w-full bg-[#2a3942] text-white rounded-lg px-3 py-2 outline-none text-sm"
            />
            <input
              type="password"
              value={confirmPasskey}
              onChange={(e) => setConfirmPasskey(e.target.value)}
              placeholder="Confirm passkey"
              className="w-full bg-[#2a3942] text-white rounded-lg px-3 py-2 outline-none text-sm"
            />
            <button
              onClick={handleSetPasskey}
              className="w-full bg-whatsapp-green text-black rounded-lg py-2 text-sm font-medium hover:opacity-90"
            >
              Set Passkey
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-[#202c33] rounded-lg p-4">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 py-2 text-red-400 hover:bg-[#2a3942] rounded px-2 transition-colors"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
        <button
          onClick={handleDelete}
          className="w-full flex items-center gap-3 py-2 text-red-400 hover:bg-[#2a3942] rounded px-2 transition-colors"
        >
          <Trash2 size={18} />
          <span>Delete Account</span>
        </button>
      </div>
    </div>
  );
}

// ============================================
// PROFILE SETTINGS
// ============================================
function ProfileSettings({ profile, setProfile }) {
  const [name, setName] = useState(profile?.name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [about, setAbout] = useState(profile?.about || '');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef(null);

  const handleUpdate = async () => {
    try {
      const res = await api.put('/profile/update', { name, username, about });
      setProfile(res.data.user);
      alert('Profile updated!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update');
    }
  };

  const handleDPUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('profilePic', file);
      const res = await api.post('/profile/upload-dp', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProfile(res.data.user);
    } catch (err) {
      alert('Failed to upload profile picture');
    } finally {
      setUploading(false);
    }
  };

  const removeDP = async () => {
    try {
      const res = await api.delete('/profile/remove-dp');
      setProfile(res.data.user);
    } catch (err) {
      alert('Failed to remove profile picture');
    }
  };

  return (
    <div className="space-y-4">
      {/* Profile Picture */}
      <div className="bg-[#202c33] rounded-lg p-4 flex flex-col items-center">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-whatsapp-teal flex items-center justify-center text-white font-semibold text-3xl overflow-hidden">
            {profile?.profilePic ? (
              <img src={profile.profilePic} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              profile?.name?.[0]?.toUpperCase() || '?'
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-0 right-0 bg-whatsapp-green text-black p-1.5 rounded-full hover:opacity-90"
            disabled={uploading}
          >
            <Camera size={16} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleDPUpload}
          />
        </div>
        {profile?.profilePic && (
          <button onClick={removeDP} className="text-red-400 text-sm mt-2 hover:underline">
            Remove Photo
          </button>
        )}
      </div>

      {/* Name */}
      <div className="bg-[#202c33] rounded-lg p-4">
        <label className="block text-xs text-gray-400 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-[#2a3942] text-white rounded-lg px-3 py-2 outline-none"
        />
      </div>

      {/* Username */}
      <div className="bg-[#202c33] rounded-lg p-4">
        <label className="block text-xs text-gray-400 mb-1">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="@username"
          className="w-full bg-[#2a3942] text-white rounded-lg px-3 py-2 outline-none"
        />
      </div>

      {/* About */}
      <div className="bg-[#202c33] rounded-lg p-4">
        <label className="block text-xs text-gray-400 mb-1">About</label>
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          rows={2}
          className="w-full bg-[#2a3942] text-white rounded-lg px-3 py-2 outline-none resize-none"
        />
      </div>

      <button
        onClick={handleUpdate}
        className="w-full bg-whatsapp-green text-black font-medium rounded-md py-2 hover:opacity-90"
      >
        Save Profile
      </button>
    </div>
  );
}

// ============================================
// PRIVACY SETTINGS
// ============================================
function PrivacySettings({ profile, setProfile }) {
  const [privacy, setPrivacy] = useState(profile?.privacy || {});

  const handleChange = async (key, value) => {
    const updated = { ...privacy, [key]: value };
    setPrivacy(updated);
    try {
      const res = await api.put('/profile/privacy', updated);
      setProfile(res.data.user);
    } catch (err) {
      alert('Failed to update privacy settings');
    }
  };

  const options = ['everyone', 'contacts', 'nobody'];

  return (
    <div className="space-y-4">
      <div className="bg-[#202c33] rounded-lg p-4">
        <h2 className="text-white font-medium mb-3">Who can see my</h2>

        <div className="space-y-3">
          <div>
            <p className="text-white text-sm">Last seen</p>
            <select
              value={privacy.lastSeen || 'everyone'}
              onChange={(e) => handleChange('lastSeen', e.target.value)}
              className="w-full bg-[#2a3942] text-white rounded-lg px-3 py-2 outline-none mt-1"
            >
              {options.map(opt => (
                <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-white text-sm">Profile photo</p>
            <select
              value={privacy.profilePhoto || 'everyone'}
              onChange={(e) => handleChange('profilePhoto', e.target.value)}
              className="w-full bg-[#2a3942] text-white rounded-lg px-3 py-2 outline-none mt-1"
            >
              {options.map(opt => (
                <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-white text-sm">About</p>
            <select
              value={privacy.about || 'everyone'}
              onChange={(e) => handleChange('about', e.target.value)}
              className="w-full bg-[#2a3942] text-white rounded-lg px-3 py-2 outline-none mt-1"
            >
              {options.map(opt => (
                <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-white text-sm">Status</p>
            <select
              value={privacy.status || 'everyone'}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full bg-[#2a3942] text-white rounded-lg px-3 py-2 outline-none mt-1"
            >
              {options.map(opt => (
                <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Disappearing Messages */}
      <div className="bg-[#202c33] rounded-lg p-4">
        <h2 className="text-white font-medium mb-3">Disappearing Messages</h2>
        <div className="flex items-center justify-between">
          <span className="text-white text-sm">Enable</span>
          <button
            onClick={() => handleChange('disappearingMessages', {
              enabled: !privacy.disappearingMessages?.enabled,
              duration: 86400
            })}
            className={`px-3 py-1 rounded-full text-sm ${
              privacy.disappearingMessages?.enabled
                ? 'bg-whatsapp-green text-black'
                : 'bg-[#2a3942] text-gray-400'
            }`}
          >
            {privacy.disappearingMessages?.enabled ? 'ON' : 'OFF'}
          </button>
        </div>
        {privacy.disappearingMessages?.enabled && (
          <div className="mt-2">
            <p className="text-gray-400 text-xs">Duration</p>
            <select
              value={privacy.disappearingMessages?.duration || 86400}
              onChange={(e) => handleChange('disappearingMessages', {
                enabled: true,
                duration: parseInt(e.target.value)
              })}
              className="w-full bg-[#2a3942] text-white rounded-lg px-3 py-2 outline-none mt-1"
            >
              <option value={86400}>24 hours</option>
              <option value={604800}>7 days</option>
              <option value={2592000}>30 days</option>
              <option value={31536000}>1 year</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// CHAT SETTINGS
// ============================================
function ChatSettings() {
  const [fontSize, setFontSize] = useState(16);
  const [theme, setTheme] = useState('dark');

  return (
    <div className="space-y-4">
      <div className="bg-[#202c33] rounded-lg p-4">
        <h2 className="text-white font-medium mb-3">Appearance</h2>

        <div className="flex items-center justify-between py-2 border-b border-black/10">
          <span className="text-white">Theme</span>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-2 bg-[#2a3942] px-3 py-1 rounded-full"
          >
            {theme === 'dark' ? <Moon size={16} className="text-white" /> : <Sun size={16} className="text-yellow-400" />}
            <span className="text-white text-sm">{theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
          </button>
        </div>

        <div className="flex items-center justify-between py-2">
          <span className="text-white">Font Size</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFontSize(Math.max(12, fontSize - 2))}
              className="bg-[#2a3942] text-white px-2 py-1 rounded"
            >A-</button>
            <span className="text-white text-sm">{fontSize}px</span>
            <button
              onClick={() => setFontSize(Math.min(24, fontSize + 2))}
              className="bg-[#2a3942] text-white px-2 py-1 rounded"
            >A+</button>
          </div>
        </div>
      </div>

      <div className="bg-[#202c33] rounded-lg p-4">
        <h2 className="text-white font-medium mb-3">Chat Backup</h2>
        <button className="w-full flex items-center justify-between py-2 border-b border-black/10">
          <div className="flex items-center gap-3">
            <Download size={18} className="text-gray-400" />
            <span className="text-white">Backup now</span>
          </div>
          <span className="text-xs text-gray-400">Last: Never</span>
        </button>
        <button className="w-full flex items-center gap-3 py-2">
          <FileText size={18} className="text-gray-400" />
          <span className="text-white">Transfer chat</span>
        </button>
      </div>

      <div className="bg-[#202c33] rounded-lg p-4">
        <h2 className="text-white font-medium mb-3">Switch Account</h2>
        <button className="w-full flex items-center gap-3 py-2 text-whatsapp-green">
          <Users size={18} />
          <span>Add another account</span>
        </button>
      </div>
    </div>
  );
}