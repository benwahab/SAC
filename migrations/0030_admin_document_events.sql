PRAGMA foreign_keys = ON;
CREATE TABLE admin_document_events (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES admin_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  actor_account_id TEXT NOT NULL REFERENCES accounts(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('printed','archived')),
  occurred_at INTEGER NOT NULL
);
CREATE INDEX admin_document_events_history ON admin_document_events(document_id, occurred_at DESC, id);
