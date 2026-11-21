-- SAC — missions administratives à délégation unique et journal append-only.
-- Toutes les autorisations sont vérifiées côté serveur à chaque requête.

PRAGMA foreign_keys = ON;

CREATE TABLE admin_missions (
  id TEXT PRIMARY KEY NOT NULL,
  assigned_account_id TEXT NOT NULL,
  created_by_account_id TEXT NOT NULL,
  scope_key TEXT NOT NULL CHECK (length(trim(scope_key)) BETWEEN 1 AND 200),
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'revoked')),
  due_at INTEGER,
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  FOREIGN KEY (assigned_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CHECK (due_at IS NULL OR due_at > created_at)
);

CREATE INDEX admin_missions_assignee_status
  ON admin_missions(assigned_account_id, status, due_at);

CREATE TABLE admin_mission_permissions (
  mission_id TEXT NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN (
    'read', 'create', 'update', 'process', 'export', 'delete'
  )),
  granted_at INTEGER NOT NULL CHECK (granted_at > 0),
  PRIMARY KEY (mission_id, permission),
  FOREIGN KEY (mission_id) REFERENCES admin_missions(id) ON DELETE RESTRICT
);

CREATE TABLE admin_audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  actor_account_id TEXT NOT NULL,
  actor_device_id TEXT NOT NULL,
  mission_id TEXT,
  action TEXT NOT NULL CHECK (length(action) BETWEEN 1 AND 80),
  scope_key TEXT,
  permission_used TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'denied', 'failure')),
  occurred_at INTEGER NOT NULL CHECK (occurred_at > 0),
  FOREIGN KEY (actor_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (mission_id) REFERENCES admin_missions(id) ON DELETE RESTRICT
);

CREATE INDEX admin_audit_events_time
  ON admin_audit_events(occurred_at DESC, id DESC);
CREATE INDEX admin_audit_events_actor
  ON admin_audit_events(actor_account_id, occurred_at DESC);

CREATE TRIGGER admin_audit_events_no_update
BEFORE UPDATE ON admin_audit_events
BEGIN
  SELECT RAISE(ABORT, 'admin_audit_events_are_append_only');
END;

CREATE TRIGGER admin_audit_events_no_delete
BEFORE DELETE ON admin_audit_events
BEGIN
  SELECT RAISE(ABORT, 'admin_audit_events_are_append_only');
END;

CREATE TRIGGER admin_mission_permissions_no_update
BEFORE UPDATE ON admin_mission_permissions
BEGIN
  SELECT RAISE(ABORT, 'replace_permissions_with_delete_and_insert');
END;
