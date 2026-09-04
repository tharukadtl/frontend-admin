// RES-019 (05_RESOURCE_MGMT, FR-15) — the Admin portal's bulk CSV user import, end to end:
// pick a file, submit it, read the per-row result summary, and see the user list refresh with the
// accounts that were actually created.
//
// Selector adaptation. The row is written against `[data-testid="import-summary"]`. There is not a
// single `data-testid` anywhere in frontend-admin/src, and adding them would be a production-code
// change, so this spec drives the real controls a user would touch: the "⇪ Import CSV" header
// button, the modal's `input[type=file]`, and its "Import" button — then reads the summary block
// UsersPage.js actually renders. Same approach as cypress/e2e/faults/liveMap.cy.js and
// cypress/e2e/payments/exportPayments.cy.js.
//
// Summary wording. The row's assertion string is "1 of 3 succeeded". The real component renders
// `{successCount} of {totalRows} rows imported` plus `— {failureCount} failed`
// (UsersPage.js:210-213), so the assertions below check those numbers in the real wording rather
// than a literal string the UI never produces.
//
// Data. Both backend calls are stubbed with cy.intercept (liveMap.cy.js convention) so the spec is
// deterministic and needs no dev database. The import response is the exact BulkUserImportResponse
// shape the backend returns (totalRows / successCount / failureCount / createdUsernames / errors)
// for the row's 3-row CSV: one valid row, one duplicate username, one invalid role — the same
// scenario UserServiceBulkImportTest::partialSuccessPerRowErrors (RES-016) proves server-side.

const EXISTING_USERS = [
  {
    id: 1, fullName: 'Ops Admin', username: 'admin', role: 'ADMIN',
    branchName: 'Colombo', email: 'admin@slt.lk', phone: '0770000001', isActive: true,
  },
  {
    id: 2, fullName: 'Duplicate Dinesh', username: 'dinesh', role: 'TECHNICIAN',
    branchName: 'Kandy', email: 'dinesh@slt.lk', phone: '0770000002', isActive: true,
  },
];

const IMPORTED_USER = {
  id: 3, fullName: 'Nimal Perera', username: 'nimal.perera', role: 'TECHNICIAN',
  branchName: 'Colombo', email: 'nimal@slt.lk', phone: '0771234567', isActive: true,
};

const IMPORT_RESULT = {
  totalRows: 3,
  successCount: 1,
  failureCount: 2,
  createdUsernames: ['nimal.perera'],
  errors: [
    "Row 3: Username 'dinesh' is already taken.",
    'Row 4: Invalid role: NOTAROLE',
  ],
};

const CSV = [
  'username,password,fullName,email,phone,address,role,branchId,workgroupId',
  'nimal.perera,Passw0rd!,Nimal Perera,nimal@slt.lk,0771234567,Colombo,TECHNICIAN,1,',
  'dinesh,Passw0rd!,Duplicate Dinesh,dup@slt.lk,0771234568,Kandy,TECHNICIAN,1,',
  'bad.role,Passw0rd!,Bad Role Bandara,bad@slt.lk,0771234569,Galle,NOTAROLE,1,',
].join('\n');

describe('RES-019 — bulk CSV user import, upload to summary to refreshed list', () => {
  beforeEach(() => {
    let usersLoads = 0;
    cy.intercept('GET', '**/api/users*', (req) => {
      usersLoads += 1;
      // The first load is the page mount; every later load is the post-import refresh, which must
      // now include the account the import actually created.
      req.reply({
        statusCode: 200,
        body: usersLoads === 1 ? EXISTING_USERS : [...EXISTING_USERS, IMPORTED_USER],
      });
    }).as('users');

    cy.intercept('GET', '**/api/branches', {
      statusCode: 200,
      body: [{ id: 1, name: 'Colombo' }, { id: 2, name: 'Kandy' }],
    }).as('branches');

    cy.intercept('POST', '**/api/users/import', {
      statusCode: 200,
      body: IMPORT_RESULT,
    }).as('import');

    cy.visit('/users', {
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

  it('uploadAndSummary', () => {
    cy.location('pathname').should('eq', '/users');
    cy.wait('@users');
    cy.contains('Duplicate Dinesh').should('be.visible');

    // Step 1: open the importer and choose the file.
    cy.contains('button', 'Import CSV').click();
    cy.contains('Bulk Import Users (CSV)').should('be.visible');

    cy.get('input[type=file]').selectFile(
      {
        contents: Cypress.Buffer.from(CSV),
        fileName: 'users.csv',
        mimeType: 'text/csv',
      },
      { force: true },
    );

    // Step 2: submit it. The button is disabled until a file is chosen, which is itself part of
    // the flow being asserted. Matched exactly — a loose 'Import' also matches the header's
    // "⇪ Import CSV" button, which the modal overlay now covers.
    cy.contains('button', /^Import$/).should('not.be.disabled').click();
    cy.wait('@import');

    // Step 3: the result summary reports how many of how many succeeded, and how many failed.
    cy.contains('1 of 3 rows imported').should('be.visible');
    cy.contains('2 failed').should('be.visible');
    cy.contains('Created: nimal.perera').should('be.visible');

    // Step 4: every failed row is listed individually, with its own row number and reason.
    cy.contains('Errors:').should('be.visible');
    cy.contains("Row 3: Username 'dinesh' is already taken.").should('be.visible');
    cy.contains('Row 4: Invalid role: NOTAROLE').should('be.visible');

    // Step 5: the user list behind the modal refreshed and now shows the created account.
    cy.wait('@users');
    cy.contains('button', 'Close').click();
    cy.contains('Bulk Import Users (CSV)').should('not.exist');

    cy.contains('Nimal Perera').should('be.visible');
    cy.contains('nimal.perera').should('be.visible');

    // And the rows that failed were genuinely not created.
    cy.contains('Bad Role Bandara').should('not.exist');
  });
});
