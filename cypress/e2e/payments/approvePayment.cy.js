// PAY-010 (04_PAYMENT_FLOW, FR-11) — the Admin payment approval flow in the web portal: open the
// pending queue, select a payment, review its materials / labour / justification, approve it, and
// see it leave the queue.
//
// Selector adaptation. The row is written against `[data-testid=pendingTab]`,
// `[data-testid=payment-15-row]`, `[data-testid=reviewModal]`, `[data-testid=approveBtn]` and
// `[data-testid=finalConfirmBtn]`. There is not a single `data-testid` anywhere in
// frontend-admin/src, and adding them would be a production-code change. The real, stable
// equivalents in PaymentsPage.js are used instead:
//   pendingTab      -> the "⏳ Pending Review (n)" tab button
//   payment-15-row  -> the PaymentListItem in the left queue carrying "#15"
//   reviewModal     -> the right-hand ReviewPanel (not a modal — a split-panel detail view)
//   approveBtn      -> the "✅ Approve" button, which opens the approve mode
//   finalConfirmBtn -> "✅ Confirm Approval", the second-step confirmation the row means
// Same approach as cypress/e2e/faults/liveMap.cy.js, which likewise maps testids onto real markup.
//
// Data. Every backend call is stubbed with cy.intercept so the spec asserts the page's behaviour
// deterministically rather than depending on whatever rows the shared dev database happens to
// hold — the convention liveMap.cy.js established. The session is seeded the way AuthContext
// restores one.
//
// Status vocabulary. The row says the payment is "PENDING" and becomes "approved". Payment
// statuses here are DRAFT (awaiting admin review — what the Pending Review queue serves, via
// GET /api/payments/pending) and FINAL (approved). The stubs use the real values.

const PENDING_PAYMENT = {
  id: 15,
  paymentNumber: 'PAY-2026-00015',
  jobNumber: 'JOB-2026-00042',
  teamLeadName: 'TL Tharindu',
  customerName: 'Test Client',
  materialsFocTotal: 1000.0,
  materialsChargeableTotal: 800.0,
  labourCharge: 3750.0,
  totalAmount: 4550.0,
  labourStartTime: '2026-08-06T08:00:00',
  labourEndTime: '2026-08-06T10:30:00',
  hourlyRate: 1500.0,
  materialJustification: 'Router replaced after customer-caused damage; out of warranty.',
  workSummary: 'Router replaced after customer-caused damage; out of warranty.',
  customerSignatureUrl: 'data:image/png;base64,SIG',
  jobPhotosUrls: '',
  status: 'DRAFT',
  createdAt: '2026-08-06T11:00:00',
  submittedAt: '2026-08-06T11:00:00',
};

const OTHER_PENDING = {
  ...PENDING_PAYMENT,
  id: 16,
  paymentNumber: 'PAY-2026-00016',
  teamLeadName: 'TL Nimal',
  totalAmount: 2200.0,
};

describe('PAY-010 — admin approves a pending payment', () => {
  beforeEach(() => {
    // First load: both payments are pending.
    cy.intercept('GET', '**/api/payments/pending', {
      statusCode: 200,
      body: [PENDING_PAYMENT, OTHER_PENDING],
    }).as('pending');

    cy.intercept('PATCH', '**/api/payments/15/review', req => {
      // The row's approval must be a genuine APPROVED decision, not a silent no-op.
      expect(req.body).to.have.property('decision', 'APPROVED');
      req.reply({
        statusCode: 200,
        body: { ...PENDING_PAYMENT, status: 'FINAL', approvedAmount: 4550.0 },
      });
    }).as('approve');

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

  it('adminApproves_removedFromQueue', () => {
    // Step 1: the payments page loaded (not bounced to /login) and pulled the queue.
    cy.location('pathname').should('eq', '/payments');
    cy.wait('@pending');

    // Step 2: the Pending Review tab is the queue in view.
    cy.contains('button', 'Pending Review').should('be.visible').click();
    cy.contains('2 payments in queue').should('be.visible');

    // Step 3: select payment #15 from the queue.
    cy.contains('#15').click();

    // Step 4: the review detail panel is showing that payment.
    // (The panel heads with "#{id}" and the submitter, not the payment number.)
    cy.contains('TL Tharindu').should('be.visible');
    cy.contains('Job #JOB-2026-00042').should('be.visible');

    // Step 5: the materials, labour and justification sections are all visible.
    cy.contains('Billing Summary').should('be.visible');
    cy.contains('FOC Amount').should('be.visible');
    cy.contains('LKR 1,000.00').should('be.visible');   // FOC materials, excluded from the bill
    cy.contains('Grand Total').should('be.visible');
    cy.contains('LKR 4,550.00').should('be.visible');   // chargeable 800 + labour 3750

    cy.contains('Labour Charges').should('be.visible');
    cy.contains('LKR 3,750.00').should('be.visible');
    cy.contains('LKR 1,500.00').should('be.visible');   // hourly rate

    cy.contains('Material Justification').should('be.visible');
    cy.contains('Router replaced after customer-caused damage').should('be.visible');

    // Step 6: approve.
    cy.contains('button', 'Approve').click();

    // Step 7: the second-step confirmation (the row's finalConfirmBtn).
    // Re-stub the queue so the reload after approval no longer carries #15.
    cy.intercept('GET', '**/api/payments/pending', {
      statusCode: 200,
      body: [OTHER_PENDING],
    }).as('pendingAfter');

    cy.contains('button', 'Confirm Approval').click();
    cy.wait('@approve');
    cy.wait('@pendingAfter');

    // Step 8: a success toast naming the approval.
    cy.contains('approved').should('be.visible');

    // Step 9: the approved payment has left the pending queue.
    //
    // Scoped to the QUEUE, which is what the row's `payment-15-row` selector means. A queue item
    // renders "#<id> · <time ago>"; the detail panel renders a bare "#<id>", so the " · " suffix
    // distinguishes the two without a testid.
    cy.contains('1 payment in queue').should('be.visible');
    cy.contains('#15 ·').should('not.exist');
    cy.contains('#16 ·').should('be.visible');

    // Step 9 (cont.) — and the detail panel must stop showing the payment that was just approved.
    //
    // THIS IS THE ROW'S RED. After a successful approval the right-hand ReviewPanel still shows
    // payment #15 with its approval form open, even though #15 is gone from the queue on the left.
    // Cause (PaymentsPage.js): the post-action reselect runs TWO setSelected calls against stale
    // closures. `loadPending` is memoised with `[]` deps, so its `!selected` check always reads the
    // first-render `null` and it unconditionally re-selects `list[0]` (= #16); `handleAction` then
    // runs `setSelected(prev => payments.find(p => p.id !== prev?.id && p.status === 'DRAFT'))`
    // over its own stale `payments` ([#15, #16]) with `prev` now #16 — which resolves to #15, the
    // payment that was just approved. The admin is left looking at a completed review, one
    // "Confirm Approval" click away from re-submitting it. Fixing it means giving `loadPending` a
    // `selected` dep (or a ref) and reselecting from the freshly-loaded list rather than the
    // captured one.
    cy.contains('Select a payment to review').should('be.visible');
  });
});
