from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
import json
import asyncio
import logging
from typing import Dict, List
from services.audio_service import AudioTranslationService
from services.video_service import VideoTranslationService
from utils.websocket_manager import WebSocketManager
from models.translation_models import TranslationMessage, MessageType

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Real-time Translation Service")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
audio_service = AudioTranslationService()
video_service = VideoTranslationService()
websocket_manager = WebSocketManager()

@app.websocket("/ws/translate")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str = Query(...),
    hearing_status: str = Query(...)
):
    await websocket_manager.connect(websocket, user_id, hearing_status)
    logger.info(f"User {user_id} connected with hearing status: {hearing_status}")
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            message = TranslationMessage(**message_data)
            
            # Process based on message type
            if message.type == MessageType.AUDIO:
                await handle_audio_message(websocket, user_id, message)
            elif message.type == MessageType.VIDEO:
                await handle_video_message(websocket, user_id, message)
            else:
                logger.warning(f"Unknown message type: {message.type}")
                
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket, user_id)
        logger.info(f"User {user_id} disconnected")
    except Exception as e:
        logger.error(f"Error handling websocket for user {user_id}: {str(e)}")
        await websocket_manager.send_error(websocket, str(e))

async def handle_audio_message(websocket: WebSocket, user_id: str, message: TranslationMessage):
    """Handle audio translation for hearing users"""
    try:
        # Extract audio data
        audio_data = message.data.get("audio", [])
        sample_rate = message.data.get("sampleRate", 16000)
        
        # Convert audio data back to bytes
        audio_bytes = bytes(audio_data)
        
        # Perform speech-to-text
        transcript = await audio_service.transcribe_audio(audio_bytes, sample_rate)
        
        if transcript and transcript.strip():
            # Send subtitle back to client
            subtitle_message = {
                "type": "subtitle",
                "data": {
                    "text": transcript,
                    "confidence": 0.85  # You can get this from your STT service
                },
                "timestamp": message.timestamp
            }
            
            await websocket.send_text(json.dumps(subtitle_message))
            logger.info(f"Sent audio subtitle to user {user_id}: {transcript[:50]}...")
            
    except Exception as e:
        logger.error(f"Error processing audio for user {user_id}: {str(e)}")
        await websocket_manager.send_error(websocket, f"Audio processing error: {str(e)}")

async def handle_video_message(websocket: WebSocket, user_id: str, message: TranslationMessage):
    """Handle video translation for deaf users (ASL recognition)"""
    try:
        # Extract frame data
        frame_data = message.data.get("frame", "")
        
        # Perform ASL recognition
        asl_text = await video_service.recognize_asl(frame_data)
        
        if asl_text and asl_text.strip():
            # Send subtitle back to client
            subtitle_message = {
                "type": "subtitle",
                "data": {
                    "text": asl_text,
                    "confidence": 0.75  # You can get this from your ASL recognition service
                },
                "timestamp": message.timestamp
            }
            
            await websocket.send_text(json.dumps(subtitle_message))
            logger.info(f"Sent ASL subtitle to user {user_id}: {asl_text[:50]}...")
            
    except Exception as e:
        logger.error(f"Error processing video for user {user_id}: {str(e)}")
        await websocket_manager.send_error(websocket, f"Video processing error: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "translation-backend"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)