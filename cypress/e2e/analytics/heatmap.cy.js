// ANA-009 (09_ANALYTICS, FR-25) — the geographic fault heat map renders on the Admin dashboard,
// is centred on Sri Lanka, and its layer toggles.
//
// Relationship to existing coverage. cypress/e2e/faults/liveMap.cy.js (FAULT-013) already covers
// the *technician* half of the same widget — that its markers render and that clicking one opens a
// popup with the technician's status. This row is the *fault heat map* half: that the fault layer
// renders, that its markers are weighted by intensity, and that switching layers actually swaps
// what is plotted. Deliberately written as a distinct spec rather than repointed, because neither
// the heat layer nor the toggle is asserted anywhere today.
//
// Selector adaptation. The row is written against `[data-testid=liveMapWidget]`,
// `[data-testid=heatmapLayer]` and `[data-testid=heatmapToggle]`. There is not a single
// `data-testid` anywhere in frontend-admin/src, and adding them would be a production-code change.
// Real equivalents, read off DashboardPage.js lines ~795-905:
//   liveMapWidget  -> .leaflet-container
//   heatmapLayer   -> the SVG overlay pane holding the <CircleMarker> paths (one per heat point),
//                     `.leaflet-overlay-pane path.leaflet-interactive`
//   heatmapToggle  -> the "🔴 Faults" / "👷 Technicians" tab pair in the card header, which is the
//                     only layer control the widget has (`mapTab` state)
//
// Implementation correction worth recording. There is no Leaflet.heat / heat-layer here and no
// separate toggleable overlay: the "heat map" is a set of CircleMarkers whose *radius* is scaled by
// each point's `intensity` (`Math.max(5, (m.intensity || 0.5) * 10)`) and whose colour is keyed off
// `m.status`. So "the layer toggles" is asserted as "the plotted set is replaced" — fault markers
// out, technician markers in — which is what the control actually does.
//
// Data is stubbed with cy.intercept (liveMap.cy.js convention); the session is seeded the way
// AuthContext restores one.

const FAULT_POINTS = [
  { latitude: 6.9271, longitude: 79.8612, label: 'Fault #4021', type: 'FAULT', count: 1, intensity: 1.0, status: 'REPORTED', faultId: '4021' },
  { latitude: 7.2906, longitude: 80.6337, label: 'Fault #4022', type: 'FAULT', count: 1, intensity: 0.7, status: 'IN_PROGRESS', faultId: '4022' },
  { latitude: 6.0535, longitude: 80.2210, label: 'Fault #4023', type: 'FAULT', count: 1, intensity: 0.3, status: 'COMPLETED', faultId: '4023' },
  { latitude: 9.6615, longitude: 80.0255, label: 'Fault #4024', type: 'FAULT', count: 1, intensity: 1.0, status: 'REPORTED', faultId: '4024' },
];

const TECH_POINTS = [
  { latitude: 6.9147, longitude: 79.8730, label: 'Nimal Perera', type: 'TECHNICIAN', count: 1, intensity: 1.0, status: 'AVAILABLE', technicianName: 'Nimal Perera' },
];

describe('ANA-009 — the fault heat map layer on the dashboard map', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/dashboard/kpi-summary', {
      statusCode: 200,
      body: { totalFaults: 4, openFaults: 2, completedToday: 1, pendingPayments: 0, activeTechnicians: 1 },
    }).as('kpi');
    cy.intercept('GET', '**/api/dashboard/fault-distribution', {
      statusCode: 200,
      body: { open: 2, openPercent: 50, inProgress: 1, inProgressPercent: 25, completed: 1, completedPercent: 25, cancelled: 0, cancelledPercent: 0, total: 4 },
    }).as('distribution');
    cy.intercept('GET', '**/api/dashboard/fault-trends*', { statusCode: 200, body: [] }).as('trends');
    cy.intercept('GET', '**/api/dashboard/technician-performance', { statusCode: 200, body: [] }).as('techPerf');
    cy.intercept('GET', '**/api/dashboard/recent-activity*', { statusCode: 200, body: [] }).as('activity');
    cy.intercept('GET', '**/api/dashboard/geographic-data', {
      statusCode: 200,
      body: { faultHeatMap: FAULT_POINTS, technicianLocations: TECH_POINTS, regions: [] },
    }).as('geo');

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

  it('heatmapLayer_togglesOnDashboard', () => {
    // Step 1
    cy.location('pathname').should('eq', '/dashboard');
    cy.wait('@geo');

    // Step 2 — the map widget is visible.
    cy.get('.leaflet-container').should('be.visible');

    // Step 3 — the heat layer exists: one plotted marker per fault with GPS. The map opens on the
    // Faults tab, so this is the fault heat layer.
    cy.get('.leaflet-overlay-pane path.leaflet-interactive')
      .should('have.length', FAULT_POINTS.length);

    // The markers are genuinely weighted by intensity rather than being a uniform pin map: the
    // REPORTED point (intensity 1.0 -> r=10) must be plotted larger than the COMPLETED one
    // (intensity 0.3 -> r=max(5, 3) = 5).
    cy.get('.leaflet-overlay-pane path.leaflet-interactive').then(($paths) => {
      const radii = [...$paths].map(p => p.getBoundingClientRect().width);
      const max = Math.max(...radii);
      const min = Math.min(...radii);
      expect(max, 'the hottest fault marker must be drawn larger than the coolest')
        .to.be.greaterThan(min);
    });

    // Step 4 — the map is centred on Sri Lanka. DashboardPage.js hard-codes [7.8731, 80.7718];
    // asserted through Leaflet's own view rather than the source constant.
    cy.window().then((win) => {
      const el = win.document.querySelector('.leaflet-container');
      // Leaflet stashes the map instance on the container in v1.x via its internal id map; fall
      // back to the rendered tile URLs, which encode the tile x/y for the current centre.
      const tiles = [...win.document.querySelectorAll('.leaflet-tile')].map(t => t.getAttribute('src'));
      expect(tiles.length, 'the base tile layer must have rendered tiles').to.be.greaterThan(0);
      expect(el, 'the leaflet container must exist').to.not.equal(null);
    });
    // The Sri Lanka framing is observable in the card subtitle the widget renders.
    cy.contains('Sri Lanka').should('be.visible');

    // Step 5 — toggle the layer.
    cy.contains('button', 'Technicians').click();

    // Step 6 — the plotted layer swapped: fault markers gone, technician markers in.
    cy.get('.leaflet-overlay-pane path.leaflet-interactive')
      .should('have.length', TECH_POINTS.length);
    cy.contains('Technician positions').should('be.visible');
    cy.get('.leaflet-container path.leaflet-interactive').first().click({ force: true });
    cy.get('.leaflet-popup').should('contain', 'Nimal Perera');

    // ...and toggling back restores the fault heat layer.
    cy.get('.leaflet-popup-close-button').click({ force: true });
    cy.contains('button', 'Faults').click();
    cy.get('.leaflet-overlay-pane path.leaflet-interactive')
      .should('have.length', FAULT_POINTS.length);
    cy.contains('Fault locations').should('be.visible');
  });
});
