// AUTH-015 (01_AUTH_ACCESS, FR-3) -- logged as "genuinely never-written, no substitute exists
// anywhere" in the 2026-09-02 completeness recount. Investigated before writing: AuthContext.logout
// (src/context/AuthContext.js:38-47) genuinely calls `localStorage.clear()` in its `finally` block --
// real, working, just never had a test. The row's cited two-step "avatar button, then a logout menu
// item" doesn't exist; the real Sidebar (src/components/Sidebar.js:222-243) is a single "Logout"
// button with no menu, confirmed by direct read -- adapted to the real DOM. There is also no
// `authAPI.logout()` network mock convention established yet in this directory, so it's intercepted
// here to keep the spec from depending on a real backend, matching this project's own established
// Cypress convention (cy.intercept over live network calls).

const seedSession = (win) => {
  win.localStorage.setItem('accessToken', 'test-access-token');
  win.localStorage.setItem('refreshToken', 'test-refresh-token');
  win.localStorage.setItem(
    'user',
    JSON.stringify({ id: 1, username: 'admin', role: 'ADMIN', fullName: 'Ops Admin' }),
  );
};

describe('Logout -- tokens cleared, redirected, protected routes re-guarded', () => {
  it('clears localStorage tokens, redirects to /login, and re-guards a protected route', () => {
    cy.intercept('POST', '**/auth/logout', { statusCode: 200, body: {} }).as('logout');
    cy.intercept('GET', '**/api/users*', { statusCode: 200, body: [] }).as('users');

    cy.visit('/users', { onBeforeLoad: seedSession });
    cy.location('pathname').should('eq', '/users');

    cy.contains('button', 'Logout').click();

    cy.location('pathname').should('eq', '/login');
    cy.window().then((win) => {
      expect(win.localStorage.getItem('accessToken')).to.be.null;
      expect(win.localStorage.getItem('refreshToken')).to.be.null;
      expect(win.localStorage.getItem('user')).to.be.null;
    });

    // A protected route must re-redirect now that the session is genuinely gone.
    cy.visit('/dashboard');
    cy.location('pathname').should('eq', '/login');
  });
});
