// Smoke test: proves the Cypress setup actually drives a real browser against the
// real dev server, not just that config parses. Login is unauthenticated and has
// stable, unambiguous text/labels, so it needs no test IDs and no backend mocking.
describe('Login page smoke test', () => {
  it('loads and renders the login form', () => {
    cy.visit('/login');

    cy.contains('h1', 'SLT Field Operations').should('be.visible');
    cy.contains('Admin Portal').should('be.visible');

    cy.contains('label', 'Username')
      .parent()
      .find('input[type="text"]')
      .should('be.visible');

    cy.contains('label', 'Password')
      .parent()
      .find('input[type="password"]')
      .should('be.visible');

    cy.get('button[type="submit"]').should('contain.text', 'Sign In').and('be.enabled');
  });

  it('redirects the bare root to /login when unauthenticated', () => {
    cy.visit('/');
    cy.location('pathname').should('eq', '/login');
  });
});
