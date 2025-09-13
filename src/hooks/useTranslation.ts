// src/hooks/useTranslation.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { TranslationWebSocket, TranslationMessage } from '@/lib/translationWebSocket';
import { useUserProfile } from './useUserProfile';

export interface Subtitle {
  id: string;
  text: string;
  timestamp: number;
  confidence?: number;
}

const FASTAPI_WS_URL = 'ws://localhost:8000/ws/translate'; // Update with your FastAPI URL

export const useTranslation = (
  localStream: MediaStream | null,
  remoteStream: MediaStream | null
) => {
  const { profile } = useUserProfile();
  const [isTranslationActive, setIsTranslationActive] = useState(false);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<TranslationWebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback((message: TranslationMessage) => {
    switch (message.type) {
      case 'subtitle':
        const newSubtitle: Subtitle = {
          id: `subtitle-${Date.now()}`,
          text: message.data.text,
          timestamp: message.timestamp,
          confidence: message.data.confidence
        };
        
        setSubtitles(prev => {
          const updated = [...prev, newSubtitle];
          // Keep only last 10 subtitles
          return updated.slice(-10);
        });
        
        // Auto-remove subtitle after 5 seconds
        setTimeout(() => {
          setSubtitles(prev => prev.filter(s => s.id !== newSubtitle.id));
        }, 5000);
        break;
        
      case 'error':
        setError(message.data.error);
        setTimeout(() => setError(null), 5000);
        break;
    }
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!isTranslationActive || !profile) return;

    const initWebSocket = async () => {
      try {
        wsRef.current = new TranslationWebSocket(
          `${FASTAPI_WS_URL}?user_id=${profile.id}&hearing_status=${profile.hearing_status}`,
          handleMessage,
          setIsConnected
        );
        
        await wsRef.current.connect();
      } catch (error) {
        console.error('Failed to connect to translation service:', error);
        setError('Failed to connect to translation service');
      }
    };

    initWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    };
  }, [isTranslationActive, profile, handleMessage]);

  // Setup audio processing for hearing users
  const setupAudioProcessing = useCallback(() => {
    if (!remoteStream || !wsRef.current || profile?.hearing_status === 'deaf') return;

    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(remoteStream);
      
      // Create processor node
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processorRef.current.onaudioprocess = (event) => {
        if (wsRef.current?.isConnected()) {
          const inputData = event.inputBuffer.getChannelData(0);
          const audioBuffer = new Float32Array(inputData);
          wsRef.current.sendAudioData(
            audioBuffer.buffer, 
            audioContextRef.current!.sampleRate
          );
        }
      };

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
    } catch (error) {
      console.error('Error setting up audio processing:', error);
      setError('Failed to setup audio processing');
    }
  }, [remoteStream, profile]);

  // Setup video processing for deaf users
  const setupVideoProcessing = useCallback(() => {
    if (!remoteStream || !wsRef.current || profile?.hearing_status === 'hearing') return;

    try {
      // Create hidden canvas for video frame extraction
      canvasRef.current = document.createElement('canvas');
      const ctx = canvasRef.current.getContext('2d');
      
      // Create video element to capture frames
      const video = document.createElement('video');
      video.srcObject = remoteStream;
      video.play();

      video.onloadedmetadata = () => {
        canvasRef.current!.width = video.videoWidth;
        canvasRef.current!.height = video.videoHeight;

        // Capture frames at 10 FPS (adjust as needed)
        videoIntervalRef.current = setInterval(() => {
          if (ctx && wsRef.current?.isConnected()) {
            ctx.drawImage(video, 0, 0);
            const frameData = canvasRef.current!.toDataURL('image/jpeg', 0.8);
            wsRef.current.sendVideoFrame(frameData);
          }
        }, 100); // 10 FPS
      };
    } catch (error) {
      console.error('Error setting up video processing:', error);
      setError('Failed to setup video processing');
    }
  }, [remoteStream, profile]);

  // Start/stop translation
  const toggleTranslation = useCallback(() => {
    setIsTranslationActive(prev => !prev);
    setError(null);
    setSubtitles([]);
  }, []);

  // Setup processing when translation is active and connected
  useEffect(() => {
    if (isTranslationActive && isConnected && profile) {
      if (profile.hearing_status === 'deaf') {
        setupVideoProcessing();
      } else {
        setupAudioProcessing();
      }
    }

    return () => {
      // Cleanup
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      if (videoIntervalRef.current) {
        clearInterval(videoIntervalRef.current);
        videoIntervalRef.current = null;
      }
    };
  }, [isTranslationActive, isConnected, profile, setupAudioProcessing, setupVideoProcessing]);

  return {
    isTranslationActive,
    toggleTranslation,
    subtitles,
    isConnected,
    error,
    userHearingStatus: profile?.hearing_status
  };
};