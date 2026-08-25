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

const REFRESH_URL = '/auth/refresh';

// Clear the session and bounce to login - used when the session can no longer be recovered
const forceLogout = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.href = '/login';
};

// Response interceptor - handle 401 (token expired)
// NOTE: the refresh-and-retry behaviour below is implied by the SRS's 7-day rotating refresh
// token design (POST /auth/refresh rotates and revokes the old token), not stated verbatim
// by any single SRS line.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || !originalRequest) {
      return Promise.reject(error);
    }

    // Don't try to refresh a refresh, and don't refresh twice for the same request
    if (originalRequest._retry || originalRequest.url === REFRESH_URL) {
      forceLogout();
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      forceLogout();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    let accessToken;
    let rotatedRefreshToken;
    try {
      // Uses the same `api` instance on purpose; /auth/refresh authenticates via the
      // refresh token in the body, so the stale Bearer header is harmless.
      const refreshResponse = await api.post(REFRESH_URL, { refreshToken });
      ({ accessToken, refreshToken: rotatedRefreshToken } = refreshResponse.data || {});
    } catch (refreshError) {
      forceLogout();
      return Promise.reject(refreshError);
    }

    if (!accessToken) {
      forceLogout();
      return Promise.reject(error);
    }

    localStorage.setItem('accessToken', accessToken);
    // The backend rotates the refresh token on every use and revokes the old one,
    // so the new one must be persisted or the NEXT refresh would fail.
    if (rotatedRefreshToken) {
      localStorage.setItem('refreshToken', rotatedRefreshToken);
    }

    // Replay the original request with the fresh token
    originalRequest.headers = { ...originalRequest.headers };
    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
    return api(originalRequest);
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
