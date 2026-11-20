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
        self.db.execute("""INSERT INTO alerts
            (id,author_account_id,category,level,status,push_reminder_limit,created_at)
            VALUES ('alert','owner','personal_danger','urgent','active',1,1000)""")

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
