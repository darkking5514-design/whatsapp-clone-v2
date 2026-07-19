import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { getFullUrl } from '../api/axios';

export default function IncomingCallBanner() {
  const { incomingCall, clearIncomingCall, socket } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!incomingCall) return null;

  const { from, offer, callType, callerName } = incomingCall;

  function accept() {
    navigate(`/call/${from}`, {
      state: { isCaller: false, offer, callType, calleeName: callerName },
    });
    clearIncomingCall();
  }

  function reject() {
    socket?.emit('call_reject', { to: from, from: user?.id });
    clearIncomingCall();
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-[#202c33] border-b border-whatsapp-green px-4 py-3 shadow-lg">
      <div className="flex items-center gap-3 text-white">
        <div className="w-10 h-10 rounded-full bg-whatsapp-green flex items-center justify-center font-bold text-black overflow-hidden">
          {callerName?.profilePic ? (
            <img
              src={getFullUrl(callerName.profilePic)}
              alt="Caller"
              className="w-full h-full object-cover"
            />
          ) : (
            (callerName?.name || (typeof callerName === 'string' ? callerName : 'U'))[0]?.toUpperCase() || 'U'
          )}
        </div>
        <div>
          <p className="font-medium">{typeof callerName === 'string' ? callerName : callerName?.name || 'Someone'}</p>
          <p className="text-xs text-gray-400">
            Incoming {callType === 'video' ? 'video' : 'voice'} call...
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={accept}
          className="p-2 rounded-full bg-whatsapp-green text-black hover:opacity-90"
          title="Accept"
        >
          {callType === 'video' ? <Video size={20} /> : <Phone size={20} />}
        </button>
        <button
          onClick={reject}
          className="p-2 rounded-full bg-red-600 text-white hover:opacity-90"
          title="Decline"
        >
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
}