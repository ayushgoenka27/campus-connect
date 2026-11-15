import json
import logging
from typing import Dict, Optional, Set
from fastapi import WebSocket

logger = logging.getLogger("campus_connect.websocket")


class ConnectionManager:
    """
    In-memory WebSocket connection manager (TD-004, FR-MSG-1, NFR-1).
    Tracks live user WebSockets, handles frame dispatch, and maintains presence.
    """

    def __init__(self):
        # Maps user_id -> set of active WebSocket connections (multi-tab support)
        self.active_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        is_first = user_id not in self.active_connections or len(self.active_connections[user_id]) == 0
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        logger.info(f"User {user_id} connected (tabs: {len(self.active_connections[user_id])})")

        # Broadcast presence to other clients if this is their first connection
        if is_first:
            await self.broadcast_presence(user_id, True, exclude_ws=websocket)

    def disconnect(self, user_id: int, websocket: WebSocket) -> bool:
        """
        Removes a connection. Returns True if user has no remaining connections (now offline).
        """
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                logger.info(f"User {user_id} went offline")
                return True
            else:
                logger.info(f"User {user_id} closed a tab (remaining: {len(self.active_connections[user_id])})")
        return False

    async def disconnect_user(self, user_id: int, code: int = 1008) -> None:
        """
        Immediately closes and removes all active WebSocket connections for a user.
        Used when an account is deactivated by an administrator (FR-ADM-3).
        """
        sockets = self.active_connections.pop(user_id, None)
        if sockets:
            for ws in list(sockets):
                try:
                    await ws.close(code=code)
                except Exception:
                    pass
            logger.info(f"User {user_id} disconnected by admin deactivation ({len(sockets)} sockets closed)")
            await self.broadcast_presence(user_id, False)

    def is_online(self, user_id: int) -> bool:
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0

    def get_online_user_ids(self) -> Set[int]:
        return set(self.active_connections.keys())

    async def send_to_user(self, user_id: int, payload: dict) -> bool:
        """
        Delivers payload to all active sockets of user_id.
        Returns True if delivered to at least one socket, False if user is offline.
        """
        sockets = self.active_connections.get(user_id)
        if not sockets:
            return False

        dead_sockets = set()
        delivered = False
        text = json.dumps(payload, default=str)

        for ws in list(sockets):
            try:
                await ws.send_text(text)
                delivered = True
            except Exception as e:
                logger.warning(f"Error sending to user {user_id} socket: {e}")
                dead_sockets.add(ws)

        for dead in dead_sockets:
            sockets.discard(dead)
        if not sockets and user_id in self.active_connections:
            del self.active_connections[user_id]

        return delivered

    async def broadcast_presence(self, user_id: int, is_online: bool, exclude_ws: Optional[WebSocket] = None) -> None:
        """
        Notifies connected clients about a user's presence state.
        """
        payload = {
            "type": "presence",
            "user_id": user_id,
            "is_online": is_online,
        }
        text = json.dumps(payload, default=str)
        for uid, sockets in list(self.active_connections.items()):
            for ws in list(sockets):
                if ws is exclude_ws:
                    continue
                try:
                    await ws.send_text(text)
                except Exception:
                    pass


# Global singleton instance
manager = ConnectionManager()
