import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Mic, MicOff, Phone, Video, VideoOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const ICE_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export default function Call() {
  const { userId: otherUserId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  // isCaller / callType / offer come from navigation state (set either by
  // ChatWindow/Calls when starting a call, or by IncomingCallBanner when
  // accepting one).
  const { isCaller = true, callType = 'video', offer: incomingOffer, calleeName } =
    location.state || {};

  const [callStatus, setCallStatus] = useState(isCaller ? 'Calling...' : 'Connecting...');
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(callType !== 'video');
  const [remoteConnected, setRemoteConnected] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const endedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType === 'video',
          audio: true,
        });
        if (cancelled) return;
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          setRemoteConnected(true);
          setCallStatus('Connected');
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket?.emit('call_ice_candidate', {
              to: otherUserId,
              from: user.id,
              candidate: event.candidate,
            });
          }
        };

        pc.onconnectionstatechange = () => {
          if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
            if (!endedRef.current) endCall(false);
          }
        };

        if (isCaller) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket?.emit('call_offer', {
            to: otherUserId,
            from: user.id,
            offer,
            callType,
            callerName: user.username,
          });
        } else if (incomingOffer) {
          await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
          flushPendingCandidates();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket?.emit('call_answer', { to: otherUserId, from: user.id, answer });
        }
      } catch (err) {
        console.error('Failed to start call:', err);
        setCallStatus('Could not access camera/microphone');
      }
    }

    async function flushPendingCandidates() {
      const pc = pcRef.current;
      if (!pc) return;
      for (const candidate of pendingCandidatesRef.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Failed to add buffered ICE candidate', err);
        }
      }
      pendingCandidatesRef.current = [];
    }

    setup();

    function onCallAnswer({ from, answer }) {
      if (from !== otherUserId || !pcRef.current) return;
      pcRef.current.setRemoteDescription(new RTCSessionDescription(answer)).then(() => {
        flushPendingCandidates();
      });
    }

    async function onIceCandidate({ from, candidate }) {
      if (from !== otherUserId) return;
      const pc = pcRef.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Failed to add ICE candidate', err);
        }
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    }

    function onCallEnd({ from }) {
      if (from !== otherUserId) return;
      setCallStatus('Call ended');
      endCall(false);
    }

    function onCallReject({ from }) {
      if (from !== otherUserId) return;
      setCallStatus('Call declined');
      endCall(false);
    }

    socket?.on('call_answer', onCallAnswer);
    socket?.on('call_ice_candidate', onIceCandidate);
    socket?.on('call_end', onCallEnd);
    socket?.on('call_reject', onCallReject);

    return () => {
      cancelled = true;
      socket?.off('call_answer', onCallAnswer);
      socket?.off('call_ice_candidate', onIceCandidate);
      socket?.off('call_end', onCallEnd);
      socket?.off('call_reject', onCallReject);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanupMedia() {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
  }

  function endCall(notifyPeer = true) {
    if (endedRef.current) return;
    endedRef.current = true;
    if (notifyPeer) {
      socket?.emit('call_end', { to: otherUserId, from: user.id });
    }
    cleanupMedia();
    setTimeout(() => navigate(-1), notifyPeer ? 0 : 800);
  }

  function toggleMute() {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = muted));
    setMuted(!muted);
  }

  function toggleVideo() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) return; // audio-only call, nothing to toggle
    videoTracks.forEach((t) => (t.enabled = videoOff));
    setVideoOff(!videoOff);
  }

  useEffect(() => () => cleanupMedia(), []);

  return (
    <div className="flex flex-col h-screen bg-black relative">
      {/* Remote video / avatar */}
      <div className="flex-1 flex items-center justify-center bg-[#0b141a] relative overflow-hidden">
        {callType === 'video' && remoteConnected ? (
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-28 h-28 rounded-full bg-whatsapp-teal flex items-center justify-center text-white text-4xl font-semibold">
              {(calleeName || 'U')[0].toUpperCase()}
            </div>
            <p className="text-white text-lg">{calleeName || 'User'}</p>
            <p className="text-gray-400 text-sm">{callStatus}</p>
          </div>
        )}

        {/* Local video (picture in picture) */}
        {callType === 'video' && (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-4 right-4 w-28 h-40 md:w-36 md:h-48 rounded-lg object-cover border-2 border-white/30 bg-black"
          />
        )}

        {remoteConnected && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1 rounded-full text-white text-xs">
            {callStatus}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-[#111b21] py-5 flex items-center justify-center gap-6">
        <button
          onClick={toggleMute}
          className={`p-4 rounded-full ${muted ? 'bg-white text-black' : 'bg-[#2a3942] text-white'}`}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        {callType === 'video' && (
          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full ${videoOff ? 'bg-white text-black' : 'bg-[#2a3942] text-white'}`}
            title={videoOff ? 'Turn camera on' : 'Turn camera off'}
          >
            {videoOff ? <VideoOff size={22} /> : <Video size={22} />}
          </button>
        )}

        <button
          onClick={() => endCall(true)}
          className="p-4 rounded-full bg-red-600 text-white"
          title="End call"
        >
          <Phone size={22} className="rotate-[135deg]" />
        </button>
      </div>
    </div>
  );
}
