const { defineConfig } = require('cypress');
const { execFile } = require('child_process');
const path = require('path');

// H1c's attachCircuit.cy.js needs to seed/delete a real `faults` row directly via SQL (real
// POST /api/faults is CLIENT-role and OTP-gated, not drivable from a Cypress spec -- see that
// spec's own comment). cy.exec() was tried first and failed on this machine: Cypress's exec
// shells out through a bash.exe path it auto-detects, which is broken here ("No such file or
// directory") -- a Windows/Cypress environment quirk, unrelated to the script itself.
// execFile() runs python directly with no shell involved, sidestepping that entirely.
//
// 2026-09-03, CI-portability fix: this used to be a bare hardcoded absolute path
// (C:\Users\<one specific Windows account>\AppData\Local\Python\bin\python.exe) -- it never
// worked for any OTHER local developer's machine either, not just CI, since it's tied to one
// person's username. CYPRESS_PYTHON_BIN lets any environment point at its own interpreter;
// the default ('python3') is what every Linux CI runner (including GitHub Actions'
// ubuntu-latest, which ships Python 3 preinstalled) provides directly on PATH with none of
// the Windows Store app-execution-alias-stub quirk a bare "python" hit on this machine.
// Set CYPRESS_PYTHON_BIN locally (e.g. in a git-ignored .env, or your shell profile) if your
// own "python3"/"python" doesn't resolve to a real interpreter.
const PYTHON = process.env.CYPRESS_PYTHON_BIN || 'python3';

function runPython(args) {
  return new Promise((resolve, reject) => {
    execFile(PYTHON, args, { cwd: __dirname }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: false,
    specPattern: 'cypress/e2e/**/*.cy.js',
    setupNodeEvents(on) {
      // Renamed + extended from seed_h1c_fault.py, 2026-09-03 -- see the script's own module
      // docstring for the full story (real API seeding replaced this for attachCircuit's
      // Opmc->Exchange->Cab->Dp->Circuit chain; this script now only covers what has no create
      // endpoint at all: the Fault row itself, the Cause hierarchy, and the bootstrap admin user).
      const seedScript = path.join('cypress', 'support', 'seed_live_fixtures.py');
      on('task', {
        // Idempotent -- safe to call from every live spec's before() hook, not just once globally,
        // since a second call is a no-op (confirmed in the script itself, not assumed).
        seedAdmin() {
          return runPython([seedScript, 'seed-admin']);
        },
        seedFault() {
          return runPython([seedScript, 'seed-fault']);
        },
        // attachCause.cy.js — same script, now also creates a fresh TypeOfFault->CauseCategory->
        // CauseOfFault chain (real endpoints don't exist for this hierarchy) alongside the fault,
        // carrying the Technician's Stage-1 free-text finding so the Cause tab has something real
        // to render at the top of the picker.
        seedFaultWithCause(techFinding) {
          return runPython([seedScript, 'seed-cause', '--tech-finding', techFinding]);
        },
        deleteFault(id) {
          return runPython([seedScript, 'delete-fault', String(id)]);
        },
      });
    },
  },
});
