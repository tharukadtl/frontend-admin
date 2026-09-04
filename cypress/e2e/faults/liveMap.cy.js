// FAULT-013 (02_FAULT_TRACKING, FR-6) — the admin dashboard's live map shows every available
// technician, and clicking a marker opens a popup carrying that technician's status.
//
// Selector adaptation. The row is written against `[data-testid=liveMapWidget]`,
// `[data-testid=techMarker]` and `[data-testid=techPopup]`. There is not a single `data-testid`
// anywhere in frontend-admin/src, and adding them would be a production-code change. The widget is
// a react-leaflet <MapContainer> whose technician pins are <CircleMarker>s (DashboardPage.js
// lines 824-869), so the real, stable DOM equivalents are used instead:
//   liveMapWidget -> .leaflet-container
//   techMarker    -> path.leaflet-interactive inside it (one SVG path per CircleMarker)
//   techPopup     -> .leaflet-popup
// This mirrors cypress/e2e/login.cy.js, which likewise locates elements by real markup and labels.
//
// Data. The row's precondition is "3 technicians with GPS in DB". The six dashboard endpoints are
// stubbed with cy.intercept so the spec asserts the map's rendering behaviour deterministically
// rather than depending on whatever rows the shared dev database happens to hold. The session is
// seeded the way AuthContext restores one (localStorage accessToken + user), since this row is
// about the map, not about logging in — that is covered by login.cy.js.
//
// The map opens on the "Faults" tab; the technician pins are on the "Technicians" tab, so the spec
// switches to it first.

const TECHNICIANS = [
  { technicianId: 5, technicianName: 'Nimal Perera',  latitude: 6.9271, longitude: 79.8612, status: 'AVAILABLE' },
  { technicianId: 6, technicianName: 'Kamal Silva',   latitude: 7.2906, longitude: 80.6337, status: 'AVAILABLE' },
  { technicianId: 7, technicianName: 'Sunil Fernando', latitude: 6.0535, longitude: 80.2210, status: 'ON_JOB' },
];

describe('FAULT-013 — dashboard live map shows technician markers', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/dashboard/kpi-summary', {
      statusCode: 200,
      body: { totalFaults: 12, openFaults: 4, activeTechnicians: 3, avgResolutionHours: 5.5 },
    }).as('kpi');

    cy.intercept('GET', '**/api/dashboard/fault-distribution', {
      statusCode: 200,
      body: {
        open: 4, openPercent: 33.3,
        inProgress: 3, inProgressPercent: 25,
        completed: 4, completedPercent: 33.3,
        cancelled: 1, cancelledPercent: 8.4,
      },
    }).as('distribution');

    cy.intercept('GET', '**/api/dashboard/fault-trends*', { statusCode: 200, body: [] }).as('trends');
    cy.intercept('GET', '**/api/dashboard/technician-performance', { statusCode: 200, body: [] }).as('techPerf');
    cy.intercept('GET', '**/api/dashboard/recent-activity*', { statusCode: 200, body: [] }).as('activity');

    cy.intercept('GET', '**/api/dashboard/geographic-data', {
      statusCode: 200,
      body: { faultHeatMap: [], technicianLocations: TECHNICIANS },
    }).as('geographicData');

    // Seed the session exactly as AuthContext restores one on mount.
    cy.visit('/dashboard', {
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

  it('dashboardMap_showsTechMarkers', () => {
    // Step 1: the dashboard loaded (not bounced to /login) and pulled its data.
    cy.location('pathname').should('eq', '/dashboard');
    cy.wait('@geographicData');

    // Step 2: the map widget is visible.
    cy.get('.leaflet-container').should('be.visible');

    // The pins for technicians live on the Technicians tab; the map opens on Faults.
    cy.contains('button', 'Technicians').click();

    // Step 3: one marker per technician with a GPS position, at least 3.
    cy.get('.leaflet-container path.leaflet-interactive')
      .should('have.length.at.least', 3);

    // Step 4: clicking a marker...
    cy.get('.leaflet-container path.leaflet-interactive').first().click({ force: true });

    // Steps 5-6: ...opens a popup naming the technician and their status.
    cy.get('.leaflet-popup').should('be.visible');
    cy.get('.leaflet-popup').should('contain', 'Status:');
    cy.get('.leaflet-popup').should('contain', 'AVAILABLE');
    cy.get('.leaflet-popup').should('contain', 'Nimal Perera');
  });
});
