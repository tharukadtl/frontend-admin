// AUTH-014 (01_AUTH_ACCESS, FR-2) -- logged as "genuinely never-written, no substitute exists
// anywhere" in the 2026-09-02 completeness recount. Investigated before writing: ProtectedRoute
// (src/components/ProtectedRoute.js) genuinely enforces this -- `roles && !roles.includes(user.role)`
// redirects to /unauthorized (UnauthorizedPage.js, real "Access Denied" heading + message) -- real,
// working, just never had a test. The row's cited `[data-testid=accessDeniedMsg]` and the second
// route `/payments/approve` don't exist; adapted to the real DOM (cy.contains) and the real route
// (/payments -- there is no /payments/approve sub-route, confirmed directly against App.js).
//
// `/users` and `/payments` both require SUPER_ADMIN/ADMIN (App.js:84-93) -- a CLIENT token must be
// redirected off both.

const seedSession = (win, role) => {
  win.localStorage.setItem('accessToken', 'test-access-token');
  win.localStorage.setItem('refreshToken', 'test-refresh-token');
  win.localStorage.setItem(
    'user',
    JSON.stringify({ id: 99, username: 'client99', role, fullName: 'Test Client' }),
  );
};

describe('Admin portal RBAC -- a CLIENT token cannot reach Admin-only routes', () => {
  it('redirects off /users and shows Access Denied', () => {
    cy.visit('/users', { onBeforeLoad: (win) => seedSession(win, 'CLIENT') });

    cy.location('pathname').should('not.include', '/users');
    cy.location('pathname').should('eq', '/unauthorized');
    cy.contains('Access Denied').should('be.visible');
  });

  it('redirects off /payments too, not just /users', () => {
    cy.visit('/payments', { onBeforeLoad: (win) => seedSession(win, 'CLIENT') });

    cy.location('pathname').should('not.include', '/payments');
    cy.location('pathname').should('eq', '/unauthorized');
    cy.contains('Access Denied').should('be.visible');
  });

  it('an ADMIN token, by contrast, reaches /users normally -- the guard is role-specific, not a blanket block', () => {
    cy.intercept('GET', '**/api/users*', { statusCode: 200, body: [] }).as('users');
    cy.visit('/users', { onBeforeLoad: (win) => seedSession(win, 'ADMIN') });

    cy.location('pathname').should('eq', '/users');
    cy.contains('Access Denied').should('not.exist');
  });
});
