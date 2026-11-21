import sqlite3
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class OptionalRootEnrollmentSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys = ON")
        for migration in (
            "0001_account_email_otp.sql",
            "0006_email_otp_delivery_state.sql",
            "0007_root_device_enrollment.sql",
            "0016_optional_root_enrollment.sql",
        ):
            self.db.executescript((ROOT / "migrations" / migration).read_text())
        self.now = int(time.time() * 1000)
        self.account_id = "11111111-1111-4111-8111-111111111111"
        self.identity_id = "22222222-2222-4222-8222-222222222222"
        self.device_id = "33333333-3333-4333-8333-333333333333"
        self._create_verified_account()

    def tearDown(self):
        self.db.close()

    def _create_verified_account(self):
        now = self.now
        self.db.execute(
            "INSERT INTO accounts (id,status,preferred_language,password_hash,created_at,updated_at) VALUES (?, 'pending_verification','fr','test-hash',?,?)",
            (self.account_id, now, now),
        )
        self.db.execute(
            "INSERT INTO account_identities (id,account_id,channel,normalized_value,verified_at,is_primary,created_at) VALUES (?,?,'email','root@example.test',NULL,1,?)",
            (self.identity_id, self.account_id, now),
        )
        challenge_id = "44444444-4444-4444-8444-444444444444"
        self.db.execute(
            """INSERT INTO email_otp_challenges
            (id,account_id,identity_id,purpose,digest,created_at,expires_at,delivery_status)
            VALUES (?,?,?,'account_email_verification',?,?,?,'pending')""",
            (challenge_id, self.account_id, self.identity_id, "a" * 64, now, now + 600000),
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

    def _insert_provisional_device(self):
        self.db.execute(
            "INSERT INTO devices (id,account_id,status,auth_version,created_at,revoked_at) VALUES (?,?,'active',1,?,NULL)",
            (self.device_id, self.account_id, self.now),
        )

    def _insert_ceremony(self, ceremony_id):
        self.db.execute(
            "INSERT INTO root_enrollment_ceremonies (id,account_id,origin,status,created_at,expires_at,completed_at) VALUES (?,?,'https://sac.example','pending',?,?,NULL)",
            (ceremony_id, self.account_id, self.now + 2, self.now + 300000),
        )

    def test_allows_enrollment_after_a_provisional_password_session(self):
        self._insert_provisional_device()
        self._insert_ceremony("55555555-5555-4555-8555-555555555555")
        self.db.execute(
            """INSERT INTO root_enrollment_challenges
            (id,ceremony_id,account_id,challenge_digest,created_at,expires_at,consumed_at,attempt_count)
            VALUES ('66666666-6666-4666-8666-666666666666','55555555-5555-4555-8555-555555555555',?,?,?,?,NULL,0)""",
            (self.account_id, "b" * 64, self.now + 2, self.now + 300000),
        )
        self.db.execute(
            """INSERT INTO device_root_credentials
            (id,device_id,account_id,credential_id,public_key_x,public_key_y,sign_count,credential_device_type,credential_backed_up,created_at,last_used_at)
            VALUES ('77777777-7777-4777-8777-777777777777',?,?,?,?,?,0,'singleDevice',0,?,NULL)""",
            (self.device_id, self.account_id, "credential-1", "A" * 43, "B" * 43, self.now + 2),
        )
        self.db.commit()
        self.assertEqual(
            self.db.execute("SELECT COUNT(*) FROM device_root_credentials WHERE device_id=?", (self.device_id,)).fetchone()[0],
            1,
        )

    def test_rejects_a_second_root_enrollment_after_the_credential_exists(self):
        self._insert_provisional_device()
        self.db.execute(
            """INSERT INTO device_root_credentials
            (id,device_id,account_id,credential_id,public_key_x,public_key_y,sign_count,credential_device_type,credential_backed_up,created_at,last_used_at)
            VALUES ('77777777-7777-4777-8777-777777777777',?,?,?,?,?,0,'singleDevice',0,?,NULL)""",
            (self.device_id, self.account_id, "credential-1", "A" * 43, "B" * 43, self.now + 2),
        )
        with self.assertRaises(sqlite3.IntegrityError) as context:
            self._insert_ceremony("88888888-8888-4888-8888-888888888888")
        self.assertIn("root_device_already_enrolled", str(context.exception))


if __name__ == "__main__":
    unittest.main()
