import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Mic, MicOff, Phone, Video, VideoOff, Play, Volume2, VolumeX } from 'lucide-react';
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

  // State
  const [callStatus, setCallStatus] = useState(isCaller ? 'Calling...' : 'Connecting...');
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(callType !== 'video');
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [iceState, setIceState] = useState('new');
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [remoteStreamReady, setRemoteStreamReady] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [timerActive, setTimerActive] = useState(false);

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const endedRef = useRef(false);
  const timerIntervalRef = useRef(null);

  // ---- Format time ----
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // ---- Toggle speaker ----
  const toggleSpeaker = () => {
    setSpeakerOn(!speakerOn);
    const audioEl = remoteAudioRef.current;
    if (audioEl) {
      audioEl.volume = speakerOn ? 0.5 : 1.0;
      // Attempt to use setSinkId if available
      if (audioEl.setSinkId) {
        const sinkId = speakerOn ? 'default' : 'speaker';
        // For simplicity, we just toggle volume as fallback
      }
    }
  };

  // ---- Play remote video ----
  const playRemoteVideo = () => {
    const video = remoteVideoRef.current;
    const stream = remoteStreamRef.current;
    if (!video || !stream) {
      console.warn('⚠️ No video element or stream to play');
      return false;
    }

    // Ensure srcObject is set
    if (video.srcObject !== stream) {
      video.srcObject = stream;
      video.volume = 1.0;
      video.muted = false;
      video.load();
    }

    return video.play()
      .then(() => {
        console.log('✅ Remote video playing');
        setShowPlayButton(false);
        return true;
      })
      .catch(err => {
        console.warn('⚠️ Play failed:', err.name);
        setShowPlayButton(true);
        return false;
      });
  };

  // ---- Manual play on button click ----
  const handlePlayClick = () => {
    playRemoteVideo();
  };

  // ---- useEffect to attach stream when ready ----
  useEffect(() => {
    if (remoteStreamReady && remoteStreamRef.current) {
      const video = remoteVideoRef.current;
      if (video) {
        // Assign and play
        playRemoteVideo();
      }
    }
  }, [remoteStreamReady]);

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

        stream.getTracks().forEach(track => {
          console.log('➕ Adding track:', track.kind);
          pc.addTrack(track, stream);
        });

        pc.ontrack = (event) => {
          console.log('📡 Remote track received:', event.track.kind);
          setRemoteConnected(true);
          setCallStatus('Connected');
          if (!timerActive) {
            setTimerActive(true);
            timerIntervalRef.current = setInterval(() => {
              setCallDuration(prev => prev + 1);
            }, 1000);
          }

          const remoteStream = event.streams[0];
          if (!remoteStream) return;
          remoteStreamRef.current = remoteStream;
          setRemoteStreamReady(true); // triggers useEffect to attach

          remoteStream.getTracks().forEach(t => t.enabled = true);

          // Audio
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch(() => {});
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
          await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
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
        }

      } catch (err) {
        console.error('❌ Setup error:', err);
        setCallStatus('Media error');
      }
    };

    setup();

    const onCallAnswer = ({ from, answer }) => {
      if (from !== otherUserId) return;
      const pc = pcRef.current;
      if (!pc) return;
      pc.setRemoteDescription(new RTCSessionDescription(answer))
        .then(() => {
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

  const cleanup = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    if (pcRef.current) pcRef.current.close();
    pcRef.current = null;
    remoteStreamRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    setRemoteStreamReady(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
      setTimerActive(false);
    }
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

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Main video area */}
      <div className="flex-1 relative bg-[#0b141a] overflow-hidden">
        {/* Remote video – always rendered, hidden if no stream */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover ${!remoteStreamReady ? 'hidden' : ''}`}
          onPlay={() => setShowPlayButton(false)}
          onPause={() => {
            if (remoteStreamRef.current) setShowPlayButton(true);
          }}
        />
        {/* Overlay for play button or fallback */}
        {!remoteStreamReady ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-28 h-28 rounded-full bg-whatsapp-teal flex items-center justify-center text-white text-4xl font-semibold">
              {(calleeName || 'U')[0].toUpperCase()}
            </div>
            <p className="text-white text-lg">{calleeName || 'User'}</p>
            <p className="text-gray-400 text-sm">{callStatus}</p>
            <p className="text-gray-500 text-xs">ICE: {iceState}</p>
            {timerActive && (
              <p className="text-white text-lg font-mono">{formatTime(callDuration)}</p>
            )}
          </div>
        ) : (
          showPlayButton && (
            <button
              onClick={handlePlayClick}
              className="absolute inset-0 flex items-center justify-center bg-black/60 text-white z-10"
            >
              <div className="flex flex-col items-center gap-2">
                <Play size={48} />
                <span className="text-sm">Tap to play video</span>
              </div>
            </button>
          )
        )}

        {/* Local video - picture-in-picture */}
        {callType === 'video' && (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-20 right-4 w-28 h-40 md:w-36 md:h-48 rounded-lg object-cover border-2 border-white/30 bg-black z-20"
          />
        )}

        {/* Status badge with timer */}
        {remoteConnected && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1 rounded-full text-white text-xs z-20 flex items-center gap-2">
            <span>{callStatus}</span>
            {timerActive && <span className="font-mono">• {formatTime(callDuration)}</span>}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-[#111b21] py-5 flex items-center justify-center gap-6 flex-shrink-0 safe-bottom">
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
          className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
        >
          <Phone size={22} className="rotate-[135deg]" />
        </button>

        <button
          onClick={toggleSpeaker}
          className={`p-4 rounded-full ${speakerOn ? 'bg-white text-black' : 'bg-[#2a3942] text-white'}`}
        >
          {speakerOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
        </button>
      </div>

      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
    </div>
  );
}