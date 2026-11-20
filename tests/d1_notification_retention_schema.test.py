import sqlite3
import unittest
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = [
    ROOT / "migrations" / "0001_account_email_otp.sql",
    ROOT / "migrations" / "0002_contact_invitations.sql",
    ROOT / "migrations" / "0003_alerts_sos.sql",
    ROOT / "migrations" / "0004_sos_reminder_leases.sql",
    ROOT / "migrations" / "0005_sos_sms_escalation.sql",
    ROOT / "migrations" / "0006_email_otp_delivery_state.sql",
    ROOT / "migrations" / "0007_root_device_enrollment.sql",
    ROOT / "migrations" / "0008_push_subscriptions.sql",
    ROOT / "migrations" / "0009_notification_delivery_retention.sql",
]

class NotificationRetentionSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA foreign_keys = ON")
        # Apply the complete migration chain. Minimal account/device fixtures
        # are added only after the schema is in place.
        for migration in MIGRATIONS:
            self.db.executescript(migration.read_text(encoding="utf-8"))
        self.now = int(time.time() * 1000) - 40 * 24 * 60 * 60 * 1000
        self._seed_accounts_and_relationship()
        self._seed_alert_and_outbox()
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _seed_accounts_and_relationship(self):
        # Test fixtures follow the production account/OTP/contact constraints.
        for account_id, email, created in [
            ("owner", "owner@example.ne", self.now),
            ("contact", "contact@example.ne", self.now + 1),
        ]:
            self.db.execute(
                """INSERT INTO accounts
                   (id,status,preferred_language,password_hash,created_at,updated_at)
                   VALUES (?,'pending_verification','fr','test-hash',?,?)""",
                (account_id, created, created),
            )
            identity = account_id + "-email"
            challenge = account_id + "-otp"
            self.db.execute(
                """INSERT INTO account_identities
                   (id,account_id,channel,normalized_value,verified_at,is_primary,created_at)
                   VALUES (?,?,'email',?,NULL,1,?)""",
                (identity, account_id, email, created),
            )
            self.db.execute(
                """INSERT INTO email_otp_challenges
                   (id,account_id,identity_id,purpose,digest,attempt_count,max_attempts,created_at,expires_at,delivery_status)
                   VALUES (?,?,?,'account_email_verification',?,0,6,?,?,'pending')""",
                (challenge, account_id, identity, "a" * 64, created, created + 600_000),
            )
            self.db.execute(
                "UPDATE email_otp_challenges SET delivery_status='accepted' WHERE id=?",
                (challenge,),
            )
            self.db.execute(
                "UPDATE email_otp_challenges SET attempt_count=1, consumed_at=? WHERE id=?",
                (created + 1, challenge),
            )
        invite_at = self.now + 10
        self.db.execute(
            """INSERT INTO contact_invitations
               (id,inviter_account_id,destination_email,token_digest,permission_version,status,created_at,expires_at)
               VALUES ('invite','owner','contact@example.ne',?,'v1','pending',?,?)""",
            ("b" * 64, invite_at, invite_at + 600_000),
        )
        self.db.execute(
            """UPDATE contact_invitations
               SET status='accepted',recipient_account_id='contact',decided_at=?
               WHERE id='invite'""",
            (invite_at + 1,),
        )
        self.db.execute(
            """INSERT INTO trusted_contacts
               (owner_account_id,contact_account_id,invitation_id,permission_version,status,created_at)
               VALUES ('owner','contact','invite','v1','active',?)""",
            (invite_at + 1,),
        )

    def _seed_alert_and_outbox(self):
        created = self.now + 100
        self.db.execute(
            """INSERT INTO alerts
               (id,author_account_id,category,level,status,push_reminder_limit,created_at)
               VALUES ('alert','owner','personal_danger','urgent','active',1,?)""",
            (created,),
        )
        self.db.execute(
            "INSERT INTO alert_recipients(alert_id,recipient_account_id,selected_at) VALUES ('alert','contact',?)",
            (created,),
        )
        self.db.execute(
            """INSERT INTO alert_events(id,alert_id,actor_account_id,event_type,occurred_at)
               VALUES ('trigger','alert','owner','triggered',?)""",
            (created,),
        )
        self.db.execute(
            """INSERT INTO alert_reminder_outbox
               (id,alert_id,recipient_account_id,reminder_number,scheduled_at,created_at)
               VALUES ('outbox','alert','contact',1,?,?)""",
            (created + 300_000, created + 1),
        )

    def _delivery(self, delivery_id="delivery", status="accepted", terminal_at="auto", expires_at="auto"):
        if terminal_at == "auto":
            terminal_at = self.now + 39 * 24 * 60 * 60 * 1000
        if expires_at == "auto":
            expires_at = terminal_at + 2_592_000_000 if terminal_at is not None else None
        created_at = min(self.now - 100, terminal_at - 100) if terminal_at is not None else self.now - 100
        self.db.execute(
            """INSERT INTO notification_device_deliveries
               (id,outbox_id,alert_id,recipient_account_id,device_id,subscription_id,
                status,attempt_count,created_at,updated_at,cycle_terminal_at,retention_expires_at)
               VALUES (?,'outbox','alert','contact','device-opaque',?,
                ?,0,?,?,NULL,NULL)""",
            (delivery_id, 'subscription-' + delivery_id, status, created_at, created_at),
        )
        if terminal_at is not None:
            self.db.execute(
                """UPDATE alert_reminder_outbox
                   SET status='sent', processed_at=?
                   WHERE id='outbox' AND status='pending'""",
                (terminal_at,),
            )
            self.db.execute(
                """UPDATE notification_device_deliveries
                   SET cycle_terminal_at=?, retention_expires_at=?
                   WHERE id=?""",
                (terminal_at, expires_at, delivery_id),
            )

    def test_30_day_expiry_is_exact_and_uses_utc_milliseconds(self):
        self._delivery(terminal_at=self.now)
        expires = self.db.execute(
            "SELECT retention_expires_at FROM notification_device_deliveries"
        ).fetchone()[0]
        self.assertEqual(expires, self.now + 2_592_000_000)
        self.assertEqual(expires - self.now, 30 * 24 * 60 * 60 * 1000)

    def test_nonterminal_or_unaggregated_delivery_is_not_purgeable(self):
        self._delivery(status="pending", terminal_at=None, expires_at=None)
        count = self.db.execute(
            """SELECT COUNT(*) FROM notification_device_deliveries
               WHERE status IN ('accepted','permanent_failure','unknown_exhausted','cancelled')
                 AND retention_expires_at <= ?""",
            (self.now + 3_000_000_000,),
        ).fetchone()[0]
        self.assertEqual(count, 0)

    def test_attempt_requires_reserved_number_and_sequence(self):
        self._delivery()
        with self.assertRaisesRegex(sqlite3.IntegrityError, "notification_attempt_not_reserved"):
            self.db.execute(
                """INSERT INTO notification_delivery_attempts
                   (id,delivery_id,attempt_number,reserved_at,result,started_at,finished_at)
                   VALUES ('attempt-1','delivery',1,?,'accepted',?,?)""",
                (self.now, self.now, self.now + 1),
            )

    def test_attempt_limit_is_two_and_unique(self):
        self._delivery()
        self.db.execute(
            "UPDATE notification_device_deliveries SET attempt_count=1 WHERE id='delivery'"
        )
        self.db.execute(
            """INSERT INTO notification_delivery_attempts
               (id,delivery_id,attempt_number,reserved_at,result,started_at,finished_at)
               VALUES ('attempt-1','delivery',1,?,'accepted',?,?)""",
            (self.now, self.now, self.now + 10),
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO notification_delivery_attempts
                   (id,delivery_id,attempt_number,reserved_at,result,started_at,finished_at)
                   VALUES ('attempt-1-duplicate','delivery',1,?,'accepted',?,?)""",
                (self.now, self.now, self.now + 10),
            )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "UPDATE notification_device_deliveries SET attempt_count=3 WHERE id='delivery'"
            )

    def test_purge_is_child_first_bounded_and_never_deletes_business_outbox(self):
        for i in range(205):
            self._delivery(f"delivery-{i:03d}", terminal_at=None, expires_at=None)
        terminal_at = self.now + 24 * 60 * 60 * 1000
        self.db.execute(
            """UPDATE alert_reminder_outbox SET status='sent', processed_at=?
               WHERE id='outbox'""",
            (terminal_at,),
        )
        self.db.execute(
            """UPDATE notification_device_deliveries
               SET cycle_terminal_at=?, retention_expires_at=?""",
            (terminal_at, terminal_at + 2_592_000_000),
        )
        # Add one technical attempt to the first eligible delivery.
        self.db.execute(
            "UPDATE notification_device_deliveries SET attempt_count=1 WHERE id='delivery-000'"
        )
        self.db.execute(
            """INSERT INTO notification_delivery_attempts
               (id,delivery_id,attempt_number,reserved_at,result,started_at,finished_at)
               VALUES ('attempt-000','delivery-000',1,?,'accepted',?,?)""",
            (self.now - 2_592_001_000, self.now - 2_592_001_000, self.now - 2_592_001_000 + 1),
        )
        cutoff = self.now + 40 * 24 * 60 * 60 * 1000
        # Mirror the two D1 batch statements: child rows first, then parents.
        self.db.execute(
            """DELETE FROM notification_delivery_attempts
               WHERE delivery_id IN (
                 SELECT id FROM notification_device_deliveries
                 WHERE retention_expires_at <= ?
                   AND status IN ('accepted','permanent_failure','unknown_exhausted','cancelled')
                 ORDER BY retention_expires_at,id LIMIT 200
               )""",
            (cutoff,),
        )
        deleted = self.db.execute(
            """DELETE FROM notification_device_deliveries
               WHERE id IN (
                 SELECT d.id FROM notification_device_deliveries d
                 WHERE d.retention_expires_at <= ?
                   AND d.status IN ('accepted','permanent_failure','unknown_exhausted','cancelled')
                   AND NOT EXISTS (
                     SELECT 1 FROM notification_delivery_attempts a WHERE a.delivery_id=d.id
                   )
                 ORDER BY d.retention_expires_at,d.id LIMIT 200
               )""",
            (cutoff,),
        ).rowcount
        self.assertEqual(deleted, 200)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM notification_device_deliveries").fetchone()[0], 5)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM alert_reminder_outbox").fetchone()[0], 1)

    def test_unexpired_and_orphan_attempts_block_parent_delete(self):
        self._delivery("future", terminal_at=self.now + 40 * 24 * 60 * 60 * 1000)
        self.db.execute(
            "UPDATE notification_device_deliveries SET attempt_count=1 WHERE id='future'"
        )
        self.db.execute(
            """INSERT INTO notification_delivery_attempts
               (id,delivery_id,attempt_number,reserved_at,result,started_at,finished_at)
               VALUES ('future-attempt','future',1,?,'accepted',?,?)""",
            (self.now, self.now, self.now + 1),
        )
        with self.assertRaisesRegex(sqlite3.IntegrityError, "notification_attempt_retention_not_expired"):
            self.db.execute("DELETE FROM notification_delivery_attempts WHERE id='future-attempt'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM notification_device_deliveries WHERE id='future'")

    def test_failed_parent_delete_rolls_back_child_attempt_deletion(self):
        self._delivery("rollback", terminal_at=self.now + 24 * 60 * 60 * 1000)
        self.db.execute(
            "UPDATE notification_device_deliveries SET attempt_count=1 WHERE id='rollback'"
        )
        self.db.execute(
            """INSERT INTO notification_delivery_attempts
               (id,delivery_id,attempt_number,reserved_at,result,started_at,finished_at)
               VALUES ('rollback-attempt','rollback',1,?,'accepted',?,?)""",
            (self.now, self.now, self.now + 1),
        )
        self.db.execute(
            """CREATE TRIGGER test_force_parent_delete_failure
               BEFORE DELETE ON notification_device_deliveries
               BEGIN SELECT RAISE(ABORT, 'test_parent_delete_failure'); END"""
        )
        self.db.execute("BEGIN")
        self.db.execute(
            """DELETE FROM notification_delivery_attempts
               WHERE delivery_id='rollback'"""
        )
        with self.assertRaisesRegex(sqlite3.IntegrityError, "test_parent_delete_failure"):
            self.db.execute(
                "DELETE FROM notification_device_deliveries WHERE id='rollback'"
            )
        self.db.rollback()
        self.assertEqual(
            self.db.execute(
                "SELECT COUNT(*) FROM notification_delivery_attempts WHERE delivery_id='rollback'"
            ).fetchone()[0],
            1,
        )
        self.assertEqual(
            self.db.execute(
                "SELECT COUNT(*) FROM notification_device_deliveries WHERE id='rollback'"
            ).fetchone()[0],
            1,
        )

    def test_technical_tables_do_not_expose_sensitive_payload_fields(self):
        forbidden = {"endpoint", "payload", "gps", "latitude", "longitude", "description", "email"}
        for table in ("notification_device_deliveries", "notification_delivery_attempts",
                      "notification_retention_control"):
            columns = {
                row[1].lower()
                for row in self.db.execute(f"PRAGMA table_info({table})").fetchall()
            }
            self.assertFalse(columns & forbidden, f"sensitive columns in {table}: {columns & forbidden}")

    def test_control_table_is_singleton_and_contains_aggregates_only(self):
        row = self.db.execute(
            "SELECT singleton_id,deleted_deliveries_last_run,deleted_attempts_last_run,overdue_rows FROM notification_retention_control"
        ).fetchone()
        self.assertEqual(tuple(row), (1, 0, 0, 0))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO notification_retention_control(singleton_id) VALUES (2)")

    def test_restore_backlog_remains_discoverable(self):
        self._delivery("restored", terminal_at=self.now + 24 * 60 * 60 * 1000)
        overdue = self.db.execute(
            """SELECT COUNT(*) FROM notification_device_deliveries
               WHERE retention_expires_at <= ?""",
            (self.now + 40 * 24 * 60 * 60 * 1000,),
        ).fetchone()[0]
        self.assertEqual(overdue, 1)

    def test_foreign_keys_are_valid_after_fixture(self):
        violations = self.db.execute("PRAGMA foreign_key_check").fetchall()
        self.assertEqual(violations, [])

if __name__ == "__main__":
    unittest.main()
