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

// AUTH-013 concurrency guard — the single in-flight refresh call every 401 handler shares.
// Without this, two requests 401ing at nearly the same time would each independently read the
// same (still-valid-looking) refreshToken and each call /auth/refresh on its own; since the
// backend rotates and revokes the refresh token on every use, only the first of those calls can
// succeed and every other one fails against an already-consumed token. refreshPromise is set by
// whichever 401 handler gets there first (a plain module-level variable is safe here — JS is
// single-threaded, so the check-then-set below never interleaves with another handler's identical
// check, since nothing awaits between them); every other 401 that arrives before it settles awaits
// this SAME promise instead of firing its own, then replays its own original request with
// whatever token that one call produced. Cleared in .finally() so the NEXT 401, after this one
// settles, correctly starts a fresh refresh rather than reusing a resolved/rejected promise.
let refreshPromise = null;

const performRefresh = (refreshToken) =>
  // Uses the same `api` instance on purpose; /auth/refresh authenticates via the refresh token
  // in the body, so the stale Bearer header is harmless.
  api.post(REFRESH_URL, { refreshToken })
    .then((refreshResponse) => refreshResponse.data || {})
    .finally(() => {
      refreshPromise = null;
    });

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

    originalRequest._retry = true;

    // Join the in-flight refresh if one already exists; otherwise become the one that starts it.
    if (!refreshPromise) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        forceLogout();
        return Promise.reject(error);
      }
      refreshPromise = performRefresh(refreshToken);
    }

    let accessToken;
    let rotatedRefreshToken;
    try {
      ({ accessToken, refreshToken: rotatedRefreshToken } = await refreshPromise);
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
