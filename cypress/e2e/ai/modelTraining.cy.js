// AI-033 (10_AI_MODULE, FR-30 / SRS 5.6.7) — the Model Training page must run a CSV upload through
// the 4-step progress indicator to completion, render two INDEPENDENT result cards (forecaster and
// clusterer) each with its own comparison metrics, and let an Admin activate one model without the
// other being activated with it.
//
// Selector adaptation. The row is written against `[data-testid="forecaster-activate"]`. There is
// not a single `data-testid` anywhere in frontend-admin/src, and adding one would be a
// production-code change, so this spec targets the real controls a user would click — the
// per-model "✓ ACTIVATE MODEL (v<n>)" buttons rendered by ModelResultCard, scoped by the card's own
// heading ("Forecasting Model" / "Clustering Model"). Same approach as
// cypress/e2e/kpi/exportKpi.cy.js and cypress/e2e/payments/exportPayments.cy.js.
//
// Data. The Flask AI service (localhost:5000) is stubbed with cy.intercept rather than run for real:
// the row's point is the UI's independence between the two models, and a real training run would
// make the assertion depend on Prophet's runtime and on whichever model version happened to be
// active on this machine. The stubbed payloads are the real response shapes, taken from app.py's
// `ok()` envelope, models/forecasting.py's and models/clustering.py's `retrain()` return values,
// and models/model_registry.py's `build_comparison()`.
//
// The independence claim is asserted two ways, because a page that simply rendered two buttons
// would pass a weaker check: (1) after activating the forecaster, the clusterer's ACTIVATE button is
// still on screen and still says CANDIDATE; and (2) the clusterer's activate endpoint was never
// called at all, verified by a spy intercept that fails the test if it fires.

const AI = 'http://localhost:5000';

const versionEntry = (versionId, status, createdAt, metrics) => ({
  versionId,
  status,
  createdAt,
  metrics,
  meta: { training_rows: 540 },
});

const FORECASTER_VERSIONS = [
  versionEntry(11, 'active', '2026-07-23T04:03:51Z', { mae: 4.78, rmse: 6.08, accuracy: 78.8 }),
  versionEntry(10, 'archived', '2026-07-19T17:12:25Z', { mae: 5.2, rmse: 6.9, accuracy: 74.1 }),
];

const CLUSTERER_VERSIONS = [
  versionEntry(125, 'active', '2026-08-12T14:37:22Z', { inertia: 41.2, silhouetteScore: 0.71 }),
  versionEntry(124, 'archived', '2026-08-12T14:37:18Z', { inertia: 44.9, silhouetteScore: 0.68 }),
];

const JOB_ID = 'job-ai033-0000000000000000';

const UPLOAD_SUMMARY = {
  filename: 'faults.csv',
  rowCount: 120,
  dateRange: { from: '2026-06-14', to: '2026-08-12' },
  hasGpsColumns: true,
  hasCategoryColumn: true,
  skippedRows: { badDates: 0, badGps: 0, tooOld: 0 },
  maxTrainingWindowMonths: 24,
  usableForForecasting: true,
  usableForClustering: true,
};

// The completed job's per-model results: a candidate + a comparison each, exactly as
// _run_training_job() records them.
const JOB_RESULT = {
  forecaster: {
    mae: 3.81,
    rmse: 4.83,
    accuracy: 81.8,
    versionId: 12,
    status: 'candidate',
    comparison: {
      previousVersionId: 11,
      delta: {
        mae: { previous: 4.78, candidate: 3.81, change: -0.97, improved: true },
        rmse: { previous: 6.08, candidate: 4.83, change: -1.25, improved: true },
        accuracy: { previous: 78.8, candidate: 81.8, change: 3.0, improved: true },
      },
    },
  },
  clusterer: {
    status: 'candidate',
    versionId: 126,
    trainingPoints: 120,
    nClusters: 5,
    metrics: { inertia: 38.4, silhouetteScore: 0.74 },
    comparison: {
      previousVersionId: 125,
      delta: {
        inertia: { previous: 41.2, candidate: 38.4, change: -2.8, improved: true },
        silhouetteScore: { previous: 0.71, candidate: 0.74, change: 0.03, improved: true },
      },
    },
  },
};

// A small, genuinely valid training CSV — the same shape data/upload_manager.py accepts.
const CSV = [
  'date,latitude,longitude,category',
  '2026-08-01,6.9271,79.8612,BROADBAND',
  '2026-08-02,7.2906,80.6337,FIBER',
  '2026-08-03,6.0535,80.2210,TELEPHONE',
].join('\n');

const ok = (data, message = 'OK') => ({
  success: true,
  data,
  message,
  timestamp: '2026-08-13T00:00:00Z',
});

describe('AI-033 — Model Training: activate each model independently', () => {
  beforeEach(() => {
    // Progress through the four documented statuses on successive polls, so the
    // stepper is genuinely driven rather than jumping straight to complete.
    const STATUS_SEQUENCE = ['preprocessing', 'training', 'complete'];
    let poll = 0;

    cy.intercept('GET', `${AI}/api/ai/health`, {
      statusCode: 200,
      body: { service: 'SLT AI Module', status: 'ok', db_status: 'unavailable (synthetic)', models: {} },
    }).as('health');

    cy.intercept('GET', `${AI}/api/ai/model-versions/forecaster`, {
      statusCode: 200,
      body: ok({ versions: FORECASTER_VERSIONS }),
    }).as('forecasterVersions');

    cy.intercept('GET', `${AI}/api/ai/model-versions/clusterer`, {
      statusCode: 200,
      body: ok({ versions: CLUSTERER_VERSIONS }),
    }).as('clustererVersions');

    cy.intercept('POST', `${AI}/api/ai/train`, {
      statusCode: 202,
      body: ok({ jobId: JOB_ID, status: 'queued', uploadSummary: UPLOAD_SUMMARY }, 'Training job queued'),
    }).as('train');

    cy.intercept('GET', `${AI}/api/ai/train/status/*`, req => {
      const status = STATUS_SEQUENCE[Math.min(poll, STATUS_SEQUENCE.length - 1)];
      poll += 1;
      req.reply({
        statusCode: 200,
        body: ok({
          jobId: JOB_ID,
          status,
          createdAt: '2026-08-13T00:00:00Z',
          updatedAt: '2026-08-13T00:00:05Z',
          uploadSummary: UPLOAD_SUMMARY,
          result: status === 'complete' ? JOB_RESULT : null,
          error: null,
        }),
      });
    }).as('jobStatus');

    cy.intercept('POST', `${AI}/api/ai/model-versions/forecaster/activate`, {
      statusCode: 200,
      body: ok(versionEntry(12, 'active', '2026-08-13T00:00:10Z', { mae: 3.81, rmse: 4.83, accuracy: 81.8 }),
              'Version 12 activated for forecaster'),
    }).as('activateForecaster');

    // Spy only — if the page couples the two models, this fires and the assertion at
    // the end of the test catches it.
    cy.intercept('POST', `${AI}/api/ai/model-versions/clusterer/activate`, {
      statusCode: 200,
      body: ok(versionEntry(126, 'active', '2026-08-13T00:00:10Z', {}), 'Version 126 activated for clusterer'),
    }).as('activateClusterer');

    cy.visit('/model-training', {
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

  it('independentActivatePerModel', () => {
    // ── Step 1: the Model Training page is up and talking to the AI service ──────────────
    cy.location('pathname').should('eq', '/model-training');
    cy.contains('Model Training').should('be.visible');
    cy.wait('@health');
    cy.wait('@forecasterVersions');
    cy.wait('@clustererVersions');

    // ── Step 2: upload the CSV and watch the 4-step indicator run to completion ──────────
    cy.get('input[type=file]').selectFile(
      { contents: Cypress.Buffer.from(CSV), fileName: 'faults.csv', mimeType: 'text/csv' },
      { force: true },
    );
    cy.contains('button', /START TRAINING/i).should('not.be.disabled').click();
    cy.wait('@train');

    // All four labelled steps are rendered by the stepper.
    ['Queued', 'Preprocessing', 'Training', 'Complete'].forEach(label => {
      cy.contains(label).should('exist');
    });

    // The upload summary reports what was ingested, including the 24-month window.
    cy.contains('UPLOAD SUMMARY').should('be.visible');
    cy.contains('120 rows ingested').should('be.visible');
    cy.contains('capped at 24 months').should('exist');

    // Polling reaches the terminal state — the result cards only render on
    // job.status === 'complete', so their appearance IS the completion signal.
    // (The START TRAINING button stays disabled afterwards because the form clears
    // its file selection on submit, so it is not a usable "finished" indicator.)
    cy.contains('CANDIDATE v12', { timeout: 20000 }).should('be.visible');

    // ── Step 3: two independent result cards, each with its own comparison metrics ───────
    cy.contains('Forecasting Model').should('be.visible');
    cy.contains('Clustering Model').should('be.visible');
    cy.contains('CANDIDATE v126').should('be.visible');

    // The two cards render DISJOINT metric sets — ModelTrainingPage's MODELS config gives
    // the forecaster mae/rmse/accuracy and the clusterer inertia/silhouetteScore — so the
    // presence of all five labels is proof both cards built their own comparison, not that
    // one card was rendered twice.
    ['MAE', 'RMSE', 'Accuracy'].forEach(label => cy.contains(label).should('exist'));
    ['Inertia', 'Silhouette'].forEach(label => cy.contains(label).should('exist'));

    // And the forecaster's comparison shows previous → candidate, not just the new number.
    cy.contains('4.78').should('exist');   // previous MAE, from active v11
    cy.contains('3.81').should('exist');   // candidate MAE, from v12
    cy.contains('0.74').should('exist');   // candidate silhouette, from clusterer v126

    // ── Step 4: activate the FORECASTER only ─────────────────────────────────────────────
    cy.contains('button', 'ACTIVATE MODEL (v12)').click();
    cy.wait('@activateForecaster').its('request.body').should('deep.equal', { versionId: 12 });
    cy.contains('Forecasting model v12 activated').should('be.visible');

    // ── Step 5: the clusterer candidate is untouched and still independently activatable ─
    cy.contains('CANDIDATE v126').should('be.visible');
    cy.contains('button', 'ACTIVATE MODEL (v126)').should('be.visible').and('not.be.disabled');

    // …and the clusterer's activate endpoint was never called by the forecaster's click.
    cy.get('@activateClusterer.all').should('have.length', 0);
  });
});
