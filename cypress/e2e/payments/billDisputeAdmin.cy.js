// PAY-024 (04_PAYMENT_FLOW, FR-31/FR-32) — the full admin-side Bill Dispute & Amendment cycle in
// the web portal: open the dedicated Bill Disputes queue, review the client's submitted evidence,
// adjust the line items with a mandatory justification, resend to the client, and see the bill
// leave the queue (and come back if it is disputed again).
//
// This is the row the previously-flagged frontend-admin coverage gap refers to: nothing tested
// PaymentsPage.js's DisputePanel / DisputesTab, only the backend halves of the cycle
// (PaymentServiceDisputeAmendTest, BillDisputeAmendmentIntegrationTest).
//
// Selector adaptation. The row is written against `[data-testid="dispute-tab"]`. There is not a
// single `data-testid` anywhere in frontend-admin/src, and adding them would be a production-code
// change, so real markup is used instead — the same approach as cypress/e2e/faults/liveMap.cy.js:
//   dispute-tab -> the "⚖️ Bill Disputes" tab button
//   status pill -> the <StatusPill> rendered from payment.status in DisputePanel's header
//
// Data. Every backend call is stubbed with cy.intercept (liveMap.cy.js convention) so the spec is
// deterministic. Note DisputesTab has no dedicated backend list endpoint — it filters
// GET /api/payments/all for status === 'DISPUTED' client-side, as its own comment says — so that
// is the call stubbed here.
//
// Status vocabulary. The row's "Awaiting Client" pill is PENDING_CLIENT_REVIEW; PaymentsPage's
// STATUS map renders that as "Awaiting Client".

const DISPUTED_BILL = {
  id: 42,
  paymentNumber: 'PAY-2026-00042',
  jobNumber: 'JOB-2026-00042',
  teamLeadName: 'TL Tharindu',
  customerName: 'Test Client',
  materialsFocTotal: 100.0,
  materialsChargeableTotal: 4000.0,
  labourCharge: 1000.0,
  totalAmount: 5000.0,
  approvedAmount: 5000.0,
  status: 'DISPUTED',
  disputeCategory: 'WRONG_AMOUNT',
  disputeDescription: 'Charged twice for the same router.',
  disputePhotoUrl: 'https://storage.slt.lk/disputes/evidence42.jpg',
  disputedAt: '2026-08-06T09:00:00',
  createdAt: '2026-08-05T09:00:00',
};

const SECOND_DISPUTE = {
  ...DISPUTED_BILL,
  id: 43,
  paymentNumber: 'PAY-2026-00043',
  customerName: 'Second Client',
  disputeCategory: 'SERVICE_NOT_DONE',
  disputeDescription: 'The technician never arrived.',
  disputePhotoUrl: null,
};

const AMENDED_BILL = {
  ...DISPUTED_BILL,
  materialsChargeableTotal: 2500.0,
  labourCharge: 800.0,
  totalAmount: 3300.0,
  approvedAmount: 3300.0,
  status: 'PENDING_CLIENT_REVIEW',
  amendmentJustification: 'Removed the duplicated router line item the client flagged.',
  amendedByName: 'Ops Admin',
  amendedAt: '2026-08-06T12:00:00',
};

const seedSession = win => {
  win.localStorage.setItem('accessToken', 'test-access-token');
  win.localStorage.setItem('refreshToken', 'test-refresh-token');
  win.localStorage.setItem(
    'user',
    JSON.stringify({ id: 1, username: 'admin', role: 'ADMIN', fullName: 'Ops Admin' }),
  );
};

describe('PAY-024 — admin bill dispute review and amendment, full cycle', () => {
  beforeEach(() => {
    // The Pending Review tab loads first (PaymentsPage opens on it).
    cy.intercept('GET', '**/api/payments/pending', { statusCode: 200, body: [] }).as('pending');

    // The dispute queue: both disputed bills.
    cy.intercept('GET', '**/api/payments/all', {
      statusCode: 200,
      body: [DISPUTED_BILL, SECOND_DISPUTE, AMENDED_BILL_PLACEHOLDER()],
    }).as('all');

    cy.intercept('PATCH', '**/api/payments/42/amend', req => {
      // The amendment must carry the adjusted line items AND a non-blank justification.
      expect(req.body).to.have.property('materialsChargeableTotal', 2500);
      expect(req.body).to.have.property('labourCharge', 800);
      expect(req.body.justification).to.be.a('string').and.not.be.empty;
      req.reply({ statusCode: 200, body: AMENDED_BILL });
    }).as('amend');

    cy.visit('/payments', { onBeforeLoad: seedSession });
  });

  it('fullAmendmentCycle', () => {
    // Step 1: logged in as Admin, on the payments page.
    cy.location('pathname').should('eq', '/payments');

    // Step 2: the Bill Disputes queue is a tab of its own, separate from Pending Review.
    cy.contains('button', 'Pending Review').should('be.visible');
    cy.contains('button', 'Bill Disputes').should('be.visible').click();
    cy.wait('@all');

    // Only DISPUTED bills are queued — the already-amended one must not be here.
    cy.contains('2 disputes in queue').should('be.visible');
    cy.contains('#99').should('not.exist');

    // Step 3: open the disputed bill and read the client's evidence.
    cy.contains('#42').click();
    cy.contains('WRONG_AMOUNT').should('be.visible');
    cy.contains('Charged twice for the same router.').should('be.visible');
    cy.get('img[alt="Dispute evidence"]').should('exist');

    // The current line items are shown before any adjustment.
    cy.contains('LKR 5,000.00').should('be.visible');

    // Step 4: adjust a line item and enter the justification.
    cy.contains('button', 'Amend Bill & Resend to Client').click();

    // Justification is mandatory — resend stays disabled until it is filled.
    cy.contains('button', 'Resend to Client').should('be.disabled');

    cy.get('input[type="number"]').eq(1).clear().type('2500');   // materials chargeable
    cy.get('input[type="number"]').eq(2).clear().type('800');    // labour

    // The recalculated total is previewed before sending (chargeable + labour, FOC excluded).
    cy.contains('LKR 3,300.00').should('be.visible');

    cy.get('textarea').type('Removed the duplicated router line item the client flagged.');
    cy.contains('button', 'Resend to Client').should('not.be.disabled');

    // After the amendment the bill drops out of the DISPUTED filter; only #43 remains.
    cy.intercept('GET', '**/api/payments/all', {
      statusCode: 200,
      body: [SECOND_DISPUTE, AMENDED_BILL],
    }).as('allAfter');

    cy.contains('button', 'Resend to Client').click();
    cy.wait('@amend');
    cy.wait('@allAfter');

    // Step 5: the amendment is confirmed and the queue shrinks.
    //
    // Scoped to the QUEUE: a queue item renders "#<id> · <time ago>" while the detail panel
    // renders a bare "#<id>", so the " · " suffix distinguishes the two without a testid.
    cy.contains('Bill amended and resent to client').should('be.visible');
    cy.contains('1 dispute in queue').should('be.visible');
    cy.contains('#42 ·').should('not.exist');

    // Step 5 (cont.) — and the detail panel must stop showing the bill that was just amended.
    //
    // THIS IS THE ROW'S RED, and it is the same defect PAY-010 hits on the approval tab.
    // `DisputesTab.load` correctly reselects from the freshly-loaded list (#42 is gone, so it
    // clears to null), but `handleAmend` then runs a SECOND reselect against its own stale
    // `disputes` closure — `disputes.find(p => p.id !== prev?.id && p.status === 'DISPUTED')` over
    // the pre-amendment [#42, #43, #99] with `prev` now null — which resolves straight back to
    // #42, the bill just amended. The admin is left reviewing a dispute that has already been
    // answered and is showing a stale DISPUTED pill. Fix: reselect from the list `load()` returned
    // instead of the captured `disputes`, or drop the second reselect entirely since `load`
    // already handles it.
    cy.contains('Select a dispute to review').should('be.visible');

    // Step 5 (cont.): the amended bill now reads "Awaiting Client" — asserted where an admin can
    // actually see it, the Payment History tab (the dispute queue deliberately excludes it).
    cy.contains('button', 'Payment History').click();
    cy.contains('Awaiting Client').should('be.visible');

    // Step 6: if the client disputes the amended bill again, it reappears in the queue.
    cy.intercept('GET', '**/api/payments/all', {
      statusCode: 200,
      body: [
        SECOND_DISPUTE,
        { ...AMENDED_BILL, status: 'DISPUTED', disputeDescription: 'Labour is still too high.' },
      ],
    }).as('allRedisputed');

    cy.contains('button', 'Bill Disputes').click();
    cy.wait('@allRedisputed');
    cy.contains('2 disputes in queue').should('be.visible');
    cy.contains('#42').should('be.visible');
  });
});

// A bill that is NOT disputed, used to prove the queue filters rather than listing everything.
function AMENDED_BILL_PLACEHOLDER() {
  return {
    ...DISPUTED_BILL,
    id: 99,
    paymentNumber: 'PAY-2026-00099',
    status: 'FINAL',
    disputeCategory: null,
    disputeDescription: null,
    disputePhotoUrl: null,
  };
}
