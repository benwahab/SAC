import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = [
    ROOT / "migrations" / "0001_account_email_otp.sql",
    ROOT / "migrations" / "0006_email_otp_delivery_state.sql",
    ROOT / "migrations" / "0013_super_admin_bootstrap.sql",
]
BOOTSTRAP_EMAIL = "benwahab111@gmail.com"


class SuperAdminBootstrapTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        for migration in MIGRATIONS:
            self.db.executescript(migration.read_text(encoding="utf-8"))
        self.now = 1_800_000_000_000
        self.add_account("admin-account", BOOTSTRAP_EMAIL)
        self.add_account("ordinary-account", "citizen@example.ne")
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def add_account(self, account_id, email):
        self.db.execute(
            """INSERT INTO accounts
               (id, status, preferred_language, password_hash, created_at, updated_at)
               VALUES (?, 'pending_verification', 'fr', 'test-hash', ?, ?)""",
            (account_id, self.now, self.now),
        )
        self.db.execute(
            """INSERT INTO account_identities
               (id, account_id, channel, normalized_value, verified_at, is_primary, created_at)
               VALUES (?, ?, 'email', ?, NULL, 1, ?)""",
            (f"{account_id}-email", account_id, email, self.now),
        )

    def verify_email_with_otp(self, account_id, at):
        identity_id = f"{account_id}-email"
        challenge_id = f"{account_id}-otp"
        self.db.execute(
            """INSERT INTO email_otp_challenges
               (id, account_id, identity_id, purpose, digest, attempt_count,
                max_attempts, created_at, expires_at, delivery_status)
               VALUES (?, ?, ?, 'account_email_verification', ?, 0, 6, ?, ?, 'pending')""",
            (challenge_id, account_id, identity_id, "a" * 64, at, at + 600_000),
        )
        self.db.execute(
            "UPDATE email_otp_challenges SET delivery_status='accepted' WHERE id=?",
            (challenge_id,),
        )
        self.db.execute(
            """UPDATE email_otp_challenges
               SET attempt_count=1, consumed_at=?
               WHERE id=? AND consumed_at IS NULL""",
            (at + 1, challenge_id),
        )
        self.db.commit()

    def test_super_admin_role_is_granted_only_after_bootstrap_email_otp(self):
        before = self.db.execute("SELECT count(*) FROM account_roles").fetchone()[0]
        self.assertEqual(before, 0)

        self.verify_email_with_otp("admin-account", self.now + 1)

        role = self.db.execute(
            "SELECT account_id, role, grant_reason, granted_at FROM account_roles"
        ).fetchone()
        self.assertEqual(role["account_id"], "admin-account")
        self.assertEqual(role["role"], "super_admin")
        self.assertEqual(role["grant_reason"], "verified_bootstrap_email")
        self.assertEqual(role["granted_at"], self.now + 2)

        account = self.db.execute(
            "SELECT status FROM accounts WHERE id='admin-account'"
        ).fetchone()
        self.assertEqual(account["status"], "active")

    def test_ordinary_verified_account_never_receives_super_admin(self):
        self.verify_email_with_otp("ordinary-account", self.now + 1)
        count = self.db.execute(
            "SELECT count(*) FROM account_roles WHERE role='super_admin'"
        ).fetchone()[0]
        self.assertEqual(count, 0)

    def test_unverified_bootstrap_email_has_no_role(self):
        count = self.db.execute(
            "SELECT count(*) FROM account_roles WHERE account_id='admin-account'"
        ).fetchone()[0]
        self.assertEqual(count, 0)

    def test_database_rejects_manual_grant_to_non_bootstrap_identity(self):
        self.verify_email_with_otp("ordinary-account", self.now + 1)
        with self.assertRaisesRegex(
            sqlite3.IntegrityError, "super_admin_bootstrap_identity_not_verified"
        ):
            self.db.execute(
                """INSERT INTO account_roles
                   (id, account_id, role, source_identity_id, grant_reason, granted_at)
                   VALUES ('forged-role', 'ordinary-account', 'super_admin',
                           'ordinary-account-email', 'verified_bootstrap_email', ?)""",
                (self.now + 2,),
            )

    def test_only_one_super_admin_can_exist(self):
        self.verify_email_with_otp("admin-account", self.now + 1)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO account_roles
                   (id, account_id, role, source_identity_id, grant_reason, granted_at)
                   SELECT 'duplicate-role', account_id, role, source_identity_id,
                          grant_reason, granted_at
                   FROM account_roles WHERE role='super_admin'"""
            )

    def test_role_is_not_derived_from_registration_input(self):
        # Une simple identité déclarée, même exacte, n'est pas une preuve.
        identity = self.db.execute(
            "SELECT verified_at FROM account_identities WHERE account_id='admin-account'"
        ).fetchone()
        self.assertIsNone(identity["verified_at"])
        self.assertEqual(
            self.db.execute("SELECT count(*) FROM account_roles").fetchone()[0], 0
        )


if __name__ == "__main__":
    unittest.main()
