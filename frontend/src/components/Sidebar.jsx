import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { MessageCircle, Circle, Phone, LogOut } from 'lucide-react';
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
    <div className="flex md:flex-col items-center justify-between md:justify-start w-full md:w-16 bg-[#202c33] md:h-screen border-t md:border-t-0 md:border-r border-black/30 order-2 md:order-1">
      <div className="hidden md:flex w-9 h-9 rounded-full bg-whatsapp-green items-center justify-center text-black font-bold mt-4 mb-6">
        {user?.username?.[0]?.toUpperCase() || '?'}
      </div>

      <div className="flex md:flex-col w-full">
        <NavLink to="/chats" className={linkClass}>
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
      </div>

      <button
        onClick={handleLogout}
        className="flex flex-col items-center justify-center gap-1 w-full py-4 text-xs text-gray-400 hover:text-red-400 md:mt-auto md:mb-4 transition-colors"
      >
        <LogOut size={22} />
        <span className="hidden sm:block">Logout</span>
      </button>
    </div>
  );
}
