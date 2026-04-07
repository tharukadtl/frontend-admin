import api from './axios';

const inventoryAPI = {
  // Materials
  getMaterials: (params = {}) =>
    api.get('/inventory/materials', { params }),

  getMaterialById: (id) =>
    api.get(`/inventory/materials/${id}`),

  createMaterial: (data) =>
    api.post('/inventory/materials', data),

  updateMaterial: (id, data) =>
    api.put(`/inventory/materials/${id}`, data),

  deleteMaterial: (id) =>
    api.delete(`/inventory/materials/${id}`),

  adjustStock: (id, transactionType, quantity, notes = '') =>
    api.post(`/inventory/materials/${id}/stock`, { transactionType, quantity, notes }),

  getStockHistory: (id) =>
    api.get(`/inventory/materials/${id}/history`),

  searchMaterials: (keyword) =>
    api.get('/inventory/materials/search', { params: { keyword } }),

  // Alerts
  getLowStockAlerts: () =>
    api.get('/inventory/alerts'),

  getLowStockByBranch: (branchId) =>
    api.get(`/inventory/alerts/branch/${branchId}`),

  // Material Requests
  createRequest: (materialId, quantityRequested, reason) =>
    api.post('/inventory/requests', { materialId, quantityRequested, reason }),

  getPendingRequests: () =>
    api.get('/inventory/requests/pending'),

  getRequestsByBranch: (branchId) =>
    api.get(`/inventory/requests/branch/${branchId}`),

  reviewRequest: (id, decision, reason = '') =>
    api.patch(`/inventory/requests/${id}/review`, { decision, reason }),

  // Categories
  getCategories: () =>
    api.get('/inventory/categories'),
};

export default inventoryAPI;
