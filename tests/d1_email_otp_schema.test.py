import sqlite3
import unittest
from pathlib import Path

MIGRATIONS = [
    Path(__file__).resolve().parents[1] / "migrations" / "0001_account_email_otp.sql",
    Path(__file__).resolve().parents[1] / "migrations" / "0006_email_otp_delivery_state.sql",
]


class EmailOtpD1SchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        for migration in MIGRATIONS:
            self.db.executescript(migration.read_text(encoding="utf-8"))
        self.now = 1_800_000_000_000
        self.db.execute(
            "INSERT INTO accounts VALUES (?, 'pending_verification', 'fr', ?, ?, ?)",
            ("account-1", "pbkdf2-test-verifier", self.now, self.now),
        )
        self.db.execute(
            """INSERT INTO account_identities
               (id, account_id, channel, normalized_value, verified_at, is_primary, created_at)
               VALUES ('email-1', 'account-1', 'email', 'person@example.ne', NULL, 1, ?)""",
            (self.now,),
        )
        self.db.execute(
            """INSERT INTO account_identities
               (id, account_id, channel, normalized_value, verified_at, is_primary, created_at)
               VALUES ('phone-1', 'account-1', 'phone', '+22790000000', NULL, 1, ?)""",
            (self.now,),
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def create_challenge(self, challenge_id, created_at, digest=None, delivery_status="accepted"):
        # Toute insertion commence en pending, comme l'exige le trigger D1.
        self.db.execute(
            """INSERT INTO email_otp_challenges
               (id, account_id, identity_id, purpose, digest, attempt_count,
                max_attempts, created_at, expires_at, delivery_status)
               VALUES (?, 'account-1', 'email-1', 'account_email_verification',
                       ?, 0, 6, ?, ?, 'pending')""",
            (challenge_id, digest or ("a" * 64), created_at, created_at + 600_000),
        )
        if delivery_status != "pending":
            self.db.execute(
                "UPDATE email_otp_challenges SET delivery_status=? WHERE id=?",
                (delivery_status, challenge_id),
            )
        self.db.commit()


    def submit_attempt(self, challenge_id, candidate_digest, at):
        return self.db.execute(
            """UPDATE email_otp_challenges
               SET attempt_count = attempt_count + 1,
                   consumed_at = CASE WHEN digest = ? THEN ? ELSE NULL END,
                   invalidated_at = CASE
                     WHEN digest <> ? AND attempt_count + 1 >= max_attempts THEN ?
                     ELSE NULL
                   END
               WHERE id = ?
                 AND consumed_at IS NULL
                 AND invalidated_at IS NULL
                 AND expires_at > ?
                 AND attempt_count < max_attempts
               RETURNING consumed_at, attempt_count""",
            (candidate_digest, at, candidate_digest, at, challenge_id, at),
        ).fetchone()

    def test_new_challenge_invalidates_previous_and_cooldown_is_exactly_60_seconds(self):
        self.create_challenge("otp-1", self.now)
        with self.assertRaisesRegex(sqlite3.IntegrityError, "otp_resend_cooldown"):
            self.create_challenge("too-soon", self.now + 59_999)

        self.create_challenge("otp-2", self.now + 60_000, delivery_status="pending")
        old = self.db.execute(
            "SELECT invalidated_at FROM email_otp_challenges WHERE id='otp-1'"
        ).fetchone()
        self.assertIsNone(old["invalidated_at"])

        self.db.execute(
            "UPDATE email_otp_challenges SET delivery_status='accepted' WHERE id='otp-2'"
        )
        self.db.commit()
        old = self.db.execute(
            "SELECT invalidated_at FROM email_otp_challenges WHERE id='otp-1'"
        ).fetchone()
        self.assertEqual(old["invalidated_at"], self.now + 60_000)

        current = self.db.execute(
            "SELECT invalidated_at FROM email_otp_challenges WHERE id='otp-2'"
        ).fetchone()
        self.assertIsNone(current["invalidated_at"])

    def test_six_wrong_attempts_exhaust_the_challenge(self):
        self.create_challenge("otp-wrong", self.now)
        for attempt in range(1, 7):
            result = self.submit_attempt("otp-wrong", "b" * 64, self.now + attempt)
            self.assertIsNotNone(result)
            self.assertEqual(result["attempt_count"], attempt)

        state = self.db.execute(
            "SELECT attempt_count, invalidated_at FROM email_otp_challenges WHERE id='otp-wrong'"
        ).fetchone()
        self.assertEqual(state["attempt_count"], 6)
        self.assertIsNotNone(state["invalidated_at"])
        self.assertIsNone(self.submit_attempt("otp-wrong", "a" * 64, self.now + 10))

    def test_correct_code_consumes_once_verifies_email_and_activates_account_atomically(self):
        self.create_challenge("otp-good", self.now)
        result = self.submit_attempt("otp-good", "a" * 64, self.now + 1)
        self.assertEqual(result["consumed_at"], self.now + 1)
        self.assertEqual(result["attempt_count"], 1)

        account = self.db.execute(
            "SELECT status FROM accounts WHERE id='account-1'"
        ).fetchone()
        identity = self.db.execute(
            "SELECT verified_at FROM account_identities WHERE id='email-1'"
        ).fetchone()
        self.assertEqual(account["status"], "active")
        self.assertEqual(identity["verified_at"], self.now + 1)
        self.assertIsNone(self.submit_attempt("otp-good", "a" * 64, self.now + 2))

    def test_wrong_code_does_not_activate_account(self):
        self.create_challenge("otp-bad", self.now)
        self.submit_attempt("otp-bad", "b" * 64, self.now + 1)
        account = self.db.execute(
            "SELECT status FROM accounts WHERE id='account-1'"
        ).fetchone()
        identity = self.db.execute(
            "SELECT verified_at FROM account_identities WHERE id='email-1'"
        ).fetchone()
        self.assertEqual(account["status"], "pending_verification")
        self.assertIsNone(identity["verified_at"])

    def test_activation_is_blocked_if_account_is_no_longer_pending(self):
        self.create_challenge("otp-suspended", self.now)
        self.db.execute(
            "UPDATE accounts SET status='suspended' WHERE id='account-1'"
        )
        self.db.commit()
        with self.assertRaisesRegex(sqlite3.IntegrityError, "otp_account_no_longer_pending"):
            self.submit_attempt("otp-suspended", "a" * 64, self.now + 1)

    def test_phone_identity_is_never_accepted_as_email_otp_target(self):
        with self.assertRaisesRegex(sqlite3.IntegrityError, "otp_account_or_identity_not_eligible"):
            self.db.execute(
                """INSERT INTO email_otp_challenges
                   (id, account_id, identity_id, purpose, digest, created_at, expires_at)
                   VALUES ('otp-phone', 'account-1', 'phone-1',
                           'account_email_verification', ?, ?, ?)""",
                ("c" * 64, self.now, self.now + 600_000),
            )

    def test_unique_email_and_phone_identity_per_channel(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO account_identities
                   (id, account_id, channel, normalized_value, is_primary, created_at)
                   VALUES ('email-duplicate', 'account-1', 'email',
                           'person@example.ne', 0, ?)""",
                (self.now,),
            )


    def test_pending_account_cannot_be_activated_without_consumed_email_otp(self):
        with self.assertRaisesRegex(sqlite3.IntegrityError, "account_activation_requires_email_otp"):
            self.db.execute(
                "UPDATE accounts SET status='active' WHERE id='account-1'"
            )

    def test_email_identity_cannot_be_verified_without_consumed_challenge(self):
        with self.assertRaisesRegex(sqlite3.IntegrityError, "email_identity_requires_consumed_otp"):
            self.db.execute(
                "UPDATE account_identities SET verified_at=? WHERE id='email-1'",
                (self.now + 1,),
            )

    def test_phone_identity_cannot_be_verified_in_account_otp_flow(self):
        with self.assertRaisesRegex(sqlite3.IntegrityError, "phone_identity_verification_not_supported"):
            self.db.execute(
                "UPDATE account_identities SET verified_at=? WHERE id='phone-1'",
                (self.now + 1,),
            )


    def test_identity_contact_value_cannot_be_silently_changed(self):
        with self.assertRaisesRegex(sqlite3.IntegrityError, "account_identity_immutable_fields"):
            self.db.execute(
                "UPDATE account_identities SET normalized_value=? WHERE id='email-1'",
                ("attacker@example.ne",),
            )


    def test_new_account_cannot_be_inserted_as_active(self):
        with self.assertRaisesRegex(sqlite3.IntegrityError, "account_must_start_pending_verification"):
            self.db.execute(
                """INSERT INTO accounts
                   (id, status, preferred_language, password_hash, created_at, updated_at)
                   VALUES ('active-direct', 'active', 'fr', 'hash', ?, ?)""",
                (self.now, self.now),
            )


    def test_challenge_expires_at_exact_deadline(self):
        self.create_challenge("otp-expired", self.now)
        result = self.submit_attempt("otp-expired", "a" * 64, self.now + 600_000)
        self.assertIsNone(result)
        state = self.db.execute(
            "SELECT attempt_count, consumed_at FROM email_otp_challenges WHERE id='otp-expired'"
        ).fetchone()
        self.assertEqual(state["attempt_count"], 0)
        self.assertIsNone(state["consumed_at"])

    def test_account_and_identity_inserts_roll_back_together_on_duplicate_identity(self):
        self.db.execute("BEGIN")
        self.db.execute(
            """INSERT INTO accounts
               (id, status, preferred_language, password_hash, created_at, updated_at)
               VALUES ('account-orphan-check', 'pending_verification', 'fr', 'hash', ?, ?)""",
            (self.now + 1, self.now + 1),
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO account_identities
                   (id, account_id, channel, normalized_value, is_primary, created_at)
                   VALUES ('email-orphan-check', 'account-orphan-check', 'email',
                           'person@example.ne', 1, ?)""",
                (self.now + 1,),
            )
        self.db.rollback()
        orphan = self.db.execute(
            "SELECT 1 FROM accounts WHERE id='account-orphan-check'"
        ).fetchone()
        self.assertIsNone(orphan)


    def test_database_rejects_consumption_at_or_after_expiration(self):
        self.create_challenge("otp-expiry-guard", self.now)
        with self.assertRaisesRegex(sqlite3.IntegrityError, "otp_invalid_challenge_transition"):
            self.db.execute(
                """UPDATE email_otp_challenges
                   SET attempt_count=1, consumed_at=?
                   WHERE id='otp-expiry-guard'""",
                (self.now + 600_000,),
            )
        state = self.db.execute(
            "SELECT attempt_count, consumed_at FROM email_otp_challenges WHERE id='otp-expiry-guard'"
        ).fetchone()
        self.assertEqual(state["attempt_count"], 0)
        self.assertIsNone(state["consumed_at"])


    def test_failed_email_delivery_keeps_previous_delivered_code_valid(self):
        self.create_challenge("otp-delivered-old", self.now)
        self.create_challenge("otp-new-failed", self.now + 60_000, "b" * 64, "pending")
        self.db.execute(
            "UPDATE email_otp_challenges SET delivery_status='failed' WHERE id='otp-new-failed'"
        )
        self.db.commit()
        old = self.db.execute(
            "SELECT invalidated_at FROM email_otp_challenges WHERE id='otp-delivered-old'"
        ).fetchone()
        self.assertIsNone(old["invalidated_at"])
        result = self.submit_attempt("otp-delivered-old", "a" * 64, self.now + 60_001)
        self.assertIsNotNone(result)
        self.assertEqual(result["consumed_at"], self.now + 60_001)

    def test_new_code_invalidates_previous_only_after_delivery_acceptance(self):
        self.create_challenge("otp-delivered-old-2", self.now)
        self.create_challenge("otp-new-pending", self.now + 60_000, "b" * 64, "pending")
        old = self.db.execute(
            "SELECT invalidated_at FROM email_otp_challenges WHERE id='otp-delivered-old-2'"
        ).fetchone()
        self.assertIsNone(old["invalidated_at"])
        self.db.execute(
            "UPDATE email_otp_challenges SET delivery_status='accepted' WHERE id='otp-new-pending'"
        )
        self.db.commit()
        old = self.db.execute(
            "SELECT invalidated_at FROM email_otp_challenges WHERE id='otp-delivered-old-2'"
        ).fetchone()
        self.assertEqual(old["invalidated_at"], self.now + 60_000)

    def test_new_challenge_must_explicitly_start_pending(self):
        with self.assertRaisesRegex(sqlite3.IntegrityError, "otp_new_challenge_must_start_pending"):
            self.db.execute(
                """INSERT INTO email_otp_challenges
                   (id, account_id, identity_id, purpose, digest, created_at, expires_at)
                   VALUES ('otp-implicit-accepted', 'account-1', 'email-1',
                           'account_email_verification', ?, ?, ?)""",
                ("d" * 64, self.now, self.now + 600_000),
            )

    def test_failed_delivery_cannot_be_promoted_to_accepted(self):
        self.create_challenge("otp-failed-terminal", self.now, "e" * 64, "pending")
        self.db.execute(
            "UPDATE email_otp_challenges SET delivery_status='failed' WHERE id='otp-failed-terminal'"
        )
        with self.assertRaisesRegex(sqlite3.IntegrityError, "otp_invalid_challenge_transition"):
            self.db.execute(
                "UPDATE email_otp_challenges SET delivery_status='accepted' WHERE id='otp-failed-terminal'"
            )

    def test_pending_code_cannot_consume_verification_attempts(self):
        self.create_challenge("otp-not-delivered", self.now, "a" * 64, "pending")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "otp_invalid_challenge_transition"):
            self.db.execute(
                """UPDATE email_otp_challenges
                   SET attempt_count=1, consumed_at=?
                   WHERE id='otp-not-delivered'""",
                (self.now + 1,),
            )



if __name__ == "__main__":
    unittest.main()
