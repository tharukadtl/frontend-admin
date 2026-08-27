"""seed_h1c_fault.py — creates (or deletes) one real REPORTED fault directly via SQL. Originally
built for cypress/e2e/faults/attachCircuit.cy.js to attach a Circuit to; Stage 2's
cypress/e2e/faults/attachCause.cy.js reuses it (via a new --cause-of-fault arg) rather than
duplicating this same seed/delete plumbing for a second, near-identical spec.

Bypasses the app's real POST /api/faults (CLIENT-role, requires OTP-based auth in this codebase --
confirmed via SLTMobileApp/__tests__/clientLogin.e2e.test.tsx -- not a simple password login this
script can drive) the same way this session's other real-data work seeded rows directly when the
app-level path wasn't practical to drive from outside.

Usage:
  python seed_h1c_fault.py                          -- creates a fault, prints FAULT_ID=<id> / MARKER=<desc>
  python seed_h1c_fault.py --cause-of-fault "text"   -- same, also sets faults.cause_of_fault (the
                                                         Technician's Stage-1 free-text finding) so
                                                         attachCause.cy.js can assert the Cause tab
                                                         renders it
  python seed_h1c_fault.py --delete <id>             -- deletes that fault (and its fault_history
                                                         rows -- faults has no DELETE endpoint at
                                                         all, and no FK cascade is assumed, so
                                                         history is cleaned up explicitly rather
                                                         than left orphaned)
"""
import sys
import time

import pymysql

conn = pymysql.connect(host="localhost", port=3306, user="root", password="1234",
                        database="slt_fieldops_db", autocommit=False)
cur = conn.cursor()

if len(sys.argv) >= 3 and sys.argv[1] == "--delete":
    fault_id = int(sys.argv[2])
    cur.execute("DELETE FROM fault_history WHERE fault_id = %s", (fault_id,))
    cur.execute("DELETE FROM faults WHERE id = %s", (fault_id,))
    conn.commit()
    print(f"DELETED={fault_id}")
else:
    cause_of_fault = None
    if len(sys.argv) >= 3 and sys.argv[1] == "--cause-of-fault":
        cause_of_fault = sys.argv[2]

    marker = f"H1c Cypress test fault {int(time.time() * 1000)}"
    fault_number = f"CYT-H1C-{int(time.time())}"

    cur.execute(
        """
        INSERT INTO faults (fault_number, customer_id, category, description, opmc_id, priority,
                             status, reopen_count, cause_of_fault)
        VALUES (%s, 6, 'INTERNET', %s, 1, 'MEDIUM', 'REPORTED', 0, %s)
        """,
        (fault_number, marker, cause_of_fault),
    )
    conn.commit()
    fault_id = cur.lastrowid

    print(f"FAULT_ID={fault_id}")
    print(f"MARKER={marker}")
