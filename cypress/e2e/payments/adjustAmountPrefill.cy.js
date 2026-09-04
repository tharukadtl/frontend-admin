// Targeted regression spec — not tied to a Test_Cases_V1.xlsx row. Added alongside the
// PaymentsPage.js:277 fix: `ReviewPanel`'s reset effect seeded the "Adjust & Approve" amount
// field from `payment?.totalChargeableAmount`, a field that does not exist on the payment
// payload (the real field, used correctly everywhere else in this file, is `totalAmount`). The
// field always opened empty despite the UI's "ORIGINAL AMOUNT" box correctly showing the real
// total right next to it — same fix shape and same file as PAY-010/PAY-024's stale-selection fix.
//
// Same conventions as the sibling specs in this folder: cy.intercept stubs (no live backend
// dependency), no data-testid in the source so real visible text/labels are used instead, and
// the localStorage session seed AuthContext expects.

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

describe('PaymentsPage regression — Adjust & Approve amount prefill', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/payments/pending', {
      statusCode: 200,
      body: [PENDING_PAYMENT, OTHER_PENDING],
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

  it('adjustAmount_prefillsWithRealTotal_notEmpty', () => {
    // Select #15 (totalAmount 4550.0) and open the Adjust & Approve form.
    cy.contains('#15').click();
    cy.contains('TL Tharindu').should('be.visible');
    cy.contains('button', 'Adjust & Approve').click();

    // The row right next to it, unaffected by the bug, proves what "correct" looks like: the
    // ORIGINAL AMOUNT box already correctly reads the real total.
    cy.contains('ORIGINAL AMOUNT').parent().should('contain', 'LKR 4,550.00');

    // THE ACTUAL FIX UNDER TEST: the adjustable field must be genuinely prefilled with that same
    // number, not left empty. Asserting the input's .value directly rules out the field merely
    // *displaying* a placeholder or a coincidentally-matching label — an empty controlled input
    // has value === '', which fails this assertion for the real reason.
    cy.get('input[type="number"]').should('have.value', '4550');

    // Not a static fixture coincidence: switch to the other pending payment (totalAmount
    // 2200.0), reopen Adjust & Approve, and confirm the field re-seeds per-payment rather than
    // being stuck on whatever the first render happened to compute.
    cy.contains('button', '← Back').click();
    cy.contains('#16').click();
    cy.contains('TL Nimal').should('be.visible');
    cy.contains('button', 'Adjust & Approve').click();
    cy.contains('ORIGINAL AMOUNT').parent().should('contain', 'LKR 2,200.00');
    cy.get('input[type="number"]').should('have.value', '2200');
  });
});
