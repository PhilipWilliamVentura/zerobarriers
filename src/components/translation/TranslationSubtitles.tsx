// src/components/translation/TranslationSubtitles.tsx
import { useEffect, useRef } from 'react';
import { Card } from "@/components/ui/card";
import { Subtitle } from '@/hooks/useTranslation';
import { cn } from "@/lib/utils";

interface TranslationSubtitlesProps {
  subtitles: Subtitle[];
  isActive: boolean;
  className?: string;
}

export const TranslationSubtitles = ({ 
  subtitles, 
  isActive, 
  className 
}: TranslationSubtitlesProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new subtitle is added
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [subtitles]);

  if (!isActive || subtitles.length === 0) {
    return null;
  }

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return '';
    
    if (confidence >= 0.8) return 'text-green-300';
    if (confidence >= 0.6) return 'text-yellow-300';
    return 'text-red-300';
  };

  return (
    <Card className={cn(
      "absolute bottom-20 left-4 right-4 max-h-32 overflow-y-auto bg-black/80 backdrop-blur border-gray-600",
      className
    )}>
      <div 
        ref={containerRef}
        className="p-3 space-y-2 max-h-28 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
      >
        {subtitles.map((subtitle) => (
          <div
            key={subtitle.id}
            className="flex items-start space-x-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
          >
            <div className="flex-1">
              <p className="text-white text-sm leading-relaxed">
                {subtitle.text}
              </p>
              {subtitle.confidence && (
                <div className="flex items-center space-x-2 mt-1">
                  <div className={cn(
                    "text-xs",
                    getConfidenceColor(subtitle.confidence)
                  )}>
                    Confidence: {Math.round(subtitle.confidence * 100)}%
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(subtitle.timestamp).toLocaleTimeString([], { 
                      hour12: false,
                      hour: '2-digit', 
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};