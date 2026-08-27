// Stage 2 (QA_Compliance_Consolidated_Report.md causeId resolution) — Admin classifies the real
// cause of a Fault via the cascading TypeOfFault -> CauseCategory -> CauseOfFault picker on
// FaultDetailModal's new "🔍 Cause" tab, using the Technician's Stage-1 free-text causeOfFault as
// the real diagnostic input shown at the top of the tab. Live verification against the real
// running stack (fieldops on SPRING_PROFILES_ACTIVE=local against real slt_fieldops_db,
// frontend-admin dev server), nothing stubbed — same standard as
// cypress/e2e/faults/attachCircuit.cy.js, this spec's direct template.
//
// Real hierarchy used throughout (confirmed live against the real imported master data,
// docs/master-data/TYPEOFFAULT.csv/CAUSECATEGORY.csv/CAUSEOFFAULT.csv):
// TypeOfFault "DR" (DIALLING RESPONSE, id 1) -> CauseCategory "BQ" (20-MANAGED
// DEVICES/APPLICATIONS, id 4) -> CauseOfFault "BAUH" (201-PABX SYSTEM, real db id 706).
const REAL_CAUSE_OF_FAULT_DB_ID = 706; // cause_of_fault.id for code "BAUH"

// Test fault is created fresh, per run, by cypress/support/seed_h1c_fault.py (via the
// seedFaultWithCause task, --cause-of-fault) — same reasoning as attachCircuit.cy.js: a real
// POST /api/faults needs CLIENT/OTP auth this spec can't drive from a browser context. This seed
// also sets faults.cause_of_fault, so the Cause tab has a real Technician finding to render.
const TECH_FINDING = 'Customer reports intermittent dial tone, checked rosette wiring looks loose';

const API = 'http://localhost:8080';

function loginAs(username, password) {
  return cy.request('POST', `${API}/api/auth/login`, {username, password})
    .then(res => {
      expect(res.status).to.eq(200);
      return res.body.accessToken;
    });
}

describe('Stage 2 (live) — Admin classifies a real Cause on a Fault', () => {
  let adminToken;
  let faultId;
  let uniqueMarker;

  before(() => {
    cy.task('seedFaultWithCause', TECH_FINDING).then(stdout => {
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
    if (faultId) {
      cy.task('deleteH1cFault', faultId);
    }
  });

  it('shows the Technician\'s free-text finding, cascades the hierarchy, and persists the real classification', () => {
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

    cy.get('input[placeholder*="Search faults"]').type(uniqueMarker);
    cy.contains(uniqueMarker).should('be.visible').click();

    cy.intercept('GET', '**/api/type-of-faults').as('getTypes');

    cy.contains('button', 'Cause').click();
    cy.contains('Classify the real cause of this fault').should('be.visible');
    cy.wait('@getTypes').its('response.statusCode').should('eq', 200);

    // ── The Technician's Stage-1 free-text finding must render prominently, real value ────────
    cy.contains('WHAT THE TECHNICIAN FOUND').should('be.visible');
    cy.contains(TECH_FINDING).should('be.visible');

    // No cause classified yet -- the "currently classified" summary must not render.
    cy.contains('Currently classified:').should('not.exist');

    const selectFor = label => cy.contains('label', label).parent().find('select');

    // ── Cascade: TypeOfFault -> CauseCategory -> CauseOfFault, real endpoints, real data ──────
    cy.intercept('GET', '**/api/cause-categories?typeOfFaultId=*').as('getCategories');
    selectFor('FAULT TYPE *').find('option').contains(/^DR —/).then($opt => {
      selectFor('FAULT TYPE *').select($opt.val());
    });
    cy.wait('@getCategories');

    cy.intercept('GET', '**/api/cause-of-faults?causeCategoryId=*').as('getCauses');
    selectFor('CAUSE CATEGORY *').find('option').contains(/^BQ —/).then($opt => {
      selectFor('CAUSE CATEGORY *').select($opt.val());
    });
    cy.wait('@getCauses');

    selectFor('CAUSE OF FAULT *').find('option').contains(/^BAUH —/).then($opt => {
      selectFor('CAUSE OF FAULT *').select($opt.val());
    });

    // ── Submit -- spy only, the real PATCH goes out ─────────────────────────────────────────
    cy.intercept('PATCH', '**/api/faults/*/cause').as('attachCause');
    cy.contains('button', 'Classify Cause').should('not.be.disabled').click();

    cy.wait('@attachCause').then(({request, response}) => {
      expect(request.body).to.deep.equal({causeId: REAL_CAUSE_OF_FAULT_DB_ID});
      expect(response.statusCode).to.eq(200);
      expect(response.body.causeId).to.eq(REAL_CAUSE_OF_FAULT_DB_ID);
      expect(response.body.causeCode).to.eq('BAUH');
    });

    cy.contains('Cause classified for fault').should('be.visible');

    // ── Proof: a fresh, independent GET after the UI closes -- not the toast, not the app's
    // own re-render ─────────────────────────────────────────────────────────────────────────
    cy.request({
      method: 'GET',
      url: `${API}/api/faults/${faultId}`,
      headers: {Authorization: `Bearer ${adminToken}`},
    }).then(res => {
      expect(res.body.causeId, 'persisted causeId, via a fresh GET').to.eq(REAL_CAUSE_OF_FAULT_DB_ID);
      expect(res.body.causeCode, 'persisted causeCode, via a fresh GET').to.eq('BAUH');
    });

    // Reopen the fault and confirm the "currently classified" summary now renders it.
    cy.reload();
    cy.get('input[placeholder*="Search faults"]').type(uniqueMarker);
    cy.contains(uniqueMarker).should('be.visible').click();
    cy.contains('button', 'Cause').click();
    cy.contains('Currently classified:').should('be.visible');
    cy.contains('Cause BAUH').should('be.visible');
  });
});
