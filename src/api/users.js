import api from './axios';

const usersAPI = {
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
