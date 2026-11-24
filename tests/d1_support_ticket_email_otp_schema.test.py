import sqlite3
import unittest
from pathlib import Path

MIGRATION = Path(__file__).resolve().parents[1] / "migrations" / "0022_support_ticket_email_otp.sql"

class SupportIntakeOtpSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.executescript(MIGRATION.read_text())

    def tearDown(self):
        self.db.close()

    def insert(self, ident, email, ip, created):
        self.db.execute("""
          INSERT INTO support_ticket_intake_challenges
          (id, normalized_email, request_ip_hash, digest, attempt_count, max_attempts, delivery_status, created_at, expires_at)
          VALUES (?, ?, ?, ?, 0, 6, 'pending', ?, ?)
        """, (ident, email, ip, "a" * 64, created, created + 600000))

    def test_pending_challenge_can_be_accepted_then_consumed(self):
        self.insert("challenge-1", "person@example.com", "a" * 64, 1000)
        self.db.execute("UPDATE support_ticket_intake_challenges SET delivery_status='accepted' WHERE id='challenge-1'")
        self.db.execute("UPDATE support_ticket_intake_challenges SET attempt_count=1, consumed_at=2000, created_ticket_id='ticket-1' WHERE id='challenge-1'")
        row = self.db.execute("SELECT delivery_status, attempt_count, consumed_at, created_ticket_id FROM support_ticket_intake_challenges WHERE id='challenge-1'").fetchone()
        self.assertEqual(row, ("accepted", 1, 2000, "ticket-1"))

    def test_email_cooldown_is_enforced(self):
        self.insert("challenge-1", "person@example.com", "a" * 64, 1000)
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert("challenge-2", "person@example.com", "b" * 64, 2000)

    def test_ip_hourly_rate_limit_is_enforced(self):
        for index in range(10):
            self.insert(f"challenge-{index}", f"person{index}@example.com", "a" * 64, 1000 + index)
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert("challenge-eleven", "another@example.com", "a" * 64, 2000)

    def test_ticket_id_can_be_bound_to_only_one_consumed_challenge(self):
        self.insert("challenge-1", "person@example.com", "a" * 64, 1000)
        self.insert("challenge-2", "another@example.com", "b" * 64, 70000)
        self.db.execute("UPDATE support_ticket_intake_challenges SET delivery_status='accepted' WHERE id IN ('challenge-1','challenge-2')")
        self.db.execute("UPDATE support_ticket_intake_challenges SET attempt_count=1, consumed_at=2000, created_ticket_id='ticket-1' WHERE id='challenge-1'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE support_ticket_intake_challenges SET attempt_count=1, consumed_at=71000, created_ticket_id='ticket-1' WHERE id='challenge-2'")

    def test_challenge_digest_and_email_are_immutable(self):
        self.insert("challenge-1", "person@example.com", "a" * 64, 1000)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE support_ticket_intake_challenges SET digest=? WHERE id='challenge-1'", ("b" * 64,))

if __name__ == "__main__":
    unittest.main()
