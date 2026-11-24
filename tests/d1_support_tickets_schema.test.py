import sqlite3
import unittest
from pathlib import Path

MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"

class SupportTicketSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys = ON")
        self.db.executescript("""
          CREATE TABLE accounts (
            id TEXT PRIMARY KEY NOT NULL,
            status TEXT NOT NULL
          );
          CREATE TABLE account_roles (
            account_id TEXT NOT NULL,
            role TEXT NOT NULL
          );
          INSERT INTO accounts (id, status) VALUES
            ('requester', 'active'), ('support', 'active'), ('suspended', 'suspended'), ('superadmin', 'active');
          INSERT INTO account_roles (account_id, role) VALUES ('superadmin', 'super_admin');
        """)
        self.db.executescript((MIGRATIONS / "0021_support_tickets.sql").read_text())
        self.db.executescript("""
          CREATE TABLE admin_missions (
            id TEXT PRIMARY KEY NOT NULL,
            assigned_account_id TEXT NOT NULL,
            scope_key TEXT NOT NULL,
            status TEXT NOT NULL,
            due_at INTEGER,
            created_at INTEGER NOT NULL
          );
          CREATE TABLE admin_mission_permissions (
            mission_id TEXT NOT NULL,
            permission TEXT NOT NULL
          );
        """)
        self.db.executescript((MIGRATIONS / "0023_support_mission_permissions.sql").read_text())

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

    def test_support_account_without_mission_cannot_write_support_message(self):
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


    def test_active_support_mission_with_process_permission_can_reply(self):
        self.db.execute("""
          INSERT INTO support_tickets
          (id, public_reference, requester_account_id, category, subject, description, created_at, updated_at)
          VALUES ('ticket-delegate', 'SAC-DELEGATE-0001', 'requester', 'general_question', 'Question', 'Need help please', 10, 10)
        """)
        self.db.execute("""
          INSERT INTO admin_missions (id, assigned_account_id, scope_key, status, due_at, created_at)
          VALUES ('mission-support', 'support', 'support', 'active', 500, 10)
        """)
        self.db.execute("""
          INSERT INTO admin_mission_permissions (mission_id, permission)
          VALUES ('mission-support', 'read'), ('mission-support', 'process')
        """)
        self.db.execute("""
          INSERT INTO support_messages (id, ticket_id, author_account_id, author_kind, body, created_at)
          VALUES ('message-delegate', 'ticket-delegate', 'support', 'support', 'We are reviewing your request', 100)
        """)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM support_messages WHERE id='message-delegate'").fetchone()[0], 1)

    def test_support_mission_wrong_scope_or_expired_cannot_reply(self):
        self.db.execute("""
          INSERT INTO support_tickets
          (id, public_reference, requester_account_id, category, subject, description, created_at, updated_at)
          VALUES ('ticket-delegate', 'SAC-DELEGATE-0002', 'requester', 'general_question', 'Question', 'Need help please', 10, 10)
        """)
        self.db.execute("""
          INSERT INTO admin_missions (id, assigned_account_id, scope_key, status, due_at, created_at)
          VALUES ('mission-wrong-scope', 'support', 'finance', 'active', 500, 10),
                 ('mission-expired', 'support', 'support', 'active', 50, 10)
        """)
        self.db.execute("""
          INSERT INTO admin_mission_permissions (mission_id, permission)
          VALUES ('mission-wrong-scope', 'read'), ('mission-wrong-scope', 'process'), ('mission-expired', 'read'), ('mission-expired', 'process')
        """)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""
              INSERT INTO support_messages (id, ticket_id, author_account_id, author_kind, body, created_at)
              VALUES ('message-wrong-scope', 'ticket-delegate', 'support', 'support', 'Reply', 100)
            """)

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
