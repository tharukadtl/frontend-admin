// H1c — Admin attaches a Circuit to a Fault via the cascading Opmc -> Exchange -> Cab -> Dp ->
// Circuit picker on FaultDetailModal's new "🔗 Circuit" tab. Live verification against the real
// running stack (fieldops, real MySQL -- a Testcontainers instance in CI, the real local dev DB
// otherwise -- frontend-admin dev server), nothing stubbed — same standard as
// cypress/e2e/opmcs/provinceDropdown.cy.js and cypress/e2e/kpi/assignTarget.cy.js's live spec.
//
// 2026-09-03, CI-portability fix. Originally asserted against the real imported master-data
// hierarchy (Opmc HBOP -> Exchange BL -> Cab BL-UPW-0309 -> Dp U009 -> Circuit "24473",
// REAL_CIRCUIT_DB_ID = 1) -- a hardcoded dependency on the real 349,180-row CIRCUIT.csv import
// that a fresh Testcontainers database has no CI-portable path to reproduce. Investigated before
// rewriting: nothing this spec actually asserts (the cascading picker mechanism, the real PATCH
// persisting, a fresh independent GET confirming it) needs the codes to be real, imported master
// data rather than a fresh fixture chain -- the exact same finding as fieldops's own H1b/H1c/
// Stage2 backend fixture-id fix earlier this session. Every level of the Opmc->Exchange->Cab->Dp->
// Circuit chain has a real, admin-authenticated POST endpoint (confirmed: CreateExchangeRequest/
// CreateCabRequest/CreateDpRequest/CreateCircuitRequest are simple name/code+parent-id DTOs), so
// this spec now seeds its own chain directly via cy.request in before() -- no fixture CSV, no
// Python/SQL, no dependency on any real import ever having run.

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
  let opmc, exchange, cab, dp, circuit;

  before(() => {
    // Bootstrap admin (idempotent -- safe even if another spec already did this in the same run).
    cy.task('seedAdmin');

    loginAs('superadmin', 'Admin@2024').then(token => {
      adminToken = token;
      const authHeaders = {Authorization: `Bearer ${adminToken}`};
      const n = Date.now();

      // ── Seed a fresh Opmc -> Exchange -> Cab -> Dp -> Circuit chain via the real API ────────
      // Real endpoints, real writes -- exactly what a real Admin does when onboarding new
      // infrastructure, just automated. Unique codes per run so repeated CI runs never collide.
      return cy.request({
        method: 'POST', url: `${API}/api/opmcs`, headers: authHeaders,
        body: {name: `CI Test OPMC ${n}`, code: `CIO${n}`.slice(0, 10), address: '123 Test Road'},
      }).then(res => {
        expect(res.status).to.eq(201);
        opmc = res.body;

        return cy.request({
          method: 'POST', url: `${API}/api/exchanges`, headers: authHeaders,
          body: {name: `CI Test Exchange ${n}`, code: `CIEX${n}`.slice(0, 20), opmcId: opmc.id},
        });
      }).then(res => {
        expect(res.status).to.eq(201);
        exchange = res.body;

        return cy.request({
          method: 'POST', url: `${API}/api/cabs`, headers: authHeaders,
          body: {name: `CI Test Cab ${n}`, code: `CICAB${n}`.slice(0, 20), exchangeId: exchange.id},
        });
      }).then(res => {
        expect(res.status).to.eq(201);
        cab = res.body;

        return cy.request({
          method: 'POST', url: `${API}/api/dps`, headers: authHeaders,
          body: {name: `CI Test Dp ${n}`, code: `CIDP${n}`.slice(0, 20), cabId: cab.id},
        });
      }).then(res => {
        expect(res.status).to.eq(201);
        dp = res.body;

        return cy.request({
          method: 'POST', url: `${API}/api/circuits`, headers: authHeaders,
          body: {code: `CICIRC${n}`.slice(0, 30), dpId: dp.id},
        });
      }).then(res => {
        expect(res.status).to.eq(201);
        circuit = res.body;
      });
    });

    // Test fault is created fresh, per run, by seed_live_fixtures.py -- a real fault creation
    // via the app's own POST /api/faults would require real CLIENT auth, which in this codebase
    // is OTP-based (confirmed against SLTMobileApp/__tests__/clientLogin.e2e.test.tsx), not a
    // simple password login this spec can drive from a browser context.
    cy.task('seedFault').then(stdout => {
      const idMatch = stdout.match(/FAULT_ID=(\d+)/);
      const markerMatch = stdout.match(/MARKER=(.+)/);
      expect(idMatch, `seed script output: ${stdout}`).to.not.be.null;
      expect(markerMatch, `seed script output: ${stdout}`).to.not.be.null;
      faultId = Number(idMatch[1]);
      uniqueMarker = markerMatch[1].trim();
    });
  });

  after(() => {
    // faults has no DELETE endpoint at all (confirmed during the H1c investigation) -- clean up
    // the same way it was seeded, so this spec doesn't leave a test row behind on every run. The
    // fixture Opmc/Exchange/Cab/Dp/Circuit chain is deliberately left in place -- cheap, harmless,
    // uniquely-coded per run, and nothing in fieldops enumerates "all Opmcs" in a way a few extra
    // test rows would break.
    if (faultId) {
      cy.task('deleteFault', faultId);
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

    // ── Cascade: Opmc -> Exchange -> Cab -> Dp -> Circuit, real endpoints, the fixture chain
    //    this spec just created ──────────────────────────────────────────────────────────────
    cy.intercept('GET', '**/api/exchanges?opmcId=*').as('getExchanges');
    selectFor('OPMC *').find('option').contains(opmc.code).then($opt => {
      selectFor('OPMC *').select($opt.val());
    });
    cy.wait('@getExchanges');

    cy.intercept('GET', '**/api/cabs?exchangeId=*').as('getCabs');
    selectFor('EXCHANGE *').find('option').contains(exchange.code).then($opt => {
      selectFor('EXCHANGE *').select($opt.val());
    });
    cy.wait('@getCabs');

    cy.intercept('GET', '**/api/dps?cabId=*').as('getDps');
    selectFor('CAB *').find('option').contains(cab.code).then($opt => {
      selectFor('CAB *').select($opt.val());
    });
    cy.wait('@getDps');

    cy.intercept('GET', '**/api/circuits?dpId=*').as('getCircuits');
    selectFor('DP *').find('option').contains(dp.code).then($opt => {
      selectFor('DP *').select($opt.val());
    });
    cy.wait('@getCircuits');

    selectFor('CIRCUIT *').find('option').contains(circuit.code).then($opt => {
      selectFor('CIRCUIT *').select($opt.val());
    });

    // ── Submit -- spy only, the real PATCH goes out ─────────────────────────────────────────
    cy.intercept('PATCH', '**/api/faults/*/circuit').as('attachCircuit');
    cy.contains('button', 'Attach Circuit').should('not.be.disabled').click();

    cy.wait('@attachCircuit').then(({request, response}) => {
      expect(request.body).to.deep.equal({circuitId: circuit.id});
      expect(response.statusCode).to.eq(200);
      expect(response.body.circuitId).to.eq(circuit.id);
      expect(response.body.circuitCode).to.eq(circuit.code);
    });

    cy.contains('Circuit attached to fault').should('be.visible');

    // ── Proof: a fresh, independent GET after the UI closes -- not the toast, not the app's
    // own re-render ─────────────────────────────────────────────────────────────────────────
    cy.request({
      method: 'GET',
      url: `${API}/api/faults/${faultId}`,
      headers: {Authorization: `Bearer ${adminToken}`},
    }).then(res => {
      expect(res.body.circuitId, 'persisted circuitId, via a fresh GET').to.eq(circuit.id);
      expect(res.body.circuitCode, 'persisted circuitCode, via a fresh GET').to.eq(circuit.code);
    });

    // Reopen the fault and confirm the "currently attached" summary now renders it.
    cy.reload();
    cy.get('input[placeholder*="Search faults"]').type(uniqueMarker);
    cy.contains(uniqueMarker).should('be.visible').click();
    cy.contains('button', 'Circuit').click();
    cy.contains('Currently attached:').should('be.visible');
    cy.contains(`Circuit ${circuit.code}`).should('be.visible');
  });
});
