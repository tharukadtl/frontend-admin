import api from './axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

const usersAPI = {
  // POST /users/import — multipart CSV upload. Raw fetch + FormData (not the
  // axios instance) so the browser sets the multipart boundary itself, rather
  // than fighting axios's default 'Content-Type: application/json' header —
  // mirrors aiClient.js's aiUpload() pattern used by ModelTrainingPage.js.
  bulkImport: (file) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${API_BASE}/users/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      body: form,
    }).then(async (r) => {
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.message || data?.error || `${r.status}`);
      return data;
    });
  },

  // GET /users
  getAll: (params = {}) =>
    api.get('/users', { params }),

  // GET /users/{id}
  getById: (id) =>
    api.get(`/users/${id}`),

  // POST /users
  create: (data) =>
    api.post('/users', data),

  // PUT /users/{id}
  update: (id, data) =>
    api.put(`/users/${id}`, data),

  // DELETE /users/{id}
  deactivate: (id) =>
    api.delete(`/users/${id}`),

  // POST /users/change-password
  changePassword: (currentPassword, newPassword) =>
    api.post('/users/change-password', { currentPassword, newPassword }),

  // POST /users/{id}/reset-password
  resetPassword: (id) =>
    api.post(`/users/${id}/reset-password`),

  // POST /users/fcm-token
  updateFCMToken: (fcmToken) =>
    api.post('/users/fcm-token', { fcmToken }),

  // GET /users/active?role=X
  getActiveByRole: (role) =>
    api.get('/users/active', { params: { role } }),
};

export default usersAPI;
