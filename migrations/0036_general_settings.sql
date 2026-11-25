CREATE TABLE system_settings (
 setting_key TEXT PRIMARY KEY, value_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
 updated_by TEXT NOT NULL REFERENCES accounts(id), updated_at INTEGER NOT NULL
);
CREATE TABLE setting_change_events (
 id TEXT PRIMARY KEY, setting_key TEXT NOT NULL, previous_value_json TEXT, new_value_json TEXT NOT NULL,
 version INTEGER NOT NULL, justification TEXT NOT NULL DEFAULT '', actor_account_id TEXT NOT NULL REFERENCES accounts(id), occurred_at INTEGER NOT NULL
);
CREATE INDEX setting_change_events_timeline ON setting_change_events(setting_key, occurred_at DESC);
