// Stage 2 (QA_Compliance_Consolidated_Report.md causeId resolution) — Admin classifies the real
// cause of a Fault via the cascading TypeOfFault -> CauseCategory -> CauseOfFault picker on
// FaultDetailModal's new "🔍 Cause" tab, using the Technician's Stage-1 free-text causeOfFault as
// the real diagnostic input shown at the top of the tab. Live verification against the real
// running stack (fieldops, real MySQL, frontend-admin dev server), nothing stubbed — same standard
// as cypress/e2e/faults/attachCircuit.cy.js, this spec's direct template.
//
// 2026-09-03, CI-portability fix. Originally asserted against the real imported master-data
// hierarchy (TypeOfFault "DR" -> CauseCategory "BQ" -> CauseOfFault "BAUH",
// REAL_CAUSE_OF_FAULT_DB_ID = 706) -- a hardcoded dependency on the real
// TYPEOFFAULT.csv/CAUSECATEGORY.csv/CAUSEOFFAULT.csv import a fresh Testcontainers database has
// no CI-portable path to reproduce. Investigated before rewriting, same finding as
// attachCircuit.cy.js's identical fix: nothing this spec asserts needs the real codes. Unlike the
// Circuit hierarchy, though, CauseHierarchyController is read-only by design (confirmed — no
// create endpoints exist for TypeOfFault/CauseCategory/CauseOfFault at all, the same reason
// fieldops's own H1b/H1c/Stage2 backend tests had to persist this hierarchy directly via JPA
// rather than through a controller), so this spec's fixture chain is seeded via
// seed_live_fixtures.py's `seed-cause` (raw SQL, short generated codes) rather than the real API.
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
  let causeId, causeCode, causeCategoryCode, typeCode;

  before(() => {
    cy.task('seedAdmin');

    cy.task('seedFaultWithCause', TECH_FINDING).then(stdout => {
      const grab = re => {
        const m = stdout.match(re);
        expect(m, `seed script output: ${stdout}`).to.not.be.null;
        return m[1].trim();
      };
      faultId = Number(grab(/FAULT_ID=(\d+)/));
      uniqueMarker = grab(/MARKER=(.+)/);
      causeId = Number(grab(/CAUSE_ID=(\d+)/));
      causeCode = grab(/CAUSE_CODE=(.+)/);
      causeCategoryCode = grab(/CAUSE_CATEGORY_CODE=(.+)/);
      typeCode = grab(/TYPE_CODE=(.+)/);
    });

    loginAs('superadmin', 'Admin@2024').then(t => { adminToken = t; });
  });

  after(() => {
    if (faultId) {
      cy.task('deleteFault', faultId);
    }
    // The seeded TypeOfFault/CauseCategory/CauseOfFault chain is deliberately left in place --
    // cheap, harmless, uniquely-coded per run, same reasoning as attachCircuit.cy.js's fixture
    // Opmc/Exchange/Cab/Dp/Circuit chain.
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

    // ── Cascade: TypeOfFault -> CauseCategory -> CauseOfFault, real endpoints, the fixture
    //    chain this spec's before() hook just created ──────────────────────────────────────────
    cy.intercept('GET', '**/api/cause-categories?typeOfFaultId=*').as('getCategories');
    selectFor('FAULT TYPE *').find('option').contains(typeCode).then($opt => {
      selectFor('FAULT TYPE *').select($opt.val());
    });
    cy.wait('@getCategories');

    cy.intercept('GET', '**/api/cause-of-faults?causeCategoryId=*').as('getCauses');
    selectFor('CAUSE CATEGORY *').find('option').contains(causeCategoryCode).then($opt => {
      selectFor('CAUSE CATEGORY *').select($opt.val());
    });
    cy.wait('@getCauses');

    selectFor('CAUSE OF FAULT *').find('option').contains(causeCode).then($opt => {
      selectFor('CAUSE OF FAULT *').select($opt.val());
    });

    // ── Submit -- spy only, the real PATCH goes out ─────────────────────────────────────────
    cy.intercept('PATCH', '**/api/faults/*/cause').as('attachCause');
    cy.contains('button', 'Classify Cause').should('not.be.disabled').click();

    cy.wait('@attachCause').then(({request, response}) => {
      expect(request.body).to.deep.equal({causeId});
      expect(response.statusCode).to.eq(200);
      expect(response.body.causeId).to.eq(causeId);
      expect(response.body.causeCode).to.eq(causeCode);
    });

    cy.contains('Cause classified for fault').should('be.visible');

    // ── Proof: a fresh, independent GET after the UI closes -- not the toast, not the app's
    // own re-render ─────────────────────────────────────────────────────────────────────────
    cy.request({
      method: 'GET',
      url: `${API}/api/faults/${faultId}`,
      headers: {Authorization: `Bearer ${adminToken}`},
    }).then(res => {
      expect(res.body.causeId, 'persisted causeId, via a fresh GET').to.eq(causeId);
      expect(res.body.causeCode, 'persisted causeCode, via a fresh GET').to.eq(causeCode);
    });

    // Reopen the fault and confirm the "currently classified" summary now renders it.
    cy.reload();
    cy.get('input[placeholder*="Search faults"]').type(uniqueMarker);
    cy.contains(uniqueMarker).should('be.visible').click();
    cy.contains('button', 'Cause').click();
    cy.contains('Currently classified:').should('be.visible');
    cy.contains(`Cause ${causeCode}`).should('be.visible');
  });
});
