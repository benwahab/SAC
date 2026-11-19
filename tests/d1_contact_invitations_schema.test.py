import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = [
    ROOT / "migrations" / "0001_account_email_otp.sql",
    ROOT / "migrations" / "0002_contact_invitations.sql",
]


class ContactInvitationD1Tests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        for migration in MIGRATIONS:
            self.db.executescript(migration.read_text(encoding="utf-8"))
        self.now = 1_800_000_000_000
        self.create_active_account("owner", "owner@example.ne", self.now)
        self.create_active_account("contact", "contact@example.ne", self.now + 1)

    def tearDown(self):
        self.db.close()

    def create_active_account(self, account_id, email, created_at):
        self.db.execute(
            """INSERT INTO accounts
               (id, status, preferred_language, password_hash, created_at, updated_at)
               VALUES (?, 'pending_verification', 'fr', 'test-hash', ?, ?)""",
            (account_id, created_at, created_at),
        )
        identity_id = f"{account_id}-email"
        challenge_id = f"{account_id}-otp"
        self.db.execute(
            """INSERT INTO account_identities
               (id, account_id, channel, normalized_value, verified_at, is_primary, created_at)
               VALUES (?, ?, 'email', ?, NULL, 1, ?)""",
            (identity_id, account_id, email, created_at),
        )
        self.db.execute(
            """INSERT INTO email_otp_challenges
               (id, account_id, identity_id, purpose, digest, attempt_count,
                max_attempts, created_at, expires_at)
               VALUES (?, ?, ?, 'account_email_verification', ?, 0, 6, ?, ?)""",
            (challenge_id, account_id, identity_id, "a" * 64, created_at, created_at + 600_000),
        )
        verified_at = created_at + 1
        self.db.execute(
            """UPDATE email_otp_challenges
               SET attempt_count=1, consumed_at=?
               WHERE id=?""",
            (verified_at, challenge_id),
        )
        self.db.commit()

    def create_invitation(self, invitation_id="invite-1", **overrides):
        values = {
            "id": invitation_id,
            "inviter_account_id": "owner",
            "destination_email": "contact@example.ne",
            "recipient_account_id": None,
            "token_digest": (invitation_id.encode().hex() + "0" * 64)[:64],
            "permission_version": "permissions-v1",
            "status": "pending",
            "created_at": self.now + 10,
            "expires_at": self.now + 7 * 24 * 60 * 60 * 1000,
            "decided_at": None,
        }
        values.update(overrides)
        self.db.execute(
            """INSERT INTO contact_invitations
               (id, inviter_account_id, destination_email, recipient_account_id,
                token_digest, permission_version, status, created_at, expires_at, decided_at)
               VALUES (:id, :inviter_account_id, :destination_email, :recipient_account_id,
                       :token_digest, :permission_version, :status, :created_at, :expires_at, :decided_at)""",
            values,
        )
        self.db.commit()
        return values

    def accept(self, invitation_id="invite-1", at=None):
        self.db.execute(
            """UPDATE contact_invitations
               SET status='accepted', recipient_account_id='contact', decided_at=?
               WHERE id=?""",
            (at if at is not None else self.now + 11, invitation_id),
        )
        self.db.commit()

    def test_active_verified_inviter_can_create_pending_invitation(self):
        self.create_invitation()
        row = self.db.execute(
            "SELECT status, recipient_account_id, decided_at FROM contact_invitations WHERE id='invite-1'"
        ).fetchone()
        self.assertEqual(tuple(row), ("pending", None, None))

    def test_unverified_or_inactive_inviter_cannot_create_invitation(self):
        self.db.execute("UPDATE accounts SET status='suspended' WHERE id='owner'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "contact_invitation_inviter_not_eligible"):
            self.create_invitation()

    def test_self_invitation_is_rejected(self):
        with self.assertRaisesRegex(sqlite3.IntegrityError, "contact_invitation_inviter_not_eligible"):
            self.create_invitation(destination_email="owner@example.ne")

    def test_only_one_pending_invitation_for_same_owner_and_email(self):
        self.create_invitation()
        with self.assertRaises(sqlite3.IntegrityError):
            self.create_invitation("invite-2")

    def test_acceptance_requires_active_account_and_exact_verified_email(self):
        self.create_invitation()
        self.db.execute("UPDATE accounts SET status='suspended' WHERE id='contact'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "contact_invitation_recipient_not_eligible"):
            self.accept()

    def test_acceptance_requires_destination_email_match(self):
        self.create_invitation(destination_email="other@example.ne")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "contact_invitation_recipient_not_eligible"):
            self.accept()

    def test_accepted_invitation_creates_only_directional_relationship(self):
        self.create_invitation()
        self.accept()
        self.db.execute(
            """INSERT INTO trusted_contacts
               (owner_account_id, contact_account_id, invitation_id, permission_version,
                status, created_at, revoked_at)
               VALUES ('owner', 'contact', 'invite-1', 'permissions-v1', 'active', ?, NULL)""",
            (self.now + 11,),
        )
        self.db.commit()
        rows = self.db.execute(
            "SELECT owner_account_id, contact_account_id FROM trusted_contacts"
        ).fetchall()
        self.assertEqual([tuple(row) for row in rows], [("owner", "contact")])

    def test_relationship_cannot_be_created_before_invitation_acceptance(self):
        self.create_invitation()
        with self.assertRaisesRegex(sqlite3.IntegrityError, "trusted_contact_requires_matching_acceptance"):
            self.db.execute(
                """INSERT INTO trusted_contacts
                   (owner_account_id, contact_account_id, invitation_id, permission_version,
                    status, created_at, revoked_at)
                   VALUES ('owner', 'contact', 'invite-1', 'permissions-v1', 'active', ?, NULL)""",
                (self.now + 11,),
            )

    def test_relationship_must_match_accepted_invitation_version_and_timestamp(self):
        self.create_invitation()
        self.accept()
        with self.assertRaisesRegex(sqlite3.IntegrityError, "trusted_contact_requires_matching_acceptance"):
            self.db.execute(
                """INSERT INTO trusted_contacts
                   (owner_account_id, contact_account_id, invitation_id, permission_version,
                    status, created_at, revoked_at)
                   VALUES ('owner', 'contact', 'invite-1', 'permissions-v2', 'active', ?, NULL)""",
                (self.now + 11,),
            )

    def test_declined_invitation_does_not_create_relationship(self):
        self.create_invitation()
        self.db.execute(
            """UPDATE contact_invitations
               SET status='declined', recipient_account_id='contact', decided_at=?
               WHERE id='invite-1'""",
            (self.now + 11,),
        )
        self.db.commit()
        self.assertEqual(
            self.db.execute("SELECT count(*) FROM trusted_contacts").fetchone()[0], 0
        )

    def test_inviter_can_revoke_pending_invitation(self):
        self.create_invitation()
        self.db.execute(
            "UPDATE contact_invitations SET status='revoked', decided_at=? WHERE id='invite-1'",
            (self.now + 11,),
        )
        self.db.commit()
        self.assertEqual(
            self.db.execute("SELECT status FROM contact_invitations WHERE id='invite-1'").fetchone()[0],
            "revoked",
        )

    def test_expiration_requires_expiry_deadline_to_have_passed(self):
        self.create_invitation()
        with self.assertRaisesRegex(sqlite3.IntegrityError, "contact_invitation_not_yet_expired"):
            self.db.execute(
                "UPDATE contact_invitations SET status='expired', decided_at=? WHERE id='invite-1'",
                (self.now + 11,),
            )

    def test_expired_invitation_cannot_be_accepted_at_deadline(self):
        invitation = self.create_invitation()
        with self.assertRaisesRegex(sqlite3.IntegrityError, "contact_invitation_expired"):
            self.accept(at=invitation["expires_at"])

    def test_terminal_invitation_cannot_be_reopened_or_rewritten(self):
        self.create_invitation()
        self.db.execute(
            "UPDATE contact_invitations SET status='revoked', decided_at=? WHERE id='invite-1'",
            (self.now + 11,),
        )
        with self.assertRaisesRegex(sqlite3.IntegrityError, "contact_invitation_terminal_state"):
            self.db.execute(
                "UPDATE contact_invitations SET status='pending', decided_at=NULL WHERE id='invite-1'"
            )

    def test_revoked_relationship_cannot_be_reactivated(self):
        self.create_invitation()
        self.accept()
        self.db.execute(
            """INSERT INTO trusted_contacts
               (owner_account_id, contact_account_id, invitation_id, permission_version,
                status, created_at, revoked_at)
               VALUES ('owner', 'contact', 'invite-1', 'permissions-v1', 'active', ?, NULL)""",
            (self.now + 11,),
        )
        self.db.execute(
            """UPDATE trusted_contacts SET status='revoked', revoked_at=?
               WHERE owner_account_id='owner' AND contact_account_id='contact'""",
            (self.now + 12,),
        )
        with self.assertRaisesRegex(sqlite3.IntegrityError, "trusted_contact_already_revoked"):
            self.db.execute(
                """UPDATE trusted_contacts SET status='active', revoked_at=NULL
                   WHERE owner_account_id='owner' AND contact_account_id='contact'"""
            )


if __name__ == "__main__":
    unittest.main()
