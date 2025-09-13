import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TranslationService } from '@/components/translation';
import clsx from "clsx";
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  MonitorSpeaker, 
  Phone, 
  Settings,
  Users,
  MessageSquare,
  MoreVertical,
  Copy,
  UserPlus
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

const VideoCall = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isVideoOn, setIsVideoOn] = useState<boolean>(true);
  const [isAudioOn, setIsAudioOn] = useState<boolean>(true);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCallStarted, setIsCallStarted] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('connecting');
  interface UserProfile {
    id: string;
    name: string;
    email: string;
  }
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const pollingInterval = useRef<any>(null);
  const lastMessageId = useRef<any>(null);
  // Buffer for ICE candidates received before remote description is set
  const pendingIceCandidates = useRef<any[]>([]);

  const [iceConnectionState, setIceConnectionState] = useState<string>('new');

  // Enhanced WebRTC configuration with more STUN/TURN servers
  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      // Add more public STUN servers
      { urls: 'stun:stun.services.mozilla.com' },
      { urls: 'stun:stun.nextcloud.com:443' }
    ],
    iceCandidatePoolSize: 10, // Generate more ICE candidates
    iceTransportPolicy: 'all' as const
  };

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setCurrentUser({
          id: user.id,
          name: profile?.full_name || user.email?.split('@')[0] || 'User',
          email: user.email
        });
      }
    };
    getCurrentUser();
  }, []);

  // Initialize signaling with database polling
  useEffect(() => {
    if (!roomId || !currentUser) return;

    // Start polling for signaling messages
    pollingInterval.current = setInterval(() => {
      pollForSignalingMessages();
    }, 1000);

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [roomId, currentUser]);

  const pollForSignalingMessages = async (): Promise<void> => {
    try {
      let query = supabase
        .from('signaling_messages')
        .select('*')
        .eq('room_id', roomId)
        .neq('from_user_id', currentUser.id)
        .order('created_at', { ascending: true });

      if (lastMessageId.current) {
        query = query.gt('id', lastMessageId.current);
      }

      const { data: messages, error } = await query;
      
      if (error) {
        console.error('Error polling messages:', error);
        return;
      }

      if (messages && messages.length > 0) {
        for (const message of messages) {
          await handleSignalingMessage(message.payload, message.message_type);
          lastMessageId.current = message.id;
        }
      }
    } catch (error) {
      console.error('Error in polling:', error);
    }
  };

  // Fix: Handle remote stream properly
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      // Try to load and play the remote video reliably
      const video = remoteVideoRef.current;
      const tryPlay = () => {
        if (video.readyState >= 2) {
          video.play().catch(error => {
            console.error('Error playing remote video:', error);
            // Optionally, show a toast or UI message here
          });
        } else {
          video.load();
          setTimeout(tryPlay, 100);
        }
      };
      tryPlay();
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.muted = true; // prevent echo
      localVideoRef.current.play().catch(console.error);
    }
  }, [localStream]);

  const sendSignalingMessage = async (messageType: string, payload: any): Promise<void> => {
    try {
      const { error } = await supabase
        .from('signaling_messages')
        .insert([
          {
            room_id: roomId,
            from_user_id: currentUser.id,
            message_type: messageType,
            payload: payload
          }
        ]);

      if (error) {
        console.error('Error sending signaling message:', error);
      }
    } catch (error) {
      console.error('Error in sendSignalingMessage:', error);
    }
  };

  // Initialize media and WebRTC
  useEffect(() => {
    if (!currentUser) return;
    
    const initializeCall = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        setLocalStream(stream);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        await initializePeerConnection(stream);
        setIsCallStarted(true);

        // Wait a bit before announcing joining to ensure peer connection is ready
        setTimeout(async () => {
          await sendSignalingMessage('join', { 
            user: currentUser,
            timestamp: new Date().toISOString()
          });
        }, 1000);
        
      } catch (error) {
        console.error("Error accessing camera/microphone:", error);
        toast({
          title: "Camera/Microphone Error",
          description: "Could not access camera or microphone. Please check permissions.",
          variant: "destructive",
        });
      }
    };

    initializeCall();
    
    return () => {
      cleanup();
    };
  }, [currentUser]);

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
    // Clear pending ICE candidates
    pendingIceCandidates.current = [];
  };

  const initializePeerConnection = async (stream: MediaStream): Promise<void> => {
    // Close existing connection if any
    if (peerConnection.current) {
      peerConnection.current.close();
    }

    peerConnection.current = new RTCPeerConnection(rtcConfiguration);

    // Add local stream to peer connection
    stream.getTracks().forEach(track => {
      if (peerConnection.current) {
        console.log('Adding track:', track.kind);
        peerConnection.current.addTrack(track, stream);
      }
    });

    // Handle remote stream properly
    peerConnection.current.ontrack = (event) => {
      console.log('Remote track received:', event.track.kind);
      const [stream] = event.streams;
      if (stream) {
        console.log('Setting remote stream with tracks:', stream.getTracks().length);
        setRemoteStream(stream);
      }
    };

    // Handle ICE candidates with better error handling
    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate:', event.candidate.type, event.candidate.candidate);
        sendSignalingMessage('ice-candidate', {
          candidate: event.candidate
        });
      } else {
        console.log('ICE gathering complete');
      }
    };

    // Handle connection state changes with retry logic
    peerConnection.current.onconnectionstatechange = () => {
      const state = peerConnection.current?.connectionState;
      console.log('Connection state changed:', state);
      setConnectionStatus(state || 'unknown');
      
      if (state === 'connected') {
        toast({
          title: "Connected!",
          description: "You are now connected to the call.",
        });
      } else if (state === 'failed') {
        console.log('Connection failed, attempting restart...');
        handleConnectionFailure();
      }
    };

    // Enhanced ICE connection state handling
    peerConnection.current.oniceconnectionstatechange = () => {
      const state = peerConnection.current?.iceConnectionState;
      console.log('ICE connection state:', state);
      if (state) {
        setIceConnectionState(state);
        
        if (state === 'failed') {
          console.log('ICE connection failed, restarting ICE...');
          // Restart ICE
          peerConnection.current?.restartIce();
        } else if (state === 'disconnected') {
          console.log('ICE disconnected, waiting for reconnection...');
          // Wait a bit before restarting ICE
          setTimeout(() => {
            if (peerConnection.current?.iceConnectionState === 'disconnected') {
              console.log('Still disconnected, restarting ICE...');
              peerConnection.current?.restartIce();
            }
          }, 5000);
        }
      }
    };

    // Add ICE gathering state change handler
    peerConnection.current.onicegatheringstatechange = () => {
      console.log('ICE gathering state:', peerConnection.current?.iceGatheringState);
    };
  };

  const handleConnectionFailure = async () => {
    console.log('Handling connection failure...');
    
    // Clear existing connection
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    
    // Wait a bit then reinitialize
    setTimeout(async () => {
      if (localStream) {
        await initializePeerConnection(localStream);
        // Restart the connection process
        const shouldInitiate = currentUser && currentUser.id < (remoteStream ? 'other' : 'zzz');
        if (shouldInitiate) {
          setTimeout(() => {
            createOffer();
          }, 1000);
        }
      }
    }, 2000);
  };

  const handleSignalingMessage = async (payload: any, messageType: string): Promise<void> => {
    console.log('Handling signaling message:', messageType, payload);
    
    try {
      // Ensure peer connection is initialized before handling signaling
      if (!peerConnection.current && localStream) {
        await initializePeerConnection(localStream);
        // Wait a bit for the connection to be ready
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (!peerConnection.current) {
        console.error('Peer connection not available');
        return;
      }

      switch (messageType) {
        case 'offer':
          await handleOffer(payload.offer);
          break;
        case 'answer':
          await handleAnswer(payload.answer);
          break;
        case 'ice-candidate':
          await handleIceCandidate(payload.candidate);
          break;
        case 'join':
          // Use deterministic connection initiation
          console.log('Someone joined, current signaling state:', peerConnection.current?.signalingState);
          if (peerConnection.current && peerConnection.current.signalingState === 'stable') {
            const shouldInitiate = currentUser.id < payload.user?.id;
            console.log('Should initiate connection:', shouldInitiate, 'My ID:', currentUser.id, 'Their ID:', payload.user?.id);
            if (shouldInitiate) {
              // Add a longer delay to ensure both sides are ready
              setTimeout(() => {
                createOffer();
              }, 2000);
            }
          }
          break;
      }
    } catch (error) {
      console.error('Error handling signaling message:', error);
    }
  };

  const createOffer = async (): Promise<void> => {
    if (!peerConnection.current) {
      console.error('No peer connection available for creating offer');
      return;
    }

    if (peerConnection.current.signalingState !== 'stable') {
      console.log('Cannot create offer, signaling state is:', peerConnection.current.signalingState);
      return;
    }

    try {
      console.log('Creating offer...');
      const offer = await peerConnection.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      console.log('Setting local description...');
      await peerConnection.current.setLocalDescription(offer);
      console.log('Offer created and set as local description');
      
      await sendSignalingMessage('offer', { offer: offer });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit): Promise<void> => {
    if (!peerConnection.current) {
      console.error('No peer connection available for handling offer');
      return;
    }

    try {
      console.log('Handling offer...');
      
      if (peerConnection.current.signalingState !== 'stable') {
        console.log('Signaling state is not stable:', peerConnection.current.signalingState);
        // If we're in have-local-offer state, we might have a glare condition
        if (peerConnection.current.signalingState === 'have-local-offer') {
          // Handle glare: the peer with lower ID should rollback and accept the offer
          if (currentUser.id > offer.sdp?.substring(0, 10)) {
            console.log('Handling glare condition, rolling back...');
            await peerConnection.current.setLocalDescription({type: 'rollback'});
          } else {
            console.log('Ignoring offer due to glare condition');
            return;
          }
        }
      }
      
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('Remote description set');
      
      // Process any buffered ICE candidates
      if (pendingIceCandidates.current.length > 0) {
        console.log('Processing', pendingIceCandidates.current.length, 'buffered ICE candidates');
        for (const candidate of pendingIceCandidates.current) {
          try {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (error) {
            console.error('Error adding buffered ICE candidate:', error);
          }
        }
        pendingIceCandidates.current = [];
      }
      
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      console.log('Answer created and set as local description');
      
      await sendSignalingMessage('answer', { answer: answer });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit): Promise<void> => {
    if (!peerConnection.current) {
      console.error('No peer connection available for handling answer');
      return;
    }

    try {
      console.log('Handling answer...');
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('Answer set as remote description');
      
      // Process any buffered ICE candidates
      if (pendingIceCandidates.current.length > 0) {
        console.log('Processing', pendingIceCandidates.current.length, 'buffered ICE candidates');
        for (const candidate of pendingIceCandidates.current) {
          try {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (error) {
            console.error('Error adding buffered ICE candidate:', error);
          }
        }
        pendingIceCandidates.current = [];
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit): Promise<void> => {
    if (!peerConnection.current) {
      console.error('No peer connection available for ICE candidate');
      return;
    }

    try {
      if (peerConnection.current.remoteDescription && peerConnection.current.remoteDescription.type) {
        console.log('Adding ICE candidate immediately:', candidate.candidate?.substring(0, 50) + '...');
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        // Buffer ICE candidates until remote description is set
        console.log('Buffering ICE candidate:', candidate.candidate?.substring(0, 50) + '...');
        pendingIceCandidates.current.push(candidate);
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  };

  const toggleVideo = (): void => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoOn;
        setIsVideoOn(!isVideoOn);
      }
    }
  };

  const toggleAudio = (): void => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioOn;
        setIsAudioOn(!isAudioOn);
      }
    }
  };

  const startScreenShare = async (): Promise<void> => {
    try {
      if (isScreenSharing) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: true
        });
        await replaceTrack(stream);
        setIsScreenSharing(false);
      } else {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        await replaceTrack(screenStream);
        setIsScreenSharing(true);
        
        screenStream.getVideoTracks()[0].onended = async () => {
          setIsScreenSharing(false);
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          });
          await replaceTrack(stream);
        };
      }
    } catch (error) {
      console.error("Error with screen sharing:", error);
      toast({
        title: "Screen Share Error",
        description: "Could not start screen sharing. Please try again.",
        variant: "destructive",
      });
    }
  };

  const replaceTrack = async (newStream: MediaStream): Promise<void> => {
    if (!peerConnection.current) return;

    setLocalStream(newStream);
    
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = newStream;
    }

    // Replace video track
    const videoSender = peerConnection.current.getSenders().find(s => 
      s.track && s.track.kind === 'video'
    );
    if (videoSender && newStream.getVideoTracks()[0]) {
      await videoSender.replaceTrack(newStream.getVideoTracks()[0]);
    }

    // Replace audio track
    const audioSender = peerConnection.current.getSenders().find(s => 
      s.track && s.track.kind === 'audio'
    );
    if (audioSender && newStream.getAudioTracks()[0]) {
      await audioSender.replaceTrack(newStream.getAudioTracks()[0]);
    }
  };

  const endCall = async (): Promise<void> => {
    // Clean up signaling messages for this room
    try {
      await supabase
        .from('signaling_messages')
        .delete()
        .eq('room_id', roomId);
    } catch (error) {
      console.error('Error cleaning up signaling messages:', error);
    }

    cleanup();
    
    toast({
      title: "Call ended",
      description: "Thanks for using Zero Barriers!",
    });
    
    navigate("/dashboard");
  };

  const copyRoomId = (): void => {
    navigator.clipboard.writeText(roomId || "");
    toast({
      title: "Room ID copied",
      description: "Share this ID with others to invite them to the call.",
    });
  };

  if (!isCallStarted) {
    return (
      <div className="min-h-screen bg-video-bg flex items-center justify-center">
        <Card className="p-8 bg-video-surface border-video-control">
          <div className="text-center text-white">
            <Video className="h-12 w-12 mx-auto mb-4 text-primary animate-pulse" />
            <h2 className="text-xl font-semibold mb-2">Joining call...</h2>
            <p className="text-gray-400">Setting up your camera and microphone</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-video-bg text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-video-surface/50 backdrop-blur border-b border-video-control">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold">Room: {roomId}</h1>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={copyRoomId}
            className="text-gray-400 hover:text-white"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Room ID
          </Button>
          <span className={`text-xs px-2 py-1 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500/20 text-green-300' :
            connectionStatus === 'connecting' ? 'bg-yellow-500/20 text-yellow-300' :
            'bg-red-500/20 text-red-300'
          }`}>
            {connectionStatus}
          </span>
          <span className={`text-xs px-2 py-1 rounded-full ${
            iceConnectionState === 'connected' || iceConnectionState === 'completed' ? 'bg-green-500/20 text-green-300' :
            iceConnectionState === 'checking' || iceConnectionState === 'new' ? 'bg-yellow-500/20 text-yellow-300' :
            'bg-red-500/20 text-red-300'
          }`}>
            ICE: {iceConnectionState}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button 
            variant="ghost" 
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            <Users className="h-4 w-4 mr-2" />
            {remoteStream ? 2 : 1}
          </Button>
        </div>
      </header>

      {/* Main Video Area */}
      <main className="flex-1 relative p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
          {/* Local Video */}
          <div className="relative bg-video-surface rounded-lg overflow-hidden">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            
            {!isVideoOn && (
              <div className="absolute inset-0 bg-video-control flex items-center justify-center">
                <div className="text-center">
                  <VideoOff className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-400">Camera is off</p>
                </div>
              </div>
            )}
            
            <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full">
              <span className="text-sm">{currentUser?.name || 'You'} {isScreenSharing && "(sharing)"}</span>
            </div>
            
            <div className="absolute bottom-4 right-4 flex space-x-2">
              {!isAudioOn && (
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                  <MicOff className="h-4 w-4" />
                </div>
              )}
            </div>
          </div>

          {/* Remote Video or Placeholder */}
          <div className="relative bg-video-surface rounded-lg overflow-hidden">
            {remoteStream ? (
              <>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full">
                  <span className="text-sm">Remote User</span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-400">
                  <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-semibold mb-2">Waiting for others</h3>
                  <p>Share the room ID to invite participants</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={copyRoomId}
                    className="mt-4 border-gray-600 text-gray-400 hover:text-white hover:border-gray-400"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite Others
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <TranslationService
    localStream={localStream}
    remoteStream={remoteStream}
    className={clsx(
      "absolute bottom-24 left-1/2 transform -translate-x-1/2",
      "flex flex-col gap-2 items-center",
      "bg-black/30 backdrop-blur-sm rounded-lg p-3",
      "[&>*]:pointer-events-auto",
      "pointer-events-none"
    )}
  />

      {/* Controls */}
      <footer className="p-6 bg-video-surface/80 backdrop-blur border-t border-video-control">
        <div className="flex items-center justify-center space-x-4">
          <Button
            variant="ghost"
            size="lg"
            onClick={toggleAudio}
            className={`w-12 h-12 rounded-full ${
              isAudioOn 
                ? "bg-video-control hover:bg-video-control-hover text-white" 
                : "bg-red-500 hover:bg-red-600 text-white"
            }`}
          >
            {isAudioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>
          
          <Button
            variant="ghost"
            size="lg"
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-full ${
              isVideoOn 
                ? "bg-video-control hover:bg-video-control-hover text-white" 
                : "bg-red-500 hover:bg-red-600 text-white"
            }`}
          >
            {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
          
          <Button
            variant="ghost"
            size="lg"
            onClick={startScreenShare}
            className={`w-12 h-12 rounded-full ${
              isScreenSharing 
                ? "bg-blue-500 hover:bg-blue-600 text-white" 
                : "bg-video-control hover:bg-video-control-hover text-white"
            }`}
          >
            <MonitorSpeaker className="h-5 w-5" />
          </Button>
          
          <Button
            variant="destructive"
            size="lg"
            onClick={endCall}
            className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white ml-8"
          >
            <Phone className="h-5 w-5" />
          </Button>
          
        </div>
      </footer>
    </div>
  );
};

export default VideoCall;