// KPI-010 (06_KPI_PERFORMANCE, FR-18) — an Admin must be able to export the monthly KPI report
// from the KPI page as an XLSX carrying technicianName, completionRate, overallScore and rank.
//
// Selector adaptation. The row is written against `[data-testid=exportBtn]`. There is not a single
// `data-testid` anywhere in frontend-admin/src, and adding one would be a production-code change,
// so this spec looks for the real control a user would click: an export affordance on the KPI
// page. Same approach as cypress/e2e/payments/exportPayments.cy.js.
//
// `cy.verifyDownload` (the row's assertion) comes from cypress-verify-downloads, which is not a
// dependency here; the download is asserted against Cypress's own `downloadsFolder` with
// `cy.readFile` instead, which needs no new package.
//
// Data. The backend calls are stubbed with cy.intercept (liveMap.cy.js convention) so the spec is
// deterministic: a five-technician monthly leaderboard is seeded, matching the row's precondition.

const entry = (rank, id, name, score, completionRate, completedJobs) => ({
  rank,
  technicianId: id,
  technicianName: name,
  phone: `07712345${id}`,
  avatarInitial: name.charAt(0),
  branchName: 'Colombo Central',
  overallScore: score,
  completionRate,
  satisfactionScore: 4.5,
  completedJobs,
  performanceLevel: score >= 90 ? 'EXCELLENT' : score >= 75 ? 'GOOD' : 'AVERAGE',
  performanceColor: '#2196F3',
  badge: rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '⭐',
  starRating: score >= 90 ? 5 : score >= 75 ? 4 : 3,
  trend: 'STABLE',
  isCurrentUser: false,
});

const LEADERBOARD = [
  entry(1, 5, 'Kasun Perera', 92.4, 96, 24),
  entry(2, 6, 'Nimal Silva',  88.1, 90, 18),
  entry(3, 7, 'Sunil Fernando', 80.5, 82, 15),
  entry(4, 8, 'Ruwan Jayasuriya', 74.2, 70, 12),
  entry(5, 9, 'Amila Bandara', 66.0, 58, 9),
];

describe('KPI-010 — export the KPI report as XLSX', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/users', { statusCode: 200, body: [] }).as('users');
    cy.intercept('GET', '**/api/kpi/leaderboard*', { statusCode: 200, body: LEADERBOARD })
      .as('leaderboard');
    cy.intercept('GET', '**/api/kpi/team*', {
      statusCode: 200,
      body: { branchId: 1, branchName: 'Colombo Central', period: 'MONTHLY', memberKpis: [] },
    }).as('team');

    // Whatever export endpoint the page might call, capture it rather than hitting a real server.
    cy.intercept('POST', '**/api/reports/export/excel', {
      statusCode: 200,
      headers: {
        'content-type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': 'attachment; filename=kpi_report.xlsx',
      },
      body: 'PKstub-xlsx',
    }).as('exportExcel');

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

  it('kpiReportXlsx_downloaded', () => {
    // Step 1
    cy.location('pathname').should('eq', '/kpi');
    cy.contains('KPI Performance').should('be.visible');
    cy.wait('@leaderboard');

    // The data the exported file is supposed to carry is on screen, so the row's precondition
    // really is met before the export is attempted.
    cy.contains('Kasun Perera').should('be.visible');
    cy.contains('Amila Bandara').should('be.visible');

    // Step 2 — the export control, and where this row currently stops.
    //
    // KpiPage.js has no export affordance of any kind: its only header actions are the DAILY /
    // WEEKLY / MONTHLY period selector and the "🎯 Assign Target" button, and the file contains no
    // occurrence of "export", "xlsx", "csv" or "download" outside its `export default`. There is
    // no KPI export on the backend either — ReportController's POST /api/reports/export/excel
    // covers job, fault, payment and attendance reports, none of which carry the rank or
    // overallScore columns this row asks for. KPI data can be read on screen and nowhere else.
    cy.contains(/export/i).should('exist');

    cy.contains(/export/i).click();
    cy.wait('@exportExcel');

    // Steps 3-4 — the file downloaded, and carries the expected columns.
    const downloads = Cypress.config('downloadsFolder');
    cy.readFile(`${downloads}/kpi_report.xlsx`, null, { timeout: 15000 }).should('exist');
  });
});
