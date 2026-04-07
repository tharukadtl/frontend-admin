import api from './axios';

const faultsAPI = {
  // GET /faults
  getAll: (params = {}) =>
    api.get('/faults', { params }),

  // GET /faults/{id}
  getById: (id) =>
    api.get(`/faults/${id}`),

  // POST /faults (Client)
  create: (data) =>
    api.post('/faults', data),

  // PATCH /faults/{id}/assign
  assign: (id, teamLeadId) =>
    api.patch(`/faults/${id}/assign`, { teamLeadId }),

  // PATCH /faults/{id}/status
  updateStatus: (id, status, reason = '') =>
    api.patch(`/faults/${id}/status`, { status, reason }),

  // GET /faults/{id}/history
  getHistory: (id) =>
    api.get(`/faults/${id}/history`),

  // GET /faults/pending
  getPending: () =>
    api.get('/faults/pending'),

  // GET /faults/branch/{branchId}
  getByBranch: (branchId) =>
    api.get(`/faults/branch/${branchId}`),
};

export default faultsAPI;
