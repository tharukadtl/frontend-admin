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

  // GET /kpi/opmc/{id}?date=X
  getOpmcScores: (opmcId, date = null) =>
    api.get(`/kpi/opmc/${opmcId}`, { params: date ? { date } : {} }),

  // POST /kpi/calculate (Admin)
  triggerCalculation: () =>
    api.post('/kpi/calculate'),

  // POST /kpi/targets
  setTarget: (data) =>
    api.post('/kpi/targets', data),
};

export default kpiAPI;
