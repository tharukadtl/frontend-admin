// Regression coverage for JobsPage.js's missing PENDING status entry (QA_Compliance_Consolidated_Report.md).
//
// Original bug: STATUS (and NEXT) had no PENDING key at all, even though the backend's real
// initial Job status is PENDING (entity/Job.java). Effect, all three confirmed by this spec:
//   1. Pill's `STATUS[status]||STATUS.ASSIGNED` fallback silently rendered a genuinely PENDING
//      job mislabeled "Assigned" (blue pill), not "Pending".
//   2. The status filter-chip row is built from `Object.entries(STATUS)` — with no PENDING key,
//      there was no "Pending" chip to filter by at all.
//   3. JobModal's manual "UPDATE STATUS" buttons come from `NEXT[job.status]||[]` — with no
//      PENDING key in NEXT, a PENDING job showed zero transition options.
//
// Fix: STATUS gained a PENDING entry (its own violet styling, distinct from ASSIGNED's blue —
// not reusing another status's look) and NEXT gained `PENDING: ['ACCEPTED','CANCELLED']`,
// matching JobService.validateJobTransition's real PENDING transitions. ASSIGNED is left in
// place (a separate, deliberately-not-fixed naming question — see #10/#11's DECIDED /
// NOT-A-DEFECT entry: the backend enum itself stays PENDING, by explicit decision).
//
// Matches this project's established convention for this exact page (see jobModalReassign.cy.js
// in the same directory): proves the rendering/wiring MECHANISM against a real running React
// app with intercepted API responses, not a full backend round-trip — there is no backend
// behaviour to prove here, this is a pure frontend map-lookup bug.

const JOB_801_PENDING = {
  id: 801,
  jobNumber: 'JOB-2026-00801',
  status: 'PENDING',
  priority: 'MEDIUM',
  faultId: 901,
  createdAt: '2026-09-01T08:00:00',
  updatedAt: '2026-09-01T08:00:00',
  assignedTo: null,
};

const seedSession = win => {
  win.localStorage.setItem('accessToken', 'test-access-token');
  win.localStorage.setItem('refreshToken', 'test-refresh-token');
  win.localStorage.setItem(
    'user',
    JSON.stringify({ id: 1, username: 'admin', role: 'ADMIN', fullName: 'Ops Admin' }),
  );
};

describe('JobsPage — a real PENDING job (previously mislabeled/unfilterable/unactionable)', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/jobs', { statusCode: 200, body: [JOB_801_PENDING] }).as('jobs');
    cy.intercept('GET', '**/api/users', { statusCode: 200, body: [] }).as('users');

    cy.visit('/jobs', { onBeforeLoad: seedSession });
    cy.wait(['@jobs', '@users']);
  });

  it('renders the real "Pending" pill, not the old mislabeled "Assigned" fallback', () => {
    cy.contains('#801').parents('tr').within(() => {
      cy.contains('Pending').should('be.visible');
      cy.contains('Assigned').should('not.exist');
    });
  });

  it('shows a real "Pending (1)" filter chip, and filtering by it keeps the PENDING job while filtering by any other status hides it', () => {
    cy.contains('button', /^Pending \(1\)$/).should('be.visible');

    cy.contains('button', /^Pending \(1\)$/).click();
    cy.contains('#801').should('be.visible');

    cy.contains('button', /^Completed \(0\)$/).click();
    cy.contains('#801').should('not.exist');
    cy.contains('No jobs found').should('be.visible');
  });

  it('the job detail modal shows the real ACCEPTED/CANCELLED transition options, not zero', () => {
    cy.contains('#801').click();
    cy.contains('Job #801').should('be.visible');

    cy.contains('div', 'UPDATE STATUS').should('be.visible');
    cy.contains('div', 'UPDATE STATUS').parent().within(() => {
      cy.contains('button', 'ACCEPTED').should('be.visible');
      cy.contains('button', 'CANCELLED').should('be.visible');
    });
  });
});
