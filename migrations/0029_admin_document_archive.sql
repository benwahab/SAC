-- SAC document register: versioned text documents and immutable archive metadata.
PRAGMA foreign_keys = ON;

CREATE TABLE admin_documents (
  id TEXT PRIMARY KEY,
  public_reference TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','validated','archived')),
  current_version INTEGER NOT NULL DEFAULT 1 CHECK (current_version >= 1),
  created_by TEXT NOT NULL REFERENCES accounts(id),
  updated_by TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived_at INTEGER
);

CREATE TABLE admin_document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES admin_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  content TEXT NOT NULL,
  author_account_id TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  UNIQUE(document_id, version_number)
);

CREATE INDEX admin_documents_updated ON admin_documents(updated_at DESC, id);
CREATE INDEX admin_documents_category_status ON admin_documents(category, status);
CREATE INDEX admin_document_versions_document ON admin_document_versions(document_id, version_number DESC);
