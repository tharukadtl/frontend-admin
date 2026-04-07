import api from './axios';

const kpiAPI = {
  // GET /kpi/leaderboard?date=X
  getLeaderboard: (date = null) =>
    api.get('/kpi/leaderboard', { params: date ? { date } : {} }),

  // GET /kpi/my
  getMyScores: (from = null, to = null) =>
    api.get('/kpi/my', { params: { from, to } }),

  // GET /kpi/technician/{id}
  getTechnicianScores: (technicianId, from = null, to = null) =>
    api.get(`/kpi/technician/${technicianId}`, { params: { from, to } }),

  // GET /kpi/technician/{id}/summary
  getTechnicianSummary: (technicianId, from = null, to = null) =>
    api.get(`/kpi/technician/${technicianId}/summary`, { params: { from, to } }),

  // GET /kpi/branch/{id}?date=X
  getBranchScores: (branchId, date = null) =>
    api.get(`/kpi/branch/${branchId}`, { params: date ? { date } : {} }),

  // POST /kpi/calculate (Admin)
  triggerCalculation: () =>
    api.post('/kpi/calculate'),

  // POST /kpi/targets
  setTarget: (data) =>
    api.post('/kpi/targets', data),
};

export default kpiAPI;
