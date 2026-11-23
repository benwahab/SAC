-- SAC secondary-device enrollment atomicity fixture ONLY.
-- This schema is isolated under tests/ and is never a production migration.
PRAGMA foreign_keys = ON;

CREATE TABLE test_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL CHECK (status = 'active')
);

CREATE TABLE test_devices (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('root', 'secondary')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'revoked')),
  auth_version INTEGER NOT NULL DEFAULT 1 CHECK (auth_version >= 1),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  activated_at INTEGER,
  revoked_at INTEGER,
  FOREIGN KEY (account_id) REFERENCES test_accounts(id) ON DELETE RESTRICT,
  UNIQUE (id, account_id),
  CHECK (
    (status = 'pending' AND activated_at IS NULL AND revoked_at IS NULL)
    OR (status = 'active' AND activated_at IS NOT NULL AND revoked_at IS NULL)
    OR (status = 'revoked' AND revoked_at IS NOT NULL AND revoked_at >= created_at)
  )
);

CREATE UNIQUE INDEX test_one_root_device_per_account
  ON test_devices(account_id) WHERE role = 'root';
CREATE UNIQUE INDEX test_one_active_root_device_per_account
  ON test_devices(account_id) WHERE role = 'root' AND status = 'active';
CREATE INDEX test_secondary_devices_account
  ON test_devices(account_id, role, status);

CREATE TABLE test_enrollment_ceremonies (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  root_device_id TEXT NOT NULL,
  new_device_id TEXT NOT NULL,
  transcript_hash TEXT NOT NULL
    CHECK (length(transcript_hash) = 64 AND transcript_hash NOT GLOB '*[^a-f0-9]*'),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  approved_at INTEGER,
  FOREIGN KEY (account_id) REFERENCES test_accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (root_device_id, account_id) REFERENCES test_devices(id, account_id) ON DELETE RESTRICT,
  FOREIGN KEY (new_device_id, account_id) REFERENCES test_devices(id, account_id) ON DELETE RESTRICT,
  UNIQUE (id, account_id),
  UNIQUE (new_device_id),
  CHECK (root_device_id <> new_device_id),
  CHECK (
    (status = 'approved' AND approved_at IS NOT NULL AND approved_at >= created_at)
    OR (status <> 'approved' AND approved_at IS NULL)
  )
);

CREATE UNIQUE INDEX test_one_pending_enrollment_per_account
  ON test_enrollment_ceremonies(account_id) WHERE status = 'pending';
CREATE INDEX test_enrollment_ceremonies_expiry
  ON test_enrollment_ceremonies(status, expires_at);

CREATE TABLE test_enrollment_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  ceremony_id TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL,
  challenge_digest TEXT NOT NULL
    CHECK (length(challenge_digest) = 64 AND challenge_digest NOT GLOB '*[^a-f0-9]*'),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  consumed_at INTEGER,
  FOREIGN KEY (ceremony_id, account_id) REFERENCES test_enrollment_ceremonies(id, account_id) ON DELETE RESTRICT,
  CHECK (consumed_at IS NULL OR (consumed_at >= created_at AND consumed_at < expires_at))
);

CREATE TABLE test_device_certificates (
  id TEXT PRIMARY KEY NOT NULL,
  ceremony_id TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL,
  device_id TEXT NOT NULL UNIQUE,
  root_device_id TEXT NOT NULL,
  transcript_hash TEXT NOT NULL
    CHECK (length(transcript_hash) = 64 AND transcript_hash NOT GLOB '*[^a-f0-9]*'),
  certificate_hash TEXT NOT NULL
    CHECK (length(certificate_hash) = 64 AND certificate_hash NOT GLOB '*[^a-f0-9]*'),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  FOREIGN KEY (ceremony_id, account_id) REFERENCES test_enrollment_ceremonies(id, account_id) ON DELETE RESTRICT,
  FOREIGN KEY (device_id, account_id) REFERENCES test_devices(id, account_id) ON DELETE RESTRICT,
  FOREIGN KEY (root_device_id, account_id) REFERENCES test_devices(id, account_id) ON DELETE RESTRICT
);

CREATE TABLE test_enrollment_idempotency (
  account_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 16 AND 128),
  request_hash TEXT NOT NULL
    CHECK (length(request_hash) = 64 AND request_hash NOT GLOB '*[^a-f0-9]*'),
  response_json TEXT NOT NULL,
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  PRIMARY KEY (account_id, idempotency_key),
  FOREIGN KEY (account_id) REFERENCES test_accounts(id) ON DELETE RESTRICT
);

CREATE TABLE test_enrollment_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  ceremony_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type = 'approved'),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  detail_hash TEXT NOT NULL
    CHECK (length(detail_hash) = 64 AND detail_hash NOT GLOB '*[^a-f0-9]*'),
  UNIQUE (ceremony_id, event_type),
  FOREIGN KEY (ceremony_id, account_id) REFERENCES test_enrollment_ceremonies(id, account_id) ON DELETE RESTRICT
);

CREATE TABLE test_enrollment_commit_guard (
  ceremony_id TEXT PRIMARY KEY NOT NULL,
  accepted_rows INTEGER NOT NULL CHECK (accepted_rows = 1),
  FOREIGN KEY (ceremony_id) REFERENCES test_enrollment_ceremonies(id) ON DELETE RESTRICT
);

CREATE TABLE test_revocation_guard (
  account_id TEXT PRIMARY KEY NOT NULL,
  accepted_rows INTEGER NOT NULL CHECK (accepted_rows = 1),
  FOREIGN KEY (account_id) REFERENCES test_accounts(id) ON DELETE RESTRICT
);

CREATE TRIGGER test_enrollment_ceremony_insert_guard
BEFORE INSERT ON test_enrollment_ceremonies
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM test_accounts a
    JOIN test_devices r ON r.account_id = a.id AND r.role = 'root' AND r.status = 'active'
    JOIN test_devices n ON n.account_id = a.id AND n.role = 'secondary' AND n.status = 'pending'
    WHERE a.id = NEW.account_id AND a.status = 'active'
      AND r.id = NEW.root_device_id
      AND n.id = NEW.new_device_id
  ) THEN RAISE(ABORT, 'test_enrollment_ceremony_unavailable') END;
END;

CREATE TRIGGER test_enrollment_challenge_insert_guard
BEFORE INSERT ON test_enrollment_challenges
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM test_enrollment_ceremonies c
    WHERE c.id = NEW.ceremony_id AND c.account_id = NEW.account_id
      AND c.status = 'pending' AND c.expires_at > NEW.created_at
  ) THEN RAISE(ABORT, 'test_enrollment_challenge_unavailable') END;
END;

CREATE TRIGGER test_enrollment_challenge_update_guard
BEFORE UPDATE ON test_enrollment_challenges
BEGIN
  SELECT CASE WHEN
    NEW.id <> OLD.id
    OR NEW.ceremony_id <> OLD.ceremony_id
    OR NEW.account_id <> OLD.account_id
    OR NEW.challenge_digest <> OLD.challenge_digest
    OR NEW.created_at <> OLD.created_at
    OR NEW.expires_at <> OLD.expires_at
  THEN RAISE(ABORT, 'test_enrollment_challenge_immutable') END;

  SELECT CASE WHEN
    OLD.consumed_at IS NOT NULL
    OR NEW.consumed_at IS NULL
    OR NEW.consumed_at < OLD.created_at
    OR NEW.consumed_at >= OLD.expires_at
  THEN RAISE(ABORT, 'test_enrollment_challenge_one_time_transition_only') END;
END;

CREATE TRIGGER test_device_update_guard
BEFORE UPDATE ON test_devices
BEGIN
  SELECT CASE WHEN
    NEW.id <> OLD.id
    OR NEW.account_id <> OLD.account_id
    OR NEW.role <> OLD.role
    OR NEW.created_at <> OLD.created_at
  THEN RAISE(ABORT, 'test_device_immutable_fields') END;

  SELECT CASE WHEN NOT (
    OLD.role = 'secondary' AND OLD.status = 'pending' AND NEW.status = 'active'
    AND NEW.activated_at IS NOT NULL AND NEW.revoked_at IS NULL
    AND NEW.auth_version = OLD.auth_version + 1
    AND EXISTS (
      SELECT 1
      FROM test_enrollment_ceremonies c
      JOIN test_enrollment_challenges ch
        ON ch.ceremony_id = c.id AND ch.account_id = c.account_id
      JOIN test_devices r
        ON r.id = c.root_device_id AND r.account_id = c.account_id
      WHERE c.account_id = OLD.account_id
        AND c.new_device_id = OLD.id
        AND c.status = 'pending'
        AND ch.consumed_at IS NOT NULL
        AND r.status = 'active'
    )
  ) AND NOT (
    OLD.status = 'active' AND NEW.status = 'revoked'
    AND NEW.revoked_at IS NOT NULL
    AND NEW.auth_version = OLD.auth_version + 1
  ) THEN RAISE(ABORT, 'test_device_transition_invalid') END;
END;

CREATE TRIGGER test_device_certificate_insert_guard
BEFORE INSERT ON test_device_certificates
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM test_enrollment_ceremonies c
    JOIN test_enrollment_challenges ch
      ON ch.ceremony_id = c.id AND ch.account_id = c.account_id
    JOIN test_devices n
      ON n.id = c.new_device_id AND n.account_id = c.account_id
    JOIN test_devices r
      ON r.id = c.root_device_id AND r.account_id = c.account_id
    WHERE c.id = NEW.ceremony_id
      AND c.account_id = NEW.account_id
      AND c.status = 'pending'
      AND c.new_device_id = NEW.device_id
      AND c.root_device_id = NEW.root_device_id
      AND c.transcript_hash = NEW.transcript_hash
      AND ch.consumed_at IS NOT NULL
      AND n.status = 'active'
      AND r.status = 'active'
  ) THEN RAISE(ABORT, 'test_device_certificate_unavailable') END;
END;

CREATE TRIGGER test_enrollment_ceremony_update_guard
BEFORE UPDATE ON test_enrollment_ceremonies
BEGIN
  SELECT CASE WHEN
    NEW.id <> OLD.id
    OR NEW.account_id <> OLD.account_id
    OR NEW.root_device_id <> OLD.root_device_id
    OR NEW.new_device_id <> OLD.new_device_id
    OR NEW.transcript_hash <> OLD.transcript_hash
    OR NEW.created_at <> OLD.created_at
    OR NEW.expires_at <> OLD.expires_at
  THEN RAISE(ABORT, 'test_enrollment_ceremony_immutable') END;

  SELECT CASE WHEN NOT (
    OLD.status = 'pending' AND NEW.status = 'approved'
    AND NEW.approved_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM test_enrollment_challenges ch
      WHERE ch.ceremony_id = OLD.id AND ch.account_id = OLD.account_id
        AND ch.consumed_at IS NOT NULL
    )
    AND EXISTS (
      SELECT 1 FROM test_device_certificates cert
      WHERE cert.ceremony_id = OLD.id AND cert.account_id = OLD.account_id
    )
    AND EXISTS (
      SELECT 1 FROM test_devices n
      WHERE n.id = OLD.new_device_id AND n.account_id = OLD.account_id AND n.status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM test_devices r
      WHERE r.id = OLD.root_device_id AND r.account_id = OLD.account_id AND r.status = 'active'
    )
  ) AND NOT (
    OLD.status = 'pending' AND NEW.status IN ('rejected', 'cancelled', 'expired')
    AND NEW.approved_at IS NULL
  ) THEN RAISE(ABORT, 'test_enrollment_ceremony_transition_invalid') END;
END;

CREATE TRIGGER test_device_certificate_immutable_update
BEFORE UPDATE ON test_device_certificates
BEGIN
  SELECT RAISE(ABORT, 'test_device_certificate_immutable');
END;

CREATE TRIGGER test_device_certificate_immutable_delete
BEFORE DELETE ON test_device_certificates
BEGIN
  SELECT RAISE(ABORT, 'test_device_certificate_immutable');
END;

CREATE TRIGGER test_enrollment_audit_immutable_update
BEFORE UPDATE ON test_enrollment_audit
BEGIN
  SELECT RAISE(ABORT, 'test_enrollment_audit_immutable');
END;

CREATE TRIGGER test_enrollment_audit_immutable_delete
BEFORE DELETE ON test_enrollment_audit
BEGIN
  SELECT RAISE(ABORT, 'test_enrollment_audit_immutable');
END;
