import React, { useState, useEffect } from 'react';
import notificationsAPI from '../../api/notifications';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await notificationsAPI.getAll();
      setNotifications(response.data || []);
    } catch (error) {
      console.error('Failed to load notifications', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await notificationsAPI.markAsRead(id);
      loadNotifications();
    } catch (error) {
      console.error('Failed to mark as read', error);
    }
  };

  if (loading) {
    return <div style={{ padding: 24 }}>Loading notifications...</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 20, color: '#1a237e' }}>Notifications</h1>
      
      <div style={{ background: '#fff', borderRadius: 12, padding: 20 }}>
        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <div>No notifications</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {notifications.map(notif => (
              <div
                key={notif.id}
                style={{
                  padding: 16,
                  background: notif.isRead ? '#fff' : '#e8eaf6',
                  border: '1px solid #e0e0e0',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
                onClick={() => !notif.isRead && markAsRead(notif.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a237e', marginBottom: 4 }}>
                      {notif.title}
                    </div>
                    <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                      {notif.body}
                    </div>
                    <div style={{ fontSize: 11, color: '#999' }}>
                      {new Date(notif.createdAt).toLocaleString()}
                    </div>
                  </div>
                  {!notif.isRead && (
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#1a237e',
                      marginLeft: 12,
                    }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
