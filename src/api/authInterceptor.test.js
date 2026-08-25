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

  /**
   * AUTH-013 concurrency guard — several requests 401ing at once must share ONE refresh call,
   * not each fire their own against what becomes an already-rotated token. Three different
   * endpoints are fired concurrently (not the same URL three times) so this can't accidentally
   * pass via some per-URL de-duplication; the guard has to be global across the whole client.
   */
  it('concurrentRequests_shareOneRefreshCall', async () => {
    const USERS_URL = '/users';
    const PAYMENTS_URL = '/payments';
    const urls = [FAULTS_URL, USERS_URL, PAYMENTS_URL];

    api.defaults.adapter = jest.fn(config => {
      calls.push(`${(config.method || 'get').toUpperCase()} ${config.url}`);

      if (config.url === REFRESH_URL) {
        return ok(config, {
          accessToken: 'fresh-access-token',
          refreshToken: 'fresh-refresh-token',
        });
      }

      if (urls.includes(config.url)) {
        const callCountForThisUrl = calls.filter(c => c.endsWith(config.url)).length;
        if (callCountForThisUrl === 1) {
          return Promise.reject(httpError(401, config, {message: 'JWT expired'}));
        }
        return ok(config, {url: config.url});
      }

      return Promise.reject(httpError(404, config));
    });

    // Fire all three concurrently — every one of them hits the 401 branch of the interceptor
    // before any refresh has resolved, so the guard is actually exercised under real overlap,
    // not just three sequential awaits that happen to look concurrent.
    const results = await Promise.allSettled([
      api.get(FAULTS_URL),
      api.get(USERS_URL),
      api.get(PAYMENTS_URL),
    ]);

    const refreshCalls = calls.filter(c => c.endsWith(REFRESH_URL));

    // Exactly one refresh call fired, no matter how many requests 401'd at once.
    expect(refreshCalls).toHaveLength(1);

    // Every one of the three requests resolved (retried successfully), none was forced into
    // forceLogout() by arriving against an already-rotated/consumed refresh token.
    expect(results.map(r => r.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
    results.forEach((r, i) => {
      expect(r.value.status).toBe(200);
      expect(r.value.data).toEqual({url: urls[i]});
    });

    // Each original endpoint was called exactly twice — the initial 401 plus one retry, not
    // more (which would suggest a second refresh cycle) and not fewer (which would suggest a
    // request never got replayed).
    urls.forEach(url => {
      expect(calls.filter(c => c.endsWith(url))).toHaveLength(2);
    });

    // forceLogout() never ran — it clears refreshToken from localStorage and navigates away.
    expect(localStorage.getItem('refreshToken')).toBe('fresh-refresh-token');
    expect(localStorage.getItem('accessToken')).toBe('fresh-access-token');
    expect(window.location.href).toBe('/dashboard');
  });
});
