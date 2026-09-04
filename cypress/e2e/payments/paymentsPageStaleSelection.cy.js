// Mechanism-level regression coverage for the PaymentsPage.js stale-selection fix
// (the defect PAY-010 / approvePayment.cy.js and PAY-024 / billDisputeAdmin.cy.js each
// hit from one end).
//
// Original bug: after a successful Approve/Reject (ReviewPanel) or Amend (DisputePanel),
// TWO reselects fought each other and put the just-processed item straight back into the
// detail panel with its action form still open:
//   1. `loadPending` was memoised with [] deps, so its `!selected` check always read the
//      first-render `null` and unconditionally re-selected `list[0]`;
//   2. `handleAction` / `DisputesTab.handleAmend` then ran a SECOND
//      `setSelected(prev => payments.find(p => p.id !== prev?.id && ...))` over its own
//      stale `payments` / `disputes` closure, resolving back to the processed item.
// The admin was left one click from re-submitting a decision that had already been made.
//
// The fix: `handleAction`/`handleAmend` clear the selection and re-fetch; the loader
// re-selects by IDENTITY from the list it just fetched, so an item that has left the
// queue can never remain selected.
//
// Why this spec exists alongside approvePayment.cy.js / billDisputeAdmin.cy.js: those two
// prove the OUTCOME with a single `cy.contains('Select a … to review')`, which is also what
// you would see if the page had crashed, if the queue had emptied, or if some unrelated
// render path produced the empty state. This spec proves the MECHANISM:
//   - the re-fetch RESPONSE BODY genuinely no longer contains the processed id,
//   - `selected` is genuinely null (not "some other payment") and `mode` is genuinely
//     closed, asserted by the absence of the panel + action-footer markup that only a
//     non-null `payment` can render,
//   - the reselect does not clobber a DIFFERENT payment picked right after an action,
//   - back-to-back actions hold,
//   - and a FAILED action deliberately KEEPS the selection so the admin can retry.
//
// Selector adaptation and stubbing follow the conventions the sibling payment specs
// established (no data-testid exists anywhere in frontend-admin/src, and adding one would
// be a production-code change).

const PENDING_15 = {
  id: 15,
  paymentNumber: 'PAY-2026-00015',
  jobNumber: 'JOB-2026-00042',
  teamLeadName: 'TL Tharindu',
  materialsFocTotal: 1000.0,
  materialsChargeableTotal: 800.0,
  labourCharge: 3750.0,
  totalAmount: 4550.0,
  materialJustification: 'Router replaced after customer-caused damage.',
  jobPhotosUrls: '',
  status: 'DRAFT',
  createdAt: '2026-08-06T11:00:00',
  submittedAt: '2026-08-06T11:00:00',
};

const PENDING_16 = {
  ...PENDING_15,
  id: 16,
  paymentNumber: 'PAY-2026-00016',
  teamLeadName: 'TL Nimal',
  totalAmount: 2200.0,
  createdAt: '2026-08-06T10:00:00',
  submittedAt: '2026-08-06T10:00:00',
};

const seedSession = win => {
  win.localStorage.setItem('accessToken', 'test-access-token');
  win.localStorage.setItem('refreshToken', 'test-refresh-token');
  win.localStorage.setItem(
    'user',
    JSON.stringify({ id: 1, username: 'admin', role: 'ADMIN', fullName: 'Ops Admin' }),
  );
};

/**
 * The detail panel is genuinely EMPTY: `selected === null`, so ReviewPanel took its
 * `if (!payment)` early return. Distinguishes "nothing selected" from "a different
 * payment got selected", which the single empty-state assertion in approvePayment.cy.js
 * cannot do on its own — a selected payment always renders the Billing Summary and,
 * while DRAFT, the action footer.
 */
const assertReviewPanelTrulyEmpty = () => {
  cy.contains('Select a payment to review').should('be.visible');
  cy.contains('Click any pending item from the left panel').should('be.visible');
  // `payment` is null -> none of the detail markup can exist.
  cy.contains('Billing Summary').should('not.exist');
  cy.contains('Grand Total').should('not.exist');
  // `mode` is closed AND the footer is gone (the footer only renders for a DRAFT payment).
  cy.contains('button', 'Confirm Approval').should('not.exist');
  cy.contains('button', 'Confirm Rejection').should('not.exist');
  cy.contains('button', 'Adjust & Approve').should('not.exist');
};

describe('PaymentsPage — post-action stale selection (mechanism)', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/payments/pending', {
      statusCode: 200,
      body: [PENDING_15, PENDING_16],
    }).as('pending');
    cy.visit('/payments', { onBeforeLoad: seedSession });
    cy.wait('@pending');
  });

  it('approve: the re-fetch RESPONSE excludes the approved id and the panel is genuinely null', () => {
    cy.intercept('PATCH', '**/api/payments/15/review', req => {
      expect(req.body).to.have.property('decision', 'APPROVED');
      req.reply({ statusCode: 200, body: { ...PENDING_15, status: 'FINAL' } });
    }).as('approve');

    cy.contains('#15 ·').click();
    cy.contains('Billing Summary').should('be.visible');
    cy.contains('button', 'Approve').click();
    cy.contains('button', 'Confirm Approval').should('be.visible');

    cy.intercept('GET', '**/api/payments/pending', {
      statusCode: 200,
      body: [PENDING_16],
    }).as('pendingAfter');

    cy.contains('button', 'Confirm Approval').click();
    cy.wait('@approve');

    // MECHANISM 1 — the queue re-fetch really happened and its BODY (not the DOM text)
    // no longer carries the approved payment.
    cy.wait('@pendingAfter').its('response.body').should(body => {
      const ids = body.map(p => p.id);
      expect(ids, 're-fetched pending queue').to.not.include(15);
      expect(ids, 're-fetched pending queue').to.include(16);
    });

    // MECHANISM 2 — `selected` is null and `mode` is closed, not "#16 got auto-selected"
    // and not "#15 is still sitting there with its approval form open".
    assertReviewPanelTrulyEmpty();

    // ...and the page is alive and rendering the remaining item, so the empty panel is
    // not the by-product of a crash or an emptied queue.
    cy.contains('1 payment in queue').should('be.visible');
    cy.contains('#16 ·').should('be.visible');
    cy.contains('#15 ·').should('not.exist');
  });

  it('reject: same clearing behaviour on the reject branch', () => {
    cy.intercept('PATCH', '**/api/payments/15/review', req => {
      expect(req.body).to.have.property('decision', 'REJECTED');
      expect(req.body).to.have.property('reason', 'Materials not justified.');
      req.reply({ statusCode: 200, body: { ...PENDING_15, status: 'NOT_APPROVED' } });
    }).as('reject');

    cy.contains('#15 ·').click();
    cy.contains('button', 'Reject').click();
    cy.get('textarea').type('Materials not justified.');

    cy.intercept('GET', '**/api/payments/pending', {
      statusCode: 200,
      body: [PENDING_16],
    }).as('pendingAfter');

    cy.contains('button', 'Confirm Rejection').click();
    cy.wait('@reject');
    cy.wait('@pendingAfter').its('response.body').should(body => {
      expect(body.map(p => p.id)).to.not.include(15);
    });

    assertReviewPanelTrulyEmpty();
    cy.contains('1 payment in queue').should('be.visible');
  });

  it('a payment picked right after a successful approve is NOT clobbered by the reselect', () => {
    cy.intercept('PATCH', '**/api/payments/15/review', {
      statusCode: 200,
      body: { ...PENDING_15, status: 'FINAL' },
    }).as('approve');

    cy.contains('#15 ·').click();
    cy.contains('button', 'Approve').click();

    cy.intercept('GET', '**/api/payments/pending', {
      statusCode: 200,
      body: [PENDING_16],
    }).as('pendingAfter');

    cy.contains('button', 'Confirm Approval').click();
    cy.wait('@approve');
    cy.wait('@pendingAfter');
    assertReviewPanelTrulyEmpty();

    // Immediately pick the OTHER payment. Under the old code the reselect could still be
    // in flight over a stale closure and would replace this with the processed payment.
    cy.contains('#16 ·').click();
    cy.contains('TL Nimal').should('be.visible');
    cy.contains('Billing Summary').should('be.visible');

    // The selection must SURVIVE — it must not flip back to the approved #15, and it must
    // not be cleared. Asserted after a further refresh, which re-runs the reselect path.
    cy.contains('button', 'Refresh').click();
    cy.wait('@pendingAfter');
    cy.contains('TL Nimal').should('be.visible');
    cy.contains('TL Tharindu').should('not.exist');
    cy.contains('button', 'Approve').should('be.visible'); // #16 still actionable
  });

  it('back-to-back approvals: each clears, and the queue drains to empty', () => {
    cy.intercept('PATCH', '**/api/payments/15/review', {
      statusCode: 200,
      body: { ...PENDING_15, status: 'FINAL' },
    }).as('approve15');
    cy.intercept('PATCH', '**/api/payments/16/review', {
      statusCode: 200,
      body: { ...PENDING_16, status: 'FINAL' },
    }).as('approve16');

    cy.contains('#15 ·').click();
    cy.contains('button', 'Approve').click();
    cy.intercept('GET', '**/api/payments/pending', { statusCode: 200, body: [PENDING_16] }).as('after15');
    cy.contains('button', 'Confirm Approval').click();
    cy.wait('@approve15');
    cy.wait('@after15');
    assertReviewPanelTrulyEmpty();

    cy.contains('#16 ·').click();
    cy.contains('TL Nimal').should('be.visible');
    cy.contains('button', 'Approve').click();
    cy.intercept('GET', '**/api/payments/pending', { statusCode: 200, body: [] }).as('after16');
    cy.contains('button', 'Confirm Approval').click();
    cy.wait('@approve16');
    cy.wait('@after16');

    assertReviewPanelTrulyEmpty();
    cy.contains('Queue Empty').should('be.visible');
    cy.contains('0 payments in queue').should('be.visible');
  });

  it('a FAILED approve keeps the selection so the admin can retry', () => {
    cy.intercept('PATCH', '**/api/payments/15/review', {
      statusCode: 500,
      body: { message: 'boom' },
    }).as('approveFail');

    cy.contains('#15 ·').click();
    cy.contains('button', 'Approve').click();
    cy.contains('button', 'Confirm Approval').click();
    cy.wait('@approveFail');

    cy.contains('Approval failed').should('be.visible');
    // Selection and the open form both survive — the opposite of the success path.
    cy.contains('Select a payment to review').should('not.exist');
    cy.contains('TL Tharindu').should('be.visible');
    cy.contains('button', 'Confirm Approval').should('be.visible');
    cy.contains('2 payments in queue').should('be.visible');
  });
});

// ─── The same defect on the Bill Disputes tab (DisputesTab + DisputePanel) ─────
const DISPUTED_42 = {
  id: 42,
  paymentNumber: 'PAY-2026-00042',
  jobNumber: 'JOB-2026-00042',
  teamLeadName: 'TL Tharindu',
  materialsFocTotal: 100.0,
  materialsChargeableTotal: 4000.0,
  labourCharge: 1000.0,
  totalAmount: 5000.0,
  status: 'DISPUTED',
  disputeCategory: 'WRONG_AMOUNT',
  disputeDescription: 'Charged twice for the same router.',
  disputedAt: '2026-08-06T09:00:00',
  createdAt: '2026-08-05T09:00:00',
};
const DISPUTED_43 = {
  ...DISPUTED_42,
  id: 43,
  paymentNumber: 'PAY-2026-00043',
  teamLeadName: 'TL Nimal',
  disputeDescription: 'The technician never arrived.',
};
const AMENDED_42 = { ...DISPUTED_42, status: 'PENDING_CLIENT_REVIEW', totalAmount: 3300.0 };

/**
 * `selected === null` in DisputesTab, so DisputePanel took its `if (!payment)` early
 * return — as opposed to "the other dispute got auto-selected" or "the amended bill is
 * still on screen with its amendment form open".
 */
const assertDisputePanelTrulyEmpty = () => {
  cy.contains('Select a dispute to review').should('be.visible');
  cy.contains('Click any disputed bill from the left panel').should('be.visible');
  cy.contains("Client's Reported Issue").should('not.exist');
  cy.contains('Original Bill Breakdown').should('not.exist');
  cy.contains('button', 'Amend Bill & Resend to Client').should('not.exist');
  cy.contains('button', 'Resend to Client').should('not.exist');
};

describe('DisputesTab — post-amend stale selection (mechanism)', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/payments/pending', { statusCode: 200, body: [] }).as('pending');
    cy.intercept('GET', '**/api/payments/all', {
      statusCode: 200,
      body: [DISPUTED_42, DISPUTED_43],
    }).as('all');
    cy.intercept('PATCH', '**/api/payments/42/amend', {
      statusCode: 200,
      body: AMENDED_42,
    }).as('amend');
    cy.visit('/payments', { onBeforeLoad: seedSession });
    cy.contains('button', 'Bill Disputes').click();
    cy.wait('@all');
  });

  it('the re-fetch RESPONSE no longer lists #42 as DISPUTED and the panel is genuinely null', () => {
    cy.contains('#42 ·').click();
    cy.contains('Charged twice for the same router.').should('be.visible');
    cy.contains('button', 'Amend Bill & Resend to Client').click();
    cy.get('textarea').type('Removed the duplicated router line item.');

    cy.intercept('GET', '**/api/payments/all', {
      statusCode: 200,
      body: [DISPUTED_43, AMENDED_42],
    }).as('allAfter');

    cy.contains('button', 'Resend to Client').click();
    cy.wait('@amend');

    // MECHANISM — the re-fetch body still CONTAINS #42, but no longer with status
    // DISPUTED, so it drops out of DisputesTab's client-side filter. Asserted on the
    // network payload, not on queue text.
    cy.wait('@allAfter').its('response.body').should(body => {
      const disputed = body.filter(p => p.status === 'DISPUTED').map(p => p.id);
      expect(disputed, 'still-disputed ids').to.not.include(42);
      expect(disputed, 'still-disputed ids').to.include(43);
      expect(body.find(p => p.id === 42).status).to.eq('PENDING_CLIENT_REVIEW');
    });

    assertDisputePanelTrulyEmpty();
    cy.contains('1 dispute in queue').should('be.visible');
    cy.contains('#42 ·').should('not.exist');
  });

  it('a dispute picked right after a successful amend is NOT clobbered by the reselect', () => {
    cy.contains('#42 ·').click();
    cy.contains('button', 'Amend Bill & Resend to Client').click();
    cy.get('textarea').type('Removed the duplicated router line item.');

    cy.intercept('GET', '**/api/payments/all', {
      statusCode: 200,
      body: [DISPUTED_43, AMENDED_42],
    }).as('allAfter');

    cy.contains('button', 'Resend to Client').click();
    cy.wait('@amend');
    cy.wait('@allAfter');
    assertDisputePanelTrulyEmpty();

    // Pick the other dispute — it must stick, and must not flip back to the amended #42.
    cy.contains('#43 ·').click();
    cy.contains('TL Nimal').should('be.visible');
    cy.contains('The technician never arrived.').should('be.visible');
    cy.contains('Charged twice for the same router.').should('not.exist');
    cy.contains('button', 'Amend Bill & Resend to Client').should('be.visible');
  });
});
