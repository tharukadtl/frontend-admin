// Regression coverage for JobsPage.js's JobModal technician-reassignment save path.
//
// Original bug (logged CRITICAL in QA_Compliance_Consolidated_Report.md, cross-referencing
// row #120 / Stage D and the retired Critical #2 / FR-17): JobModal.save() posted the retired
// direct-assignment shape ({technicianId, priority, notes, notifyTechnician, notifyCustomer})
// to POST /api/faults/{job.faultId}/assign. Stage D retired that endpoint's shape in favour of
// Work-Group-scoped assignment; the call now 400s every time. The failure was swallowed by
// `.catch(()=>{})` while "Job updated" was shown unconditionally — a silent false success on a
// live, Admin-reachable action, with zero prior test coverage.
//
// The fix: reassignment now goes through POST /api/jobs/{job.id}/reassign (job.id, not
// job.faultId — the faultId was the structural root cause of the original break), payload
// {newTechnicianId} only, matching TaskListScreen.tsx's (SLTMobileApp, Team Lead) already-working
// production pattern against the same endpoint. The swallowing .catch(()=>{}) is gone: a failed
// reassignment now surfaces a real error toast and leaves the modal open for retry, instead of
// falsely reporting success.
//
// This spec proves the MECHANISM, matching this project's established convention (see
// payments/paymentsPageStaleSelection.cy.js): the exact endpoint and payload actually sent, that
// the retired endpoint is never called, and that success/failure toasts reflect the real network
// outcome rather than being shown unconditionally.
//
// Backend-side correctness (a valid reassignment actually taking effect, a same-day-session
// boundary violation being genuinely rejected, and SUPER_ADMIN no longer getting a 403 on this
// endpoint) is covered live against the real Spring Boot + MySQL stack by
// fieldops/src/test/java/lk/slt/fieldops/controller/JobReassignIntegrationTest.java
// (reassignUpdatesTechnicianAndStatus, reassignToTechnicianOutsideTodaysSession_isRefused,
// reassignBySuperAdmin_notForbidden) — this spec does not re-prove that server-side behaviour,
// only that JobModal now drives it correctly and reports its real outcome.

const JOB_501 = {
  id: 501,
  jobNumber: 'JOB-2026-00501',
  status: 'ASSIGNED',
  priority: 'HIGH',
  faultId: 601,
  createdAt: '2026-08-19T08:00:00',
  updatedAt: '2026-08-19T08:00:00',
  assignedTo: { id: 301, fullName: 'Tech Nimal', phone: '0771234567' },
};

const TECH_301 = { id: 301, fullName: 'Tech Nimal', role: 'TECHNICIAN', phone: '0771234567' };
const TECH_302 = { id: 302, fullName: 'Tech Saman', role: 'TECHNICIAN', phone: '0779876543' };

const seedSession = win => {
  win.localStorage.setItem('accessToken', 'test-access-token');
  win.localStorage.setItem('refreshToken', 'test-refresh-token');
  win.localStorage.setItem(
    'user',
    JSON.stringify({ id: 1, username: 'admin', role: 'ADMIN', fullName: 'Ops Admin' }),
  );
};

describe('JobsPage — JobModal technician reassignment (mechanism)', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/jobs', { statusCode: 200, body: [JOB_501] }).as('jobs');
    cy.intercept('GET', '**/api/users', { statusCode: 200, body: [TECH_301, TECH_302] }).as('users');
    // The retired shape. Must never be hit again — asserted in every test below.
    cy.intercept('POST', '**/api/faults/*/assign', { statusCode: 400 }).as('oldAssign');

    cy.visit('/jobs', { onBeforeLoad: seedSession });
    cy.wait(['@jobs', '@users']);
  });

  it('a successful reassignment hits POST /api/jobs/{id}/reassign with {newTechnicianId} only, and shows a real success toast', () => {
    cy.intercept('POST', '**/api/jobs/501/reassign', {
      statusCode: 200,
      body: { ...JOB_501, assignedTo: TECH_302, status: 'PENDING' },
    }).as('reassign');

    cy.contains('#501').click();
    cy.contains('Job #501').should('be.visible');

    // Scoped to the modal's own select — JobsPage's priority filter dropdown, rendered earlier
    // in the DOM (not a portal), would otherwise be matched by an unscoped `cy.get('select')`.
    cy.contains('div', 'ASSIGN TECHNICIAN').parent().find('select').select('302');
    cy.contains('button', '💾 Save').click();

    cy.wait('@reassign').its('request.body').should('deep.equal', { newTechnicianId: 302 });

    // The old, retired shape must never be called.
    cy.get('@oldAssign.all').should('have.length', 0);

    // Real success, reflecting the genuine 200 — not an unconditional claim.
    cy.contains('✅ Job updated').should('be.visible');

    // onClose() ran: the modal closed and the list was refetched.
    cy.contains('Job #501').should('not.exist');
  });

  it('a rejected reassignment (e.g. a technician outside the caller\'s Work Group / active session) shows a real error, not a false success, and leaves the modal open to retry', () => {
    cy.intercept('POST', '**/api/jobs/501/reassign', {
      statusCode: 400,
      body: { message: "Technician #302 is not in this team's active session today." },
    }).as('reassignRejected');

    cy.contains('#501').click();
    // Scoped to the modal's own select — JobsPage's priority filter dropdown, rendered earlier
    // in the DOM (not a portal), would otherwise be matched by an unscoped `cy.get('select')`.
    cy.contains('div', 'ASSIGN TECHNICIAN').parent().find('select').select('302');
    cy.contains('button', '💾 Save').click();

    cy.wait('@reassignRejected');
    cy.get('@oldAssign.all').should('have.length', 0);

    // The failure must be visible — the old swallowed-catch behaviour always showed
    // "✅ Job updated" here regardless of outcome.
    cy.contains('✅ Job updated').should('not.exist');
    cy.contains('❌').should('be.visible');
    cy.contains('Update failed').should('be.visible');

    // The modal must still be open (onClose() only runs on the success path), so the Admin
    // can correct the technician and retry rather than losing their place.
    cy.contains('Job #501').should('be.visible');
    cy.contains('button', '💾 Save').should('be.visible');
  });

  it('leaving the technician selection unchanged never calls the reassign endpoint at all', () => {
    cy.intercept('PATCH', '**/api/jobs/501/status', {
      statusCode: 200,
      body: { ...JOB_501, status: 'ACCEPTED' },
    }).as('statusUpdate');
    cy.intercept('POST', '**/api/jobs/501/reassign', { statusCode: 200, body: JOB_501 }).as('reassign');

    cy.contains('#501').click();
    // Change only the status, not the technician — Save should be enabled by the status change
    // alone, and must not implicitly reassign.
    cy.contains('button', 'ACCEPTED').click();
    cy.contains('button', '💾 Save').click();

    cy.wait('@statusUpdate');
    cy.wait('@jobs'); // status update success reloads the list via onClose()->load()
    cy.get('@reassign.all').should('have.length', 0);
    cy.get('@oldAssign.all').should('have.length', 0);
  });
});

// Regression coverage for the ASSIGN TECHNICIAN dropdown's candidate list (Minor,
// QA_Compliance_Consolidated_Report.md): JobsPage.js:171 built `techs` as every
// TECHNICIAN/TEAM_LEAD in the system, unfiltered, and passed the same full list into
// JobModal for every job regardless of which OPMC/Work Group the job actually belongs
// to — relying entirely on JobService.reassignJob's backend guard
// (findActiveMemberForTeamLeadToday) to reject an invalid pick after the fact. Fixed by
// resolving the job's own OPMC/Work Group via its Team Lead (job.teamLeadId, looked up in
// the same already-fetched technicians list) and filtering the dropdown to matching
// opmcId + workgroupId before rendering, so an Admin no longer sees an option that would
// fail anyway on save.
//
// Deliberately not a full guarantee, and not claimed as one here: the backend's real
// enforcement is finer than a static OPMC/Work Group match — findActiveMemberForTeamLeadToday
// requires the technician to be a checked-in member of THIS team lead's *today's active
// day-session*, which has no list endpoint the admin portal can query. This filter removes
// the clearly-wrong-org options (a technician in a different OPMC or Work Group entirely);
// it cannot rule out a same-Work-Group technician who simply hasn't checked in today.
describe('JobsPage — JobModal ASSIGN TECHNICIAN dropdown OPMC/Work Group filtering', () => {
  const JOB_701 = {
    id: 701,
    jobNumber: 'JOB-2026-00701',
    status: 'ASSIGNED',
    priority: 'MEDIUM',
    faultId: 801,
    teamLeadId: 900,
    createdAt: '2026-08-26T08:00:00',
    updatedAt: '2026-08-26T08:00:00',
    assignedTo: { id: 910, fullName: 'Tech Own Team', phone: '0771111111' },
  };

  // The job's own Team Lead — present in the users list, same shape /api/users returns
  // (UserDTO: opmcId + workgroupId, not a nested object).
  const TEAM_LEAD_900 = {
    id: 900, fullName: 'TL Own Team', role: 'TEAM_LEAD', phone: '0770000000',
    opmcId: 5, workgroupId: 50,
  };
  // Same OPMC + Work Group as the job's Team Lead — must appear.
  const TECH_SAME_OPMC_WG = {
    id: 910, fullName: 'Tech Own Team', role: 'TECHNICIAN', phone: '0771111111',
    opmcId: 5, workgroupId: 50,
  };
  // Same OPMC, DIFFERENT Work Group — must NOT appear.
  const TECH_SAME_OPMC_DIFF_WG = {
    id: 920, fullName: 'Tech Other WorkGroup', role: 'TECHNICIAN', phone: '0772222222',
    opmcId: 5, workgroupId: 60,
  };
  // Entirely different OPMC — must NOT appear.
  const TECH_DIFF_OPMC = {
    id: 930, fullName: 'Tech Other OPMC', role: 'TECHNICIAN', phone: '0773333333',
    opmcId: 9, workgroupId: 50,
  };

  beforeEach(() => {
    cy.intercept('GET', '**/api/jobs', { statusCode: 200, body: [JOB_701] }).as('jobs');
    cy.intercept('GET', '**/api/users', {
      statusCode: 200,
      body: [TEAM_LEAD_900, TECH_SAME_OPMC_WG, TECH_SAME_OPMC_DIFF_WG, TECH_DIFF_OPMC],
    }).as('users');

    cy.visit('/jobs', { onBeforeLoad: seedSession });
    cy.wait(['@jobs', '@users']);
    cy.contains('#701').click();
    cy.contains('Job #701').should('be.visible');
  });

  it('shows only candidates sharing the job\'s OPMC and Work Group, excluding same-OPMC-different-Work-Group and different-OPMC candidates', () => {
    cy.contains('div', 'ASSIGN TECHNICIAN').parent().find('select').as('techSelect');

    // "— Keep current —" + Tech Own Team (910) + the job's own Team Lead (900, TL Own Team) —
    // the Team Lead trivially matches their own OPMC/Work Group and legitimately stays in the
    // pool, since this fix only adds org-filtering on top of the existing TECHNICIAN-or-
    // TEAM_LEAD role eligibility, not narrows which roles are eligible.
    cy.get('@techSelect').find('option').should('have.length', 3);
    cy.get('@techSelect').contains('option', 'Tech Own Team').should('exist');
    cy.get('@techSelect').contains('option', 'TL Own Team').should('exist');
    cy.get('@techSelect').contains('option', 'Tech Other WorkGroup').should('not.exist');
    cy.get('@techSelect').contains('option', 'Tech Other OPMC').should('not.exist');
  });

  it('the excluded technicians are not merely hidden by CSS — they are absent from the DOM entirely', () => {
    // Guards against a filter implemented as display:none on the option elements rather than
    // actually not rendering them, which would still let a value be programmatically selected.
    cy.contains('div', 'ASSIGN TECHNICIAN').parent().find('select')
      .find('option[value="920"], option[value="930"]').should('not.exist');
  });
});
