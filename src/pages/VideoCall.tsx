import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCallStarted, setIsCallStarted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [currentUser, setCurrentUser] = useState(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const pollingInterval = useRef(null);
  const lastMessageId = useRef(null);

  const [iceConnectionState, setIceConnectionState] = useState<string>('new');

  // WebRTC configuration
  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
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

  const pollForSignalingMessages = async () => {
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
      // Force play the remote video
      remoteVideoRef.current.play().catch(error => {
        console.error('Error playing remote video:', error);
      });
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.muted = true; // prevent echo
      localVideoRef.current.play().catch(console.error);
    }
  }, [localStream]);

  const sendSignalingMessage = async (messageType, payload) => {
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
          video: true,
          audio: true
        });
        
        setLocalStream(stream);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        await initializePeerConnection(stream);
        setIsCallStarted(true);

        // Announce joining the room
        await sendSignalingMessage('join', { 
          user: currentUser,
          timestamp: new Date().toISOString()
        });
        
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
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnection.current) {
        peerConnection.current.close();
      }
    };
  }, [currentUser]);

  const initializePeerConnection = async (stream) => {
    peerConnection.current = new RTCPeerConnection(rtcConfiguration);

    // Add local stream to peer connection
    stream.getTracks().forEach(track => {
      peerConnection.current.addTrack(track, stream);
    });

    // Fix: Handle remote stream properly
    peerConnection.current.ontrack = (event) => {
      console.log('Remote track received:', event);
      const [remoteStream] = event.streams;
      setRemoteStream(remoteStream);
      
      // Force update the video element
      setTimeout(() => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch(error => {
            console.error('Error playing remote video:', error);
          });
        }
      }, 100);
    };

    // Handle ICE candidates
    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate:', event.candidate);
        sendSignalingMessage('ice-candidate', {
          candidate: event.candidate
        });
      }
    };

    // Handle connection state changes
    peerConnection.current.onconnectionstatechange = () => {
      console.log('Connection state changed:', peerConnection.current.connectionState);
      setConnectionStatus(peerConnection.current.connectionState);
      
      if (peerConnection.current.connectionState === 'connected') {
        toast({
          title: "Connected!",
          description: "You are now connected to the call.",
        });
      }
    };

    // Add ice connection state logging
    peerConnection.current.oniceconnectionstatechange = () => {
      const state = peerConnection.current?.iceConnectionState;
      console.log('ICE connection state:', state);
      if (state) {
        setIceConnectionState(state);
      }
    };
  };

  const handleSignalingMessage = async (payload, messageType) => {
    console.log('Handling signaling message:', messageType, payload);
    try {
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
          // Someone joined, create and send offer if we're in stable state
          console.log('Someone joined, current signaling state:', peerConnection.current?.signalingState);
          if (peerConnection.current && peerConnection.current.signalingState === 'stable') {
            // Small delay to ensure both peers are ready
            setTimeout(() => {
              createOffer();
            }, 1000);
          }
          break;
      }
    } catch (error) {
      console.error('Error handling signaling message:', error);
    }
  };

  const createOffer = async () => {
    if (!peerConnection.current) return;

    try {
      console.log('Creating offer...');
      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      console.log('Offer created and set as local description');
      
      await sendSignalingMessage('offer', { offer: offer });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  const handleOffer = async (offer) => {
    if (!peerConnection.current) return;

    try {
      console.log('Handling offer...');
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      console.log('Answer created and set as local description');
      
      await sendSignalingMessage('answer', { answer: answer });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (answer) => {
    if (!peerConnection.current) return;

    try {
      console.log('Handling answer...');
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('Answer set as remote description');
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleIceCandidate = async (candidate) => {
    if (!peerConnection.current) return;

    try {
      console.log('Adding ICE candidate:', candidate);
      await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoOn;
        setIsVideoOn(!isVideoOn);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioOn;
        setIsAudioOn(!isAudioOn);
      }
    }
  };

  const startScreenShare = async () => {
    try {
      if (isScreenSharing) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
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

  const replaceTrack = async (newStream) => {
    if (!peerConnection.current) return;

    setLocalStream(newStream);
    
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = newStream;
    }

    // Replace video track
    const videoSender = peerConnection.current.getSenders().find(s => 
      s.track && s.track.kind === 'video'
    );
    if (videoSender) {
      await videoSender.replaceTrack(newStream.getVideoTracks()[0]);
    }

    // Replace audio track
    const audioSender = peerConnection.current.getSenders().find(s => 
      s.track && s.track.kind === 'audio'
    );
    if (audioSender) {
      await audioSender.replaceTrack(newStream.getAudioTracks()[0]);
    }
  };

  const endCall = async () => {
    // Clean up signaling messages for this room
    await supabase
      .from('signaling_messages')
      .delete()
      .eq('room_id', roomId);

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    if (peerConnection.current) {
      peerConnection.current.close();
    }

    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
    
    toast({
      title: "Call ended",
      description: "Thanks for using Zero Barriers!",
    });
    
    navigate("/dashboard");
  };

  const copyRoomId = () => {
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