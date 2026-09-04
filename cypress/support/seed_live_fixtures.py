"""seed_live_fixtures.py — direct-SQL fixture seeding for Cypress specs that run against a real,
live fieldops backend (frontend-admin's "live" specs: attachCircuit.cy.js, attachCause.cy.js,
opmcs/provinceDropdown.cy.js, users/workGroupSelector.cy.js, workgroups/workGroupManagement.cy.js,
and kpi/assignTarget.cy.js's live describe block).

Renamed and extended from seed_h1c_fault.py, 2026-09-03, when the CI-portability investigation into
those live specs found each one's real gap:
  - attachCircuit.cy.js no longer needs this script for its Opmc->Exchange->Cab->Dp->Circuit chain
    at all -- those all have real, admin-authenticated POST endpoints, so the spec seeds that chain
    itself via cy.request in its own before() hook. This script still seeds the Fault row (real
    POST /api/faults is CLIENT-role + OTP-gated, not drivable from a browser-context Cypress spec).
  - attachCause.cy.js's TypeOfFault->CauseCategory->CauseOfFault hierarchy has NO create endpoint at
    all (CauseHierarchyController is read-only by design -- confirmed) -- the same reason fieldops's
    own H1b/H1c/Stage2 backend tests had to persist these directly via JPA rather than through a
    controller. `seed-cause` below does the equivalent via raw SQL.
  - None of the 6 live specs had any way to create the very first SUPER_ADMIN account they log in
    as -- confirmed no CommandLineRunner/ApplicationRunner/bootstrap mechanism exists anywhere in
    fieldops (logged as its own Major finding, QA_Compliance_Consolidated_Report.md §4 §M,
    independent of this CI work). `seed-admin` below is the CI-side workaround for that gap; it
    does not fix the underlying application-level gap, which is tracked separately.

Connects directly to fieldops's own datasource (host/port/credentials/database match whatever
run-mode backend .github/workflows/test.yml starts against Testcontainers -- see that workflow for
the exact values used in CI; defaults below match this project's established local-dev convention).

Usage:
  python seed_live_fixtures.py seed-admin
      Idempotently ensures one SUPER_ADMIN user (username=superadmin, password=Admin@2024) exists.
      Safe to call every run -- does nothing if the row is already there. Prints ADMIN_READY=1.

  python seed_live_fixtures.py seed-fault [--cause-of-fault TEXT]
      Creates a fresh REPORTED fault (optionally with a Technician free-text finding).
      Prints FAULT_ID=<id> / MARKER=<description>.

  python seed_live_fixtures.py seed-cause [--tech-finding TEXT]
      Creates a fresh TypeOfFault -> CauseCategory -> CauseOfFault chain (unique generated codes,
      not the real imported hierarchy) AND a fresh fault carrying the given Technician finding.
      Prints FAULT_ID=<id> / MARKER=<description> / CAUSE_ID=<id> / CAUSE_CODE=<code>.

  python seed_live_fixtures.py delete-fault <id>
      Deletes that fault and its fault_history rows (faults has no DELETE endpoint at all, and no
      FK cascade is assumed, so history is cleaned up explicitly rather than left orphaned). Does
      NOT delete any seed-cause hierarchy rows -- those are cheap, harmless to leave (unique codes
      never collide with the real import or with each other run to run), and nothing in fieldops
      ever queries "all type_of_fault rows" in a way a few extra test rows would break.
"""
import argparse
import os
import sys
import time

import pymysql

DB_HOST = os.environ.get("FIELDOPS_DB_HOST", "localhost")
DB_PORT = int(os.environ.get("FIELDOPS_DB_PORT", "3306"))
DB_USER = os.environ.get("FIELDOPS_DB_USER", "root")
DB_PASSWORD = os.environ.get("FIELDOPS_DB_PASSWORD", "1234")
# Defaults describe the real local dev DB (used when this script runs against that, unchanged).
# CI's run-mode backend (against Testcontainers) overrides all four via env vars -- and specifically
# FIELDOPS_DB_NAME, confirmed empirically, not assumed: Testcontainers' MySQLContainer always
# provisions its own default database named "test" and grants its default "test" user access only
# to that -- the "slt_fieldops_db_test" segment in application.yml's `jdbc:tc:mysql:8.0:///
# slt_fieldops_db_test` URL does not change what database actually gets created. This never
# mattered for `mvn test` (the JVM's own JDBC driver resolves the same connection internally either
# way) -- it only matters here, where an external process has to know the real name independently.
DB_NAME = os.environ.get("FIELDOPS_DB_NAME", "slt_fieldops_db")

# Precomputed via fieldops's own BCryptPasswordEncoder(12) (spring-security-crypto 6.2.2) and
# confirmed with encoder.matches("Admin@2024", hash) == true before use, not just assumed to be a
# valid hash shape. BCrypt hashes are portable across environments by design -- generating this
# once, here, is equivalent to generating it inside fieldops itself.
ADMIN_PASSWORD_HASH = "$2a$12$fcJNSpxvKpd9N851.EQzg.KXYP0xnLXub12YIM8eg31fPLM.Yghgm"


def connect():
    return pymysql.connect(host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASSWORD,
                            database=DB_NAME, autocommit=False)


def short_code(prefix):
    """A <=10-char unique-enough code -- mirrors the shortUniq() pattern already proven in
    fieldops's own Stage2AttachCauseIntegrationTest.java (type_code/cause_category_code/cause_code
    are all VARCHAR(10), too short for a raw nanosecond timestamp)."""
    n = int(time.time() * 1000) % 90_000
    return f"{prefix}{n}"


def cmd_seed_admin():
    conn = connect()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE username = %s", ("superadmin",))
        existing = cur.fetchone()
        if existing:
            print(f"ADMIN_READY=1")
            print(f"ADMIN_ID={existing[0]} (already existed)")
            return
        # created_at/updated_at supplied explicitly -- confirmed empirically, not assumed: the
        # persistent dev DB's `users` table has a DB-level DEFAULT CURRENT_TIMESTAMP for both, but
        # a table freshly built by ddl-auto=update from the current User entity does not (this
        # entity sets timestamps via Java-side @PrePersist/@PreUpdate, the same pattern already
        # established for every other entity's fixture helper this session), so a raw INSERT
        # against a fresh schema fails with "Field 'created_at' doesn't have a default value"
        # unless supplied here.
        # Every NOT NULL column below that User.java initializes in Java (@PrePersist-adjacent
        # field initializers, not a DB-level DEFAULT) is supplied explicitly -- confirmed by
        # reading every `private X y = ...;` in User.java, not discovered one error at a time.
        cur.execute(
            """
            INSERT INTO users (username, password_hash, first_name, last_name, full_name, phone,
                                role, status, is_active, failed_login_attempts, force_password_change,
                                preferred_language, notify_billing, notify_job_completed,
                                notify_promotions, notify_status_updates, notify_technician_assigned,
                                created_at, updated_at)
            VALUES (%s, %s, 'Super', 'Admin', 'Super Admin', '0770000000',
                    'SUPER_ADMIN', 'ACTIVE', 1, 0, 0, 'ENGLISH', 1, 1, 0, 1, 1, NOW(), NOW())
            """,
            ("superadmin", ADMIN_PASSWORD_HASH),
        )
        conn.commit()
        print("ADMIN_READY=1")
        print(f"ADMIN_ID={cur.lastrowid}")
    finally:
        conn.close()


def _insert_fault(cur, cause_of_fault=None):
    # Millisecond granularity on both -- second-granularity on fault_number alone collided when
    # seed-fault and seed-cause ran within the same second in testing (confirmed empirically:
    # "Duplicate entry ... for key 'faults.UK_...'" on fault_number's real unique constraint).
    ms = int(time.time() * 1000)
    marker = f"CI Cypress test fault {ms}"
    fault_number = f"CYT-{ms}"
    # reported_at/created_at/updated_at supplied explicitly for the same reason as seed-admin's
    # users INSERT above -- Fault.java sets these via @PrePersist, not a DB-level default, so a
    # fresh ddl-auto=update schema has none. opmc_id=1 is safe even with no real Opmc row present
    # (fresh schema or otherwise): Fault.opmcId is a plain unmapped Long, no @ManyToOne/@JoinColumn,
    # confirmed no DB-level FK constraint exists on this column.
    # Same reasoning as seed-admin's users INSERT: every NOT NULL column Fault.java initializes
    # in Java only (is_overdue/sla_breached/is_escalated) is supplied explicitly.
    cur.execute(
        """
        INSERT INTO faults (fault_number, customer_id, category, description, opmc_id, priority,
                             status, reopen_count, cause_of_fault, is_overdue, sla_breached,
                             is_escalated, reported_at, created_at, updated_at)
        VALUES (%s, 6, 'INTERNET', %s, 1, 'MEDIUM', 'REPORTED', 0, %s, 0, 0, 0, NOW(6), NOW(6), NOW())
        """,
        (fault_number, marker, cause_of_fault),
    )
    return cur.lastrowid, marker


def cmd_seed_fault(cause_of_fault):
    conn = connect()
    try:
        cur = conn.cursor()
        fault_id, marker = _insert_fault(cur, cause_of_fault)
        conn.commit()
        print(f"FAULT_ID={fault_id}")
        print(f"MARKER={marker}")
    finally:
        conn.close()


def cmd_seed_cause(tech_finding):
    conn = connect()
    try:
        cur = conn.cursor()

        type_code = short_code("T")
        cur.execute(
            "INSERT INTO type_of_fault (type_code, description, created_at) VALUES (%s, %s, NOW(6))",
            (type_code, "CI Test Type"),
        )
        type_id = cur.lastrowid

        category_code = short_code("C")
        cur.execute(
            "INSERT INTO cause_category (cause_category_code, description, type_of_fault_id, created_at) "
            "VALUES (%s, %s, %s, NOW(6))",
            (category_code, "CI Test Category", type_id),
        )
        category_id = cur.lastrowid

        cause_code = short_code("F")
        cur.execute(
            "INSERT INTO cause_of_fault (cause_code, description, cause_category_id, "
            "applies_copper, applies_ftth, applies_lte, created_at) "
            "VALUES (%s, %s, %s, 1, 1, 1, NOW(6))",
            (cause_code, "CI Test Cause", category_id),
        )
        cause_id = cur.lastrowid

        fault_id, marker = _insert_fault(cur, tech_finding)

        conn.commit()
        print(f"FAULT_ID={fault_id}")
        print(f"MARKER={marker}")
        print(f"CAUSE_ID={cause_id}")
        print(f"CAUSE_CODE={cause_code}")
        print(f"CAUSE_CATEGORY_CODE={category_code}")
        print(f"TYPE_CODE={type_code}")
    finally:
        conn.close()


def cmd_delete_fault(fault_id):
    conn = connect()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM fault_history WHERE fault_id = %s", (fault_id,))
        cur.execute("DELETE FROM faults WHERE id = %s", (fault_id,))
        conn.commit()
        print(f"DELETED={fault_id}")
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("seed-admin")

    p_fault = sub.add_parser("seed-fault")
    p_fault.add_argument("--cause-of-fault", default=None)

    p_cause = sub.add_parser("seed-cause")
    p_cause.add_argument("--tech-finding", default=None)

    p_delete = sub.add_parser("delete-fault")
    p_delete.add_argument("fault_id", type=int)

    args = parser.parse_args()

    if args.command == "seed-admin":
        cmd_seed_admin()
    elif args.command == "seed-fault":
        cmd_seed_fault(args.cause_of_fault)
    elif args.command == "seed-cause":
        cmd_seed_cause(args.tech_finding)
    elif args.command == "delete-fault":
        cmd_delete_fault(args.fault_id)


if __name__ == "__main__":
    sys.exit(main())
