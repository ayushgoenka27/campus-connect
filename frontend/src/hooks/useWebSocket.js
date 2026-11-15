import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";

/**
 * Custom hook for real-time WebSocket communication (FR-MSG-1 through FR-MSG-5, FR-ERR-5, FR-ERR-6).
 * Handles authentication, heartbeats, exponential backoff reconnection, and event dispatch.
 */
export function useWebSocket({ onNewMessage, onReadReceipt, onTyping, onNotification } = {}) {
  const { token, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isUnmountedRef = useRef(false);
  const connectRef = useRef(null);

  // Keep callback refs fresh
  const onNewMessageRef = useRef(onNewMessage);
  const onReadReceiptRef = useRef(onReadReceipt);
  const onTypingRef = useRef(onTyping);
  const onNotificationRef = useRef(onNotification);

  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
    onReadReceiptRef.current = onReadReceipt;
    onTypingRef.current = onTyping;
    onNotificationRef.current = onNotification;
  });

  const authToken = token || (typeof window !== "undefined" ? localStorage.getItem("campus_connect_token") : null);

  const connect = useCallback(() => {
    if (!authToken || isUnmountedRef.current) return;

    // Close any previous instance
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
    }

    // Resolve WebSocket URL:
    // 1. Explicit VITE_WS_URL (e.g. wss://campus-connect.onrender.com/ws)
    // 2. Derived from VITE_API_URL (e.g. https://.../api/v1 -> wss://.../ws)
    // 3. Fallback: Nginx same-origin host in PROD, or localhost:8000 in DEV
    let wsBaseUrl = import.meta.env.VITE_WS_URL;
    if (!wsBaseUrl && import.meta.env.VITE_API_URL) {
      try {
        const apiUrl = new URL(import.meta.env.VITE_API_URL, window.location.origin);
        const wsProto = apiUrl.protocol === "https:" ? "wss:" : "ws:";
        wsBaseUrl = `${wsProto}//${apiUrl.host}/ws`;
      } catch {
        // invalid URL string, ignore and fallback
      }
    }

    if (!wsBaseUrl) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = import.meta.env.PROD
        ? window.location.host
        : `${window.location.hostname || "127.0.0.1"}:8000`;
      wsBaseUrl = `${protocol}//${wsHost}/ws`;
    }

    const sep = wsBaseUrl.includes("?") ? "&" : "?";
    const url = `${wsBaseUrl}${sep}token=${encodeURIComponent(authToken)}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) {
          ws.close();
          return;
        }
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Start heartbeat ping every 30s
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "connected") {
            if (Array.isArray(data.online_users)) {
              setOnlineUserIds(new Set(data.online_users));
            }
          } else if (data.type === "presence") {
            setOnlineUserIds((prev) => {
              const next = new Set(prev);
              if (data.is_online) {
                next.add(data.user_id);
              } else {
                next.delete(data.user_id);
              }
              return next;
            });
          } else if (data.type === "new_message") {
            if (onNewMessageRef.current) {
              onNewMessageRef.current(data.message);
            }
          } else if (data.type === "read_receipt") {
            if (onReadReceiptRef.current) {
              onReadReceiptRef.current(data);
            }
          } else if (data.type === "typing") {
            if (onTypingRef.current) {
              onTypingRef.current(data);
            }
          } else if (data.type === "notification") {
            if (onNotificationRef.current) {
              onNotificationRef.current(data.notification);
            }
          }
        } catch {
          // ignore malformed frame
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        // Do not reconnect on policy violation (1008 - unauthenticated/inactive)
        if (event.code === 1008 || isUnmountedRef.current) return;

        // Exponential backoff reconnect: 1s, 2s, 4s, 8s, max 10s
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          connectRef.current?.();
        }, delay);
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          // ignore
        }
      };
    } catch {
      // Failed to instantiate WebSocket
    }
  }, [authToken]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, [connect]);

  const sendChatMessage = useCallback((conversationId, content, clientMsgId) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "chat_message",
          conversation_id: conversationId,
          content,
          client_msg_id: clientMsgId,
        })
      );
      return true;
    }
    return false;
  }, []);

  const sendMarkRead = useCallback((conversationId) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "mark_read",
          conversation_id: conversationId,
        })
      );
    }
  }, []);

  const sendTyping = useCallback((conversationId) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "typing",
          conversation_id: conversationId,
        })
      );
    }
  }, []);

  const isUserOnline = useCallback(
    (userId) => {
      if (!userId) return false;
      return onlineUserIds.has(userId);
    },
    [onlineUserIds]
  );

  return {
    isConnected,
    isUserOnline,
    onlineUserIds,
    sendChatMessage,
    sendMarkRead,
    sendTyping,
    currentUserId: user?.id,
  };
}
