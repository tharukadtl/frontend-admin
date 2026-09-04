// Targeted regression spec — not tied to a Test_Cases_V1.xlsx row. Added alongside the
// PaymentsPage.js:1557 fix: the queue's "Sort: Highest Amount" comparator read
// `p.totalChargeableAmount`, a field that does not exist on the payment payload — every
// comparison was `(0||0) - (0||0) === 0`, so the sort was a permanent no-op regardless of which
// option was selected. Fixed to read the real field, `totalAmount` (used correctly by
// PaymentListItem two lines below the old bug, and by ReviewPanel).
//
// Same conventions as the sibling specs in this folder: cy.intercept stubs, no data-testid in
// the source so visible text is used, real localStorage session seed.

const LOW = {
  id: 15,
  paymentNumber: 'PAY-2026-00015',
  jobNumber: 'JOB-2026-00042',
  teamLeadName: 'TL Tharindu',
  materialsFocTotal: 0,
  totalAmount: 2200.0,
  status: 'DRAFT',
  createdAt: '2026-08-06T09:00:00',
  submittedAt: '2026-08-06T09:00:00',
};

const HIGH = {
  ...LOW,
  id: 16,
  paymentNumber: 'PAY-2026-00016',
  teamLeadName: 'TL Nimal',
  totalAmount: 9800.0,
  createdAt: '2026-08-06T08:00:00', // older than LOW, so "Newest First" would rank it BELOW LOW
  submittedAt: '2026-08-06T08:00:00',
};

const MID = {
  ...LOW,
  id: 17,
  paymentNumber: 'PAY-2026-00017',
  teamLeadName: 'TL Kasun',
  totalAmount: 5000.0,
  createdAt: '2026-08-06T10:00:00',
  submittedAt: '2026-08-06T10:00:00',
};

describe('PaymentsPage regression — Sort: Highest Amount', () => {
  beforeEach(() => {
    // Seeded intentionally out of amount order (and out of createdAt order relative to amount)
    // so a passing sort can only be explained by the comparator actually running on the real
    // field — sorting by insertion order or by date would both produce a different, wrong order.
    cy.intercept('GET', '**/api/payments/pending', {
      statusCode: 200,
      body: [LOW, HIGH, MID],
    }).as('pending');

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

    cy.wait('@pending');
    cy.contains('button', 'Pending Review').click();
  });

  it('sortHighest_genuinelyReordersQueue_byRealTotalAmount', () => {
    // Sanity check on the default order first: "Newest First" (createdAt desc) puts MID (10:00)
    // above LOW (09:00) above HIGH (08:00) — the opposite of amount order. If this pre-check ever
    // failed, the real-order assertion below would be meaningless.
    cy.get('select').should('have.value', 'newest');
    cy.contains('LKR 5,000.00').then($mid => {
      cy.contains('LKR 2,200.00').then($low => {
        expect(
          $mid[0].compareDocumentPosition($low[0]) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).to.be.greaterThan(0);
      });
    });

    // Switch to Highest Amount.
    cy.get('select').select('highest');

    // The queue must now read HIGH (9800) -> MID (5000) -> LOW (2200), top to bottom. Checked via
    // real DOM document order (compareDocumentPosition), not just "all three visible somewhere" —
    // a no-op sort would leave the original (date) order in place and fail this specific check.
    cy.contains('LKR 9,800.00').then($high => {
      cy.contains('LKR 5,000.00').then($mid => {
        expect(
          $high[0].compareDocumentPosition($mid[0]) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).to.be.greaterThan(0);
      });
    });
    cy.contains('LKR 5,000.00').then($mid => {
      cy.contains('LKR 2,200.00').then($low => {
        expect(
          $mid[0].compareDocumentPosition($low[0]) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).to.be.greaterThan(0);
      });
    });
  });
});
