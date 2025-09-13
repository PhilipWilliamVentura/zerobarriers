import asyncio
import speech_recognition as sr
import io
import wave
import numpy as np
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class AudioTranslationService:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        # Configure recognizer settings
        self.recognizer.energy_threshold = 300
        self.recognizer.dynamic_energy_threshold = True
        self.recognizer.pause_threshold = 0.8
        self.recognizer.phrase_threshold = 0.3

    async def transcribe_audio(self, audio_data: bytes, sample_rate: int = 16000) -> Optional[str]:
        """
        Transcribe audio data to text using speech recognition
        """
        try:
            # Convert bytes to audio format that speech_recognition can use
            audio_array = np.frombuffer(audio_data, dtype=np.float32)
            
            # Convert to 16-bit PCM
            audio_int16 = (audio_array * 32767).astype(np.int16)
            
            # Create WAV file in memory
            wav_buffer = io.BytesIO()
            with wave.open(wav_buffer, 'wb') as wav_file:
                wav_file.setnchannels(1)  # Mono
                wav_file.setsampwidth(2)  # 2 bytes per sample (16-bit)
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(audio_int16.tobytes())
            
            wav_buffer.seek(0)
            
            # Use speech_recognition to transcribe
            with sr.AudioFile(wav_buffer) as source:
                audio = self.recognizer.record(source)
                
            # Use Google Speech Recognition (you can change this to other services)
            text = await self._recognize_with_timeout(audio)
            
            return text
            
        except Exception as e:
            logger.error(f"Error in audio transcription: {str(e)}")
            return None

    async def _recognize_with_timeout(self, audio_data, timeout: float = 5.0) -> Optional[str]:
        """
        Perform speech recognition with timeout
        """
        try:
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            result = await asyncio.wait_for(
                loop.run_in_executor(
                    None, 
                    self._perform_recognition, 
                    audio_data
                ), 
                timeout=timeout
            )
            return result
        except asyncio.TimeoutError:
            logger.warning("Speech recognition timed out")
            return None
        except Exception as e:
            logger.error(f"Recognition error: {str(e)}")
            return None

    def _perform_recognition(self, audio_data) -> Optional[str]:
        """
        Perform the actual speech recognition (blocking operation)
        """
        try:
            # You can switch between different recognition services:
            
            # Option 1: Google Speech Recognition (free, requires internet)
            return self.recognizer.recognize_google(audio_data)
            
            # Option 2: Whisper (local, no internet required)
            # return self.recognizer.recognize_whisper(audio_data)
            
            # Option 3: Azure Speech Services
            # return self.recognizer.recognize_azure(audio_data, key="YOUR_KEY", location="YOUR_REGION")
            
            # Option 4: AWS Transcribe
            # return self.recognizer.recognize_amazon(audio_data, key="YOUR_KEY", secret="YOUR_SECRET", region="YOUR_REGION")
            
        except sr.UnknownValueError:
            logger.debug("Could not understand audio")
            return None
        except sr.RequestError as e:
            logger.error(f"Recognition service error: {str(e)}")
            return None