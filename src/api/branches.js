import api from './axios';

const branchesAPI = {
  // GET /branches
  getAll: () =>
    api.get('/branches'),

  // GET /branches/{id}
  getById: (id) =>
    api.get(`/branches/${id}`),

  // POST /branches
  create: (data) =>
    api.post('/branches', data),

  // PUT /branches/{id}
  update: (id, data) =>
    api.put(`/branches/${id}`, data),

  // DELETE /branches/{id}
  deactivate: (id) =>
    api.delete(`/branches/${id}`),
};

export default branchesAPI;
