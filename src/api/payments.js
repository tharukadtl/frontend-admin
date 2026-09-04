import api from './axios';

const paymentsAPI = {
  // POST /payments (Team Lead)
  submit: (data) =>
    api.post('/payments', data),

  // GET /payments/pending
  getPending: () =>
    api.get('/payments/pending'),

  // GET /payments/{id}
  getById: (id) =>
    api.get(`/payments/${id}`),

  // PATCH /payments/{id}/review (Admin)
  review: (id, decision, adjustedAmount = null, reason = '') =>
    api.patch(`/payments/${id}/review`, { decision, adjustedAmount, reason }),

  // GET /payments/{id}/approvals
  getApprovals: (id) =>
    api.get(`/payments/${id}/approvals`),

  // GET /payments/opmc/{opmcId}
  getByOpmc: (opmcId) =>
    api.get(`/payments/opmc/${opmcId}`),
};

export default paymentsAPI;
