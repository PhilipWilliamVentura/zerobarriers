from pydantic import BaseModel
from enum import Enum
from typing import Dict, Any, Optional

class MessageType(str, Enum):
    AUDIO = "audio"
    VIDEO = "video"
    SUBTITLE = "subtitle"
    ERROR = "error"

class TranslationMessage(BaseModel):
    type: MessageType
    data: Dict[str, Any]
    timestamp: int

class AudioData(BaseModel):
    audio: list[int]  # Audio bytes as array of integers
    sampleRate: int = 16000

class VideoData(BaseModel):
    frame: str  # Base64 encoded image

class SubtitleData(BaseModel):
    text: str
    confidence: Optional[float] = None

class ErrorData(BaseModel):
    error: str
    code: Optional[str] = None