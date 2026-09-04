// OPMC Province dropdown — live verification against the real backend.
//
// Context: OpmcsPage.js's Add/Edit OPMC form used to send a free-text "Region" field into
// OpmcService.mapRequestToEntity's Province fallback parsing (Opmc.Province.valueOf() on
// normalized text) — unparseable input (including the field's own former placeholder text,
// "Western Province") silently saved the OPMC with province=NULL and no error shown. Fixed
// 2026-08-20 by replacing the free-text field with a controlled <select> of the 9 real
// Opmc.Province values, submitted as `province` (see QA_Compliance_Consolidated_Report.md,
// "Live Admin create/edit path checked for the same bug class" entry).
//
// That fix was verified by a clean `npm run build` and code inspection only, with an explicit
// note that no browser tool was available to click through it live. This spec closes that gap:
// it drives the real running app against the real running backend (SPRING_PROFILES_ACTIVE=local,
// slt_fieldops_db), with NOTHING stubbed — the POST/PUT go out for real — and confirms via a
// separate, fresh `cy.request` GET (independent of whatever the UI re-renders) that the exact
// enum value selected in the dropdown is what actually landed in `opmcs.province`. Same standard
// as cypress/e2e/kpi/assignTarget.cy.js's "(live)" spec.
//
// Test data uses unique CYT- prefixed codes. `after` calls the real DELETE endpoint on each —
// discovered while writing this spec that `DELETE /api/opmcs/{id}` does NOT hard-delete; it sets
// status=INACTIVE ("OPMCs are not permanently deleted to preserve historical data", per its own
// response body). So this cleanup step deactivates the 5 test rows rather than removing them from
// the 65-row opmcs table (62 real OPMC.csv rows + 3 pre-existing dev rows, documented elsewhere in
// the QA report) — they stay present but excluded from getAllActive()/active-only views. A prior
// run of this spec's leftover rows were purged with a direct SQL DELETE outside the app, once,
// after this was discovered; re-running the spec again will accumulate more INACTIVE CYT- rows
// the same way unless it does the same. Not fixed here — it's a real, separate, pre-existing
// backend behavior (shared with every other OpmcController DELETE caller), not something this
// spec's fix touches.
//
// OPMC create/update is SUPER_ADMIN-only (OpmcController, resolved 2026-08-19) — logs in as
// superadmin, matching assignTarget.cy.js's live spec.

const API = 'http://localhost:8080';

// A spread of real provinces, not just one — covers a WESTERN-family value (the most common
// case in the real data), a NORTH_CENTRAL/NORTH_WESTERN pair (the two provinces the Opmc-layer
// text-match got backwards for ADOP/PROP, see the QA report), and UVA (a province with a single,
// unambiguous source HPCODE) — a spread wide enough that a systematic off-by-one in the <option>
// list (e.g. value/label pairs shifted against each other) would show up as a mismatch somewhere
// in the set, not just happen to hit a coincidentally-correct value.
const CASES = [
  { code: 'CYT-W01', label: 'Western',        value: 'WESTERN' },
  { code: 'CYT-NC1', label: 'North Central',   value: 'NORTH_CENTRAL' },
  { code: 'CYT-NW1', label: 'North Western',   value: 'NORTH_WESTERN' },
  { code: 'CYT-UV1', label: 'Uva',             value: 'UVA' },
];

const createdCodes = [];

function loginAndGetToken() {
  return cy.request('POST', `${API}/api/auth/login`, {
    username: 'superadmin',
    password: 'Admin@2024',
  }).then(res => {
    expect(res.status).to.eq(200);
    return res.body.accessToken;
  });
}

function fetchOpmcByCode(token, code) {
  // A fresh, independent GET — not the app's own post-save refetch — hitting the real API
  // directly, matching what "confirm via a fresh GET" means: proof outside the UI's own state.
  return cy.request({
    method: 'GET',
    url: `${API}/api/opmcs`,
    headers: { Authorization: `Bearer ${token}` },
  }).then(res => {
    const all = Array.isArray(res.body) ? res.body : res.body?.content || [];
    return all.find(o => o.code === code);
  });
}

describe('OPMC Province dropdown (live) — selecting a province actually persists it', () => {
  let token;

  before(() => {
    loginAndGetToken().then(t => { token = t; });
  });

  after(() => {
    // Cleanup: delete every OPMC this spec created, real DELETE against the real backend.
    createdCodes.forEach(code => {
      fetchOpmcByCode(token, code).then(opmc => {
        if (opmc) {
          cy.request({
            method: 'DELETE',
            url: `${API}/api/opmcs/${opmc.id}`,
            headers: { Authorization: `Bearer ${token}` },
            failOnStatusCode: false,
          });
        }
      });
    });
  });

  beforeEach(() => {
    cy.visit('/opmcs', {
      onBeforeLoad(win) {
        win.localStorage.setItem('accessToken', token);
        win.localStorage.setItem('refreshToken', 'live-refresh');
        win.localStorage.setItem(
          'user',
          JSON.stringify({ id: 1, username: 'superadmin', role: 'SUPER_ADMIN', fullName: 'Super Admin' }),
        );
      },
    });
    cy.contains('h1', 'OPMCs').should('be.visible');
  });

  CASES.forEach(({ code, label, value }) => {
    it(`create_selectsProvince_${value}_persistsRealEnumValue`, () => {
      createdCodes.push(code);

      // Spy only — no `reply` — the real POST goes to the real backend.
      cy.intercept('POST', '**/api/opmcs').as('createOpmc');

      cy.contains('button', 'Add OPMC').click();
      cy.contains('Add New OPMC').should('be.visible');

      cy.get('input[placeholder="e.g. Colombo North"]').type(`Cypress Test ${value}`);
      cy.get('input[placeholder="e.g. COL-N"]').type(code);

      // The dropdown itself — select by real enum token, exactly what a user picking the
      // human-readable label produces (the <option>'s value is the enum token, its visible
      // text is the label).
      cy.get('select').should('contain.text', label);
      cy.get('select').select(value);
      cy.get('select').should('have.value', value);

      cy.contains('button', 'Create').should('not.be.disabled').click();

      cy.wait('@createOpmc').then(({ response }) => {
        expect(response.statusCode, `POST /api/opmcs for ${code}`).to.be.oneOf([200, 201]);
      });

      // The toast + modal-closed are the UI's own claim of success.
      cy.contains('OPMC created').should('be.visible');
      cy.contains('Add New OPMC').should('not.exist');

      // The actual proof: an independent, freshly-issued GET — not the toast, not the page's own
      // post-save state — confirming the exact enum value landed in the database.
      fetchOpmcByCode(token, code).then(opmc => {
        expect(opmc, `${code} must exist after creation`).to.exist;
        expect(opmc.province, `${code}'s persisted province`).to.eq(value);
      });
    });
  });

  it('edit_changesProvince_newValueOverwritesOldOneInTheDatabase', () => {
    const code = 'CYT-EDT1';
    createdCodes.push(code);

    // Seed directly via a real POST (not through the UI) so this test is only about the edit
    // path, not re-proving create.
    cy.request({
      method: 'POST',
      url: `${API}/api/opmcs`,
      body: { name: 'Cypress Edit Seed', code, province: 'SOUTHERN' },
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => expect(res.status).to.be.oneOf([200, 201]));

    cy.reload();
    cy.contains('h1', 'OPMCs').should('be.visible');
    cy.contains('Cypress Edit Seed').should('be.visible');

    fetchOpmcByCode(token, code).then(before => {
      expect(before.province, 'seeded province, confirmed before editing').to.eq('SOUTHERN');
    });

    cy.intercept('PUT', '**/api/opmcs/*').as('updateOpmc');

    cy.contains('div', 'Cypress Edit Seed')
      .parents('[class="opmc-card"]')
      .contains('button', 'Edit')
      .click();

    // Avoids depending on exact em-dash encoding in "Edit — {name}" — the Save button (vs.
    // Create) is the unambiguous signal that the edit modal, not the create one, is open.
    cy.contains('button', 'Save').should('be.visible');
    cy.get('select').should('have.value', 'SOUTHERN');
    cy.get('select').select('SABARAGAMUWA');
    cy.get('select').should('have.value', 'SABARAGAMUWA');

    cy.contains('button', 'Save').should('not.be.disabled').click();

    cy.wait('@updateOpmc').then(({ response }) => {
      expect(response.statusCode, `PUT /api/opmcs/${code}`).to.eq(200);
    });

    cy.contains('OPMC updated').should('be.visible');

    fetchOpmcByCode(token, code).then(after => {
      expect(after.province, `${code}'s province after the edit, via a fresh GET`).to.eq('SABARAGAMUWA');
    });
  });
});
