import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

// The backend exposes a raw (non-STOMP) WebSocket at /ws/notifications
// (see WebSocketConfig.java) — same host as the REST API, ws(s):// scheme.
const API_HTTP = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const WS_BASE = API_HTTP.replace(/^http/i, 'ws');
const RECONNECT_MS = 4000;

const NotificationSocketContext = createContext(null);

export function NotificationSocketProvider({ children }) {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [liveNotifications, setLiveNotifications] = useState([]);
  const [toast, setToast] = useState(null);
  const [liveUnreadCount, setLiveUnreadCount] = useState(0);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  useEffect(() => {
    // AuthContext.login() stores the raw AuthResponse fields verbatim (see
    // AuthContext.js:28-32) — the backend serializes the caller's id as `userId`,
    // never `id` (AuthResponse.java). Reading `user.id` here was always undefined,
    // so this effect never even attempted a connection for any real logged-in user
    // — found while live-verifying the Sec-WebSocket-Protocol auth fix below, and
    // fixed together since without it that fix could never be observed working.
    if (!user?.userId) return undefined;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      // A native WebSocket() can't attach an Authorization header, and the JWT lives in
      // localStorage, not a cookie — so the token is carried as the WebSocket subprotocol
      // instead (Sec-WebSocket-Protocol), which jwtAuthFilter/WebSocketAuthInterceptor
      // validate server-side. See SecurityConfig.jwtAuthFilter() for the matching fallback.
      const token = localStorage.getItem('accessToken');
      if (!token) {
        reconnectRef.current = setTimeout(connect, RECONNECT_MS);
        return;
      }
      let ws;
      try {
        ws = new WebSocket(`${WS_BASE}/ws/notifications`, [token]);
      } catch {
        reconnectRef.current = setTimeout(connect, RECONNECT_MS);
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        // Server buckets connections by senderRole for role-based broadcasts
        // (e.g. sendToRole("admin", ...) on payment submission) — see
        // NotificationWebSocketHandler.handleRegister.
        const role = ['ADMIN', 'SUPER_ADMIN'].includes(user.role) ? 'admin' : (user.role || '').toLowerCase();
        ws.send(JSON.stringify({ type: 'REGISTER', senderId: String(user.userId), senderRole: role }));
      };

      ws.onmessage = (evt) => {
        let msg;
        try { msg = JSON.parse(evt.data); } catch { return; }
        if (msg.type !== 'NOTIFICATION' || !msg.data) return;
        const item = {
          id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: msg.data.title,
          message: msg.data.message,
          type: msg.data.notificationType,
          createdAt: msg.data.timestamp || new Date().toISOString(),
          read: false,
          isRead: false,
          live: true,
        };
        setLiveNotifications(prev => [item, ...prev].slice(0, 50));
        setLiveUnreadCount(c => c + 1);
        setToast(item);
      };

      ws.onclose = () => {
        setConnected(false);
        if (!cancelled) reconnectRef.current = setTimeout(connect, RECONNECT_MS);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [user?.userId, user?.role]);

  const clearToast = useCallback(() => setToast(null), []);
  const clearLiveUnread = useCallback(() => setLiveUnreadCount(0), []);

  return (
    <NotificationSocketContext.Provider value={{
      connected, liveNotifications, toast, clearToast, liveUnreadCount, clearLiveUnread,
    }}>
      {children}
    </NotificationSocketContext.Provider>
  );
}

export function useNotificationSocket() {
  const ctx = useContext(NotificationSocketContext);
  if (!ctx) throw new Error('useNotificationSocket must be used within NotificationSocketProvider');
  return ctx;
}
