// Add type declarations at the top
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onstart: () => void;
  onend: () => void;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Video, Mic, MicOff, ArrowLeft, VideoOff, Volume2, Activity, Play, Pause } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const VideoCall = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const aslVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
  // Video-based avatar states
  const [currentVideo, setCurrentVideo] = useState("");
  const [videoQueue, setVideoQueue] = useState<string[]>([]);
  const [isPlayingASL, setIsPlayingASL] = useState(false);
  
  // Original states
  const [recognizing, setRecognizing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const [micActive, setMicActive] = useState(true);
  const [avatarLoaded, setAvatarLoaded] = useState(true); // Always true for videos
  const [recognitionActive, setRecognitionActive] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  // Transcript
  const [gloss, setGloss] = useState("");

  async function saveSessionValue(userId: string, value: string, ts = new Date()) {
  const { data, error } = await supabase
    .from("user_sessions")
    .insert([{ user_id: userId, ts, value }]);

  if (error) {
    console.error("Error saving session:", error);
  } else {
    console.log("Saved:", data);
  }
}

  // ASL video library - you can expand this with your actual video files
  const aslVideoLibrary = {
    so: "/videos/so.mp4",
    you: "/videos/you.mp4",
    understand: "/videos/understand.mp4",
    translating: "/videos/translating.mp4",
    // Fallback/demo videos
    waiting: "https://www.youtube.com/watch?v=zm8_SDEYjtw",
    demo2: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4"
  };

  // Sample phrases to ASL word mapping
  const phraseToASL = {
    "so": ["so"],
    "you": ["you"],
    "understand": ["understand"],
    "translating": ["translating"],
  };
  
  // Convert text/phrase to ASL videos
  const translateToASL = useCallback((text: string) => {
    const lowerText = text.toLowerCase().trim();
    
    // Check for direct phrase matches
    for (const [phrase, aslWords] of Object.entries(phraseToASL)) {
      if (lowerText.includes(phrase)) {
        return aslWords;
      }
    }
    
    // Check for individual word matches
    const words = lowerText.split(' ');
    const aslVideos: string[] = [];
    
    words.forEach(word => {
      const cleanWord = word.replace(/[^\w]/g, ''); // Remove punctuation
      if (aslVideoLibrary[cleanWord as keyof typeof aslVideoLibrary]) {
        aslVideos.push(cleanWord);
      }
    });
    
    // If no matches found, return a default demonstration
    return aslVideos.length > 0 ? aslVideos : ["waiting"];
  }, []);

  // Queue multiple ASL videos
  const queueASLVideos = useCallback((videoKeys: string[]) => {
    if (videoKeys.length === 0) return;
    
    setVideoQueue(videoKeys);
    playASLVideo(videoKeys[0]);
  }, []);

  // Initialize ASL video player
  useEffect(() => {
    if (aslVideoRef.current) {
      const handleVideoEnded = () => {
        setIsPlayingASL(false);
        
        // Play next video in queue
        setVideoQueue(prevQueue => {
          if (prevQueue.length > 1) {
            const newQueue = prevQueue.slice(1);
            playASLVideo(newQueue[0]);
            return newQueue;
          } else {
            setCurrentVideo("");
            return [];
          }
        });
      };

      aslVideoRef.current.addEventListener('ended', handleVideoEnded);
      aslVideoRef.current.addEventListener('loadeddata', () => {
        console.log('ASL video loaded successfully');
      });
      aslVideoRef.current.addEventListener('error', (e) => {
        console.error('Error loading ASL video:', e);
      });

      return () => {
        if (aslVideoRef.current) {
          aslVideoRef.current.removeEventListener('ended', handleVideoEnded);
        }
      };
    }
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported in this browser");
      setSpeechSupported(false);
      return;
    }

    setSpeechSupported(true);
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = true; // Change to false for better control

    recognition.onstart = () => {
      console.log('Speech recognition started');
      setRecognizing(true);
      setSpeaking(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      console.log("Recognized speech:", transcript);

      // Convert recognized phrase to ASL videos
      const aslVideos = translateToASL(transcript);
      queueASLVideos(aslVideos);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      setRecognizing(false);
      setSpeaking(false);
      setRecognitionActive(false);
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      setRecognizing(false);
      setSpeaking(false);
      setRecognitionActive(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [translateToASL, queueASLVideos]);

  // Play ASL video
  const playASLVideo = (videoKey: string) => {
    if (!aslVideoRef.current) return;
    
    setGloss(prev => (prev ? `${prev} ${videoKey}` : videoKey));

    const videoPath = aslVideoLibrary[videoKey as keyof typeof aslVideoLibrary] || aslVideoLibrary.waiting;
    setCurrentVideo(videoKey);
    setIsPlayingASL(true);
    
    aslVideoRef.current.src = videoPath;
    aslVideoRef.current.currentTime = 0;
    aslVideoRef.current.play().catch(e => {
      console.error('Error playing ASL video:', e);
      setIsPlayingASL(false);
    });
  };

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        videoRef.current.muted = true;
        streamRef.current = stream;
        setWebcamActive(true);
      }
    } catch (error) {
      console.error("Error accessing webcam:", error);
      alert("Could not access camera/microphone. Please check permissions.");
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setWebcamActive(false);
  };

  // Handle navigation to dashboard
  const handleDashboard = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (recognitionRef.current && recognitionActive) {
      recognitionRef.current.stop();
    }
    // In a real app, this would be router navigation
    window.history.back();
  };

  async function getUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("No logged-in user");
  }
  return user.id;
}

  // Handle end session
  const handleEndSession = async () => {
    const userId = await getUserId();
    await saveSessionValue(userId, gloss, new Date());
    stopWebcam();
    if (recognitionRef.current && recognitionActive) {
      recognitionRef.current.stop();
      setRecognitionActive(false);
    }
    setVideoQueue([]);
    setCurrentVideo("");
    if (aslVideoRef.current) aslVideoRef.current.pause();
    setIsPlayingASL(false);
    // In a real app, this would be router navigation
    window.history.back();
  };

  // Handle speech recognition toggle
  const handleTranslate = () => {
    if (!webcamActive) {
      alert("Please start your camera first to begin translation.");
      return;
    }

    if (!speechSupported) {
      alert("Speech recognition is not supported in this browser. Please try Chrome, Edge, or Safari.");
      return;
    }

    if (!recognitionRef.current) return;

    if (!recognitionActive) {
      try {
        recognitionRef.current.start();
        setRecognitionActive(true);
      } catch (error) {
        console.error("Error starting speech recognition:", error);
        alert("Could not start speech recognition. Please try again.");
      }
    } else {
      recognitionRef.current.stop();
      setRecognitionActive(false);
    }
  };

  const toggleMic = () => {
    setMicActive(!micActive);
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !micActive;
      });
    }
  };

  const toggleASLVideo = () => {
    if (!aslVideoRef.current) return;
    
    if (isPlayingASL) {
      aslVideoRef.current.pause();
      setIsPlayingASL(false);
    } else {
      aslVideoRef.current.play().catch(e => console.error('Error playing video:', e));
      setIsPlayingASL(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="px-6 py-4 border-b border-purple-200/50 bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-purple-600 hover:text-purple-800 hover:bg-purple-50"
              onClick={handleDashboard}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <div className="h-6 w-px bg-purple-300" />
            <div className="flex items-center space-x-2">
              <Video className="h-6 w-6 text-purple-600" />
              <span className="text-xl font-bold text-gray-900">Video-Based ASL Translation</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              webcamActive ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
            }`}>
              {webcamActive ? 'LIVE SESSION' : 'STANDBY'}
            </div>
            {!speechSupported && (
              <div className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                SPEECH NOT SUPPORTED
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* User Video Panel */}
          <Card className="p-6 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-purple-600" />
                <h2 className="text-xl font-semibold text-gray-900">Your Video</h2>
              </div>
              <div className="flex gap-2">
                {webcamActive && (
                  <Button
                    onClick={toggleMic}
                    size="sm"
                    variant={micActive ? "outline" : "destructive"}
                    className="h-8"
                  >
                    {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </Button>
                )}
              </div>
            </div>
            
            <div className={`relative rounded-lg overflow-hidden border-2 transition-all duration-300 ${
              recognitionActive ? "border-purple-500 shadow-lg shadow-purple-200" : "border-gray-200"
            }`}>
              <video 
                ref={videoRef} 
                className="w-full h-80 object-cover bg-gray-100"
                style={{ filter: webcamActive ? 'none' : 'blur(10px)' }}
              />
              
              {!webcamActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
                  <div className="text-center">
                    <VideoOff className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Camera not active</p>
                  </div>
                </div>
              )}

              {/* Status indicators */}
              <div className="absolute top-3 left-3 flex gap-2">
                {webcamActive && (
                  <div className="px-2 py-1 rounded text-xs font-medium bg-red-500 text-white">
                    LIVE
                  </div>
                )}
                {recognitionActive && (
                  <div className="px-2 py-1 rounded text-xs font-medium bg-purple-500 text-white animate-pulse">
                    LISTENING
                  </div>
                )}
              </div>

              {/* Audio level indicator */}
              {webcamActive && micActive && (
                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  <Mic className="w-4 h-4 text-purple-600" />
                  <div className="flex gap-1">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-1 bg-purple-500 rounded-full transition-all duration-200 ${
                          recognitionActive ? 'h-4 opacity-100' : 'h-1 opacity-40'
                        }`}
                        style={{ animationDelay: `${i * 100}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* ASL Video Panel */}
          <Card className="p-6 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-purple-600" />
                <h2 className="text-xl font-semibold text-gray-900">ASL Video Translation</h2>
              </div>
              <div className="flex items-center gap-2">
                {currentVideo && (
                  <Button
                    onClick={toggleASLVideo}
                    size="sm"
                    variant="outline"
                    className="h-8"
                  >
                    {isPlayingASL ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Activity className="w-4 h-4" />
                  {speechSupported ? 'Ready' : 'Speech Not Supported'}
                </div>
              </div>
            </div>
            
            <div className="relative rounded-lg overflow-hidden border-2 border-gray-200">
              <video 
                ref={aslVideoRef}
                className="w-full h-80 object-cover bg-gray-900"
                loop={false}
                muted
                playsInline
              />
              
              {!currentVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90">
                  <div className="text-center">
                    <Volume2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-white text-lg">Ready for ASL Translation</p>
                    <p className="text-gray-400 text-sm mt-2">
                      {speechSupported ? "Start speaking to see sign language videos" : "Speech recognition not supported in this browser"}
                    </p>
                  </div>
                </div>
              )}

              {/* Video queue indicator */}
              {videoQueue.length > 1 && (
                <div className="absolute top-3 right-3 bg-purple-500 text-white px-2 py-1 rounded text-xs font-medium">
                  Queue: {videoQueue.length} videos
                </div>
              )}

              {/* Current word indicator */}
              {currentVideo && (
                <div className="absolute bottom-3 left-3 bg-black/50 text-white px-3 py-1 rounded text-sm font-medium">
                  {currentVideo.toUpperCase()}
                </div>
              )}
              
            </div>

            {/* Video Controls */}
            {currentVideo && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Playing: <span className="font-medium">{currentVideo}</span>
                    {videoQueue.length > 1 && (
                      <span className="ml-2 text-purple-600">
                        ({videoQueue.length - 1} more in queue)
                      </span>
                    )}
                  </div>
                  <Button
                    onClick={() => {
                      setVideoQueue([]);
                      setCurrentVideo("");
                      if (aslVideoRef.current) {
                        aslVideoRef.current.pause();
                      }
                      setIsPlayingASL(false);
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Status Message */}
        {recognitionActive && (
          <div className="text-center mb-8">
            <Card className="inline-block p-4 bg-purple-50 border-purple-200">
              <div className="flex items-center gap-3 text-purple-600">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                <span className="font-medium">
                  Listening for speech... Speak clearly into your microphone
                </span>
              </div>
            </Card>
          </div>
        )}

        {/* Control Panel */}
        <div className="flex flex-wrap gap-4 justify-center">
          {!webcamActive ? (
            <Button 
              onClick={startWebcam} 
              size="lg"
              className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Video className="w-5 h-5 mr-2" />
              Start Camera
            </Button>
          ) : (
            <Button 
              onClick={stopWebcam} 
              size="lg"
              variant="outline"
              className="border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              <VideoOff className="w-5 h-5 mr-2" />
              Stop Camera
            </Button>
          )}
          
          <Button 
            onClick={handleTranslate} 
            size="lg"
            className={`shadow-lg hover:shadow-xl transition-all duration-200 ${
              recognitionActive 
                ? "bg-red-600 hover:bg-red-700" 
                : "bg-indigo-600 hover:bg-indigo-700"
            } text-white`}
            disabled={!webcamActive || !speechSupported}
          >
            <Volume2 className="w-5 h-5 mr-2" />
            {recognitionActive ? 'Stop Listening' : 'Start Listening'}
          </Button>

          <Button 
            size="lg"
            variant="outline"
            className="border-purple-200 text-purple-700 hover:bg-purple-50"
            onClick={handleEndSession}
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            End Session
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-gray-600 text-sm">
            Real-time speech-to-ASL translation using curated video content
          </p>
          {!speechSupported && (
            <p className="text-red-600 text-sm mt-2">
              Speech recognition requires Chrome, Edge, or Safari browser
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default VideoCall;