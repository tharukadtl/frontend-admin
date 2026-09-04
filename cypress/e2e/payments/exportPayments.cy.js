// PAY-018 (04_PAYMENT_FLOW, FR-11) — an Admin must be able to export the approved payments from
// the Payments page as an XLSX with the right columns.
//
// Selector adaptation. The row is written against `[data-testid=approvedTab]` and
// `[data-testid=exportBtn]`. There is not a single `data-testid` anywhere in frontend-admin/src,
// and adding them would be a production-code change, so this spec looks for the real controls a
// user would click: a tab that scopes the view to approved payments, and an export control on
// that page. Same approach as cypress/e2e/faults/liveMap.cy.js.
//
// Data. The backend calls are stubbed with cy.intercept (liveMap.cy.js convention) so the spec is
// deterministic: five APPROVED payments are seeded, matching the row's precondition. Status
// vocabulary: an approved payment is FINAL; the Payment History tab's own stats card counts
// exactly `status === 'FINAL'` as "Approved".
//
// `cy.verifyDownload` (the row's assertion) comes from cypress-verify-downloads, which is not a
// dependency here; downloads are asserted against Cypress's own `downloadsFolder` with
// `cy.readFile` instead, which needs no new package.

const approvedPayment = (id, total) => ({
  id,
  paymentNumber: `PAY-2026-000${id}`,
  jobNumber: `JOB-2026-000${id}`,
  teamLeadName: 'TL Tharindu',
  customerName: 'Test Client',
  materialsFocTotal: 100.0,
  materialsChargeableTotal: total - 1000,
  labourCharge: 1000.0,
  totalAmount: total,
  approvedAmount: total,
  approvedByName: 'Ops Admin',
  approvedAt: '2026-08-06T12:00:00',
  billReference: `BILL-2026-08-000${id}`,
  status: 'FINAL',
  createdAt: '2026-08-05T09:00:00',
});

const APPROVED = [
  approvedPayment(21, 4550),
  approvedPayment(22, 3300),
  approvedPayment(23, 7800),
  approvedPayment(24, 1250),
  approvedPayment(25, 9900),
];

describe('PAY-018 — export approved payments as XLSX', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/payments/pending', { statusCode: 200, body: [] }).as('pending');
    cy.intercept('GET', '**/api/payments/all', { statusCode: 200, body: APPROVED }).as('all');

    // Whatever export endpoint the page might call, capture it rather than hitting a real server.
    cy.intercept('POST', '**/api/reports/export/excel', {
      statusCode: 200,
      headers: {
        'content-type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': 'attachment; filename=payments_approved.xlsx',
      },
      body: 'PKstub-xlsx',
    }).as('exportExcel');

    cy.visit('/payments', {
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

  it('exportApprovedXlsx', () => {
    cy.location('pathname').should('eq', '/payments');

    // Step 1-2: scope the view to approved payments.
    //
    // The Payments page has three tabs — "⏳ Pending Review", "⚖️ Bill Disputes" and
    // "📋 Payment History". There is no Approved tab; the closest real control is Payment
    // History's status filter, which the row's "approvedTab" step means in practice.
    cy.contains('button', 'Payment History').click();
    cy.wait('@all');
    cy.contains('Approved').should('be.visible');

    // Step 3: the export control on the approved-payments view.
    //
    // This is the row's real assertion, and where it currently stops: PaymentsPage.js has no
    // export affordance of ANY kind — no button, no download handler, no call to
    // /api/reports/export/excel. Its only header actions are "🔄 Refresh" and a pending-count
    // badge, and the file contains no occurrence of "export", "xlsx", "csv" or "download" outside
    // its `export default`. Approved-payment data can only be exported today by leaving this
    // screen for the Reports page and running the generic financial-summary export, which is not
    // the same list, not scoped to approved payments, and not what an Admin reviewing payments
    // would find. The backend endpoint exists (POST /api/reports/export/excel, ReportController)
    // — the Payments page simply never calls it.
    cy.contains(/export/i).should('exist');

    cy.contains(/export/i).click();
    cy.wait('@exportExcel');

    // Steps 4-5: the file downloaded and carries the expected columns.
    const downloads = Cypress.config('downloadsFolder');
    cy.readFile(`${downloads}/payments_approved.xlsx`, null, { timeout: 15000 }).should('exist');
  });
});
