import sqlite3
import unittest
from pathlib import Path

MIGRATION = Path(__file__).resolve().parents[1] / "migrations" / "0021_support_tickets.sql"

class SupportTicketSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys = ON")
        self.db.executescript("""
          CREATE TABLE accounts (
            id TEXT PRIMARY KEY NOT NULL,
            status TEXT NOT NULL
          );
          INSERT INTO accounts (id, status) VALUES
            ('requester', 'active'), ('support', 'active'), ('suspended', 'suspended'), ('superadmin', 'active');\n          INSERT INTO account_roles (account_id, role) VALUES ('superadmin', 'super_admin');
        """)
        self.db.executescript(MIGRATION.read_text())

    def tearDown(self):
        self.db.close()

    def test_ticket_requires_active_requester(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""
              INSERT INTO support_tickets
              (id, public_reference, requester_account_id, category, subject, description, created_at, updated_at)
              VALUES ('bad', 'SAC-REFERENCE-0001', 'suspended', 'general_question', 'Question', 'Need help please', 10, 10)
            """)

    def test_ticket_creation_and_event(self):
        self.db.execute("""
          INSERT INTO support_tickets
          (id, public_reference, requester_account_id, category, subject, description, created_at, updated_at)
          VALUES ('ticket-1', 'SAC-REFERENCE-0002', 'requester', 'general_question', 'Question', 'Need help please', 10, 10)
        """)
        self.db.execute("""
          INSERT INTO support_ticket_events
          (id, ticket_id, actor_account_id, event_type, new_value, occurred_at)
          VALUES ('event-1', 'ticket-1', 'requester', 'created', 'new', 10)
        """)
        self.assertEqual(self.db.execute("SELECT status FROM support_tickets WHERE id='ticket-1'").fetchone()[0], "new")

    def test_ticket_creation_rate_is_limited_by_database(self):
        for index in range(5):
            self.db.execute("""
              INSERT INTO support_tickets
              (id, public_reference, requester_account_id, category, subject, description, created_at, updated_at)
              VALUES (?, ?, 'requester', 'general_question', 'Question', 'Need help please', ?, ?)
            """, (f'ticket-{index}', f'SAC-RATE-LIMIT-{index:02d}', 100 + index, 100 + index))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""
              INSERT INTO support_tickets
              (id, public_reference, requester_account_id, category, subject, description, created_at, updated_at)
              VALUES ('ticket-six', 'SAC-RATE-LIMIT-06', 'requester', 'general_question', 'Question', 'Need help please', 200, 200)
            """)

    def test_requester_cannot_write_as_support(self):
        self.db.execute("""
          INSERT INTO support_tickets
          (id, public_reference, requester_account_id, category, subject, description, created_at, updated_at)
          VALUES ('ticket-1', 'SAC-REFERENCE-0003', 'requester', 'general_question', 'Question', 'Need help please', 10, 10)
        """)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""
              INSERT INTO support_messages (id, ticket_id, author_account_id, author_kind, body, created_at)
              VALUES ('message-1', 'ticket-1', 'requester', 'support', 'Reply', 11)
            """)

    def test_only_super_admin_can_write_support_message(self):
        self.db.execute("""
          INSERT INTO support_tickets
          (id, public_reference, requester_account_id, category, subject, description, created_at, updated_at)
          VALUES ('ticket-1', 'SAC-ROLE-CHECK-0001', 'requester', 'general_question', 'Question', 'Need help please', 10, 10)
        """)
        self.db.execute("""
          INSERT INTO support_messages (id, ticket_id, author_account_id, author_kind, body, created_at)
          VALUES ('message-admin', 'ticket-1', 'superadmin', 'support', 'We are reviewing your request', 11)
        """)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM support_messages").fetchone()[0], 1)

    def test_messages_and_events_are_append_only(self):
        self.db.execute("""
          INSERT INTO support_tickets
          (id, public_reference, requester_account_id, category, subject, description, created_at, updated_at)
          VALUES ('ticket-1', 'SAC-REFERENCE-0004', 'requester', 'general_question', 'Question', 'Need help please', 10, 10)
        """)
        self.db.execute("""
          INSERT INTO support_messages (id, ticket_id, author_account_id, author_kind, body, created_at)
          VALUES ('message-1', 'ticket-1', 'requester', 'requester', 'Description complémentaire', 11)
        """)
        self.db.execute("""
          INSERT INTO support_ticket_events
          (id, ticket_id, actor_account_id, event_type, new_value, occurred_at)
          VALUES ('event-1', 'ticket-1', 'requester', 'created', 'new', 10)
        """)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE support_messages SET body='edited' WHERE id='message-1'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM support_ticket_events WHERE id='event-1'")

if __name__ == "__main__":
    unittest.main()
