const { defineConfig } = require('cypress');
const { execFile } = require('child_process');
const path = require('path');

// H1c's attachCircuit.cy.js needs to seed/delete a real `faults` row directly via SQL (real
// POST /api/faults is CLIENT-role and OTP-gated, not drivable from a Cypress spec -- see that
// spec's own comment). cy.exec() was tried first and failed on this machine: Cypress's exec
// shells out through a bash.exe path it auto-detects, which is broken here ("No such file or
// directory") -- a Windows/Cypress environment quirk, unrelated to the script itself.
// execFile() runs python directly with no shell involved, sidestepping that entirely.
// Absolute path, not the bare "python" command: Cypress's Node process resolves PATH
// differently than an interactive shell on this machine and was landing on the Windows Store
// app-execution-alias stub (which errors unless Python is installed via the Store) instead of
// the real interpreter used everywhere else this session.
const PYTHON = 'C:\\Users\\lenovo\\AppData\\Local\\Python\\bin\\python.exe';

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
      const seedScript = path.join('cypress', 'support', 'seed_h1c_fault.py');
      on('task', {
        seedH1cFault() {
          return runPython([seedScript]);
        },
        // Stage 2's attachCause.cy.js — same seed script, plus the Technician's Stage-1 free-text
        // causeOfFault so the Cause tab has something real to render at the top of the picker.
        seedFaultWithCause(causeOfFault) {
          return runPython([seedScript, '--cause-of-fault', causeOfFault]);
        },
        deleteH1cFault(id) {
          return runPython([seedScript, '--delete', String(id)]);
        },
      });
    },
  },
});
