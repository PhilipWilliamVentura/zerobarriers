// src/components/translation/TranslationService.tsx
import { useTranslation } from '@/hooks/useTranslation';
import { TranslationButton } from './TranslationButton';
import { TranslationSubtitles } from './TranslationSubtitles';

interface TranslationServiceProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  className?: string;
}

export const TranslationService = ({ 
  localStream, 
  remoteStream, 
  className 
}: TranslationServiceProps) => {
  const {
    isTranslationActive,
    toggleTranslation,
    subtitles,
    isConnected,
    error,
    userHearingStatus
  } = useTranslation(localStream, remoteStream);

  return (
    <div className={className}>
      {/* Translation Button */}
      <TranslationButton
        isActive={isTranslationActive}
        isConnected={isConnected}
        hearingStatus={userHearingStatus}
        onClick={toggleTranslation}
        disabled={!remoteStream} // Disable if no remote stream
      />

      {/* Error Display */}
      {error && (
        <div className="absolute top-20 left-4 right-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Subtitles Display */}
      <TranslationSubtitles 
        subtitles={subtitles}
        isActive={isTranslationActive}
      />
    </div>
  );
};