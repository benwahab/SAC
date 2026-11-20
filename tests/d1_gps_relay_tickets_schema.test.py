import sqlite3
import unittest
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
    ROOT / "migrations" / "0010_gps_relay_tickets.sql",
]

class GpsRelayTicketSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        for migration in MIGRATIONS:
            self.db.executescript(migration.read_text(encoding="utf-8"))
        self.db.execute("""INSERT INTO accounts
            (id,status,preferred_language,password_hash,created_at,updated_at)
            VALUES ('owner','pending_verification','fr','test',1000,1000)""")
        self.db.execute("""INSERT INTO account_identities
            (id,account_id,channel,normalized_value,verified_at,is_primary,created_at)
            VALUES ('owner-email','owner','email','owner@example.ne',NULL,1,1000)""")
        self.db.execute("""INSERT INTO email_otp_challenges
            (id,account_id,identity_id,purpose,digest,attempt_count,max_attempts,
             created_at,expires_at,delivery_status)
            VALUES ('owner-otp','owner','owner-email','account_email_verification',
                    ?,0,6,1000,601000,'pending')""", ("a" * 64,))
        self.db.execute("UPDATE email_otp_challenges SET delivery_status='accepted' WHERE id='owner-otp'")
        self.db.execute("UPDATE email_otp_challenges SET attempt_count=1,consumed_at=1001 WHERE id='owner-otp'")
        self.db.execute("UPDATE account_identities SET verified_at=1001 WHERE id='owner-email'")
        self.db.execute("UPDATE accounts SET status='active' WHERE id='owner'")
        self.db.execute("""INSERT INTO alerts
            (id,author_account_id,category,level,status,push_reminder_limit,created_at)
            VALUES ('alert','owner','personal_danger','urgent','active',1,1002)""")

    def tearDown(self):
        self.db.close()

    def test_ticket_hash_is_single_use(self):
        self.db.execute("""INSERT INTO gps_relay_tickets
            (ticket_hash,alert_id,account_id,role,created_at,expires_at)
            VALUES (?, 'alert','owner','author',1000,121000)""", ("a" * 64,))
        consumed = self.db.execute("""DELETE FROM gps_relay_tickets
            WHERE ticket_hash=? AND alert_id=? AND account_id=? AND role=?
              AND expires_at>?""", ("a" * 64, "alert", "owner", "author", 2000)).rowcount
        replay = self.db.execute("""DELETE FROM gps_relay_tickets
            WHERE ticket_hash=? AND alert_id=? AND account_id=? AND role=?
              AND expires_at>?""", ("a" * 64, "alert", "owner", "author", 2000)).rowcount
        self.assertEqual(consumed, 1)
        self.assertEqual(replay, 0)

    def test_expired_ticket_cannot_be_consumed(self):
        self.db.execute("""INSERT INTO gps_relay_tickets
            (ticket_hash,alert_id,account_id,role,created_at,expires_at)
            VALUES (?, 'alert','owner','author',1000,2000)""", ("b" * 64,))
        consumed = self.db.execute("""DELETE FROM gps_relay_tickets
            WHERE ticket_hash=? AND expires_at>?""", ("b" * 64, 2000)).rowcount
        self.assertEqual(consumed, 0)

    def test_ticket_rejects_invalid_hash_and_role(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""INSERT INTO gps_relay_tickets
                (ticket_hash,alert_id,account_id,role,created_at,expires_at)
                VALUES ('not-a-hash','alert','owner','author',1000,2000)""")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""INSERT INTO gps_relay_tickets
                (ticket_hash,alert_id,account_id,role,created_at,expires_at)
                VALUES (?, 'alert','owner','admin',1000,2000)""", ("c" * 64,))

    def test_table_contains_no_location_or_secret_material(self):
        columns = {row[1].lower() for row in self.db.execute(
            "PRAGMA table_info(gps_relay_tickets)").fetchall()}
        forbidden = {"latitude", "longitude", "coordinates", "location", "payload",
                     "private_key", "public_key", "gps_data", "address"}
        self.assertFalse(columns & forbidden)
        self.assertEqual(columns, {"ticket_hash", "alert_id", "account_id", "role",
                                   "created_at", "expires_at"})

    def test_ticket_is_bound_to_existing_alert_and_account(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""INSERT INTO gps_relay_tickets
                (ticket_hash,alert_id,account_id,role,created_at,expires_at)
                VALUES (?, 'missing','owner','author',1000,2000)""", ("d" * 64,))

if __name__ == "__main__":
    unittest.main()
