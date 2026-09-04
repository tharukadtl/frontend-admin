// NOTIF-010 (08_NOTIFICATIONS, FR-21) — the notification badge must reflect the unread count on
// load and clear when the user marks everything read.
//
// TOOL SUBSTITUTION. The row says "Jest + RTL" and maps to `NotificationBadge.test.jsx`. RTL cannot
// run in this module at all — `@testing-library/react` and `react-test-renderer` are both absent
// from package.json and there is no `test` script, so adding it would be a new-framework decision
// for the user, not a free choice. Cypress 13.17 IS a real devDependency here with a working
// config, so this row follows the same substitution already accepted on KPI-007/KPI-010:
// Cypress spec, real page, stubbed backend.
//
// COMPONENT ADAPTATION. There is no `NotificationBadge` component and no `notifBadge` testid — there
// is not one data-testid anywhere in frontend-admin/src, and adding one would be a production-code
// change. There are exactly two unread badges in the portal:
//   1. NotificationsPage.js's header pill — `{unreadCount} new`, derived from the notifications the
//      page actually loaded from GET /api/notifications. This is the badge bound to the server's
//      unread state, so it is what this spec drives.
//   2. Sidebar.js's bell pill — driven by `liveUnreadCount` from NotificationSocketContext, which
//      counts ONLY WebSocket frames received since this page load and is seeded to 0. An admin with
//      7 unread notifications waiting sees no bell badge at all until a new one arrives live. That
//      is asserted in the second `it()` below as a documented observation, not as the row's verdict.
//
// The row's `dispatch(markAllRead())` is the page's own "✓ Mark All Read" button (this portal uses
// React context, not Redux).
//
// BACKEND MIRROR — the POST/PATCH verb mismatch this spec exposes is NOT an artefact of stubbing.
// NotificationController maps the read route as @PatchMapping("/{id}/read") only, and
// NotificationsPage.js's `markRead` issues a POST to it. What the real server answers for that POST
// was measured, not guessed: fieldops NotificationIntegrationTest::markReadRoute_rejectsPostVerb_
// evidenceForNotif010 drives it against real MySQL and gets HTTP 500 with body
// {"status":500,"error":"Internal Server Error","message":"An unexpected error occurred. Please try
// again."} (GlobalExceptionHandler has no HttpRequestMethodNotSupportedException handler). The POST
// intercept below replies with exactly that, so the page behaves here exactly as it does in
// production. The PATCH route the page *should* be calling is stubbed 200, so if the page is ever
// fixed to use PATCH this spec goes green with no edit.

const UNREAD_COUNT = 7;

const notif = (id, type, read) => ({
  id,
  recipientId: 5,
  type,
  title: `${type.replace(/_/g, ' ')} #${id}`,
  body: `Notification body for #${id}`,
  referenceId: 1000 + id,
  referenceType: type.startsWith('FAULT') ? 'FAULT' : 'PAYMENT',
  isRead: read,
  read,
  readAt: read ? '2026-08-12T08:00:00' : null,
  isPushSent: false,
  createdAt: '2026-08-12T09:00:00',
  timeAgo: '5 minutes ago',
});

const UNREAD = [
  notif(1, 'FAULT_ASSIGNED', false),
  notif(2, 'FAULT_REPORTED', false),
  notif(3, 'FAULT_COMPLETED', false),
  notif(4, 'PAYMENT_APPROVED', false),
  notif(5, 'PAYMENT_REJECTED', false),
  notif(6, 'FAULT_ASSIGNED', false),
  notif(7, 'MATERIAL_REQUEST_APPROVED', false),
];
const READ = [notif(101, 'FAULT_COMPLETED', true), notif(102, 'PAYMENT_APPROVED', true)];

const seedSession = (win) => {
  win.localStorage.setItem('accessToken', 'test-access-token');
  win.localStorage.setItem('refreshToken', 'test-refresh-token');
  win.localStorage.setItem(
    'user',
    JSON.stringify({ id: 5, username: 'admin', role: 'ADMIN', fullName: 'Ops Admin' }),
  );
};

describe('NOTIF-010 — notification badge count', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/notifications', {
      statusCode: 200,
      body: [...UNREAD, ...READ],
    }).as('notifications');

    // The route the page SHOULD be calling (NotificationController is PATCH-only).
    cy.intercept('PATCH', '**/api/notifications/*/read', {
      statusCode: 200,
      body: { ...notif(1, 'FAULT_ASSIGNED', true) },
    }).as('patchRead');

    // The route the page ACTUALLY calls, answered exactly as the real backend answers it.
    cy.intercept('POST', '**/api/notifications/*/read', {
      statusCode: 500,
      body: {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred. Please try again.',
        status: 500,
        timestamp: '2026-08-12T05:27:51.755357600',
      },
    }).as('postRead');

    cy.visit('/notifications', { onBeforeLoad: seedSession });
    cy.wait('@notifications');
  });

  it('badgeCount_clearsOnMarkAllRead', () => {
    // ── Steps 1-2: the badge reflects the 7 unread notifications on load ──────────────────
    cy.contains(`${UNREAD_COUNT} new`).should('be.visible');
    cy.contains(`${UNREAD.length + READ.length} total notifications`).should('be.visible');

    // ── Step 3: mark all read ─────────────────────────────────────────────────────────────
    cy.contains('button', 'Mark All Read').click();

    // The page must use the verb the API exposes. This is the root cause of the step-4 failure
    // below and is asserted first so the reason is unambiguous.
    cy.get('@postRead.all').should(
      'have.length',
      0,
      'NotificationsPage.markRead POSTs to /api/notifications/{id}/read, but the route is '
        + 'PATCH-only (NotificationController @PatchMapping) — every mark-read request fails',
    );

    // ── Step 4: the badge clears ──────────────────────────────────────────────────────────
    cy.contains(`${UNREAD_COUNT} new`).should('not.exist');
    cy.contains('button', 'Mark All Read').should('not.exist');
    cy.contains("You're all caught up!").should('not.exist'); // list still renders, just all read
  });

  it('sidebar bell badge ignores the unread notifications already on the server', () => {
    // Documented observation, not one of the row's steps: Sidebar.js's badge renders only when
    // `liveUnreadCount > 0`, and that counter starts at 0 on every page load and is incremented
    // solely by NOTIFICATION frames arriving over the WebSocket. With 7 unread rows waiting on
    // the server, the bell shows the connection dot instead of a count.
    cy.get('nav').contains('Notifications').parent().within(() => {
      cy.contains(String(UNREAD_COUNT)).should('exist');
    });
  });
});
