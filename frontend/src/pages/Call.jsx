import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Mic, MicOff, Phone, Video, VideoOff, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
};

export default function Call() {
  const { userId: otherUserId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  const { isCaller = true, callType = 'video', offer: incomingOffer, calleeName } =
    location.state || {};

  const [callStatus, setCallStatus] = useState(isCaller ? 'Calling...' : 'Connecting...');
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(callType !== 'video');
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [iceState, setIceState] = useState('new');
  const [remoteStream, setRemoteStream] = useState(null); // Store remote stream for manual play

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const endedRef = useRef(false);

  // Force play remote video when user taps on it
  const handleRemoteTap = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.play()
        .then(() => console.log('✅ Remote video started playing on user tap'))
        .catch(e => console.warn('⚠️ Play failed even on tap:', e));
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      try {
        console.log('📱 Requesting media devices...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType === 'video',
          audio: true,
        });
        if (cancelled) return;
        localStreamRef.current = stream;
        console.log('✅ Local stream obtained, tracks:', stream.getTracks().length);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(e => console.warn('Local play error:', e));
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        stream.getTracks().forEach((track) => {
          console.log('➕ Adding track:', track.kind);
          pc.addTrack(track, stream);
        });

        pc.ontrack = (event) => {
          console.log('📡 Remote track received:', event.track.kind);
          setRemoteConnected(true);
          setCallStatus('Connected');

          // Store remote stream
          if (event.streams && event.streams.length > 0) {
            const remote = event.streams[0];
            setRemoteStream(remote);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remote;
              // Try to play immediately; if fails, user tap will trigger it
              remoteVideoRef.current.play()
                .then(() => console.log('✅ Remote video autoplayed'))
                .catch(e => console.warn('⚠️ Autoplay blocked, tap to play'));
            }
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

        pc.oniceconnectionstatechange = () => {
          const state = pc.iceConnectionState;
          setIceState(state);
          console.log('🧊 ICE State:', state);
          if (state === 'connected' || state === 'completed') {
            setCallStatus('Connected');
          } else if (state === 'failed') {
            setCallStatus('Connection failed');
            endCall(false);
          }
        };

        if (isCaller) {
          console.log('📤 Creating offer...');
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket?.emit('call_offer', {
            to: otherUserId,
            from: user.id,
            offer: pc.localDescription,
            callType,
            callerName: user.name,
          });
        } else if (incomingOffer) {
          console.log('📥 Setting remote description from offer...');
          await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
          for (const candidate of pendingCandidatesRef.current) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {}
          }
          pendingCandidatesRef.current = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket?.emit('call_answer', {
            to: otherUserId,
            from: user.id,
            answer: pc.localDescription,
          });
        }

      } catch (err) {
        console.error('❌ Failed to start call:', err);
        setCallStatus('Could not access camera/microphone');
        alert('Please allow camera and microphone permissions.');
      }
    }

    setup();

    function onCallAnswer({ from, answer }) {
      if (from !== otherUserId || !pcRef.current) return;
      const pc = pcRef.current;
      pc.setRemoteDescription(new RTCSessionDescription(answer))
        .then(() => {
          for (const candidate of pendingCandidatesRef.current) {
            pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => console.warn('Error adding candidate', err));
          }
          pendingCandidatesRef.current = [];
        })
        .catch(err => console.error('Set remote description error:', err));
    }

    function onIceCandidate({ from, candidate }) {
      if (from !== otherUserId) return;
      const pc = pcRef.current;
      if (!pc) return;
      if (pc.remoteDescription && pc.remoteDescription.type) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => console.warn('Error adding candidate', err));
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
      cleanupMedia();
    };
  }, []);

  function cleanupMedia() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
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
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;
    audioTracks.forEach(t => (t.enabled = muted));
    setMuted(!muted);
  }

  function toggleVideo() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) return;
    videoTracks.forEach(t => (t.enabled = videoOff));
    setVideoOff(!videoOff);
  }

  useEffect(() => () => cleanupMedia(), []);

  return (
    <div className="flex flex-col h-screen bg-black relative">
      <div className="flex-1 flex items-center justify-center bg-[#0b141a] relative overflow-hidden">
        {callType === 'video' && remoteConnected ? (
          <div className="w-full h-full relative" onClick={handleRemoteTap}>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {/* Tap to play overlay if autoplay blocked */}
            {remoteStream && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-black/50 rounded-full p-4 pointer-events-auto">
                  <Play size={32} className="text-white" />
                  <span className="text-white text-xs block mt-1">Tap to play</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-28 h-28 rounded-full bg-whatsapp-teal flex items-center justify-center text-white text-4xl font-semibold">
              {(calleeName || 'U')[0].toUpperCase()}
            </div>
            <p className="text-white text-lg">{calleeName || 'User'}</p>
            <p className="text-gray-400 text-sm">{callStatus}</p>
            <p className="text-gray-500 text-xs">ICE: {iceState}</p>
          </div>
        )}

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

      <div className="bg-[#111b21] py-5 flex items-center justify-center gap-6">
        <button
          onClick={toggleMute}
          className={`p-4 rounded-full ${muted ? 'bg-white text-black' : 'bg-[#2a3942] text-white'}`}
        >
          {muted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        {callType === 'video' && (
          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full ${videoOff ? 'bg-white text-black' : 'bg-[#2a3942] text-white'}`}
          >
            {videoOff ? <VideoOff size={22} /> : <Video size={22} />}
          </button>
        )}

        <button
          onClick={() => endCall(true)}
          className="p-4 rounded-full bg-red-600 text-white"
        >
          <Phone size={22} className="rotate-[135deg]" />
        </button>
      </div>
    </div>
  );
}