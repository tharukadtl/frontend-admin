import api from './axios';

const jobsAPI = {
  // GET /jobs
  getAll: (params = {}) =>
    api.get('/jobs', { params }),

  // GET /jobs/{id}
  getById: (id) =>
    api.get(`/jobs/${id}`),

  // POST /jobs (Team Lead)
  create: (data) =>
    api.post('/jobs', data),

  // PATCH /jobs/{id}/start (Technician)
  start: (id) =>
    api.patch(`/jobs/${id}/start`),

  // PATCH /jobs/{id}/complete (Technician)
  complete: (id, workSummary, actualHours) =>
    api.patch(`/jobs/${id}/complete`, { workSummary, actualHours }),

  // GET /jobs/team-lead/{id}
  getByTeamLead: (teamLeadId) =>
    api.get(`/jobs/team-lead/${teamLeadId}`),

  // GET /jobs/technician/{id}
  getByTechnician: (technicianId) =>
    api.get(`/jobs/technician/${technicianId}`),

  // GET /jobs/today
  getToday: () =>
    api.get('/jobs/today'),
};

export default jobsAPI;
