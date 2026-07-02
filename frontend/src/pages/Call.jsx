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
  const [showPlayButton, setShowPlayButton] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const endedRef = useRef(false);

  // ---- Helper: play remote stream ----
  const playRemoteStream = () => {
    const video = remoteVideoRef.current;
    if (!video || !remoteStreamRef.current) return;
    video.srcObject = remoteStreamRef.current;
    video.volume = 1.0;
    video.muted = false;
    video.load();
    video.play()
      .then(() => {
        console.log('✅ Remote video playing');
        setShowPlayButton(false);
      })
      .catch(err => {
        console.warn('⚠️ Play blocked:', err.name);
        setShowPlayButton(true);
      });
  };

  // ---- Main setup ----
  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType === 'video',
          audio: true,
        });
        if (cancelled) return;
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        // Add local tracks
        stream.getTracks().forEach(track => {
          console.log('➕ Adding track:', track.kind);
          pc.addTrack(track, stream);
        });

        // ---- Remote track handler ----
        pc.ontrack = (event) => {
          console.log('📡 Remote track received:', event.track.kind);
          setRemoteConnected(true);
          setCallStatus('Connected');

          const remoteStream = event.streams[0];
          if (!remoteStream) return;
          remoteStreamRef.current = remoteStream;

          // Enable all tracks
          remoteStream.getTracks().forEach(t => t.enabled = true);

          // Audio
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch(() => {});
          }

          // Video
          if (callType === 'video' && remoteVideoRef.current) {
            playRemoteStream();
          }
        };

        // ---- ICE candidates ----
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket?.emit('call_ice_candidate', {
              to: otherUserId,
              from: user.id,
              candidate: event.candidate,
            });
          }
        };

        // ---- ICE connection state ----
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

        // ---- Caller: create offer ----
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
          console.log('📤 Offer sent, waiting for answer...');
        } 
        // ---- Callee: handle incoming offer ----
        else if (incomingOffer) {
          console.log('📥 Received offer, setting remote description...');
          await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
          // Add any buffered candidates
          for (const cand of pendingCandidatesRef.current) {
            try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (e) {}
          }
          pendingCandidatesRef.current = [];

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket?.emit('call_answer', {
            to: otherUserId,
            from: user.id,
            answer: pc.localDescription,
          });
          console.log('📤 Answer sent to caller');
        }

      } catch (err) {
        console.error('❌ Setup error:', err);
        setCallStatus('Media error');
      }
    };

    setup();

    // ---- Socket listeners ----
    const onCallAnswer = ({ from, answer }) => {
      if (from !== otherUserId) return;
      console.log('📥 Received answer from', from);
      const pc = pcRef.current;
      if (!pc) return;
      pc.setRemoteDescription(new RTCSessionDescription(answer))
        .then(() => {
          console.log('✅ Remote description set (answer)');
          // Add any pending candidates
          for (const cand of pendingCandidatesRef.current) {
            pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          pendingCandidatesRef.current = [];
        })
        .catch(err => console.error('❌ setRemoteDescription error:', err));
    };

    const onIceCandidate = ({ from, candidate }) => {
      if (from !== otherUserId) return;
      const pc = pcRef.current;
      if (!pc) return;
      if (pc.remoteDescription && pc.remoteDescription.type) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    const onCallEnd = ({ from }) => {
      if (from !== otherUserId) return;
      endCall(false);
    };

    const onCallReject = ({ from }) => {
      if (from !== otherUserId) return;
      setCallStatus('Call declined');
      endCall(false);
    };

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
      cleanup();
    };
  }, []);

  // ---- Cleanup ----
  const cleanup = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    if (pcRef.current) pcRef.current.close();
    pcRef.current = null;
    remoteStreamRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  };

  const endCall = (notify = true) => {
    if (endedRef.current) return;
    endedRef.current = true;
    if (notify) socket?.emit('call_end', { to: otherUserId, from: user.id });
    cleanup();
    setTimeout(() => navigate(-1), 500);
  };

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;
    audioTracks.forEach(t => (t.enabled = muted));
    setMuted(!muted);
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) return;
    videoTracks.forEach(t => (t.enabled = videoOff));
    setVideoOff(!videoOff);
  };

  // ---- Render ----
  return (
    <div className="flex flex-col h-screen bg-black relative">
      <div className="flex-1 flex items-center justify-center bg-[#0b141a] relative overflow-hidden">
        {callType === 'video' && remoteStreamRef.current ? (
          <div className="relative w-full h-full">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              onPlay={() => setShowPlayButton(false)}
              onPause={() => { if (remoteStreamRef.current) setShowPlayButton(true); }}
            />
            {showPlayButton && (
              <button
                onClick={playRemoteStream}
                className="absolute inset-0 flex items-center justify-center bg-black/60 text-white z-10"
              >
                <div className="flex flex-col items-center gap-2">
                  <Play size={48} />
                  <span className="text-sm">Tap to play video</span>
                </div>
              </button>
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

      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
    </div>
  );
}