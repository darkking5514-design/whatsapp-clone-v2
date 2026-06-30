import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { MessageCircle, Circle, Phone, LogOut, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const linkClass = ({ isActive }) =>
    `flex flex-col items-center justify-center gap-1 w-full py-4 text-xs transition-colors ${
      isActive ? 'text-whatsapp-green' : 'text-gray-400 hover:text-gray-200'
    }`;

  return (
    <>
      {/* ============================================
          DESKTOP SIDEBAR - Hidden on mobile
          ============================================ */}
      <div className="hidden md:flex md:flex-col items-center justify-between w-16 bg-[#202c33] h-screen border-r border-black/30 flex-shrink-0">
        {/* Profile Avatar */}
        <div className="flex flex-col items-center w-full">
          <div className="w-9 h-9 rounded-full bg-whatsapp-green flex items-center justify-center text-black font-bold mt-4 mb-6">
            {user?.name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || '?'}
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col w-full">
            <NavLink to="/chats" className={linkClass} end>
              <MessageCircle size={22} />
              <span className="hidden sm:block">Chats</span>
            </NavLink>

            <NavLink to="/status" className={linkClass}>
              <Circle size={22} />
              <span className="hidden sm:block">Status</span>
            </NavLink>

            <NavLink to="/calls" className={linkClass}>
              <Phone size={22} />
              <span className="hidden sm:block">Calls</span>
            </NavLink>

            <NavLink to="/friends" className={linkClass}>
              <UserPlus size={22} />
              <span className="hidden sm:block">Friends</span>
            </NavLink>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center gap-1 w-full py-4 text-xs text-gray-400 hover:text-red-400 transition-colors"
        >
          <LogOut size={22} />
          <span className="hidden sm:block">Logout</span>
        </button>
      </div>
    </>
  );
}