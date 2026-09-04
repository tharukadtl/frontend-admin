// KPI-009 (06_KPI_PERFORMANCE, FR-18) — an Admin assigns a KPI target from the KPI page, gets a
// confirmation toast, and the target then shows on that technician's profile.
//
// Selector adaptation. The row is written against `[data-testid=assignTargetBtn]`, `techSelect`,
// `targetTitle`, `targetValue`, `saveTargetBtn` and `targetCard`. There is not a single
// `data-testid` anywhere in frontend-admin/src, and adding them would be a production-code change,
// so this spec drives the real controls a user would use on
// frontend-admin/src/pages/KPI/KpiPage.js:
//   assignTargetBtn -> the header's "🎯 Assign Target" button
//   techSelect      -> the "Technician *" <select> in the Assign KPI Target modal
//   targetTitle     -> the "Target Title *" text input
//   targetValue     -> the "Target Value *" number input
//   saveTargetBtn   -> the modal footer's "🎯 Assign Target" submit button. The page header
//                      carries a button with the *same* label, and it comes first in the DOM, so
//                      the submit is reached through its sibling "Cancel" button rather than by
//                      text alone.
//   targetCard      -> the target card in the technician drawer's "Targets" tab
// Same approach as cypress/e2e/faults/liveMap.cy.js and cypress/e2e/payments/exportPayments.cy.js.
//
// One field the row omits is mandatory. The modal's submit button stays disabled until
// technician, title, target value AND due date are all filled (KpiPage.js), and
// KpiDTO.AssignTargetRequest marks dueDate, unit and category @NotNull/@NotBlank, so the spec
// fills a due date too.
//
// Toast text. The row expects "Target assigned"; the page shows "Target assigned successfully",
// which cy.contains matches as a substring.
//
// Data. Every backend call is stubbed with cy.intercept (liveMap.cy.js convention) so the spec is
// deterministic and does not depend on the shared dev database. Note that the POST is stubbed with
// a success response: against the real backend this request cannot succeed at all — see
// KpiIntegrationTest.adminAssignsTarget_returns201Active, which shows the API rejects the portal's
// own body outright (unknown field `isGroupTarget`) and then fails the INSERT on five NOT NULL
// kpi_targets columns the service never populates. This spec covers the portal's side of FR-18;
// the backend gap is covered, and reported, there.

const TECHNICIANS = [
  { id: 5, fullName: 'Kasun Perera', name: 'Kasun Perera', phone: '0771234567', role: 'TECHNICIAN' },
  { id: 6, fullName: 'Nimal Silva',  name: 'Nimal Silva',  phone: '0772234567', role: 'TECHNICIAN' },
];

const LEADERBOARD = [
  {
    rank: 1, technicianId: 5, technicianName: 'Kasun Perera', phone: '0771234567',
    avatarInitial: 'K', branchName: 'Colombo Central', overallScore: 88.4, completionRate: 90,
    satisfactionScore: 4.5, completedJobs: 18, performanceLevel: 'GOOD',
    performanceColor: '#2196F3', badge: '🥇', starRating: 4, trend: 'STABLE',
  },
  {
    rank: 2, technicianId: 6, technicianName: 'Nimal Silva', phone: '0772234567',
    avatarInitial: 'N', branchName: 'Colombo Central', overallScore: 71.2, completionRate: 60,
    satisfactionScore: 4.5, completedJobs: 9, performanceLevel: 'AVERAGE',
    performanceColor: '#FF9800', badge: '🥈', starRating: 3, trend: 'STABLE',
  },
];

const KASUN_KPI = {
  technicianId: 5, technicianName: 'Kasun Perera', phone: '0771234567', avatarInitial: 'K',
  period: 'MONTHLY', startDate: '2026-08-01', endDate: '2026-08-11',
  totalJobs: 20, completedJobs: 18, inProgressJobs: 2, cancelledJobs: 0,
  completionRate: 90, avgJobDurationHours: 2.3, avgResponseTimeMinutes: 22,
  customerSatisfactionScore: 4.5, onTimeCompletionRate: 81, totalRevenue: 145000,
  presentDays: 8, avgWorkingHours: 7.6, attendanceRate: 90,
  overallScore: 88.4, performanceLevel: 'GOOD', performanceColor: '#2196F3', starRating: 4,
  totalTargets: 1, achievedTargets: 0, onTrackTargets: 1, atRiskTargets: 0, behindTargets: 0,
  targets: [],
};

const ASSIGNED_TARGET = {
  id: 77, technicianId: 5, technicianName: 'Kasun Perera',
  title: 'Monthly Rate', description: '',
  targetValue: 90, currentValue: 0, unit: 'jobs', period: 'MONTHLY',
  category: 'JOBS', categoryIcon: '📋', dueDate: '2026-09-30',
  status: 'ON_TRACK', statusIcon: '✅', progressPercent: 0,
  assignedBy: 'Ops Admin', assignedAt: '2026-08-11T10:00:00',
  isGroupTarget: false, branchId: 1, branchName: 'Colombo Central',
};

describe('KPI-009 — admin assigns a KPI target', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/users', { statusCode: 200, body: TECHNICIANS }).as('users');
    cy.intercept('GET', '**/api/kpi/leaderboard*', { statusCode: 200, body: LEADERBOARD })
      .as('leaderboard');
    cy.intercept('GET', '**/api/kpi/score/5*', { statusCode: 200, body: KASUN_KPI }).as('score');

    // Before the target is assigned the technician has none; after the POST the same endpoint
    // returns it. Cypress uses the most recently registered matching intercept, so the "after"
    // stub is registered inside the test.
    cy.intercept('GET', '**/api/kpi/targets/technician/5', { statusCode: 200, body: [] })
      .as('targetsBefore');

    cy.intercept('POST', '**/api/kpi/targets/assign', {
      statusCode: 200,
      body: ASSIGNED_TARGET,
    }).as('assignTarget');

    cy.visit('/kpi', {
      onBeforeLoad(win) {
        win.localStorage.setItem('accessToken', 'test-access-token');
        win.localStorage.setItem('refreshToken', 'test-refresh-token');
        win.localStorage.setItem(
          'user',
          JSON.stringify({ id: 1, username: 'admin', role: 'ADMIN', fullName: 'Ops Admin' }),
        );
      },
    });
  });

  it('adminAssigns_targetCardVisible', () => {
    // Step 1
    cy.location('pathname').should('eq', '/kpi');
    cy.contains('KPI Performance').should('be.visible');
    cy.wait('@leaderboard');

    // Step 2 — open the assign-target modal from the page header.
    cy.contains('button', 'Assign Target').click();
    cy.contains('Assign KPI Target').should('be.visible');

    // Step 3 — pick the technician.
    cy.get('select').first().select('5');

    // Steps 4-5 — title and value. (Plus the mandatory due date the row omits.)
    cy.get('input[placeholder*="Complete 50 jobs"]').type('Monthly Rate');
    cy.get('input[type=number]').type('90');
    cy.get('input[type=date]').type('2026-09-30');

    // Step 6 — submit. Scoped through "Cancel" because the page header carries a button with the
    // identical "🎯 Assign Target" label and appears first in the DOM.
    cy.intercept('GET', '**/api/kpi/targets/technician/5', {
      statusCode: 200,
      body: [ASSIGNED_TARGET],
    }).as('targetsAfter');

    cy.contains('button', 'Cancel')
      .parent()
      .contains('button', 'Assign Target')
      .should('not.be.disabled')
      .click();

    cy.wait('@assignTarget').its('request.body').should(body => {
      expect(body.technicianId).to.eq(5);
      expect(body.title).to.eq('Monthly Rate');
      expect(body.targetValue).to.eq(90);
      expect(body.period).to.eq('MONTHLY');
    });

    // Step 7 — the confirmation toast.
    cy.contains('Target assigned').should('be.visible');

    // Step 8 — the technician's profile now shows the target card.
    cy.contains('Assign KPI Target').should('not.exist');
    cy.contains('td', 'Kasun Perera').click();
    cy.wait('@score');
    cy.wait('@targetsAfter');

    cy.contains('button', 'Targets').click();
    cy.contains('Monthly Rate').should('be.visible');
    cy.contains('0 / 90').should('be.visible');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// KPI-009 (live) — the same flow with NOTHING stubbed, against the real running
// backend. Purpose: the stubbed spec above proves only that the portal renders;
// it forces the POST to succeed, which it cannot do for real. This one logs in
// against the real API, drives the real form, lets the real POST go out, and
// records what the admin actually sees when the backend rejects it.
//
// Requires both servers up:
//   fieldops:       SPRING_PROFILES_ACTIVE=local ./mvnw.cmd -DskipTests spring-boot:run
//   frontend-admin: BROWSER=none npx react-scripts start
// The POST intercept below has NO reply — it is a pass-through spy only, so the
// request reaches localhost:8080 unmodified.
//
// The assertions encode the behaviour a correct portal SHOULD have: a failed
// write must surface a visible error and must NOT show the success toast or
// close the form. If the portal instead reports success, this test goes red on
// that assertion — which is the finding, not a broken test.

const LIVE_TECH_NAME = 'Test Technician'; // users id=11, role TECHNICIAN, seeded in slt_fieldops_db

describe('KPI-009 (live) — admin assigns a KPI target against the real backend', () => {
  let token;

  before(() => {
    cy.request('POST', 'http://localhost:8080/api/auth/login', {
      username: 'superadmin',
      password: 'Admin@2024',
    }).then(res => {
      expect(res.status).to.eq(200);
      token = res.body.accessToken;
    });
  });

  it('adminAssigns_realBackend_surfacesFailure', () => {
    // Spy only — no `reply`, so this passes straight through to the real API.
    cy.intercept('POST', '**/api/kpi/targets/assign').as('assignReal');

    cy.visit('/kpi', {
      onBeforeLoad(win) {
        win.localStorage.setItem('accessToken', token);
        win.localStorage.setItem('refreshToken', 'live-refresh');
        win.localStorage.setItem(
          'user',
          JSON.stringify({ id: 1, username: 'superadmin', role: 'SUPER_ADMIN', fullName: 'Super Admin' }),
        );
      },
    });

    cy.contains('KPI Performance').should('be.visible');

    // Open the real assign-target modal and fill it with realistic data.
    cy.contains('button', 'Assign Target').click();
    cy.contains('Assign KPI Target').should('be.visible');

    cy.get('select').first().find('option').contains(LIVE_TECH_NAME).then($opt => {
      cy.get('select').first().select($opt.val());
    });

    cy.get('input[placeholder*="Complete 50 jobs"]').type('Complete 50 jobs this month');
    cy.get('input[type=number]').type('50');
    cy.get('input[type=date]').type('2026-09-30');

    cy.contains('button', 'Cancel')
      .parent()
      .contains('button', 'Assign Target')
      .should('not.be.disabled')
      .click();

    // Evidence: the real request/response, written out verbatim.
    cy.wait('@assignReal').then(({ request, response }) => {
      cy.writeFile('cypress/evidence/kpi009-live-assign-target.json', {
        requestBody: request.body,
        responseStatus: response && response.statusCode,
        responseBody: response && response.body,
      });
      cy.log(`POST /api/kpi/targets/assign -> ${response && response.statusCode}`);
      cy.log(JSON.stringify(response && response.body));

      // The write really does fail against the live backend.
      expect(response.statusCode, 'real backend rejects the portal payload').to.be.gte(400);
    });

    cy.screenshot('kpi009-live-after-submit', { capture: 'viewport' });

    // What the admin is shown. A failed write must not be reported as a success.
    cy.contains('Target assigned successfully', { timeout: 1000 })
      .should('not.exist');
    cy.contains('Failed to assign target').should('be.visible');

    // …and the form must not close as though the target had been created.
    cy.contains('Assign KPI Target').should('be.visible');

    // Nothing was persisted, so the technician still has no such target.
    cy.request({
      method: 'GET',
      url: 'http://localhost:8080/api/kpi/targets/technician/11',
      headers: { Authorization: `Bearer ${token}` },
      failOnStatusCode: false,
    }).then(res => {
      const titles = Array.isArray(res.body) ? res.body.map(t => t.title) : [];
      expect(titles).to.not.include('Complete 50 jobs this month');
    });
  });
});
