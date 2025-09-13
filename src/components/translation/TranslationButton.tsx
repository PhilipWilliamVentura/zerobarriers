// src/components/translation/TranslationButton.tsx
import { Button } from "@/components/ui/button";
import { Subtitles, Loader2, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface TranslationButtonProps {
  isActive: boolean;
  isConnected: boolean;
  hearingStatus?: 'hearing' | 'deaf' | 'hard_of_hearing';
  onClick: () => void;
  disabled?: boolean;
}

export const TranslationButton = ({ 
  isActive, 
  isConnected, 
  hearingStatus,
  onClick, 
  disabled = false 
}: TranslationButtonProps) => {
  const getButtonText = () => {
    if (!isActive) {
      return hearingStatus === 'deaf' ? 'Enable ASL Translation' : 'Enable Live Captions';
    }
    
    if (!isConnected) {
      return 'Connecting...';
    }
    
    return hearingStatus === 'deaf' ? 'ASL Translation On' : 'Live Captions On';
  };

  const getIcon = () => {
    if (!isActive) {
      return <Subtitles className="h-4 w-4" />;
    }
    
    if (!isConnected) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    
    return isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />;
  };

  return (
    <Button
      variant={isActive ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "transition-all duration-200",
        isActive && isConnected && "bg-green-600 hover:bg-green-700",
        isActive && !isConnected && "bg-yellow-600 hover:bg-yellow-700",
        !isActive && "border-gray-600 text-gray-400 hover:text-white hover:border-gray-400"
      )}
    >
      {getIcon()}
      <span className="ml-2">{getButtonText()}</span>
    </Button>
  );
};