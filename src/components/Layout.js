import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useNotificationSocket } from '../context/NotificationSocketContext';

function LiveNotificationToast() {
  const { toast, clearToast } = useNotificationSocket();

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(clearToast, 5000);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  if (!toast) return null;
  return (
    <div
      onClick={clearToast}
      style={{
        position: 'fixed', bottom: 28, right: 28, zIndex: 4000,
        background: '#16232F', border: '1px solid #00D4FF55',
        borderRadius: 12, padding: '14px 18px', maxWidth: 360,
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)', cursor: 'pointer',
        color: '#D0E8FF', fontFamily: 'sans-serif',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: '#00D4FF', marginBottom: 4 }}>
        🔔 {toast.title || 'New notification'}
      </div>
      <div style={{ fontSize: 12, color: '#9FC4E0', lineHeight: 1.5 }}>
        {toast.message}
      </div>
    </div>
  );
}

export default function Layout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f4f6fb' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
        <Outlet />
      </main>
      <LiveNotificationToast />
    </div>
  );
}
