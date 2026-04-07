// Frontend Reports API Client - see USAGE_EXAMPLES.md for details
import api from './axios';

const reportsAPI = {
  getFaultSummary: (params = {}) => api.get('/reports/faults/summary', { params }),
  exportFaults: (format, params = {}) => api.get('/reports/faults/export', { params: { format, ...params }, responseType: 'blob' }),
  getJobPerformance: (params = {}) => api.get('/reports/jobs/performance', { params }),
  exportJobs: (format, params = {}) => api.get('/reports/jobs/export', { params: { format, ...params }, responseType: 'blob' }),
  getRevenue: (params = {}) => api.get('/reports/payments/revenue', { params }),
  exportRevenue: (format, params = {}) => api.get('/reports/payments/export', { params: { format, ...params }, responseType: 'blob' }),
  getKPITrends: (params = {}) => api.get('/reports/kpi/trends', { params }),
  getInventoryStock: (params = {}) => api.get('/reports/inventory/stock', { params }),
  exportInventory: (format, params = {}) => api.get('/reports/inventory/export', { params: { format, ...params }, responseType: 'blob' }),
  getVehicleUsage: (params = {}) => api.get('/reports/vehicles/usage', { params }),
};

export const downloadFile = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export default reportsAPI;
