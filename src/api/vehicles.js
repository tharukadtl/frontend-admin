import api from './axios';

const vehiclesAPI = {
  // GET /vehicles
  getAll: (params = {}) =>
    api.get('/vehicles', { params }),

  // GET /vehicles/{id}
  getById: (id) =>
    api.get(`/vehicles/${id}`),

  // POST /vehicles
  create: (data) =>
    api.post('/vehicles', data),

  // PUT /vehicles/{id}
  update: (id, data) =>
    api.put(`/vehicles/${id}`, data),

  // PATCH /vehicles/{id}/status
  setStatus: (id, status) =>
    api.patch(`/vehicles/${id}/status`, { status }),

  // GET /vehicles/alerts
  getAlerts: () =>
    api.get('/vehicles/alerts'),

  // GET /vehicles/alerts/expired
  getExpired: () =>
    api.get('/vehicles/alerts/expired'),

  // GET /vehicles/alerts/summary
  getAlertSummary: () =>
    api.get('/vehicles/alerts/summary'),

  // GET /vehicles/{id}/assignments
  getAssignmentHistory: (id) =>
    api.get(`/vehicles/${id}/assignments`),

  // GET /vehicles/assignment/today
  getTodaysAssignments: () =>
    api.get('/vehicles/assignment/today'),
};

export default vehiclesAPI;
