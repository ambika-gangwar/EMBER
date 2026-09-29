import { useEffect, useRef, useState, useCallback } from "react";
import { WS_BASE_URL } from "@/lib/api";

export function useCollaboration({ noteId, user, onRemoteEdit }) {
  const [collaborators, setCollaborators] = useState([]);
  const [readerCount, setReaderCount] = useState(1);
  const [remoteCursors, setRemoteCursors] = useState({});
  const wsRef = useRef(null);
  const cursorThrottleRef = useRef(0);

  useEffect(() => {
    if (!noteId) return;

    const token = localStorage.getItem("san_token") || "";
    const wsUrl = `${WS_BASE_URL}/ws/notes/${noteId}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    let socket;
    let pingInterval;
    let isMounted = true;

    try {
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        // Send heartbeat every 20 seconds
        pingInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, 20000);
      };

      socket.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === "presence") {
            const all = data.collaborators || [];
            // Exclude current user from remote collaborators display
            const others = all.filter((c) => c.user_id !== user?.id);
            setCollaborators(others);
            setReaderCount(Math.max(1, data.reader_count || 1));
          } else if (data.type === "remote_cursor") {
            setRemoteCursors((prev) => ({
              ...prev,
              [data.user_id]: {
                name: data.name,
                color: data.color,
                x: data.x,
                y: data.y,
                timestamp: Date.now(),
              },
            }));
          } else if (data.type === "remote_edit") {
            if (data.user_id !== user?.id) {
              onRemoteEdit?.({
                title: data.title,
                content: data.content,
                version: data.version,
              });
            }
          }
        } catch (e) {
          // Ignore non-json frames
        }
      };

      socket.onerror = () => {
        // Silently handle error; WebSocket will attempt close
      };

      socket.onclose = () => {
        if (pingInterval) clearInterval(pingInterval);
      };
    } catch (e) {
      // Fallback gracefully if WebSockets are unavailable
    }

    return () => {
      isMounted = false;
      if (pingInterval) clearInterval(pingInterval);
      if (socket) {
        socket.close();
      }
      wsRef.current = null;
      setRemoteCursors({});
    };
  }, [noteId, user?.id, onRemoteEdit]);

  // Broadcast cursor movement (throttled to ~50ms)
  const sendCursor = useCallback((x, y) => {
    const now = Date.now();
    if (now - cursorThrottleRef.current < 45) return;
    cursorThrottleRef.current = now;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "cursor",
        x,
        y,
      }));
    }
  }, []);

  // Broadcast live edit
  const sendEdit = useCallback((title, content) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "edit",
        title,
        content,
      }));
    }
  }, []);

  return {
    collaborators,
    readerCount,
    remoteCursors,
    sendCursor,
    sendEdit,
  };
}
