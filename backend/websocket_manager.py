"""
Smart AI Notes - Real-time Collaboration WebSocket Manager
Handles real-time presence indicators, live cursor streaming,
reader tracking, and collaborative note updates.
"""
import json
import logging
from typing import Dict, Set, Any, Optional
from fastapi import WebSocket

logger = logging.getLogger("collab")

# Distinct vivid pastel colors for collaborators
COLLAB_COLORS = [
    "#F59E0B", # Amber
    "#10B981", # Emerald
    "#3B82F6", # Blue
    "#8B5CF6", # Purple
    "#EC4899", # Pink
    "#06B6D4", # Cyan
    "#F97316", # Orange
]

class ConnectionManager:
    def __init__(self):
        # note_id -> set of active WebSockets
        self.active_rooms: Dict[str, Set[WebSocket]] = {}
        # websocket -> metadata dict { user_id, name, color, note_id, avatar_url, joined_at }
        self.client_meta: Dict[WebSocket, Dict[str, Any]] = {}
        # round-robin color index counter
        self._color_counter: int = 0

    def _next_color(self) -> str:
        color = COLLAB_COLORS[self._color_counter % len(COLLAB_COLORS)]
        self._color_counter += 1
        return color

    async def connect(self, websocket: WebSocket, note_id: str, user: dict):
        await websocket.accept()
        if note_id not in self.active_rooms:
            self.active_rooms[note_id] = set()
        self.active_rooms[note_id].add(websocket)

        color = self._next_color()
        self.client_meta[websocket] = {
            "user_id": user.get("id"),
            "name": user.get("name", "Anonymous"),
            "email": user.get("email", ""),
            "color": color,
            "note_id": note_id,
            "cursor": None,
        }

        # Broadcast updated presence and reader count
        await self.broadcast_presence(note_id)

    async def disconnect(self, websocket: WebSocket):
        meta = self.client_meta.pop(websocket, None)
        if not meta:
            return
        note_id = meta.get("note_id")
        if note_id and note_id in self.active_rooms:
            self.active_rooms[note_id].discard(websocket)
            if not self.active_rooms[note_id]:
                del self.active_rooms[note_id]
            else:
                await self.broadcast_presence(note_id)

    def get_room_presence(self, note_id: str) -> list:
        room = self.active_rooms.get(note_id, set())
        presence = []
        seen_users = set()
        for ws in room:
            meta = self.client_meta.get(ws)
            if meta:
                uid = meta["user_id"]
                if uid not in seen_users:
                    seen_users.add(uid)
                    presence.append({
                        "user_id": uid,
                        "name": meta["name"],
                        "color": meta["color"],
                        "cursor": meta.get("cursor"),
                    })
        return presence

    async def broadcast_presence(self, note_id: str):
        room = self.active_rooms.get(note_id, set())
        if not room:
            return
        presence = self.get_room_presence(note_id)
        msg = {
            "type": "presence",
            "collaborators": presence,
            "reader_count": len(presence),
        }
        await self._broadcast(note_id, msg)

    async def handle_cursor_move(self, websocket: WebSocket, cursor_data: dict):
        meta = self.client_meta.get(websocket)
        if not meta:
            return
        meta["cursor"] = cursor_data
        note_id = meta.get("note_id")
        if not note_id:
            return

        msg = {
            "type": "remote_cursor",
            "user_id": meta["user_id"],
            "name": meta["name"],
            "color": meta["color"],
            "x": cursor_data.get("x", 0),
            "y": cursor_data.get("y", 0),
        }
        await self._broadcast(note_id, msg, exclude=websocket)

    async def handle_note_edit(self, websocket: WebSocket, edit_data: dict):
        meta = self.client_meta.get(websocket)
        if not meta:
            return
        note_id = meta.get("note_id")
        if not note_id:
            return

        msg = {
            "type": "remote_edit",
            "user_id": meta["user_id"],
            "name": meta["name"],
            "title": edit_data.get("title"),
            "content": edit_data.get("content"),
            "version": edit_data.get("version"),
        }
        await self._broadcast(note_id, msg, exclude=websocket)

    async def _broadcast(self, note_id: str, message: dict, exclude: Optional[WebSocket] = None):
        room = self.active_rooms.get(note_id, set())
        dead = []
        payload = json.dumps(message)
        for ws in list(room):
            if ws == exclude:
                continue
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for d in dead:
            await self.disconnect(d)

collab_manager = ConnectionManager()
