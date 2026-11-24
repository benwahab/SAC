import sqlite3
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class MultiDevicePasswordLoginSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys = ON")
        for migration in (
            "0001_account_email_otp.sql",
            "0006_email_otp_delivery_state.sql",
            "0007_root_device_enrollment.sql",
            "0020_multi_device_password_login.sql",
        ):
            self.db.executescript((ROOT / "migrations" / migration).read_text())
        self.now = int(time.time() * 1000)
        self.account_id = "11111111-1111-4111-8111-111111111111"
        self.root_device = "22222222-2222-4222-8222-222222222222"
        self.second_device = "33333333-3333-4333-8333-333333333333"
        self._create_account()
        self._create_root_device()

    def tearDown(self):
        self.db.close()

    def _create_account(self):
        now = self.now
        identity_id = "44444444-4444-4444-8444-444444444444"
        challenge_id = "88888888-8888-4888-8888-888888888888"
        self.db.execute(
            "INSERT INTO accounts (id,status,preferred_language,password_hash,created_at,updated_at) VALUES (?, 'pending_verification','fr','test-hash',?,?)",
            (self.account_id, now, now),
        )
        self.db.execute(
            "INSERT INTO account_identities (id,account_id,channel,normalized_value,verified_at,is_primary,created_at) VALUES (?,?,'email','root@example.test',NULL,1,?)",
            (identity_id, self.account_id, now),
        )
        self.db.execute(
            """INSERT INTO email_otp_challenges
            (id,account_id,identity_id,purpose,digest,created_at,expires_at,delivery_status)
            VALUES (?,?,?,'account_email_verification',?,?,?,'pending')""",
            (challenge_id, self.account_id, identity_id, "a" * 64, now, now + 600000),
        )
        self.db.execute(
            "UPDATE email_otp_challenges SET delivery_status='accepted' WHERE id=?",
            (challenge_id,),
        )
        self.db.execute(
            "UPDATE email_otp_challenges SET attempt_count=attempt_count+1, consumed_at=? WHERE id=?",
            (now + 1, challenge_id),
        )
        self.db.commit()
        self.assertEqual(self.db.execute("SELECT status FROM accounts WHERE id=?", (self.account_id,)).fetchone()[0], "active")

    def _create_root_device(self):
        now = self.now
        self.db.execute(
            "INSERT INTO devices (id,account_id,status,auth_version,created_at,revoked_at) VALUES (?,?,'active',1,?,NULL)",
            (self.root_device, self.account_id, now),
        )
        self.db.execute(
            """INSERT INTO device_root_credentials
            (id,device_id,account_id,credential_id,public_key_x,public_key_y,sign_count,credential_device_type,credential_backed_up,created_at,last_used_at)
            VALUES (?,?,?,?,?,?,0,'singleDevice',0,?,NULL)""",
            ("55555555-5555-4555-8555-555555555555", self.root_device, self.account_id, "credential-1", "A" * 43, "B" * 43, now),
        )
        self.db.commit()

    def test_migration_allows_multiple_devices_but_one_root_credential(self):
        now = self.now + 1
        self.db.execute(
            "INSERT INTO devices (id,account_id,status,auth_version,created_at,revoked_at) VALUES (?,?,'active',1,?,NULL)",
            (self.second_device, self.account_id, now),
        )
        self.db.execute(
            """INSERT INTO device_sessions
            (id,account_id,device_id,token_hash,status,auth_version,created_at,last_activity_at,expires_at,revoked_at)
            VALUES (?,?,?,?,'active',1,?,?,?,NULL)""",
            ("66666666-6666-4666-8666-666666666666", self.account_id, self.second_device, "c" * 64, now, now, now + 2592000000),
        )
        self.db.commit()
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM devices WHERE account_id=?", (self.account_id,)).fetchone()[0], 2)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO device_root_credentials
                (id,device_id,account_id,credential_id,public_key_x,public_key_y,sign_count,credential_device_type,credential_backed_up,created_at,last_used_at)
                VALUES (?,?,?,?,?,?,0,'singleDevice',0,?,NULL)""",
                ("77777777-7777-4777-8777-777777777777", self.second_device, self.account_id, "credential-2", "C" * 43, "D" * 43, now),
            )

    def test_migration_removes_single_device_index(self):
        indexes = {row[0] for row in self.db.execute("SELECT name FROM sqlite_master WHERE type='index'").fetchall()}
        self.assertNotIn("devices_one_root_per_account", indexes)
        self.assertIn("device_root_credentials_one_per_account", indexes)
        self.assertIn("devices_account_status", indexes)

    def test_migration_is_idempotent_for_index_names(self):
        migration = (ROOT / "migrations" / "0020_multi_device_password_login.sql").read_text()
        self.db.executescript(migration)
        indexes = {row[0] for row in self.db.execute("SELECT name FROM sqlite_master WHERE type='index'").fetchall()}
        self.assertIn("device_root_credentials_one_per_account", indexes)


if __name__ == "__main__":
    unittest.main()
