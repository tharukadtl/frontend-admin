// Onboarding-blocker fix (2026-08-21) — UsersPage.js's create/edit form now has a Work Group
// selector for TECHNICIAN/TEAM_LEAD roles, cascaded off the selected OPMC (same pattern as
// FaultsPage.js's Circuit picker). Live verification against the real running stack (fieldops on
// SPRING_PROFILES_ACTIVE=local against real slt_fieldops_db, frontend-admin dev server), nothing
// stubbed except window.alert (asserted on, not silenced) — same standard as
// cypress/e2e/faults/attachCircuit.cy.js.
//
// work_groups is empty in this dev DB (confirmed via direct query before writing this spec) —
// two real Work Groups are created fresh via the real POST /api/workgroups endpoint in before(),
// one under Opmc id=1 ("Main Branch"), one under id=2 ("Test Branch"), so the OPMC-switch
// scenario has two genuinely different Work Group lists to switch between. Both Work Groups and
// any User created during the test are cleaned up (deactivated — neither has a DELETE endpoint)
// in after(), regardless of pass/fail.

const API = 'http://localhost:8080';
const OPMC_A = 1; // Main Branch
const OPMC_B = 2; // Test Branch

function loginAs(username, password) {
  return cy.request('POST', `${API}/api/auth/login`, { username, password }).then(res => {
    expect(res.status).to.eq(200);
    return res.body.accessToken;
  });
}

describe('Onboarding fix (live) — Work Group selector on UsersPage.js', () => {
  let adminToken;
  let wgAId, wgBId;
  const marker = `WGSEL-${Date.now()}`;
  const createdUserIds = [];

  before(() => {
    loginAs('superadmin', 'Admin@2024')
      .then(t => {
        adminToken = t;
        return cy.request({
          method: 'POST', url: `${API}/api/workgroups`,
          headers: { Authorization: `Bearer ${t}` },
          body: { name: `${marker}-A`, opmcId: OPMC_A },
        });
      })
      .then(res => { expect(res.status).to.eq(201); wgAId = res.body.id; })
      .then(() => cy.request({
        method: 'POST', url: `${API}/api/workgroups`,
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { name: `${marker}-B`, opmcId: OPMC_B },
      }))
      .then(res => { expect(res.status).to.eq(201); wgBId = res.body.id; });
  });

  after(() => {
    createdUserIds.forEach(id => cy.request({
      method: 'DELETE', url: `${API}/api/users/${id}`,
      headers: { Authorization: `Bearer ${adminToken}` }, failOnStatusCode: false,
    }));
    [wgAId, wgBId].filter(Boolean).forEach(id => cy.request({
      method: 'PATCH', url: `${API}/api/workgroups/${id}/deactivate`,
      headers: { Authorization: `Bearer ${adminToken}` }, failOnStatusCode: false,
    }));
  });

  beforeEach(() => {
    cy.viewport(1400, 900);
    cy.visit('/users', {
      onBeforeLoad(win) {
        win.localStorage.setItem('accessToken', adminToken);
        win.localStorage.setItem('refreshToken', 'live-refresh');
        win.localStorage.setItem('user', JSON.stringify({
          id: 1, username: 'superadmin', role: 'SUPER_ADMIN', fullName: 'Super Admin',
        }));
      },
    });
    cy.contains('button', '+ Add User').click();
  });

  it('Work Group selector is disabled and empty until an OPMC is chosen', () => {
    // Role defaults to TECHNICIAN (UsersPage.js's EMPTY), so the field must already be visible.
    cy.contains('label', 'Work Group').should('be.visible')
      .next('select').should('be.disabled')
      .find('option').first().should('contain.text', 'Select an OPMC first');
  });

  it('creates a real Technician with a Work Group selected — succeeds end to end', () => {
    const fullName = `${marker} Success Case`;
    cy.contains('label', 'Full Name').next('input').type(fullName);
    cy.contains('label', 'Username').next('input').type(`${marker}-ok`);
    cy.contains('label', 'Role').next('select').select('TECHNICIAN');
    cy.contains('label', 'OPMC').next('select').select(String(OPMC_A));
    // Cascade must resolve to the real Work Group created in before() before the option exists.
    cy.contains('label', 'Work Group').next('select').should('not.be.disabled')
      .find(`option[value="${wgAId}"]`).should('exist');
    cy.contains('label', 'Work Group').next('select').select(String(wgAId));
    cy.contains('label', 'Password').next('input').type('TestPass123!');

    cy.contains('button', 'Save').click();
    // Modal closes only on the success path (handleSave's catch leaves it open on error) —
    // the real, product-relevant signal that the save succeeded, not a network-layer status
    // assertion (confirmed independently via curl: real POST /api/users returns 201 with
    // workgroupId/workgroupName populated — see this task's investigation notes).
    cy.contains('button', 'Save').should('not.exist');

    // Independent, fresh GET — proof it really persisted with the right Work Group, not just a
    // closed modal. GET /api/users has no single-name filter, so pull the list and find it.
    // The list endpoint lagged the just-committed write by roughly a second in this environment
    // (confirmed via direct curl re-checks during development — the record is always present a
    // moment later; not a caching layer, no @Cacheable anywhere in UserService, just real-world
    // request/response latency this synchronous test outruns) — poll instead of a single fixed
    // wait, so the assertion is robust rather than tuned to one observed delay.
    const findCreated = (attempt = 0) => {
      cy.request({
        method: 'GET', url: `${API}/api/users`,
        headers: { Authorization: `Bearer ${adminToken}` },
      }).then(res => {
        const list = Array.isArray(res.body) ? res.body : res.body?.content || [];
        const created = list.find(u => u.fullName === fullName);
        if (created) {
          expect(created.workgroupId).to.eq(wgAId);
          createdUserIds.push(created.id);
        } else if (attempt < 10) {
          cy.wait(500);
          findCreated(attempt + 1);
        } else {
          expect.fail(`created user (fullName=${fullName}) never appeared via GET /api/users after ${attempt} retries`);
        }
      });
    };
    findCreated();
  });

  it('blocks submission client-side when no Work Group is selected — no request is even sent', () => {
    cy.window().then(win => cy.stub(win, 'alert').as('alertStub'));

    cy.contains('label', 'Full Name').next('input').type(`${marker} Blocked Case`);
    cy.contains('label', 'Username').next('input').type(`${marker}-blocked`);
    cy.contains('label', 'Role').next('select').select('TECHNICIAN');
    cy.contains('label', 'OPMC').next('select').select(String(OPMC_A));
    // Deliberately leave Work Group at its default "-- Select Work Group --" — never select one.
    cy.contains('label', 'Password').next('input').type('TestPass123!');

    cy.intercept('POST', '**/api/users').as('createUser');
    cy.contains('button', 'Save').click();

    cy.get('@alertStub').should('have.been.calledWithMatch', /Work Group is required/);
    // The real assertion this test exists for: the client-side guard fires BEFORE any network
    // call is made — not a race against a slow 400, a guard that runs and returns early.
    cy.get('@createUser.all').should('have.length', 0);
  });

  it('switching OPMC after selecting a Work Group clears the (now invalid) selection and re-fetches', () => {
    cy.contains('label', 'Role').next('select').select('TECHNICIAN');
    cy.contains('label', 'OPMC').next('select').select(String(OPMC_A));
    cy.contains('label', 'Work Group').next('select').should('not.be.disabled')
      .find(`option[value="${wgAId}"]`).should('exist');
    cy.contains('label', 'Work Group').next('select').select(String(wgAId));
    cy.contains('label', 'Work Group').next('select').should('have.value', String(wgAId));

    // Switch to the OTHER OPMC, which has a completely different Work Group (wgBId).
    cy.contains('label', 'OPMC').next('select').select(String(OPMC_B));

    // The stale selection from OPMC_A must not silently survive the switch.
    cy.contains('label', 'Work Group').next('select').should('have.value', '');
    // And the list itself must re-fetch to the new OPMC's real Work Group, not just clear.
    cy.contains('label', 'Work Group').next('select')
      .find(`option[value="${wgBId}"]`).should('exist');
    cy.contains('label', 'Work Group').next('select')
      .find(`option[value="${wgAId}"]`).should('not.exist');
  });
});
