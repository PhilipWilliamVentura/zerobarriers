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

interface Participant {
  id: string;
  name: string;
  isVideoOn: boolean;
  isAudioOn: boolean;
  stream?: MediaStream;
}

const VideoCall = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isCallStarted, setIsCallStarted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<{ [key: string]: HTMLVideoElement }>({});

  // Initialize camera and microphone
  useEffect(() => {
    const initializeMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        setLocalStream(stream);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        // Simulate adding current user as participant
        const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
        setParticipants([{
          id: currentUser.id || "local",
          name: currentUser.name || "You",
          isVideoOn: true,
          isAudioOn: true,
          stream
        }]);
        
        setIsCallStarted(true);
        
      } catch (error) {
        console.error("Error accessing camera/microphone:", error);
        toast({
          title: "Camera/Microphone Error",
          description: "Could not access camera or microphone. Please check permissions.",
          variant: "destructive",
        });
      }
    };

    initializeMedia();
    
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [toast]);

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
        // Stop screen sharing and return to camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setIsScreenSharing(false);
      } else {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        setLocalStream(screenStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        setIsScreenSharing(true);
        
        // Listen for screen share end
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          // Return to camera
          navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          }).then(stream => {
            setLocalStream(stream);
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
          });
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

  const endCall = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
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
        </div>
        
        <div className="flex items-center space-x-2">
          <Button 
            variant="ghost" 
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            <Users className="h-4 w-4 mr-2" />
            {participants.length}
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className="text-gray-400 hover:text-white"
          >
            <Settings className="h-4 w-4" />
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
              <span className="text-sm">You {isScreenSharing && "(sharing)"}</span>
            </div>
            
            <div className="absolute bottom-4 right-4 flex space-x-2">
              {!isAudioOn && (
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                  <MicOff className="h-4 w-4" />
                </div>
              )}
            </div>
          </div>

          {/* Remote Videos or Placeholder */}
          <div className="relative bg-video-surface rounded-lg overflow-hidden flex items-center justify-center">
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
            variant="ghost"
            size="lg"
            className="w-12 h-12 rounded-full bg-video-control hover:bg-video-control-hover text-white"
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
          
          <Button
            variant="ghost"
            size="lg"
            className="w-12 h-12 rounded-full bg-video-control hover:bg-video-control-hover text-white"
          >
            <MoreVertical className="h-5 w-5" />
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