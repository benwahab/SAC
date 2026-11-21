import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = [
    ROOT / "migrations" / "0001_account_email_otp.sql",
    ROOT / "migrations" / "0006_email_otp_delivery_state.sql",
    ROOT / "migrations" / "0013_super_admin_bootstrap.sql",
    ROOT / "migrations" / "0014_admin_missions_and_audit.sql",
]


class AdminMissionSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        for migration in MIGRATIONS:
            self.db.executescript(migration.read_text(encoding="utf-8"))
        self.now = 1_800_000_000_000
        self.add_account("admin")
        self.add_account("delegate")
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def add_account(self, account_id):
        self.db.execute(
            """INSERT INTO accounts
               (id, status, preferred_language, password_hash, created_at, updated_at)
               VALUES (?, 'pending_verification', 'fr', 'test-hash', ?, ?)""",
            (account_id, self.now, self.now),
        )

    def add_mission(self):
        self.db.execute(
            """INSERT INTO admin_missions
               (id, assigned_account_id, created_by_account_id, scope_key, status,
                due_at, created_at, updated_at, version)
               VALUES ('mission-1', 'delegate', 'admin', 'area:sample', 'active',
                       NULL, ?, ?, 1)""",
            (self.now, self.now),
        )

    def test_mission_and_explicit_permissions_are_persisted(self):
        self.add_mission()
        self.db.execute(
            """INSERT INTO admin_mission_permissions (mission_id, permission, granted_at)
               VALUES ('mission-1', 'read', ?)""",
            (self.now,),
        )
        row = self.db.execute(
            """SELECT m.assigned_account_id, m.scope_key, p.permission
               FROM admin_missions m
               JOIN admin_mission_permissions p ON p.mission_id=m.id"""
        ).fetchone()
        self.assertEqual(tuple(row), ("delegate", "area:sample", "read"))

    def test_unknown_permission_is_rejected(self):
        self.add_mission()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO admin_mission_permissions (mission_id, permission, granted_at)
                   VALUES ('mission-1', 'delegate', ?)""",
                (self.now,),
            )

    def test_audit_events_are_append_only(self):
        self.add_mission()
        self.db.execute(
            """INSERT INTO admin_audit_events
               (id, actor_account_id, actor_device_id, mission_id, action,
                scope_key, permission_used, outcome, occurred_at)
               VALUES ('event-1', 'admin', 'device-1', 'mission-1',
                       'mission_created', 'area:sample', 'admin.missions.create',
                       'success', ?)""",
            (self.now,),
        )
        with self.assertRaisesRegex(sqlite3.IntegrityError, "append_only"):
            self.db.execute("UPDATE admin_audit_events SET action='rewritten' WHERE id='event-1'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "append_only"):
            self.db.execute("DELETE FROM admin_audit_events WHERE id='event-1'")

    def test_mission_requires_existing_accounts(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO admin_missions
                   (id, assigned_account_id, created_by_account_id, scope_key, status,
                    created_at, updated_at)
                   VALUES ('bad', 'missing', 'admin', 'scope', 'active', ?, ?)""",
                (self.now, self.now),
            )

    def test_mission_status_is_constrained(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO admin_missions
                   (id, assigned_account_id, created_by_account_id, scope_key, status,
                    created_at, updated_at)
                   VALUES ('bad', 'delegate', 'admin', 'scope', 'delegated', ?, ?)""",
                (self.now, self.now),
            )


if __name__ == "__main__":
    unittest.main()
