import api from './axios';

const notificationsAPI = {
  // GET /notifications
  getAll: () =>
    api.get('/notifications'),

  // GET /notifications/unread
  getUnread: () =>
    api.get('/notifications/unread'),

  // GET /notifications/count
  getCount: () =>
    api.get('/notifications/count'),

  // PATCH /notifications/read-all
  markAllRead: () =>
    api.patch('/notifications/read-all'),

  // PATCH /notifications/{id}/read
  markOneRead: (id) =>
    api.patch(`/notifications/${id}/read`),

  // POST /notifications/push (Admin)
  sendPush: (recipientId, fcmToken, title, body, referenceType = null, referenceId = null) =>
    api.post('/notifications/push', { recipientId, fcmToken, title, body, referenceType, referenceId }),
};

export default notificationsAPI;
