from fastapi import WebSocket
from typing import Dict, List
import json
import logging
import time

logger = logging.getLogger(__name__)

class WebSocketManager:
    def __init__(self):
        # Store active connections: {user_id: {"websocket": WebSocket, "hearing_status": str}}
        self.active_connections: Dict[str, Dict] = {}

    async def connect(self, websocket: WebSocket, user_id: str, hearing_status: str):
        await websocket.accept()
        self.active_connections[user_id] = {
            "websocket": websocket,
            "hearing_status": hearing_status
        }
        logger.info(f"User {user_id} connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        logger.info(f"User {user_id} disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]["websocket"]
            try:
                await websocket.send_text(message)
            except Exception as e:
                logger.error(f"Error sending message to user {user_id}: {str(e)}")
                # Remove disconnected websocket
                self.disconnect(websocket, user_id)

    async def send_error(self, websocket: WebSocket, error_message: str):
        error_data = {
            "type": "error",
            "data": {
                "error": error_message
            },
            "timestamp": int(time.time() * 1000)
        }
        try:
            await websocket.send_text(json.dumps(error_data))
        except Exception as e:
            logger.error(f"Error sending error message: {str(e)}")

    def get_connection_count(self) -> int:
        return len(self.active_connections)

    def get_user_hearing_status(self, user_id: str) -> str:
        if user_id in self.active_connections:
            return self.active_connections[user_id]["hearing_status"]
        return "unknown"