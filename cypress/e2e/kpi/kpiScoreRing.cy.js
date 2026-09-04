// KPI-007 (06_KPI_PERFORMANCE, FR-16) — the KPI score ring must render the score it is given and
// the correct performance band beside it, including for a score of 0.
//
// Tool substitution. The row maps to `KpiScoreRing.test.jsx::scoreLabels_EXCELLENT_GOOD_NEEDS_WORK`
// with Tool "Jest + RTL". frontend-admin has no Jest/RTL setup at all: package.json has no `test`
// script, and neither `@testing-library/react` nor `react-test-renderer` is a dependency (only
// `@testing-library/jest-dom`, which cannot satisfy an RTL import on its own). Adding a test
// framework to a module is a project decision, not this suite's, so this row is covered with
// Cypress — the module's only real component-level option and the same substitution used across
// 04_PAYMENT_FLOW and 05_RESOURCE_MGMT.
//
// Component location. There is no `KpiScoreRing` component file. The ring is `ScoreRing`, declared
// inline inside frontend-admin/src/pages/KPI/KpiPage.js and not exported, so it can only be driven
// through the page that renders it. Its largest instance is the technician KPI drawer's score
// header, reached by clicking a leaderboard row, which is what this spec drives.
//
// Two corrections to the row's expectations, both facts about the implementation:
//   1. ScoreRing renders ONLY the rounded number — it has no label of its own. The performance
//      band ("EXCELLENT" / "GOOD" / "NEEDS WORK") is rendered beside it from `performanceLevel`
//      as it comes back from the API, mapped through KpiPage.js's PERF table; it is not derived
//      from the score in the browser. Both parts are asserted here.
//   2. The row expects score 55 -> "NEEDS WORK". The backend's bands
//      (KpiCalculationService.getPerformanceLevel) are EXCELLENT >= 90, GOOD >= 75, AVERAGE >= 60,
//      BELOW_AVERAGE >= 40, NEEDS_IMPROVEMENT below that, and the portal renders BELOW_AVERAGE as
//      "BELOW AVG". 55 is therefore BELOW_AVERAGE, and "NEEDS WORK" is what a score under 40 —
//      including the row's own 0 — produces. The spec asserts the real bands for all four scores,
//      which still covers EXCELLENT, GOOD and NEEDS WORK as the mapped test name requires.

const LEADERBOARD = [
  {
    rank: 1, technicianId: 5, technicianName: 'Ring Tech', phone: '0771234567',
    avatarInitial: 'R', branchName: 'Colombo Central', overallScore: 82, completionRate: 85,
    satisfactionScore: 4.5, completedJobs: 17, performanceLevel: 'GOOD',
    performanceColor: '#2196F3', badge: '🥇', starRating: 4, trend: 'STABLE',
  },
  {
    rank: 2, technicianId: 6, technicianName: 'Other Tech', phone: '0772234567',
    avatarInitial: 'O', branchName: 'Colombo Central', overallScore: 60, completionRate: 55,
    satisfactionScore: 4.5, completedJobs: 8, performanceLevel: 'AVERAGE',
    performanceColor: '#FF9800', badge: '🥈', starRating: 3, trend: 'STABLE',
  },
];

const kpiWithScore = (overallScore, performanceLevel) => ({
  technicianId: 5, technicianName: 'Ring Tech', phone: '0771234567', avatarInitial: 'R',
  period: 'MONTHLY', startDate: '2026-08-01', endDate: '2026-08-11',
  totalJobs: 20, completedJobs: 17, inProgressJobs: 3, cancelledJobs: 0,
  completionRate: 85, avgJobDurationHours: 2.3, avgResponseTimeMinutes: 22,
  customerSatisfactionScore: 4.5, onTimeCompletionRate: 76.5, totalRevenue: 120000,
  presentDays: 8, avgWorkingHours: 7.6, attendanceRate: 90,
  overallScore,
  performanceLevel,
  performanceColor: '#2196F3',
  starRating: 4,
  totalTargets: 0, achievedTargets: 0, onTrackTargets: 0, atRiskTargets: 0, behindTargets: 0,
  targets: [],
});

// score -> [performanceLevel from the backend's bands, label the portal renders]
const CASES = [
  [82, 'GOOD',              'GOOD'],
  [95, 'EXCELLENT',         'EXCELLENT'],
  [55, 'BELOW_AVERAGE',     'BELOW AVG'],
  [0,  'NEEDS_IMPROVEMENT', 'NEEDS WORK'],
];

describe('KPI-007 — KPI score ring renders the score and its performance band', () => {
  const openDrawerWith = (score, performanceLevel) => {
    cy.intercept('GET', '**/api/users', { statusCode: 200, body: [] }).as('users');
    cy.intercept('GET', '**/api/kpi/leaderboard*', { statusCode: 200, body: LEADERBOARD })
      .as('leaderboard');
    cy.intercept('GET', '**/api/kpi/score/5*', {
      statusCode: 200,
      body: kpiWithScore(score, performanceLevel),
    }).as('score');
    cy.intercept('GET', '**/api/kpi/targets/technician/5', { statusCode: 200, body: [] })
      .as('targets');

    cy.visit('/kpi', {
      onBeforeLoad(win) {
        win.localStorage.setItem('accessToken', 'test-access-token');
        win.localStorage.setItem('refreshToken', 'test-refresh-token');
        win.localStorage.setItem(
          'user',
          JSON.stringify({ id: 1, username: 'admin', role: 'ADMIN', fullName: 'Ops Admin' }),
        );
      },
    });

    cy.wait('@leaderboard');
    cy.contains('td', 'Ring Tech').click();
    cy.wait('@score');
  };

  it('scoreLabels_EXCELLENT_GOOD_NEEDS_WORK', () => {
    CASES.forEach(([score, performanceLevel, label]) => {
      openDrawerWith(score, performanceLevel);

      // The ring itself: an <svg> whose only <text> node is the rounded score.
      cy.get('svg text').first().should('have.text', String(score));

      // The band rendered next to it. Scoped to the ring's own sibling block: the leaderboard
      // table behind the drawer carries performance-band pills with the same wording, and a bare
      // cy.contains would match one of those (clipped, and about a different technician).
      cy.get('svg').first().siblings('div').first().should('contain', label);
    });
  });
});
