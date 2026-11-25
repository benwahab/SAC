-- Private attachments linked to a specific archived document version.
PRAGMA foreign_keys = ON;
CREATE TABLE admin_document_attachments (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES admin_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  uploaded_by TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  UNIQUE(document_id, version_number, id)
);
CREATE INDEX admin_document_attachments_document ON admin_document_attachments(document_id, version_number, created_at DESC);
