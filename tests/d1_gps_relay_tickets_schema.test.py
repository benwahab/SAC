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
    ROOT / "migrations" / "0011_gps_ticket_device_binding.sql",
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
        self.db.execute("""INSERT INTO devices
            (id,account_id,status,auth_version,created_at,revoked_at)
            VALUES ('device-owner','owner','active',1,1001,NULL)""")
        self.db.execute("""INSERT INTO device_root_credentials
            (id,device_id,account_id,credential_id,public_key_x,public_key_y,sign_count,
             credential_device_type,credential_backed_up,created_at,last_used_at)
            VALUES ('root-credential','device-owner','owner','credential-owner',
                    ?,?,0,'singleDevice',0,1001,NULL)""", ("A" * 43, "B" * 43))
        self.db.execute("""INSERT INTO device_sessions
            (id,account_id,device_id,token_hash,status,auth_version,created_at,
             last_activity_at,expires_at,revoked_at)
            VALUES ('owner-session','owner','device-owner',?,'active',1,1001,1001,
                    86401001,NULL)""", ("1" * 64,))
        self.db.execute("""INSERT INTO alerts
            (id,author_account_id,category,level,status,push_reminder_limit,created_at)
            VALUES ('alert','owner','personal_danger','urgent','active',1,1002)""")

    def tearDown(self):
        self.db.close()

    def test_ticket_hash_is_single_use(self):
        self.db.execute("""INSERT INTO gps_relay_tickets
            (ticket_hash,alert_id,account_id,device_id,session_id,role,created_at,expires_at)
            VALUES (?, 'alert','owner','device-owner','owner-session','author',1000,121000)""", ("a" * 64,))
        consumed = self.db.execute("""DELETE FROM gps_relay_tickets
            WHERE ticket_hash=? AND alert_id=? AND account_id=? AND device_id=? AND session_id=? AND role=?
              AND expires_at>?""", ("a" * 64, "alert", "owner", "device-owner", "owner-session", "author", 2000)).rowcount
        replay = self.db.execute("""DELETE FROM gps_relay_tickets
            WHERE ticket_hash=? AND alert_id=? AND account_id=? AND device_id=? AND session_id=? AND role=?
              AND expires_at>?""", ("a" * 64, "alert", "owner", "device-owner", "owner-session", "author", 2000)).rowcount
        self.assertEqual(consumed, 1)
        self.assertEqual(replay, 0)

    def test_expired_ticket_cannot_be_consumed(self):
        self.db.execute("""INSERT INTO gps_relay_tickets
            (ticket_hash,alert_id,account_id,device_id,session_id,role,created_at,expires_at)
            VALUES (?, 'alert','owner','device-owner','owner-session','author',1000,2000)""", ("b" * 64,))
        consumed = self.db.execute("""DELETE FROM gps_relay_tickets
            WHERE ticket_hash=? AND device_id=? AND session_id=? AND expires_at>?""", ("b" * 64, "device-owner", "owner-session", 2000)).rowcount
        self.assertEqual(consumed, 0)

    def test_ticket_rejects_invalid_hash_and_role(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""INSERT INTO gps_relay_tickets
                (ticket_hash,alert_id,account_id,device_id,session_id,role,created_at,expires_at)
                VALUES ('not-a-hash','alert','owner','device-owner','owner-session','author',1000,2000)""")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""INSERT INTO gps_relay_tickets
                (ticket_hash,alert_id,account_id,device_id,session_id,role,created_at,expires_at)
                VALUES (?, 'alert','owner','device-owner','owner-session','admin',1000,2000)""", ("c" * 64,))

    def test_table_contains_no_location_or_secret_material(self):
        columns = {row[1].lower() for row in self.db.execute(
            "PRAGMA table_info(gps_relay_tickets)").fetchall()}
        forbidden = {"latitude", "longitude", "coordinates", "location", "payload",
                     "private_key", "public_key", "gps_data", "address"}
        self.assertFalse(columns & forbidden)
        self.assertEqual(columns, {"ticket_hash", "alert_id", "account_id", "device_id", "session_id", "role",
                                   "created_at", "expires_at"})

    def test_ticket_is_bound_to_existing_alert_and_account(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""INSERT INTO gps_relay_tickets
                (ticket_hash,alert_id,account_id,device_id,session_id,role,created_at,expires_at)
                VALUES (?, 'missing','owner','device-owner','owner-session','author',1000,2000)""", ("d" * 64,))


    def test_ticket_cannot_be_consumed_by_a_different_device(self):
        self.db.execute("""INSERT INTO gps_relay_tickets
            (ticket_hash,alert_id,account_id,device_id,session_id,role,created_at,expires_at)
            VALUES (?, 'alert','owner','device-owner','owner-session','author',1000,121000)""", ("e" * 64,))
        wrong_device = self.db.execute("""DELETE FROM gps_relay_tickets
            WHERE ticket_hash=? AND alert_id=? AND account_id=? AND device_id=? AND session_id=?
              AND expires_at>?""", ("e" * 64, "alert", "owner", "other-device", "owner-session", 2000)).rowcount
        right_device = self.db.execute("""DELETE FROM gps_relay_tickets
            WHERE ticket_hash=? AND alert_id=? AND account_id=? AND device_id=? AND session_id=?
              AND expires_at>?""", ("e" * 64, "alert", "owner", "device-owner", "owner-session", 2000)).rowcount
        self.assertEqual(wrong_device, 0)
        self.assertEqual(right_device, 1)

    def test_ticket_requires_an_existing_device_owned_by_the_account(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""INSERT INTO gps_relay_tickets
                (ticket_hash,alert_id,account_id,device_id,session_id,role,created_at,expires_at)
                VALUES (?, 'alert','owner','missing-device','owner-session','author',1000,2000)""", ("f" * 64,))


    def test_revoked_session_cannot_consume_a_ticket(self):
        self.db.execute("""INSERT INTO gps_relay_tickets
            (ticket_hash,alert_id,account_id,device_id,session_id,role,created_at,expires_at)
            VALUES (?, 'alert','owner','device-owner','owner-session','author',1000,121000)""", ("9" * 64,))
        self.db.execute("""UPDATE device_sessions
            SET status='revoked',revoked_at=1002
            WHERE id='owner-session'""")
        consumed = self.db.execute("""DELETE FROM gps_relay_tickets
            WHERE ticket_hash=? AND session_id=?
              AND EXISTS (SELECT 1 FROM device_sessions
                          WHERE id=? AND status='active' AND expires_at>?)""",
            ("9" * 64, "owner-session", "owner-session", 2000)).rowcount
        self.assertEqual(consumed, 0)

    def test_ticket_requires_an_existing_session(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""INSERT INTO gps_relay_tickets
                (ticket_hash,alert_id,account_id,device_id,session_id,role,created_at,expires_at)
                VALUES (?, 'alert','owner','device-owner','missing-session','author',1000,2000)""", ("8" * 64,))

if __name__ == "__main__":
    unittest.main()
