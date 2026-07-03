import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MessageCircle, Circle, Phone, UserPlus } from 'lucide-react';

export default function MobileNav() {
  const location = useLocation();
  
  const hideNav = location.pathname.includes('/chat/') || 
                  location.pathname.includes('/call/') ||
                  location.pathname.includes('/group/') ||
                  location.pathname === '/login';

  if (hideNav) return null;

  const linkClass = ({ isActive }) =>
    `flex flex-col items-center justify-center gap-0.5 py-1 px-2 text-[10px] font-medium transition-colors ${
      isActive ? 'text-whatsapp-green' : 'text-gray-400'
    }`;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#1f2a30] border-t border-[#2f3b41] z-50 flex justify-around items-center py-1.5 px-1 safe-bottom h-[60px]">
      <NavLink to="/chats" className={linkClass} end>
        <MessageCircle size={24} strokeWidth={1.5} />
        <span>Chats</span>
      </NavLink>
      <NavLink to="/status" className={linkClass}>
        <Circle size={24} strokeWidth={1.5} />
        <span>Status</span>
      </NavLink>
      <NavLink to="/calls" className={linkClass}>
        <Phone size={24} strokeWidth={1.5} />
        <span>Calls</span>
      </NavLink>
      <NavLink to="/friends" className={linkClass}>
        <UserPlus size={24} strokeWidth={1.5} />
        <span>Friends</span>
      </NavLink>
    </div>
  );
}