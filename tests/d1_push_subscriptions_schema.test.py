import sqlite3
import unittest
from pathlib import Path


class PushSubscriptionSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys = ON")
        self.db.executescript("""
            CREATE TABLE devices (
                id TEXT NOT NULL,
                account_id TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                revoked_at INTEGER,
                UNIQUE (id, account_id)
            );
        """)
        migration = Path("migrations/0008_push_subscriptions.sql").read_text()
        self.db.executescript(migration)
        self.db.execute(
            "INSERT INTO devices (id, account_id, status, created_at) VALUES (?, ?, 'active', 100)",
            ("device-1", "account-1"),
        )

    def tearDown(self):
        self.db.close()

    def insert_subscription(self):
        self.db.execute("""
            INSERT INTO push_subscriptions
              (id, account_id, device_id, endpoint_hash, encrypted_subscription, iv, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "subscription-1", "account-1", "device-1", "a" * 64,
            "encrypted-payload-" + "x" * 32, "b" * 16, 200, 200,
        ))

    def test_encrypted_subscription_is_bound_to_account_and_device(self):
        self.insert_subscription()
        row = self.db.execute(
            "SELECT account_id, device_id, status, encryption_key_version FROM push_subscriptions"
        ).fetchone()
        self.assertEqual(row, ("account-1", "device-1", "active", "v1"))

    def test_endpoint_fingerprint_is_globally_unique(self):
        self.insert_subscription()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""
                INSERT INTO push_subscriptions
                  (id, account_id, device_id, endpoint_hash, encrypted_subscription, iv, created_at, updated_at)
                VALUES ('subscription-2', 'account-1', 'device-1', ?, ?, ?, 201, 201)
            """, ("a" * 64, "encrypted-payload-" + "y" * 32, "c" * 16))

    def test_subscription_identity_cannot_be_reassigned(self):
        self.insert_subscription()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "UPDATE push_subscriptions SET device_id = 'other-device' WHERE id = 'subscription-1'"
            )

    def test_device_has_at_most_one_active_push_endpoint(self):
        self.insert_subscription()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""
                INSERT INTO push_subscriptions
                  (id, account_id, device_id, endpoint_hash, encrypted_subscription, iv, created_at, updated_at)
                VALUES ('subscription-2', 'account-1', 'device-1', ?, ?, ?, 201, 201)
            """, ("c" * 64, "encrypted-payload-" + "z" * 32, "d" * 16))

    def test_device_revocation_deletes_endpoint_and_encrypted_keys(self):
        self.insert_subscription()
        self.db.execute(
            "UPDATE devices SET status = 'revoked', revoked_at = 300 WHERE id = 'device-1'"
        )
        count = self.db.execute("SELECT COUNT(*) FROM push_subscriptions").fetchone()[0]
        self.assertEqual(count, 0)


if __name__ == "__main__":
    unittest.main()
