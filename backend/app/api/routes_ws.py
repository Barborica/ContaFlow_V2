import json
import logging
from urllib.parse import parse_qs

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jwt import InvalidTokenError

from app.core.config import settings
import jwt

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """Manages active WebSocket connections by role and broadcasts status."""

    def __init__(self):
        self.connections: dict[WebSocket, tuple[str, str | None]] = {}

    def _phone_connected(self) -> bool:
        return any(role == "phone" for role, _ in self.connections.values())

    async def _broadcast_status(self):
        """Broadcast the current phone status to every connected web client."""
        payload = json.dumps(
            {"type": "status", "phone_connected": self._phone_connected()}
        )
        disconnected: list[WebSocket] = []
        for connection in list(self.connections.keys()):
            try:
                await connection.send_text(payload)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            self.connections.pop(conn, None)

    async def connect(
        self, websocket: WebSocket, role: str = "unknown", user_id: str | None = None
    ):
        await websocket.accept()
        self.connections[websocket] = (role, user_id)
        logger.info(f"WebSocket connected (role={role}). Active: {len(self.connections)}")
        await self._broadcast_status()

    async def disconnect(self, websocket: WebSocket):
        role, _ = self.connections.pop(websocket, ("unknown", None))
        logger.info(
            f"WebSocket disconnected (role={role}). Active: {len(self.connections)}"
        )
        await self._broadcast_status()

    async def broadcast(self, message: dict):
        """Send a message to all connected clients."""
        payload = json.dumps(message)
        disconnected: list[WebSocket] = []
        for connection in list(self.connections.keys()):
            try:
                await connection.send_text(payload)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            self.connections.pop(conn, None)

    async def broadcast_to_user(self, user_id: str, message: dict):
        payload = json.dumps(message)
        disconnected: list[WebSocket] = []
        for connection, (_, connection_user_id) in list(self.connections.items()):
            if connection_user_id != user_id:
                continue
            try:
                await connection.send_text(payload)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            self.connections.pop(conn, None)


# Singleton instance shared across the application
manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time status updates.

    Clients should connect with query param ?role=web or ?role=phone.
    The server broadcasts phone connection status to every web client.
    """
    query = parse_qs(websocket.scope.get("query_string", b"").decode())
    role = query.get("role", ["unknown"])[0]
    token = query.get("token", [None])[0]
    user_id = None

    if token:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            user_id = payload.get("sub")
        except InvalidTokenError:
            await websocket.close(code=1008)
            return

    await manager.connect(websocket, role, str(user_id) if user_id else None)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
