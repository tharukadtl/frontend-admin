import api from './axios';

const opmcAPI = {
  // GET /opmcs
  getAll: () =>
    api.get('/opmcs'),

  // GET /opmcs/{id}
  getById: (id) =>
    api.get(`/opmcs/${id}`),

  // POST /opmcs
  create: (data) =>
    api.post('/opmcs', data),

  // PUT /opmcs/{id}
  update: (id, data) =>
    api.put(`/opmcs/${id}`, data),

  // DELETE /opmcs/{id}
  deactivate: (id) =>
    api.delete(`/opmcs/${id}`),
};

export default opmcAPI;
