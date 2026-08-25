/**
 * AUTH-013 — the admin portal's axios client must transparently recover from an expired access
 * token: when a request comes back 401 it should refresh the token once and replay the ORIGINAL
 * request, so the caller sees a successful response instead of an error.
 *
 * Subject under test: the real response interceptor configured in `src/api/axios.js` (the shared
 * `api` instance every page imports). Nothing about the interceptor is stubbed — only the
 * transport is: `api.defaults.adapter` is swapped for a fake that scripts the HTTP responses.
 * That keeps both interceptors (request: attach bearer; response: handle 401) in the code path
 * exactly as they run in the browser, which is what the row is about. `axios-mock-adapter` is
 * not a dependency of this module, and the adapter swap needs no extra package.
 *
 * `window.location` is replaced with a plain object because the current interceptor assigns to
 * `window.location.href`, which jsdom cannot perform (it would log a "Not implemented:
 * navigation" error and drown the real assertion output).
 */
import api from './axios';

const FAULTS_URL = '/faults';
const REFRESH_URL = '/auth/refresh';

/** An axios-shaped rejection carrying a response, so `error.response.status` is readable. */
const httpError = (status, config, data = {}) => {
  const err = new Error(`Request failed with status code ${status}`);
  err.isAxiosError = true;
  err.config = config;
  err.response = {status, data, statusText: 'Error', headers: {}, config};
  return err;
};

const ok = (config, data) =>
  Promise.resolve({data, status: 200, statusText: 'OK', headers: {}, config});

describe('axios auth interceptor', () => {
  let originalAdapter;
  let originalLocation;
  let calls;

  beforeEach(() => {
    originalAdapter = api.defaults.adapter;
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: {href: '/dashboard'},
      writable: true,
      configurable: true,
    });

    localStorage.clear();
    localStorage.setItem('accessToken', 'expired-access-token');
    localStorage.setItem('refreshToken', 'valid-refresh-token');
    localStorage.setItem('user', JSON.stringify({id: 1, role: 'ADMIN'}));

    calls = [];
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    localStorage.clear();
  });

  it('refreshInterceptor_retriesRequest', async () => {
    // ── Steps 1-3: script the transport ─────────────────────────────────────────────────
    //   GET  /faults        -> 401 on the first call, 200 on the retry
    //   POST /auth/refresh  -> 200 with a brand-new access token
    api.defaults.adapter = jest.fn(config => {
      calls.push(`${(config.method || 'get').toUpperCase()} ${config.url}`);

      if (config.url === REFRESH_URL) {
        return ok(config, {
          accessToken: 'fresh-access-token',
          refreshToken: 'fresh-refresh-token',
        });
      }

      if (config.url === FAULTS_URL) {
        const faultsCallCount = calls.filter(c => c.endsWith(FAULTS_URL)).length;
        if (faultsCallCount === 1) {
          return Promise.reject(
            httpError(401, config, {message: 'JWT expired'}),
          );
        }
        return ok(config, [{id: 1, faultNumber: 'FLT-001'}]);
      }

      return Promise.reject(httpError(404, config));
    });

    // ── Step 4: a single caller-level request ───────────────────────────────────────────
    let response;
    let thrown;
    try {
      response = await api.get(FAULTS_URL);
    } catch (e) {
      thrown = e;
    }

    const refreshCalls = calls.filter(c => c.endsWith(REFRESH_URL));
    const faultsCalls = calls.filter(c => c.endsWith(FAULTS_URL));

    // One up-front assertion that prints the whole observed picture (which requests were made,
    // what the caller ended up with, whether it was bounced to /login) rather than failing on a
    // single opaque number.
    expect({
      requestsMade: calls,
      callerSaw: thrown
        ? `rejected: ${thrown.message}`
        : `resolved: ${response && response.status}`,
      accessTokenAfter: localStorage.getItem('accessToken'),
      redirectedTo: window.location.href,
    }).toEqual({
      requestsMade: ['GET /faults', 'POST /auth/refresh', 'GET /faults'],
      callerSaw: 'resolved: 200',
      accessTokenAfter: 'fresh-access-token',
      redirectedTo: '/dashboard',
    });

    // ── Step 5: the interceptor refreshed the token exactly once ────────────────────────
    expect(refreshCalls).toHaveLength(1);

    // ── Step 6: the original request was replayed (original + retry = 2 calls) ──────────
    expect(faultsCalls).toHaveLength(2);

    // ── Expected Result: the caller gets the successful response, not an error ──────────
    expect(response).toBeDefined();
    expect(response.status).toBe(200);
    expect(response.data).toEqual([{id: 1, faultNumber: 'FLT-001'}]);

    // The retry must carry the NEW token, otherwise the refresh accomplished nothing.
    expect(localStorage.getItem('accessToken')).toBe('fresh-access-token');
  });
});
