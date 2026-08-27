// H1c — Admin attaches a Circuit to a Fault via the cascading Opmc -> Exchange -> Cab -> Dp ->
// Circuit picker on FaultDetailModal's new "🔗 Circuit" tab. Live verification against the real
// running stack (fieldops on SPRING_PROFILES_ACTIVE=local against real slt_fieldops_db,
// frontend-admin dev server), nothing stubbed — same standard as
// cypress/e2e/opmcs/provinceDropdown.cy.js and cypress/e2e/kpi/assignTarget.cy.js's live spec.
//
// Real hierarchy used throughout (confirmed during H1a/H1b/H1c work against the actual imported
// master data): Opmc HBOP (Hambanthota) -> Exchange BL (Beliatta) -> Cab BL-UPW-0309 -> Dp U009
// -> Circuit code "24473". The same chain the H1a spot-check exercised, so this spec proves the
// UI on top of an already-known-correct data path rather than gambling on an untested one.
//
// circuits.code ("24473", from the original CIRCUIT.csv's CIRCUITID column) and circuits.id (the
// surrogate DB primary key the app actually submits as circuitId) are two different numbers that
// happen to both look like plausible circuit identifiers -- confirmed directly against the DB
// while writing this spec (code "24473" -> real id 1) rather than assumed equal.
const REAL_CIRCUIT_DB_ID = 1; // circuits.id for code "24473", confirmed via direct query
//
// Test fault is created fresh, per run, by cypress/support/seed_h1c_fault.py -- a real fault
// creation via the app's own POST /api/faults would require real CLIENT auth, which in this
// codebase is OTP-based (confirmed against SLTMobileApp/__tests__/clientLogin.e2e.test.tsx), not
// a simple password login this spec can drive from a browser context. Its id is used for an
// independent, fresh GET after the UI attach — proof the attach really persisted, not just that
// the UI shows a success toast.

const API = 'http://localhost:8080';

function loginAs(username, password) {
  return cy.request('POST', `${API}/api/auth/login`, {username, password})
    .then(res => {
      expect(res.status).to.eq(200);
      return res.body.accessToken;
    });
}

describe('H1c (live) — Admin attaches a real Circuit to a Fault', () => {
  let adminToken;
  let faultId;
  let uniqueMarker;

  before(() => {
    cy.task('seedH1cFault').then(stdout => {
      const idMatch = stdout.match(/FAULT_ID=(\d+)/);
      const markerMatch = stdout.match(/MARKER=(.+)/);
      expect(idMatch, `seed script output: ${stdout}`).to.not.be.null;
      expect(markerMatch, `seed script output: ${stdout}`).to.not.be.null;
      faultId = Number(idMatch[1]);
      uniqueMarker = markerMatch[1].trim();
    });

    loginAs('superadmin', 'Admin@2024').then(t => { adminToken = t; });
  });

  after(() => {
    // faults has no DELETE endpoint at all (confirmed during the H1c investigation) -- clean up
    // the same way it was seeded, so this spec doesn't leave a test row behind on every run.
    if (faultId) {
      cy.task('deleteH1cFault', faultId);
    }
  });

  it('cascades Opmc -> Exchange -> Cab -> Dp -> Circuit and persists the real attach', () => {
    // The default 1000px viewport collapses the faults table's Description column to 0 width
    // (discovered running this spec, not assumed) -- wide enough to keep it real content-visible.
    cy.viewport(1600, 900);
    cy.visit('/faults', {
      onBeforeLoad(win) {
        win.localStorage.setItem('accessToken', adminToken);
        win.localStorage.setItem('refreshToken', 'live-refresh');
        win.localStorage.setItem(
          'user',
          JSON.stringify({id: 1, username: 'superadmin', role: 'SUPER_ADMIN', fullName: 'Super Admin'}),
        );
      },
    });

    // Find the seeded fault by its unique description and open its detail modal.
    cy.get('input[placeholder*="Search faults"]').type(uniqueMarker);
    cy.contains(uniqueMarker).should('be.visible').click();

    // Registered before the tab click so it catches the Opmc fetch that click triggers.
    cy.intercept('GET', '**/api/opmcs?status=ACTIVE').as('getOpmcs');

    // Open the new Circuit tab.
    cy.contains('button', 'Circuit').click();
    cy.contains('Attach the specific Exchange').should('be.visible');
    cy.wait('@getOpmcs').its('response.statusCode').should('eq', 200);

    // No circuit attached yet -- the "currently attached" summary must not render.
    cy.contains('Currently attached:').should('not.exist');

    // Scoped by label, not cy.get('select').eq(N): the faults LIST page's own "All Priority" /
    // "All Categories" filter <select>s stay in the DOM behind the modal overlay, so a bare
    // cy.get('select') matches 7 elements, not the 5 in the Circuit tab -- discovered running
    // this spec (index 0 was actually the page's Priority filter), not assumed.
    const selectFor = label => cy.contains('label', label).parent().find('select');

    // ── Cascade: Opmc -> Exchange -> Cab -> Dp -> Circuit, real endpoints, real data ────────
    cy.intercept('GET', '**/api/exchanges?opmcId=*').as('getExchanges');
    selectFor('OPMC *').find('option').contains('HBOP').then($opt => {
      selectFor('OPMC *').select($opt.val());
    });
    cy.wait('@getExchanges');

    cy.intercept('GET', '**/api/cabs?exchangeId=*').as('getCabs');
    selectFor('EXCHANGE *').find('option').contains(/^BL —/).then($opt => {
      selectFor('EXCHANGE *').select($opt.val());
    });
    cy.wait('@getCabs');

    cy.intercept('GET', '**/api/dps?cabId=*').as('getDps');
    selectFor('CAB *').find('option').contains('BL-UPW-0309').then($opt => {
      selectFor('CAB *').select($opt.val());
    });
    cy.wait('@getDps');

    cy.intercept('GET', '**/api/circuits?dpId=*').as('getCircuits');
    selectFor('DP *').find('option').contains('U009').then($opt => {
      selectFor('DP *').select($opt.val());
    });
    cy.wait('@getCircuits');

    selectFor('CIRCUIT *').find('option').contains('24473').then($opt => {
      selectFor('CIRCUIT *').select($opt.val());
    });

    // ── Submit -- spy only, the real PATCH goes out ─────────────────────────────────────────
    cy.intercept('PATCH', '**/api/faults/*/circuit').as('attachCircuit');
    cy.contains('button', 'Attach Circuit').should('not.be.disabled').click();

    cy.wait('@attachCircuit').then(({request, response}) => {
      expect(request.body).to.deep.equal({circuitId: REAL_CIRCUIT_DB_ID});
      expect(response.statusCode).to.eq(200);
      expect(response.body.circuitId).to.eq(REAL_CIRCUIT_DB_ID);
      expect(response.body.circuitCode).to.eq('24473');
    });

    cy.contains('Circuit attached to fault').should('be.visible');

    // ── Proof: a fresh, independent GET after the UI closes -- not the toast, not the app's
    // own re-render ─────────────────────────────────────────────────────────────────────────
    cy.request({
      method: 'GET',
      url: `${API}/api/faults/${faultId}`,
      headers: {Authorization: `Bearer ${adminToken}`},
    }).then(res => {
      expect(res.body.circuitId, 'persisted circuitId, via a fresh GET').to.eq(REAL_CIRCUIT_DB_ID);
      expect(res.body.circuitCode, 'persisted circuitCode, via a fresh GET').to.eq('24473');
    });

    // Reopen the fault and confirm the "currently attached" summary now renders it.
    cy.reload();
    cy.get('input[placeholder*="Search faults"]').type(uniqueMarker);
    cy.contains(uniqueMarker).should('be.visible').click();
    cy.contains('button', 'Circuit').click();
    cy.contains('Currently attached:').should('be.visible');
    cy.contains('Circuit 24473').should('be.visible');
  });
});
