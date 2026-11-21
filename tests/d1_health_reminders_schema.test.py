import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = sorted((ROOT / "migrations").glob("*.sql"))


class HealthReminderD1SchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA foreign_keys = ON")
        for migration in MIGRATIONS:
            self.db.executescript(migration.read_text(encoding="utf-8"))
        self.now = 1_800_000_000_000
        self.account("owner", "owner@example.ne", self.now)
        self.account("other", "other@example.ne", self.now + 1)
        self.db.execute(
            "INSERT INTO account_entitlements (account_id, updated_at) VALUES ('owner', ?)",
            (self.now,),
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def account(self, account_id, email, created_at):
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
                max_attempts, created_at, expires_at, delivery_status)
               VALUES (?, ?, ?, 'account_email_verification', ?, 0, 6, ?, ?, 'pending')""",
            (challenge, account_id, identity, "a" * 64, created_at, created_at + 600_000),
        )
        self.db.execute(
            "UPDATE email_otp_challenges SET delivery_status='accepted' WHERE id=?",
            (challenge,),
        )
        self.db.execute(
            "UPDATE email_otp_challenges SET attempt_count=1, consumed_at=? WHERE id=?",
            (created_at + 1, challenge),
        )

    def reminder(self, reminder_id="reminder-1", **overrides):
        values = {
            "id": reminder_id,
            "owner_account_id": "owner",
            "created_by_account_id": "owner",
            "source": "personal",
            "kind": "appointment",
            "title": "Consultation",
            "description": None,
            "timezone": "Africa/Niamey",
            "recurrence_type": "once",
            "local_date": "2026-11-21",
            "local_time": "08:00",
            "start_date": None,
            "end_date": None,
            "weekdays_json": None,
            "day_of_month": None,
            "medication_name": None,
            "medication_dosage": None,
            "medication_instructions": None,
            "status": "active",
            "version": 1,
            "created_at": self.now + 10,
            "updated_at": self.now + 10,
        }
        values.update(overrides)
        self.db.execute(
            """INSERT INTO health_reminders
               (id, owner_account_id, created_by_account_id, source, kind, title,
                description, timezone, recurrence_type, local_date, local_time,
                start_date, end_date, weekdays_json, day_of_month,
                medication_name, medication_dosage, medication_instructions,
                status, version, created_at, updated_at)
               VALUES (:id, :owner_account_id, :created_by_account_id, :source, :kind, :title,
                       :description, :timezone, :recurrence_type, :local_date, :local_time,
                       :start_date, :end_date, :weekdays_json, :day_of_month,
                       :medication_name, :medication_dosage, :medication_instructions,
                       :status, :version, :created_at, :updated_at)""",
            values,
        )
        self.db.commit()
        return values

    def occurrence(self, occurrence_id="occurrence-1", scheduled_at=None, **overrides):
        values = {
            "id": occurrence_id,
            "reminder_id": "reminder-1",
            "owner_account_id": "owner",
            "scheduled_at": scheduled_at or self.now + 1_000,
            "local_date": "2026-11-21",
            "local_time": "08:00",
            "timezone": "Africa/Niamey",
            "status": "scheduled",
            "deduplication_key": f"reminder-1:{scheduled_at or self.now + 1_000}",
            "created_at": self.now + 10,
            "notified_at": None,
            "closed_at": None,
        }
        values.update(overrides)
        self.db.execute(
            """INSERT INTO health_reminder_occurrences
               (id, reminder_id, owner_account_id, scheduled_at, local_date, local_time,
                timezone, status, deduplication_key, created_at, notified_at, closed_at)
               VALUES (:id, :reminder_id, :owner_account_id, :scheduled_at, :local_date,
                       :local_time, :timezone, :status, :deduplication_key, :created_at,
                       :notified_at, :closed_at)""",
            values,
        )
        self.db.commit()
        return values

    def outbox(self, notification_id="notification-1", **overrides):
        values = {
            "id": notification_id,
            "kind": "reminder_due",
            "source_id": "occurrence-1",
            "recipient_account_id": "owner",
            "scheduled_at": self.now + 1_000,
            "status": "pending",
            "attempt_count": 0,
            "next_attempt_at": self.now + 1_000,
            "lease_until": None,
            "lease_token": None,
            "deduplication_key": f"ordinary:reminder_due:occurrence-1:owner:{self.now + 1_000}",
            "created_at": self.now + 10,
            "updated_at": self.now + 10,
            "processed_at": None,
            "error_code": None,
        }
        values.update(overrides)
        self.db.execute(
            """INSERT INTO ordinary_notification_outbox
               (id, kind, source_id, recipient_account_id, scheduled_at, status,
                attempt_count, next_attempt_at, lease_until, lease_token,
                deduplication_key, created_at, updated_at, processed_at, error_code)
               VALUES (:id, :kind, :source_id, :recipient_account_id, :scheduled_at, :status,
                       :attempt_count, :next_attempt_at, :lease_until, :lease_token,
                       :deduplication_key, :created_at, :updated_at, :processed_at, :error_code)""",
            values,
        )
        self.db.commit()
        return values

    def device_and_subscription(self):
        self.db.execute(
            """INSERT INTO devices (id, account_id, status, auth_version, created_at)
               VALUES ('device-1', 'owner', 'active', 1, ?)""",
            (self.now,),
        )
        self.db.execute(
            """INSERT INTO push_subscriptions
               (id, account_id, device_id, endpoint_hash, encrypted_subscription,
                encryption_key_version, iv, status, created_at, updated_at)
               VALUES ('subscription-1', 'owner', 'device-1', ?, ?, 'v1', ?, 'active', ?, ?)""",
            ("b" * 64, "c" * 32, "d" * 16, self.now, self.now),
        )
        self.db.commit()

    def test_default_entitlement_is_free(self):
        row = self.db.execute("SELECT plan FROM account_entitlements WHERE account_id='owner'").fetchone()
        self.assertEqual(row["plan"], "free")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO account_entitlements (account_id, plan, updated_at) VALUES ('other', 'gold', ?)",
                (self.now,),
            )

    def test_active_owner_can_create_reminder(self):
        self.reminder()
        row = self.db.execute("SELECT title, status FROM health_reminders WHERE id='reminder-1'").fetchone()
        self.assertEqual(tuple(row), ("Consultation", "active"))

    def test_suspended_or_missing_owner_is_rejected(self):
        self.db.execute("UPDATE accounts SET status='suspended' WHERE id='owner'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "reminder_owner_not_active"):
            self.reminder()

    def test_clinic_reminders_are_disabled_in_this_lot(self):
        with self.assertRaisesRegex(sqlite3.IntegrityError, "clinic_reminders_not_enabled"):
            self.reminder(source="clinic")

    def test_medication_requires_name_and_dosage(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.reminder(kind="medication", medication_name=None, medication_dosage="1 comprimé")
        with self.assertRaises(sqlite3.IntegrityError):
            self.reminder(kind="medication", medication_name="Médicament", medication_dosage=None)

    def test_weekly_recurrence_requires_weekdays(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.reminder(
                recurrence_type="weekly",
                local_date=None,
                start_date="2026-11-21",
                end_date="2026-11-30",
                weekdays_json=None,
            )

    def test_occurrence_must_belong_to_an_active_reminder(self):
        self.reminder(status="paused")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "occurrence_reminder_not_active"):
            self.occurrence()

    def test_closing_one_occurrence_does_not_close_the_next(self):
        self.reminder()
        self.occurrence("occurrence-1", self.now + 1_000)
        self.occurrence("occurrence-2", self.now + 2_000, deduplication_key="reminder-1:2")
        self.db.execute(
            "UPDATE health_reminder_occurrences SET status='completed', closed_at=? WHERE id='occurrence-1'",
            (self.now + 1_100,),
        )
        self.db.commit()
        rows = self.db.execute(
            "SELECT id, status FROM health_reminder_occurrences ORDER BY scheduled_at"
        ).fetchall()
        self.assertEqual([tuple(row) for row in rows], [("occurrence-1", "completed"), ("occurrence-2", "scheduled")])

    def test_occurrence_identity_is_immutable(self):
        self.reminder()
        self.occurrence()
        with self.assertRaisesRegex(sqlite3.IntegrityError, "occurrence_identity_immutable"):
            self.db.execute(
                "UPDATE health_reminder_occurrences SET scheduled_at=? WHERE id='occurrence-1'",
                (self.now + 9_000,),
            )

    def test_terminal_occurrence_cannot_be_reopened(self):
        self.reminder()
        self.occurrence()
        self.db.execute(
            "UPDATE health_reminder_occurrences SET status='cancelled', closed_at=? WHERE id='occurrence-1'",
            (self.now + 1_100,),
        )
        with self.assertRaisesRegex(sqlite3.IntegrityError, "occurrence_terminal_state"):
            self.db.execute(
                "UPDATE health_reminder_occurrences SET status='scheduled', closed_at=NULL WHERE id='occurrence-1'"
            )

    def test_schedule_is_immutable_and_version_must_increment(self):
        self.reminder()
        with self.assertRaisesRegex(sqlite3.IntegrityError, "reminder_schedule_immutable"):
            self.db.execute(
                "UPDATE health_reminders SET local_time='09:00', version=2, updated_at=? WHERE id='reminder-1'",
                (self.now + 20,),
            )
        with self.assertRaisesRegex(sqlite3.IntegrityError, "reminder_version_increment_required"):
            self.db.execute(
                "UPDATE health_reminders SET title='Nouveau titre', updated_at=? WHERE id='reminder-1'",
                (self.now + 20,),
            )
        self.db.execute(
            "UPDATE health_reminders SET title='Nouveau titre', version=2, updated_at=? WHERE id='reminder-1'",
            (self.now + 20,),
        )
        self.db.commit()
        self.assertEqual(
            self.db.execute("SELECT title, version FROM health_reminders WHERE id='reminder-1'").fetchone()["version"],
            2,
        )

    def test_cancelling_reminder_cancels_pending_occurrences_and_notifications(self):
        self.reminder()
        self.occurrence()
        self.outbox()
        self.db.execute(
            "UPDATE health_reminders SET status='cancelled', version=2, updated_at=? WHERE id='reminder-1'",
            (self.now + 1_100,),
        )
        self.db.commit()
        self.assertEqual(
            self.db.execute("SELECT status FROM health_reminder_occurrences WHERE id='occurrence-1'").fetchone()["status"],
            "cancelled",
        )
        self.assertEqual(
            self.db.execute("SELECT status FROM ordinary_notification_outbox WHERE id='notification-1'").fetchone()["status"],
            "cancelled",
        )

    def test_ordinary_outbox_deduplicates_and_requires_pending_deadline(self):
        self.outbox()
        with self.assertRaises(sqlite3.IntegrityError):
            self.outbox("notification-2")
        with self.assertRaises(sqlite3.IntegrityError):
            self.outbox("notification-3", deduplication_key="other", next_attempt_at=None)

    def test_ordinary_outbox_rejects_suspended_recipient(self):
        self.db.execute("UPDATE accounts SET status='suspended' WHERE id='owner'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "ordinary_notification_recipient_not_active"):
            self.outbox()

    def test_ordinary_outbox_terminal_state_is_immutable(self):
        self.outbox(status="accepted", attempt_count=1, next_attempt_at=None, processed_at=self.now + 20)
        with self.assertRaisesRegex(sqlite3.IntegrityError, "ordinary_notification_terminal_state"):
            self.db.execute(
                "UPDATE ordinary_notification_outbox SET status='pending', next_attempt_at=?, processed_at=NULL WHERE id='notification-1'",
                (self.now + 30,),
            )

    def test_read_state_is_bound_to_the_notification_recipient(self):
        self.outbox()
        with self.assertRaisesRegex(sqlite3.IntegrityError, "ordinary_read_recipient_mismatch"):
            self.db.execute(
                "INSERT INTO ordinary_notification_reads (notification_id, recipient_account_id, read_at) VALUES ('notification-1', 'other', ?)",
                (self.now + 20,),
            )
        self.db.execute(
            "INSERT INTO ordinary_notification_reads (notification_id, recipient_account_id, read_at) VALUES ('notification-1', 'owner', ?)",
            (self.now + 20,),
        )
        self.db.commit()

    def test_delivery_requires_active_device_and_subscription(self):
        self.reminder()
        self.occurrence()
        self.outbox()
        with self.assertRaisesRegex(sqlite3.IntegrityError, "ordinary_delivery_scope_mismatch"):
            self.db.execute(
                """INSERT INTO ordinary_notification_deliveries
                   (id, outbox_id, recipient_account_id, device_id, subscription_id,
                    status, attempt_count, next_attempt_at, created_at, updated_at)
                   VALUES ('delivery-1', 'notification-1', 'owner', 'device-1', 'subscription-1',
                           'pending', 0, ?, ?, ?)""",
                (self.now + 1_000, self.now + 10, self.now + 10),
            )

    def test_json_each_bulk_inserts_occurrences_and_notifications(self):
        self.reminder(
            recurrence_type="daily",
            local_date=None,
            start_date="2026-11-21",
            end_date="2026-11-23",
        )
        occurrences = [
            {
                "id": f"occurrence-{index}",
                "reminderId": "reminder-1",
                "ownerAccountId": "owner",
                "scheduledAt": self.now + index * 86_400_000,
                "localDate": f"2026-11-{20 + index}",
                "localTime": "08:00",
                "timeZone": "Africa/Niamey",
                "deduplicationKey": f"reminder-1:{self.now + index * 86_400_000}",
            }
            for index in (1, 2, 3)
        ]
        self.db.execute(
            """INSERT INTO health_reminder_occurrences
               (id, reminder_id, owner_account_id, scheduled_at, local_date, local_time,
                timezone, status, deduplication_key, created_at, notified_at, closed_at)
               SELECT json_extract(value, '$.id'), json_extract(value, '$.reminderId'),
                      json_extract(value, '$.ownerAccountId'), json_extract(value, '$.scheduledAt'),
                      json_extract(value, '$.localDate'), json_extract(value, '$.localTime'),
                      json_extract(value, '$.timeZone'), 'scheduled',
                      json_extract(value, '$.deduplicationKey'), ?, NULL, NULL
               FROM json_each(?)""",
            (self.now + 10, __import__("json").dumps(occurrences)),
        )
        notifications = [
            {
                "id": f"notification-{index}",
                "sourceId": f"occurrence-{index}",
                "scheduledAt": self.now + index * 86_400_000,
                "deduplicationKey": f"ordinary:reminder_due:occurrence-{index}:owner:{self.now + index * 86_400_000}",
            }
            for index in (1, 2, 3)
        ]
        self.db.execute(
            """INSERT INTO ordinary_notification_outbox
               (id, kind, source_id, recipient_account_id, scheduled_at, status,
                attempt_count, next_attempt_at, lease_until, lease_token,
                deduplication_key, created_at, updated_at, processed_at, error_code)
               SELECT json_extract(value, '$.id'), 'reminder_due', json_extract(value, '$.sourceId'),
                      ?, json_extract(value, '$.scheduledAt'), 'pending', 0,
                      json_extract(value, '$.scheduledAt'), NULL, NULL,
                      json_extract(value, '$.deduplicationKey'), ?, ?, NULL, NULL
               FROM json_each(?)""",
            ("owner", self.now + 10, self.now + 10, __import__("json").dumps(notifications)),
        )
        self.db.commit()
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM health_reminder_occurrences").fetchone()[0], 3)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM ordinary_notification_outbox").fetchone()[0], 3)

    def test_ordinary_notification_tables_do_not_reference_sos_columns(self):
        columns = {
            row["name"]
            for row in self.db.execute("PRAGMA table_info(ordinary_notification_outbox)").fetchall()
        }
        self.assertNotIn("alert_id", columns)
        self.assertNotIn("alert_reminder_outbox_id", columns)
        self.assertNotIn("gps", columns)
        self.assertNotIn("sms", columns)


if __name__ == "__main__":
    unittest.main()
