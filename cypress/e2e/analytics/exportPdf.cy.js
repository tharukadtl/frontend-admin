// ANA-005 (09_ANALYTICS, FR-24) — an Admin generates the Fault Summary report for April 2026 from
// the Reports page and exports it as a PDF, which downloads inside 30s.
//
// UI adaptation, read off src/pages/Reports/ReportsPage.js rather than assumed.
//   "Select report type 'Fault Summary'" -> the page renders one card per report template; the
//     spec'd REP-01 report is the "Daily Fault Summary" card. Expanding it is the selection.
//   "Set date range April 2026"          -> the page-level DATE RANGE control: the "Custom" preset
//     chip, then the two <input type="date"> From/To fields.
//   "click generateBtn"                  -> there is no generate button. Expanding a card fires its
//     own GET immediately (ReportCard's `useEffect(() => { if (expanded) load(); })`), so expanding
//     the card IS generating the report. Asserted by waiting on the real request.
//   "click exportPdfBtn"                 -> the card's always-visible "📄 PDF" button.
//
// Filename correction. The row expects `fault_summary_2026-04.pdf`. The portal names its downloads
// `slt-<template.id with the FIRST underscore replaced>-<Date.now()>.pdf`, i.e.
// `slt-daily-fault_summary-<epoch>.pdf` — `template.id.replace('_','-')` replaces only the first
// occurrence, so the second underscore survives. The backend independently names its own attachment
// `slt-daily-fault-summary-<yyyyMMdd_HHmmss>.pdf` via ReportController.buildFilename, and the portal
// ignores that Content-Disposition entirely. The spec asserts the real client-side pattern and
// records the discrepancy here rather than asserting a name that cannot occur.
//
// `cy.verifyDownload` (the row's assertion) comes from cypress-verify-downloads, which is not a
// dependency here, and the filename carries a `Date.now()` stamp that cannot be predicted from
// outside. The download is therefore observed two ways: a passive spy on the anchor the page
// creates (which still performs the real click, so the browser really downloads), giving the exact
// filename; and then `cy.readFile` against Cypress's own downloadsFolder to prove the bytes landed
// on disk. This needs no new package — the exportKpi.cy.js / exportPayments.cy.js precedent.
//
// Data is stubbed with cy.intercept so the spec is deterministic and needs no live backend.

const APRIL_START = '2026-04-01';
const APRIL_END   = '2026-04-30';

const SUMMARY = {
  reportType: 'DAILY_FAULT_SUMMARY',
  reportTitle: 'Daily Fault Summary Report',
  period: 'CUSTOM',
  startDate: APRIL_START,
  endDate: APRIL_END,
  generatedAt: new Date().toISOString().slice(0, 19),
  totalRecords: 42,
  data: {
    totalFaults: 42,
    byCategory: [
      { category: 'INTERNET', count: 20, percentage: 47.6 },
      { category: 'FIBER', count: 14, percentage: 33.3 },
      { category: 'TV', count: 8, percentage: 19.1 },
    ],
    byStatus: [
      { category: 'COMPLETED', count: 30, percentage: 71.4 },
      { category: 'ASSIGNED', count: 12, percentage: 28.6 },
    ],
    avgResolutionTimeHours: 4.2,
    technicianWorkload: [
      { technicianId: '5', technicianName: 'Nimal Perera', assignedFaults: 18 },
    ],
    geographicDistribution: [{ region: 'Colombo', faultCount: 24 }],
  },
};

// A minimal but genuine PDF, so what lands on disk is recognisably a PDF.
const PDF_BYTES = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n%%EOF\n';

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

describe('ANA-005 — export the Fault Summary report as a PDF', () => {
  beforeEach(() => {
    // Every other card on the page also fires when expanded; keep them cheap and quiet. Declared
    // FIRST on purpose — Cypress matches the most recently registered intercept, so the specific
    // route below must come after this catch-all or the alias never sees its request.
    cy.intercept('GET', '**/api/reports/**', { statusCode: 200, body: { data: [] } });

    cy.intercept('GET', '**/api/reports/daily-fault-summary*', {
      statusCode: 200,
      body: SUMMARY,
    }).as('faultSummary');

    cy.intercept('POST', '**/api/reports/export/pdf', {
      statusCode: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="slt-daily-fault-summary-20260401_090000.pdf"',
      },
      body: PDF_BYTES,
    }).as('exportPdf');

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

  it('faultSummaryReport_pdfDownloaded', () => {
    // Step 1
    cy.location('pathname').should('eq', '/reports');
    cy.contains('Daily Fault Summary').should('be.visible');

    // Step 3 (before 2, because the range must be set before the card generates) — April 2026.
    cy.contains('button', 'Custom').click();
    cy.get('input[type=date]').eq(0).clear().type(APRIL_START);
    cy.get('input[type=date]').eq(1).clear().type(APRIL_END);

    // Steps 2 + 4 — selecting the report and generating it are the same gesture here.
    cy.contains('Daily Fault Summary').click();
    cy.wait('@faultSummary').its('request.url')
      .should('include', `startDate=${APRIL_START}`)
      .and('include', `endDate=${APRIL_END}`);

    // The generated report really is on screen before it is exported.
    cy.contains('42').should('exist');

    // Step 5 — export as PDF, from this card's own export controls.
    cy.contains('Daily Fault Summary').parent().parent()
      .contains('button', 'PDF').click();

    // The request carries the right report and window — an export of the wrong thing would still
    // produce a file, so this is asserted rather than inferred from the download alone.
    cy.wait('@exportPdf').then(({ request }) => {
      expect(request.body.reportType).to.eq('DAILY_FAULT_SUMMARY');
      expect(request.body.format).to.eq('PDF');
      expect(request.body.period).to.eq('CUSTOM');
      expect(request.body.startDate).to.eq(APRIL_START);
      expect(request.body.endDate).to.eq(APRIL_END);
    });

    // Steps 6-7 — the download fires and completes well inside 30s.
    cy.contains('exported as PDF', { timeout: 30000 }).should('be.visible');

    cy.window({ timeout: 30000 }).its('__downloads').should('have.length', 1);
    cy.window().its('__downloads').then((downloads) => {
      const name = downloads[0].name;
      expect(name, 'the downloaded filename').to.match(/^slt-daily-fault_summary-\d+\.pdf$/);

      const folder = Cypress.config('downloadsFolder');
      cy.readFile(`${folder}/${name}`, 'utf8', { timeout: 30000 })
        .should('contain', '%PDF-');
    });
  });
});
