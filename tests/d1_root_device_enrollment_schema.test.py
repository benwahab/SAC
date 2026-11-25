import sqlite3
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class RootDeviceEnrollmentSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys = ON")
        for migration in (
            "0001_account_email_otp.sql",
            "0006_email_otp_delivery_state.sql",
            "0007_root_device_enrollment.sql",
            "0012_root_authentication_challenges.sql",
            "0024_root_authentication_session_claim.sql",
        ):
            self.db.executescript((ROOT / "migrations" / migration).read_text())
        self.now = int(time.time() * 1000)
        self.account_id = "11111111-1111-4111-8111-111111111111"
        self.identity_id = "22222222-2222-4222-8222-222222222222"
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
        challenge_id = "33333333-3333-4333-8333-333333333333"
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

    def _complete_enrollment(self):
        now = self.now + 100
        ceremony = "44444444-4444-4444-8444-444444444444"
        challenge = "55555555-5555-4555-8555-555555555555"
        device = "66666666-6666-4666-8666-666666666666"
        credential = "77777777-7777-4777-8777-777777777777"
        session = "88888888-8888-4888-8888-888888888888"
        self.db.execute(
            "INSERT INTO root_enrollment_ceremonies (id,account_id,origin,status,created_at,expires_at,completed_at) VALUES (?,?,'https://sac.example','pending',?,?,NULL)",
            (ceremony, self.account_id, now, now + 300000),
        )
        self.db.execute(
            """INSERT INTO root_enrollment_challenges
            (id,ceremony_id,account_id,challenge_digest,created_at,expires_at,consumed_at,attempt_count)
            VALUES (?,?,?,?,?,?,NULL,0)""",
            (challenge, ceremony, self.account_id, "b" * 64, now, now + 300000),
        )
        self.db.execute(
            "UPDATE root_enrollment_challenges SET consumed_at=?, attempt_count=attempt_count+1 WHERE id=?",
            (now + 1, challenge),
        )
        self.db.execute(
            "INSERT INTO devices VALUES (?,?,'active',1,?,NULL)",
            (device, self.account_id, now + 1),
        )
        self.db.execute(
            """INSERT INTO device_root_credentials
            (id,device_id,account_id,credential_id,public_key_x,public_key_y,sign_count,credential_device_type,credential_backed_up,created_at,last_used_at)
            VALUES (?,?,?,?,?,?,0,'singleDevice',0,?,NULL)""",
            (credential, device, self.account_id, "AQIDBA", "A" * 43, "B" * 43, now + 1),
        )
        self.db.execute(
            """INSERT INTO device_sessions
            (id,account_id,device_id,token_hash,status,auth_version,created_at,last_activity_at,expires_at,revoked_at)
            VALUES (?,?,?,?,'active',1,?,?,?,NULL)""",
            (session, self.account_id, device, "c" * 64, now + 1, now + 1, now + 1 + 2592000000),
        )
        self.db.execute(
            "UPDATE root_enrollment_ceremonies SET status='completed', completed_at=? WHERE id=?",
            (now + 1, ceremony),
        )
        self.db.execute(
            "INSERT INTO device_enrollment_events VALUES (?,?,?, ?,?,'root_device_enrolled',?)",
            ("99999999-9999-4999-8999-999999999999", ceremony, self.account_id, device, session, now + 1),
        )
        self.db.commit()
        return ceremony, device, session

    def _create_authentication_challenge(self, challenge_id, now):
        _, device, _ = self._complete_enrollment()
        self.db.execute(
            """INSERT INTO root_authentication_challenges
            (id,account_id,device_id,origin,challenge_digest,created_at,expires_at,consumed_at,attempt_count)
            VALUES (?,?,?,'https://sac.example',?,?,?,NULL,0)""",
            (challenge_id, self.account_id, device, "a" * 64, now, now + 300000),
        )
        self.db.commit()
        return device

    def test_authentication_challenge_can_be_claimed_by_only_one_session_attempt(self):
        now = self.now + 500
        challenge_id = "aaaaaaaa-2222-4222-8222-222222222222"
        claim_id = "bbbbbbbb-2222-4222-8222-222222222222"
        self._create_authentication_challenge(challenge_id, now)

        first = self.db.execute(
            """UPDATE root_authentication_challenges
            SET consumed_at=?, attempt_count=attempt_count+1, consumed_by_request_id=?
            WHERE id=? AND consumed_at IS NULL AND expires_at>? AND attempt_count=0""",
            (now + 1, claim_id, challenge_id, now),
        )
        self.assertEqual(first.rowcount, 1)

        replay = self.db.execute(
            """UPDATE root_authentication_challenges
            SET consumed_at=?, attempt_count=attempt_count+1, consumed_by_request_id=?
            WHERE id=? AND consumed_at IS NULL AND expires_at>? AND attempt_count=0""",
            (now + 2, "cccccccc-2222-4222-8222-222222222222", challenge_id, now),
        )
        self.assertEqual(replay.rowcount, 0)
        row = self.db.execute(
            "SELECT consumed_at, attempt_count, consumed_by_request_id FROM root_authentication_challenges WHERE id=?",
            (challenge_id,),
        ).fetchone()
        self.assertEqual(row, (now + 1, 1, claim_id))

    def test_authentication_challenge_claim_is_required_immutable_and_unique(self):
        now = self.now + 600
        first_id = "dddddddd-2222-4222-8222-222222222222"
        second_id = "eeeeeeee-2222-4222-8222-222222222222"
        claim_id = "ffffffff-2222-4222-8222-222222222222"
        self._create_authentication_challenge(first_id, now)

        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "UPDATE root_authentication_challenges SET consumed_at=?, attempt_count=attempt_count+1 WHERE id=?",
                (now + 1, first_id),
            )

        self.db.execute(
            """UPDATE root_authentication_challenges
            SET consumed_at=?, attempt_count=attempt_count+1, consumed_by_request_id=?
            WHERE id=?""",
            (now + 1, claim_id, first_id),
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "UPDATE root_authentication_challenges SET consumed_by_request_id=? WHERE id=?",
                ("11111111-2222-4222-8222-222222222222", first_id),
            )

        self.db.execute(
            """INSERT INTO root_authentication_challenges
            (id,account_id,device_id,origin,challenge_digest,created_at,expires_at,consumed_at,attempt_count)
            SELECT ?,account_id,device_id,origin,?, ?, ?,NULL,0
            FROM root_authentication_challenges WHERE id=?""",
            (second_id, "b" * 64, now + 2, now + 300002, first_id),
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """UPDATE root_authentication_challenges
                SET consumed_at=?, attempt_count=attempt_count+1, consumed_by_request_id=?
                WHERE id=?""",
                (now + 3, claim_id, second_id),
            )

    def test_persists_one_root_device_credential_and_bound_session_atomically(self):
        ceremony, device, session = self._complete_enrollment()
        self.assertEqual(self.db.execute("SELECT status FROM root_enrollment_ceremonies WHERE id=?", (ceremony,)).fetchone()[0], "completed")
        self.assertEqual(self.db.execute("SELECT account_id FROM devices WHERE id=?", (device,)).fetchone()[0], self.account_id)
        self.assertEqual(self.db.execute("SELECT device_id FROM device_root_credentials WHERE device_id=?", (device,)).fetchone()[0], device)
        self.assertEqual(self.db.execute("SELECT device_id FROM device_sessions WHERE id=?", (session,)).fetchone()[0], device)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO devices (id,account_id,status,auth_version,created_at,revoked_at) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',?,'active',1,?,NULL)", (self.account_id, self.now + 2))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE root_enrollment_ceremonies SET origin='https://evil.example' WHERE id=?", (ceremony,))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM device_enrollment_events WHERE ceremony_id=?", (ceremony,))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE device_sessions SET last_activity_at=created_at-1 WHERE id=?", (session,))

    def test_failed_verification_attempts_are_counted_and_capped(self):
        ceremony = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        challenge = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
        now = self.now + 100
        self.db.execute("INSERT INTO root_enrollment_ceremonies (id,account_id,origin,status,created_at,expires_at,completed_at) VALUES (?,?,'https://sac.example','pending',?,?,NULL)", (ceremony, self.account_id, now, now + 300000))
        self.db.execute("INSERT INTO root_enrollment_challenges (id,ceremony_id,account_id,challenge_digest,created_at,expires_at) VALUES (?,?,?,?,?,?)", (challenge, ceremony, self.account_id, "d" * 64, now, now + 300000))
        for expected in range(1, 6):
            self.db.execute("UPDATE root_enrollment_challenges SET attempt_count=attempt_count+1 WHERE id=?", (challenge,))
            actual = self.db.execute("SELECT attempt_count FROM root_enrollment_challenges WHERE id=?", (challenge,)).fetchone()[0]
            self.assertEqual(actual, expected)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE root_enrollment_challenges SET attempt_count=attempt_count+1 WHERE id=?", (challenge,))

    def test_expired_pending_ceremony_can_be_closed_to_allow_retry(self):
        ceremony = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
        challenge = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
        created = self.now - 900000
        expires = self.now - 600000
        self.db.execute("INSERT INTO root_enrollment_ceremonies (id,account_id,origin,status,created_at,expires_at,completed_at) VALUES (?,?,'https://sac.example','pending',?,?,NULL)", (ceremony, self.account_id, created, expires))
        self.db.execute("INSERT INTO root_enrollment_challenges (id,ceremony_id,account_id,challenge_digest,created_at,expires_at) VALUES (?,?,?,?,?,?)", (challenge, ceremony, self.account_id, "e" * 64, created + 1, expires))
        self.db.execute("UPDATE root_enrollment_ceremonies SET status='expired' WHERE id=?", (ceremony,))
        self.assertEqual(self.db.execute("SELECT status FROM root_enrollment_ceremonies WHERE id=?", (ceremony,)).fetchone()[0], "expired")


    def test_abandoned_pending_ceremony_can_be_cancelled_and_replaced(self):
        first = "aaaaaaaa-1111-4111-8111-111111111111"
        first_challenge = "bbbbbbbb-1111-4111-8111-111111111111"
        second = "cccccccc-1111-4111-8111-111111111111"
        now = self.now + 100
        self.db.execute(
            "INSERT INTO root_enrollment_ceremonies (id,account_id,origin,status,created_at,expires_at,completed_at) VALUES (?,?,'https://sac.example','pending',?,?,NULL)",
            (first, self.account_id, now, now + 300000),
        )
        self.db.execute(
            "INSERT INTO root_enrollment_challenges (id,ceremony_id,account_id,challenge_digest,created_at,expires_at) VALUES (?,?,?,?,?,?)",
            (first_challenge, first, self.account_id, "f" * 64, now, now + 300000),
        )
        self.db.execute("UPDATE root_enrollment_ceremonies SET status='cancelled' WHERE id=?", (first,))
        self.db.execute(
            "INSERT INTO root_enrollment_ceremonies (id,account_id,origin,status,created_at,expires_at,completed_at) VALUES (?,?,'https://sac.example','pending',?,?,NULL)",
            (second, self.account_id, now + 1, now + 300001),
        )
        self.assertEqual(self.db.execute("SELECT status FROM root_enrollment_ceremonies WHERE id=?", (first,)).fetchone()[0], "cancelled")
        self.assertEqual(self.db.execute("SELECT status FROM root_enrollment_ceremonies WHERE id=?", (second,)).fetchone()[0], "pending")

    def test_unverified_account_cannot_start_root_enrollment(self):
        pending_id = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
        now = self.now + 100
        self.db.execute("INSERT INTO accounts VALUES (?,'pending_verification','fr','hash',?,?)", (pending_id, now, now))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO root_enrollment_ceremonies (id,account_id,origin,status,created_at,expires_at,completed_at) VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff',?,'https://sac.example','pending',?,?,NULL)", (pending_id, now, now + 300000))


if __name__ == "__main__":
    unittest.main()
