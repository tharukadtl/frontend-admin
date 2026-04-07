import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8080/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401 (token expired)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Helper to extract data from paginated or direct responses
export const extractData = (response) => {
  // Backend returns Page<T> for paginated endpoints
  if (response.data?.content) {
    return {
      items: response.data.content,
      total: response.data.totalElements,
      pages: response.data.totalPages,
      current: response.data.number,
    };
  }
  // Direct array or object
  return Array.isArray(response.data) ? response.data : [response.data];
};

export default api;
