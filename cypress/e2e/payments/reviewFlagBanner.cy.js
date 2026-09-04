// #12 (FR-9, SRS 5.3.1.3) — Admin's existing PATCH /{id}/review action (ReviewPanel in
// PaymentsPage.js) surfaces the same client-declined-signature flag the Team Lead's own
// payment-submission screen already shows, so if the Team Lead submits anyway, Admin sees it
// before approving/rejecting/adjusting. No new endpoint: this reuses the existing
// GET /api/jobs/{id} (the linked job's needsTeamLeadReview/signatureDeclineReason fields),
// exactly as the Team Lead's PaymentSubmissionScreen (mobile) already does for the same data.
//
// Data. Every backend call is stubbed with cy.intercept, matching this directory's established
// convention (see approvePayment.cy.js). The session is seeded the way AuthContext restores one.

const FLAGGED_PAYMENT = {
  id: 21,
  paymentNumber: 'PAY-2026-00021',
  jobId: 501,
  jobNumber: 'JOB-2026-00501',
  teamLeadName: 'TL Tharindu',
  customerName: 'Test Client',
  materialsFocTotal: 0,
  materialsChargeableTotal: 800.0,
  labourCharge: 1200.0,
  totalAmount: 2000.0,
  status: 'DRAFT',
  createdAt: '2026-09-02T11:00:00',
  submittedAt: '2026-09-02T11:00:00',
};

const UNFLAGGED_PAYMENT = {
  ...FLAGGED_PAYMENT,
  id: 22,
  paymentNumber: 'PAY-2026-00022',
  jobId: 502,
  jobNumber: 'JOB-2026-00502',
};

const seedSession = win => {
  win.localStorage.setItem('accessToken', 'test-access-token');
  win.localStorage.setItem('refreshToken', 'test-refresh-token');
  win.localStorage.setItem(
    'user',
    JSON.stringify({ id: 1, username: 'admin', role: 'ADMIN', fullName: 'Ops Admin' }),
  );
};

describe('PaymentsPage ReviewPanel — #12 client-declined-signature review flag', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/payments/pending', {
      statusCode: 200,
      body: [FLAGGED_PAYMENT, UNFLAGGED_PAYMENT],
    }).as('pending');

    cy.intercept('GET', '**/api/jobs/501', {
      statusCode: 200,
      body: {
        id: 501,
        needsTeamLeadReview: true,
        signatureDeclineReason: 'Client left the property before work finished',
      },
    }).as('job501');

    cy.intercept('GET', '**/api/jobs/502', {
      statusCode: 200,
      body: { id: 502, needsTeamLeadReview: false, signatureDeclineReason: null },
    }).as('job502');

    cy.visit('/payments', { onBeforeLoad: seedSession });
    cy.wait('@pending');
    cy.contains('button', 'Pending Review').click();
  });

  it('shows the review-flag banner with the real decline reason for a flagged payment', () => {
    cy.contains('#21').click();
    cy.wait('@job501');

    cy.contains('Flagged for Review').should('be.visible');
    cy.contains('No Customer Signature Captured').should('be.visible');
    cy.contains('Client left the property before work finished').should('be.visible');
  });

  it('shows no banner at all for a payment whose job was not flagged', () => {
    cy.contains('#22').click();
    cy.wait('@job502');

    cy.contains('Flagged for Review').should('not.exist');
  });

  it('the flag is informational only — Approve remains fully usable, not blocked', () => {
    cy.intercept('PATCH', '**/api/payments/21/review', req => {
      expect(req.body).to.have.property('decision', 'APPROVED');
      req.reply({ statusCode: 200, body: { ...FLAGGED_PAYMENT, status: 'FINAL' } });
    }).as('approve');

    cy.contains('#21').click();
    cy.wait('@job501');
    cy.contains('Flagged for Review').should('be.visible');

    cy.contains('button', 'Approve').click();
    cy.intercept('GET', '**/api/payments/pending', {
      statusCode: 200,
      body: [UNFLAGGED_PAYMENT],
    }).as('pendingAfter');
    cy.contains('button', 'Confirm Approval').click();
    cy.wait('@approve');
    cy.wait('@pendingAfter');

    cy.contains('approved').should('be.visible');
  });

  it('falls back to a generic explanation when the job carries the flag but no reason text', () => {
    cy.intercept('GET', '**/api/jobs/501', {
      statusCode: 200,
      body: { id: 501, needsTeamLeadReview: true, signatureDeclineReason: null },
    }).as('job501NoReason');

    cy.contains('#21').click();
    cy.wait('@job501NoReason');

    cy.contains('The client was unavailable or declined to sign.').should('be.visible');
  });
});
