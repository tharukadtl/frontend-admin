// Critical #2 (QA_Compliance_Consolidated_Report.md) — Work Group management UI, live against the
// real running stack (fieldops on SPRING_PROFILES_ACTIVE=local against real slt_fieldops_db,
// frontend-admin dev server), nothing stubbed. Same standard as
// cypress/e2e/opmcs/provinceDropdown.cy.js and cypress/e2e/users/workGroupSelector.cy.js: every
// create/update/activate/deactivate goes out for real, and every claim is independently confirmed
// via a fresh cy.request GET, not the UI's own re-render.
//
// 2026-09-04, CI-portability fix. Originally hardcoded OPMC_ID = 1 / the real imported OPMC named
// "Main Branch" -- a fresh Testcontainers database has no such row, and (discovered running this
// spec against one for the first time) even a coincidental id=1 isn't safe to assume: when this
// spec runs after attachCircuit.cy.js in the same CI session, attachCircuit's own dynamic-seeding
// before() hook already consumes id=1 for its own randomly-coded Opmc. Same fix as attachCircuit/
// attachCause: seed a real Opmc via the real POST /api/opmcs endpoint in this spec's own before(),
// and reference its actual id/name throughout instead of a hardcoded real-data assumption.

const API = 'http://localhost:8080';

const marker = `WGM-${Date.now()}`;
const createdWorkGroupIds = [];
const createdUserIds = [];
// Set once, in before(), from the real Opmc this spec seeds for itself -- see the file-header note.
let seededOpmcId;

function loginAs(username, password) {
  return cy.request('POST', `${API}/api/auth/login`, { username, password }).then(res => {
    expect(res.status).to.eq(200);
    return res.body.accessToken;
  });
}

function createUser(token, overrides) {
  const n = Cypress._.uniqueId();
  return cy.request({
    method: 'POST', url: `${API}/api/users`,
    headers: { Authorization: `Bearer ${token}` },
    body: {
      username: `${marker}-${n}`, password: 'TestPass123!',
      fullName: `${marker} ${overrides.role} ${n}`,
      role: overrides.role, opmcId: seededOpmcId,
      ...overrides,
    },
  }).then(res => {
    expect(res.status).to.eq(201);
    createdUserIds.push(res.body.id);
    return res.body;
  });
}

function createWorkGroup(token, body) {
  return cy.request({
    method: 'POST', url: `${API}/api/workgroups`,
    headers: { Authorization: `Bearer ${token}` },
    body,
  }).then(res => {
    expect(res.status).to.eq(201);
    createdWorkGroupIds.push(res.body.id);
    return res.body;
  });
}

function fetchWorkGroup(token, id) {
  return cy.request({
    method: 'GET', url: `${API}/api/workgroups/${id}`,
    headers: { Authorization: `Bearer ${token}` },
  }).then(res => res.body);
}

function fetchUser(token, id) {
  return cy.request({
    method: 'GET', url: `${API}/api/users/${id}`,
    headers: { Authorization: `Bearer ${token}` },
  }).then(res => res.body);
}

describe('Work Group management (live) — Critical #2', () => {
  let token;
  let opmcId;
  let opmcName;
  // POST /api/users hard-requires workgroupId for TECHNICIAN/TEAM_LEAD (UserService.createUser —
  // "Work group is required for TECHNICIAN/TEAM_LEAD users") and PUT can only ever SET it, never
  // clear it (confirmed directly in the design pass) — so a fixture user can never start with no
  // Work Group at all. This holding Work Group only satisfies that creation requirement; it is
  // unrelated to WHO a user is later free to lead (User.workgroupId, membership) vs WHO already
  // leads a different Work Group (WorkGroup.teamLeadId, leadership) — two separate relationships.
  let seedWgId;
  // A technician the "Add from another Work Group" flow moves in — starts in seedWg, not
  // unassigned (impossible to seed unassigned, per the note above).
  let candidateTechId;
  // A Team Lead used only by the "already leads another Work Group" scenario.
  let raceTeamLeadId;

  before(() => {
    loginAs('superadmin', 'Admin@2024').then(t => {
      token = t;
      opmcName = `CI Test OPMC ${marker}`;
      return cy.request({
        method: 'POST', url: `${API}/api/opmcs`,
        headers: { Authorization: `Bearer ${token}` },
        body: { name: opmcName, code: `WGM${Date.now()}`.slice(0, 10), address: '123 Test Road' },
      });
    }).then(res => {
      expect(res.status).to.eq(201);
      opmcId = res.body.id;
      seededOpmcId = opmcId;
      return createWorkGroup(token, { name: `${marker}-seed`, opmcId });
    }).then(wg => {
      seedWgId = wg.id;
      return createUser(token, { role: 'TECHNICIAN', workgroupId: seedWgId });
    }).then(u => { candidateTechId = u.id; })
      .then(() => createUser(token, { role: 'TEAM_LEAD', workgroupId: seedWgId }))
      .then(u => { raceTeamLeadId = u.id; });
  });

  after(() => {
    createdUserIds.forEach(id => cy.request({
      method: 'DELETE', url: `${API}/api/users/${id}`,
      headers: { Authorization: `Bearer ${token}` }, failOnStatusCode: false,
    }));
    createdWorkGroupIds.forEach(id => cy.request({
      method: 'PATCH', url: `${API}/api/workgroups/${id}/deactivate`,
      headers: { Authorization: `Bearer ${token}` }, failOnStatusCode: false,
    }));
  });

  beforeEach(() => {
    cy.viewport(1400, 950);
  });

  function visitPage(query = '') {
    cy.visit(`/work-groups${query}`, {
      onBeforeLoad(win) {
        win.localStorage.setItem('accessToken', token);
        win.localStorage.setItem('refreshToken', 'live-refresh');
        win.localStorage.setItem('user', JSON.stringify({
          id: 1, username: 'superadmin', role: 'SUPER_ADMIN', fullName: 'Super Admin',
        }));
      },
    });
    cy.contains('h1', 'Work Groups').should('be.visible');
  }

  it('creates a real Work Group with no Team Lead, end to end', () => {
    visitPage();
    const name = `${marker}-plain`;

    cy.contains('button', '➕ Add Work Group').click();
    cy.contains('Add New Work Group').should('be.visible');
    cy.get('input[placeholder="e.g. North Colombo Field Team"]').type(name);
    cy.get('.wg-modal').find('select').eq(0).select(opmcName);

    cy.intercept('POST', '**/api/workgroups').as('createWg');
    cy.contains('button', '➕ Create').should('not.be.disabled').click();
    cy.wait('@createWg').then(({ response }) => {
      expect(response.statusCode).to.eq(201);
      createdWorkGroupIds.push(response.body.id);
    });

    cy.contains('Work Group created').should('be.visible');
    cy.contains('Add New Work Group').should('not.exist');
    cy.contains(name).should('be.visible');
  });

  it('assigns a Team Lead on create, persisted for real', () => {
    visitPage();
    const name = `${marker}-withtl`;

    cy.contains('button', '➕ Add Work Group').click();
    cy.get('input[placeholder="e.g. North Colombo Field Team"]').type(name);
    cy.get('.wg-modal').find('select').eq(0).select(opmcName);

    // The Team Lead select is the second <select> in the modal and must have loaded our
    // fresh unassigned Team Lead as a real option once the OPMC is picked.
    cy.get('.wg-modal').find('select').eq(1).should('not.be.disabled')
      .find('option').should('have.length.greaterThan', 1);
    cy.get('.wg-modal').find('select').eq(1).then($sel => {
      const opt = [...$sel[0].options].find(o => o.value === String(raceTeamLeadId));
      expect(opt, 'the seeded Team Lead must appear as a selectable option').to.exist;
    });
    cy.get('.wg-modal').find('select').eq(1).select(String(raceTeamLeadId));

    cy.intercept('POST', '**/api/workgroups').as('createWg');
    cy.contains('button', '➕ Create').click();
    cy.wait('@createWg').then(({ response }) => {
      expect(response.statusCode).to.eq(201);
      createdWorkGroupIds.push(response.body.id);
      fetchWorkGroup(token, response.body.id).then(wg => {
        expect(wg.teamLeadId).to.eq(raceTeamLeadId);
      });
    });
    cy.contains('Work Group created').should('be.visible');
  });

  it('shows the REAL backend message — not "Save failed" — when the picked Team Lead already leads another Work Group', () => {
    // A fresh Team Lead, unassigned at the moment the modal loads its candidate list, so the
    // client-side pre-filter genuinely offers them (proving the filter is a nicety, not the
    // real guard).
    createUser(token, { role: 'TEAM_LEAD', workgroupId: seedWgId }).then(freshLead => {
      visitPage();
      cy.contains('button', '➕ Add Work Group').click();
      cy.get('input[placeholder="e.g. North Colombo Field Team"]').type(`${marker}-conflict`);
      cy.get('.wg-modal').find('select').eq(0).select(opmcName);
      cy.get('.wg-modal').find('select').eq(1).should('not.be.disabled')
        .find(`option[value="${freshLead.id}"]`).should('exist');
      cy.get('.wg-modal').find('select').eq(1).select(String(freshLead.id));

      // While the modal is still open with freshLead selected, a real conflicting assignment
      // is created directly against the backend — the same race a second concurrent Admin
      // action would cause. The modal's own already-fetched dropdown has no way to know this
      // happened; submission still proceeds with the now-stale selection.
      createWorkGroup(token, { name: `${marker}-holder`, opmcId, teamLeadId: freshLead.id });

      cy.contains('button', '➕ Create').click();

      // The real ConflictException message, verbatim — not the generic fallback.
      cy.contains(`User ${freshLead.id} already leads another Work Group.`).should('be.visible');
      cy.contains('Save failed').should('not.exist');
      // And the modal must stay open on failure (same convention as OpmcsPage.js's OpmcModal).
      cy.contains('Add New Work Group').should('be.visible');
    });
  });

  it('moves a technician between two real Work Groups via the roster panel', () => {
    createWorkGroup(token, { name: `${marker}-src`, opmcId }).then(src =>
      createWorkGroup(token, { name: `${marker}-dst`, opmcId }).then(dst =>
        createUser(token, { role: 'TECHNICIAN', workgroupId: src.id }).then(tech => {
          visitPage();
          // Narrow the grid to this test's own card first — the dev DB already carries many
          // real/leftover Work Groups, and searching avoids depending on a card buried deep in
          // a long, tall grid being scrolled into a position where its sticky detail panel is
          // still guaranteed on-screen.
          cy.get('input[placeholder="Search by name, OPMC, Team Lead…"]').type(src.name);
          cy.contains(src.name).parents('.wg-card').contains('button', '👥 Roster').click();
          cy.contains(tech.fullName).should('be.visible');

          cy.intercept('PUT', `**/api/users/${tech.id}`).as('moveTech');
          cy.contains(tech.fullName).parent().parent()
            .find('select').select(String(dst.id));
          cy.wait('@moveTech').then(({ response }) => {
            expect(response.statusCode).to.eq(200);
          });
          cy.contains('Technician moved').should('be.visible');

          fetchUser(token, tech.id).then(u => {
            expect(u.workgroupId).to.eq(dst.id);
          });
        })
      )
    );
  });

  it('adds a technician from a different Work Group via the roster panel\'s "Add" candidate list', () => {
    // candidateTechId starts in seedWgId (see the before() note — a technician can never be
    // seeded with no Work Group at all), so this proves the "Add" list correctly surfaces a
    // technician who belongs to a DIFFERENT real Work Group in the same OPMC, not just an
    // unassigned one — the harder, more realistic case.
    createWorkGroup(token, { name: `${marker}-addtarget`, opmcId }).then(wg => {
      visitPage();
      cy.contains(wg.name).parents('.wg-card').contains('button', '👥 Roster').click();
      cy.contains('button', '➕ Add a Technician').click();

      fetchUser(token, candidateTechId).then(before => {
        expect(before.workgroupId, 'precondition: candidate starts in the seed Work Group').to.eq(seedWgId);
        cy.contains(before.fullName).should('be.visible')
          .parent().contains('div', 'currently in another Work Group').should('be.visible');

        cy.intercept('PUT', `**/api/users/${candidateTechId}`).as('addTech');
        cy.contains(before.fullName).parent().parent().contains('button', '＋ Add').click();
      });
      cy.wait('@addTech').then(({ response }) => {
        expect(response.statusCode).to.eq(200);
      });
      cy.contains('Technician moved').should('be.visible');

      fetchUser(token, candidateTechId).then(u => {
        expect(u.workgroupId).to.eq(wg.id);
      });
    });
  });

  it('deactivates then reactivates a real Work Group from the roster panel', () => {
    createWorkGroup(token, { name: `${marker}-toggle`, opmcId }).then(wg => {
      visitPage();
      cy.contains(wg.name).parents('.wg-card').contains('button', '👥 Roster').click();

      cy.intercept('PATCH', `**/api/workgroups/${wg.id}/deactivate`).as('deactivate');
      cy.contains('button', '⏸ Deactivate Work Group').click();
      cy.wait('@deactivate').its('response.statusCode').should('eq', 200);
      cy.contains('Work Group deactivated').should('be.visible');
      cy.contains('INACTIVE').should('be.visible');
      fetchWorkGroup(token, wg.id).then(w => expect(w.isActive).to.eq(false));

      cy.intercept('PATCH', `**/api/workgroups/${wg.id}/activate`).as('activate');
      cy.contains('button', '▶ Activate Work Group').click();
      cy.wait('@activate').its('response.statusCode').should('eq', 200);
      cy.contains('Work Group activated').should('be.visible');
      fetchWorkGroup(token, wg.id).then(w => expect(w.isActive).to.eq(true));
    });
  });

  it('the ?opmcId= deep-link from OpmcsPage.js pre-filters the OPMC dropdown', () => {
    visitPage(`?opmcId=${opmcId}`);
    cy.get('select').first().should('have.value', String(opmcId));
  });

  it('OpmcsPage.js links to this page\'s OPMC-scoped view', () => {
    cy.visit('/opmcs', {
      onBeforeLoad(win) {
        win.localStorage.setItem('accessToken', token);
        win.localStorage.setItem('refreshToken', 'live-refresh');
        win.localStorage.setItem('user', JSON.stringify({
          id: 1, username: 'superadmin', role: 'SUPER_ADMIN', fullName: 'Super Admin',
        }));
      },
    });
    cy.contains('h1', 'OPMCs').should('be.visible');
    cy.contains('div', opmcName).parents('.opmc-card').contains('button', '👥 Team').click();
    cy.contains('button', '🧭 Work Groups').click();
    cy.url().should('include', `/work-groups?opmcId=${opmcId}`);
    cy.contains('h1', 'Work Groups').should('be.visible');
  });
});
