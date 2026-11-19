import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = [
    ROOT / "migrations" / "0001_account_email_otp.sql",
    ROOT / "migrations" / "0002_contact_invitations.sql",
    ROOT / "migrations" / "0003_alerts_sos.sql",
]


class AlertD1SchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        for migration in MIGRATIONS:
            self.db.executescript(migration.read_text(encoding="utf-8"))
        self.now = 1_800_000_000_000
        self._account("owner", "owner@example.ne", self.now)
        self._account("contact", "contact@example.ne", self.now + 1)
        self._account("outsider", "outsider@example.ne", self.now + 2)
        self._relationship()
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _account(self, account_id, email, created_at):
        self.db.execute(
            """INSERT INTO accounts
               (id, status, preferred_language, password_hash, created_at, updated_at)
               VALUES (?, 'pending_verification', 'fr', 'test-hash', ?, ?)""",
            (account_id, created_at, created_at),
        )
        identity = f"{account_id}-email"
        challenge = f"{account_id}-otp"
        self.db.execute(
            """INSERT INTO account_identities
               (id, account_id, channel, normalized_value, verified_at, is_primary, created_at)
               VALUES (?, ?, 'email', ?, NULL, 1, ?)""",
            (identity, account_id, email, created_at),
        )
        self.db.execute(
            """INSERT INTO email_otp_challenges
               (id, account_id, identity_id, purpose, digest, attempt_count,
                max_attempts, created_at, expires_at)
               VALUES (?, ?, ?, 'account_email_verification', ?, 0, 6, ?, ?)""",
            (challenge, account_id, identity, "a" * 64, created_at, created_at + 600_000),
        )
        self.db.execute(
            "UPDATE email_otp_challenges SET attempt_count=1, consumed_at=? WHERE id=?",
            (created_at + 1, challenge),
        )

    def _relationship(self):
        created = self.now + 10
        self.db.execute(
            """INSERT INTO contact_invitations
               (id, inviter_account_id, destination_email, token_digest,
                permission_version, status, created_at, expires_at)
               VALUES ('invite-contact', 'owner', 'contact@example.ne', ?, 'v1',
                       'pending', ?, ?)""",
            ("b" * 64, created, created + 600_000),
        )
        self.db.execute(
            """UPDATE contact_invitations
               SET status='accepted', recipient_account_id='contact', decided_at=?
               WHERE id='invite-contact'""",
            (created + 1,),
        )
        self.db.execute(
            """INSERT INTO trusted_contacts
               (owner_account_id, contact_account_id, invitation_id,
                permission_version, status, created_at)
               VALUES ('owner', 'contact', 'invite-contact', 'v1', 'active', ?)""",
            (created + 1,),
        )

    def _alert(self, alert_id="alert-1", created_at=None, reminder_limit=2):
        created = created_at or self.now + 100
        self.db.execute(
            """INSERT INTO alerts
               (id, author_account_id, category, level, status,
                push_reminder_limit, created_at)
               VALUES (?, 'owner', 'personal_danger', 'urgent', 'active', ?, ?)""",
            (alert_id, reminder_limit, created),
        )
        self.db.execute(
            """INSERT INTO alert_recipients
               (alert_id, recipient_account_id, selected_at)
               VALUES (?, 'contact', ?)""",
            (alert_id, created),
        )
        self.db.execute(
            """INSERT INTO alert_events
               (id, alert_id, actor_account_id, event_type, occurred_at)
               VALUES (?, ?, 'owner', 'triggered', ?)""",
            (f"{alert_id}-trigger", alert_id, created),
        )
        return created

    def test_active_trusted_contact_can_be_snapshotted_at_trigger(self):
        self._alert()
        self.assertEqual(
            self.db.execute("SELECT recipient_account_id FROM alert_recipients").fetchone()[0],
            "contact",
        )

    def test_non_contact_cannot_be_added_to_recipient_snapshot(self):
        created = self._alert()
        with self.assertRaisesRegex(sqlite3.IntegrityError, "alert_recipient_not_trusted_at_trigger"):
            self.db.execute(
                "INSERT INTO alert_recipients VALUES ('alert-1', 'outsider', ?)",
                (created,),
            )

    def test_snapshot_cannot_be_changed_or_deleted(self):
        self._alert()
        with self.assertRaisesRegex(sqlite3.IntegrityError, "alert_recipient_snapshot_immutable"):
            self.db.execute(
                "UPDATE alert_recipients SET recipient_account_id='outsider' WHERE alert_id='alert-1'"
            )
        with self.assertRaisesRegex(sqlite3.IntegrityError, "alert_recipient_snapshot_immutable"):
            self.db.execute("DELETE FROM alert_recipients WHERE alert_id='alert-1'")

    def test_contact_can_acknowledge_and_volunteer_only_once_per_sequence(self):
        created = self._alert()
        self.db.execute(
            """INSERT INTO alert_events
               (id, alert_id, actor_account_id, event_type, occurred_at, server_sequence)
               VALUES ('vol-1', 'alert-1', 'contact', 'volunteered', ?, 1)""",
            (created + 1,),
        )
        with self.assertRaisesRegex(sqlite3.IntegrityError, "alert_volunteer_sequence_duplicate"):
            self.db.execute(
                """INSERT INTO alert_events
                   (id, alert_id, actor_account_id, event_type, occurred_at, server_sequence)
                   VALUES ('vol-2', 'alert-1', 'contact', 'volunteered', ?, 1)""",
                (created + 2,),
            )

    def test_responsibility_requires_a_matching_volunteer_event(self):
        created = self._alert()
        with self.assertRaisesRegex(sqlite3.IntegrityError, "alert_responsibility_requires_volunteer"):
            self.db.execute(
                """INSERT INTO alert_responsibility_periods
                   (id, alert_id, contact_account_id, started_at, sequence)
                   VALUES ('period-1', 'alert-1', 'contact', ?, 1)""",
                (created + 1,),
            )

    def test_reminders_are_bounded_by_user_choice_and_five_minute_spacing(self):
        created = self._alert(reminder_limit=1)
        self.db.execute(
            """INSERT INTO alert_reminder_outbox
               (id, alert_id, recipient_account_id, reminder_number, scheduled_at, created_at)
               VALUES ('reminder-1', 'alert-1', 'contact', 1, ?, ?)""",
            (created + 300_000, created + 1),
        )
        with self.assertRaisesRegex(sqlite3.IntegrityError, "alert_reminder_not_eligible"):
            self.db.execute(
                """INSERT INTO alert_reminder_outbox
                   (id, alert_id, recipient_account_id, reminder_number, scheduled_at, created_at)
                   VALUES ('reminder-2', 'alert-1', 'contact', 2, ?, ?)""",
                (created + 600_000, created + 2),
            )

    def test_author_closure_cancels_unsent_reminders_and_blocks_new_ones(self):
        created = self._alert()
        self.db.execute(
            """INSERT INTO alert_reminder_outbox
               (id, alert_id, recipient_account_id, reminder_number, scheduled_at, created_at)
               VALUES ('reminder-1', 'alert-1', 'contact', 1, ?, ?)""",
            (created + 300_000, created + 1),
        )
        closed = created + 60_000
        self.db.execute(
            """UPDATE alerts SET status='closed_by_author', closed_at=?,
               closure_reason='completed' WHERE id='alert-1'""",
            (closed,),
        )
        status = self.db.execute(
            "SELECT status FROM alert_reminder_outbox WHERE id='reminder-1'"
        ).fetchone()[0]
        self.assertEqual(status, "cancelled")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "alert_reminder_not_eligible"):
            self.db.execute(
                """INSERT INTO alert_reminder_outbox
                   (id, alert_id, recipient_account_id, reminder_number, scheduled_at, created_at)
                   VALUES ('reminder-2', 'alert-1', 'contact', 2, ?, ?)""",
                (created + 600_000, closed + 1),
            )

    def test_events_are_append_only(self):
        self._alert()
        with self.assertRaisesRegex(sqlite3.IntegrityError, "alert_events_append_only"):
            self.db.execute("DELETE FROM alert_events WHERE id='alert-1-trigger'")


if __name__ == "__main__":
    unittest.main()
