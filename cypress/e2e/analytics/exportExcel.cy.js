// ANA-006 (09_ANALYTICS, FR-24) — an Admin exports the Technician Performance report from the
// Reports page as an XLSX carrying technicianName, completedJobs, onTimeRate and overallScore.
//
// UI adaptation, read off src/pages/Reports/ReportsPage.js rather than assumed.
//   "Select 'Technician Performance' report" -> the "Technician Performance" report card. Expanding
//     it fires its own GET (ReportCard's `useEffect(() => { if (expanded) load(); })`).
//   "Set date range"                          -> the page-level DATE RANGE control ("Custom" chip +
//     the two <input type="date"> fields).
//   "click exportExcelBtn"                    -> that card's always-visible "📊 Excel" button.
//
// Filename correction. The row expects `tech_performance.xlsx`. The portal names its downloads
// `slt-<template.id with the first underscore replaced>-<Date.now()>.xlsx`, i.e.
// `slt-technician-performance-<epoch>.xlsx`; the backend's own Content-Disposition
// (`slt-technician-performance-<yyyyMMdd_HHmmss>.xlsx`) is ignored by the client. The spec asserts
// the real pattern.
//
// Column assertion. The row names four DTO-style columns. The exported sheet's real header row is
// built by ReportService.buildTechnicianPerformanceSheet and reads:
//   Technician | Phone | Total Jobs | Completed | Completion % | Avg Duration (hrs) |
//   Response Time (mins) | Satisfaction | On-Time %
// So technicianName -> "Technician", completedJobs -> "Completed", onTimeRate -> "On-Time %" are
// all present under human-readable labels, but there is NO overallScore column and no equivalent:
// ReportResponseDTO.TechnicianPerformanceDTO has no overall/composite score field at all (the
// weighted KPI score lives on the separate /api/kpi surface, which has no export — the already-open
// KPI-010 finding). Because the export response is necessarily stubbed here, the columns are
// asserted where they are actually observable end-to-end without a live backend: on the on-screen
// TECHNICIAN BREAKDOWN table the same DTO feeds, which is the client-side half of the same
// contract. The missing overallScore is asserted explicitly so the gap is recorded rather than
// quietly skipped.
//
// `cy.verifyDownload` is from cypress-verify-downloads, not a dependency here; the download is
// observed with a passive spy on the anchor the page creates (which still performs the real click)
// and then read back off Cypress's own downloadsFolder — the exportKpi.cy.js / exportPayments.cy.js
// precedent, no new package.

const START = '2026-04-01';
const END   = '2026-04-30';

const techRow = (id, name, total, completed, compRate, onTime, satisfaction) => ({
  technicianId: String(id),
  technicianName: name,
  phone: `07712345${id}`,
  branchName: 'Colombo Central',
  totalJobsAssigned: total,
  jobsCompleted: completed,
  jobsInProgress: total - completed,
  jobsCancelled: 0,
  completionRate: compRate,
  avgJobDurationHours: 2.4,
  avgResponseTimeMinutes: 18,
  customerSatisfactionScore: satisfaction,
  onTimeCompletions: Math.round((onTime / 100) * completed),
  onTimeCompletionRate: onTime,
  totalWorkingDays: 20,
  avgJobsPerDay: total / 20,
});

const PERFORMANCE = {
  reportType: 'TECHNICIAN_PERFORMANCE',
  reportTitle: 'Technician Performance Report',
  period: 'CUSTOM',
  startDate: START,
  endDate: END,
  generatedAt: new Date().toISOString().slice(0, 19),
  totalRecords: 3,
  data: [
    techRow(5, 'Nimal Perera', 30, 28, 93.3, 91.0, 4.7),
    techRow(6, 'Kamal Silva', 22, 17, 77.3, 80.0, 4.2),
    techRow(7, 'Sunil Fernando', 18, 11, 61.1, 66.0, 3.9),
  ],
};

/** Records every download the page triggers, without preventing it. */
function spyOnDownloads(win) {
  win.__downloads = [];
  const create = win.document.createElement.bind(win.document);
  win.document.createElement = function (tag, ...rest) {
    const el = create(tag, ...rest);
    if (String(tag).toLowerCase() === 'a') {
      const click = el.click.bind(el);
      el.click = function () {
        win.__downloads.push({ name: el.download, href: el.href });
        return click();
      };
    }
    return el;
  };
}

describe('ANA-006 — export the Technician Performance report as XLSX', () => {
  beforeEach(() => {
    // Declared FIRST on purpose — Cypress matches the most recently registered intercept, so the
    // specific route below must come after this catch-all or the alias never sees its request.
    cy.intercept('GET', '**/api/reports/**', { statusCode: 200, body: { data: [] } });

    cy.intercept('GET', '**/api/reports/technician-performance*', {
      statusCode: 200,
      body: PERFORMANCE,
    }).as('techPerformance');

    cy.intercept('POST', '**/api/reports/export/excel', {
      statusCode: 200,
      headers: {
        'content-type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition':
          'attachment; filename="slt-technician-performance-20260401_090000.xlsx"',
      },
      body: 'PKstub-xlsx',
    }).as('exportExcel');

    cy.visit('/reports', {
      onBeforeLoad(win) {
        win.localStorage.setItem('accessToken', 'test-access-token');
        win.localStorage.setItem('refreshToken', 'test-refresh-token');
        win.localStorage.setItem(
          'user',
          JSON.stringify({ id: 1, username: 'admin', role: 'ADMIN', fullName: 'Ops Admin' }),
        );
        spyOnDownloads(win);
      },
    });
  });

  it('techPerformance_xlsxDownloaded', () => {
    // Step 1
    cy.location('pathname').should('eq', '/reports');
    cy.contains('Technician Performance').should('be.visible');

    // Step 3 — the date range.
    cy.contains('button', 'Custom').click();
    cy.get('input[type=date]').eq(0).clear().type(START);
    cy.get('input[type=date]').eq(1).clear().type(END);

    // Step 2 — select (and thereby generate) the report.
    cy.contains('Technician Performance').click();
    cy.wait('@techPerformance').its('request.url')
      .should('include', `startDate=${START}`)
      .and('include', `endDate=${END}`);

    // Step 4 — export as Excel.
    cy.contains('Technician Performance').parent().parent()
      .contains('button', 'Excel').click();

    cy.wait('@exportExcel').then(({ request }) => {
      expect(request.body.reportType).to.eq('TECHNICIAN_PERFORMANCE');
      expect(request.body.format).to.eq('EXCEL');
      expect(request.body.period).to.eq('CUSTOM');
      expect(request.body.startDate).to.eq(START);
      expect(request.body.endDate).to.eq(END);
    });

    // Step 5 — the file downloaded.
    cy.contains('exported as EXCEL', { timeout: 30000 }).should('be.visible');

    cy.window({ timeout: 30000 }).its('__downloads').should('have.length', 1);
    cy.window().its('__downloads').then((downloads) => {
      const name = downloads[0].name;
      expect(name, 'the downloaded filename')
        .to.match(/^slt-technician-performance-\d+\.xlsx$/);

      const folder = Cypress.config('downloadsFolder');
      cy.readFile(`${folder}/${name}`, null, { timeout: 30000 }).should('exist');
    });

    // Step 6 — the columns the row requires, asserted on the breakdown table fed by the very DTO
    // the XLSX is built from (the export response must be stubbed here, so this is where the
    // column contract is observable end to end without a live backend).
    cy.contains('TECHNICIAN BREAKDOWN').should('be.visible');
    cy.contains('th', 'Technician').should('exist');   // technicianName
    cy.contains('th', 'Completed').should('exist');    // completedJobs
    cy.contains('th', 'On-Time %').should('exist');    // onTimeRate
    cy.contains('td', 'Nimal Perera').should('be.visible');

    // overallScore — the one column the row names that does not exist anywhere. There is no
    // overall/composite score field on ReportResponseDTO.TechnicianPerformanceDTO, none on the
    // exported sheet's header row (Technician | Phone | Total Jobs | Completed | Completion % |
    // Avg Duration (hrs) | Response Time (mins) | Satisfaction | On-Time %, built by
    // ReportService.buildTechnicianPerformanceSheet), and none on this table. The weighted KPI
    // score lives only on the /api/kpi surface, which has no export at all (open KPI-010 finding).
    cy.get('table').first().within(() => {
      cy.contains('th', /overall/i).should('exist');
    });
  });
});
