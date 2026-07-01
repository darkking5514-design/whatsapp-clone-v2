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
  const [remoteStreamSet, setRemoteStreamSet] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const endedRef = useRef(false);
  const playCheckInterval = useRef(null);

  // Function to attempt playing remote video
  const attemptPlay = () => {
    if (!remoteVideoRef.current || !remoteStreamRef.current) {
      console.warn('⚠️ attemptPlay: no video element or stream');
      return false;
    }
    const video = remoteVideoRef.current;
    // Assign srcObject if not already assigned
    if (!video.srcObject) {
      video.srcObject = remoteStreamRef.current;
      video.volume = 1.0;
      video.muted = false;
      video.load();
    }
    video.play()
      .then(() => {
        console.log('✅ Remote video playing');
        setShowPlayButton(false);
        // Clear interval if playing
        if (playCheckInterval.current) {
          clearInterval(playCheckInterval.current);
          playCheckInterval.current = null;
        }
      })
      .catch(err => {
        console.warn('⚠️ Play failed:', err.name);
        if (err.name === 'NotAllowedError' || err.name === 'NotSupportedError') {
          setShowPlayButton(true);
          // Start checking if video is paused
          if (!playCheckInterval.current) {
            playCheckInterval.current = setInterval(() => {
              if (remoteVideoRef.current && !remoteVideoRef.current.paused) {
                // Video is playing now
                setShowPlayButton(false);
                clearInterval(playCheckInterval.current);
                playCheckInterval.current = null;
              }
            }, 500);
          }
        }
      });
    return true;
  };

  // Manual play on button click
  const handlePlayClick = () => {
    attemptPlay();
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

          const remoteStream = event.streams[0];
          if (!remoteStream) return;
          remoteStreamRef.current = remoteStream;
          setRemoteStreamSet(true);

          // Enable all tracks
          remoteStream.getTracks().forEach(track => {
            track.enabled = true;
            console.log('🔊 Track enabled:', track.kind);
          });

          // Assign to audio element
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.volume = 1.0;
            remoteAudioRef.current.muted = false;
            remoteAudioRef.current.play()
              .then(() => console.log('✅ Remote audio playing'))
              .catch(e => console.warn('⚠️ Audio autoplay blocked'));
          }

          // Handle video
          if (callType === 'video') {
            // Assign to video element
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
              remoteVideoRef.current.volume = 1.0;
              remoteVideoRef.current.muted = false;
              remoteVideoRef.current.load();
              // Attempt to play
              attemptPlay();
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

    // Cleanup interval on unmount
    return () => {
      if (playCheckInterval.current) {
        clearInterval(playCheckInterval.current);
        playCheckInterval.current = null;
      }
      cancelled = true;
      socket?.off('call_answer');
      socket?.off('call_ice_candidate');
      socket?.off('call_end');
      socket?.off('call_reject');
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
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    remoteStreamRef.current = null;
    setRemoteStreamSet(false);
    if (playCheckInterval.current) {
      clearInterval(playCheckInterval.current);
      playCheckInterval.current = null;
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
        {callType === 'video' && remoteStreamSet ? (
          <div className="relative w-full h-full">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              onPlay={() => {
                console.log('🎬 onPlay triggered');
                setShowPlayButton(false);
              }}
              onPause={() => {
                console.log('⏸️ onPause triggered');
                // If paused and stream is there, show button
                if (remoteStreamRef.current) {
                  setShowPlayButton(true);
                }
              }}
            />
            {showPlayButton && (
              <button
                onClick={handlePlayClick}
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

      {/* Hidden audio element for audio-only calls */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
    </div>
  );
}