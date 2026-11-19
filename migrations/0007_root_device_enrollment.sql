-- SAC — enrôlement de la credential racine et sessions liées à l'appareil.
-- Horodatages en millisecondes Unix UTC. Cette migration n'est pas appliquée à distance.

PRAGMA foreign_keys = ON;

CREATE TABLE root_enrollment_rate_limits (
  email_hash TEXT PRIMARY KEY NOT NULL CHECK (length(email_hash) = 64 AND email_hash NOT GLOB '*[^a-f0-9]*'),
  window_started_at INTEGER NOT NULL CHECK (window_started_at > 0),
  attempt_count INTEGER NOT NULL CHECK (attempt_count BETWEEN 1 AND 1000000),
  updated_at INTEGER NOT NULL CHECK (updated_at >= window_started_at)
);

CREATE TABLE root_enrollment_ceremonies (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (length(origin) BETWEEN 9 AND 255),
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'expired', 'cancelled')),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  completed_at INTEGER,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  UNIQUE (id, account_id),
  CHECK (completed_at IS NULL OR completed_at >= created_at),
  CHECK ((status = 'completed' AND completed_at IS NOT NULL) OR (status <> 'completed' AND completed_at IS NULL))
);

CREATE UNIQUE INDEX root_enrollment_one_pending_per_account
  ON root_enrollment_ceremonies(account_id) WHERE status = 'pending';
CREATE INDEX root_enrollment_ceremonies_expiry
  ON root_enrollment_ceremonies(status, expires_at);

CREATE TABLE root_enrollment_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  ceremony_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  challenge_digest TEXT NOT NULL CHECK (length(challenge_digest) = 64 AND challenge_digest NOT GLOB '*[^a-f0-9]*'),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  consumed_at INTEGER,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  FOREIGN KEY (ceremony_id, account_id) REFERENCES root_enrollment_ceremonies(id, account_id) ON DELETE RESTRICT,
  UNIQUE (id, ceremony_id, account_id),
  CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);
CREATE UNIQUE INDEX root_enrollment_one_challenge_per_ceremony ON root_enrollment_challenges(ceremony_id);
CREATE INDEX root_enrollment_challenges_expiry ON root_enrollment_challenges(expires_at, consumed_at);

CREATE TABLE devices (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  auth_version INTEGER NOT NULL DEFAULT 1 CHECK (auth_version >= 1),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  revoked_at INTEGER,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  UNIQUE (id, account_id),
  CHECK ((status = 'active' AND revoked_at IS NULL) OR (status = 'revoked' AND revoked_at IS NOT NULL AND revoked_at >= created_at))
);
CREATE UNIQUE INDEX devices_one_root_per_account ON devices(account_id);

CREATE TABLE device_root_credentials (
  id TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key_x TEXT NOT NULL CHECK (length(public_key_x) = 43),
  public_key_y TEXT NOT NULL CHECK (length(public_key_y) = 43),
  sign_count INTEGER NOT NULL DEFAULT 0 CHECK (sign_count >= 0),
  credential_device_type TEXT NOT NULL CHECK (credential_device_type = 'singleDevice'),
  credential_backed_up INTEGER NOT NULL CHECK (credential_backed_up = 0),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  last_used_at INTEGER,
  FOREIGN KEY (device_id, account_id) REFERENCES devices(id, account_id) ON DELETE RESTRICT,
  UNIQUE (device_id),
  CHECK (last_used_at IS NULL OR last_used_at >= created_at)
);
CREATE INDEX device_root_credentials_account ON device_root_credentials(account_id);

CREATE TABLE device_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^a-f0-9]*'),
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  auth_version INTEGER NOT NULL CHECK (auth_version >= 1),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  last_activity_at INTEGER NOT NULL CHECK (last_activity_at >= created_at),
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at AND expires_at <= created_at + 7776000000 AND expires_at <= last_activity_at + 2592000000),
  revoked_at INTEGER,
  FOREIGN KEY (device_id, account_id) REFERENCES devices(id, account_id) ON DELETE RESTRICT,
  CHECK ((status = 'active' AND revoked_at IS NULL) OR (status = 'revoked' AND revoked_at IS NOT NULL AND revoked_at >= last_activity_at))
);
CREATE INDEX device_sessions_account ON device_sessions(account_id, status);
CREATE INDEX device_sessions_device ON device_sessions(device_id, status);
CREATE INDEX device_sessions_expiry ON device_sessions(expires_at, status);

CREATE TABLE device_enrollment_events (
  id TEXT PRIMARY KEY NOT NULL,
  ceremony_id TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type = 'root_device_enrolled'),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  FOREIGN KEY (ceremony_id, account_id) REFERENCES root_enrollment_ceremonies(id, account_id) ON DELETE RESTRICT,
  FOREIGN KEY (device_id, account_id) REFERENCES devices(id, account_id) ON DELETE RESTRICT,
  FOREIGN KEY (session_id) REFERENCES device_sessions(id) ON DELETE RESTRICT
);

CREATE TRIGGER root_enrollment_account_guard
BEFORE INSERT ON root_enrollment_ceremonies
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM accounts a
    JOIN account_identities i ON i.account_id = a.id
    WHERE a.id = NEW.account_id AND a.status = 'active'
      AND i.channel = 'email' AND i.is_primary = 1 AND i.verified_at IS NOT NULL
  ) THEN RAISE(ABORT, 'root_enrollment_account_not_verified') END;
  SELECT CASE WHEN EXISTS (SELECT 1 FROM devices d WHERE d.account_id = NEW.account_id)
    THEN RAISE(ABORT, 'root_device_already_enrolled') END;
END;

CREATE TRIGGER root_enrollment_challenge_insert_guard
BEFORE INSERT ON root_enrollment_challenges
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM root_enrollment_ceremonies c
    WHERE c.id = NEW.ceremony_id AND c.account_id = NEW.account_id
      AND c.status = 'pending' AND c.expires_at > NEW.created_at
  ) THEN RAISE(ABORT, 'root_enrollment_ceremony_unavailable') END;
END;

CREATE TRIGGER root_enrollment_challenge_update_guard
BEFORE UPDATE ON root_enrollment_challenges
BEGIN
  SELECT CASE WHEN NEW.id <> OLD.id OR NEW.ceremony_id <> OLD.ceremony_id
    OR NEW.account_id <> OLD.account_id OR NEW.challenge_digest <> OLD.challenge_digest
    OR NEW.created_at <> OLD.created_at OR NEW.expires_at <> OLD.expires_at
    THEN RAISE(ABORT, 'root_enrollment_challenge_immutable') END;
  SELECT CASE WHEN NOT (
    OLD.consumed_at IS NULL
    AND NEW.attempt_count = OLD.attempt_count + 1
    AND NEW.attempt_count <= 5
    AND (
      NEW.consumed_at IS NULL
      OR (NEW.consumed_at >= OLD.created_at AND NEW.consumed_at < OLD.expires_at)
    )
  ) THEN RAISE(ABORT, 'root_enrollment_challenge_transition_invalid') END;
END;

CREATE TRIGGER root_enrollment_ceremony_update_guard
BEFORE UPDATE ON root_enrollment_ceremonies
BEGIN
  SELECT CASE WHEN NEW.id <> OLD.id OR NEW.account_id <> OLD.account_id
    OR NEW.origin <> OLD.origin OR NEW.created_at <> OLD.created_at OR NEW.expires_at <> OLD.expires_at
    THEN RAISE(ABORT, 'root_enrollment_ceremony_immutable') END;
  SELECT CASE WHEN NOT (
    OLD.status = 'pending' AND NEW.status = 'completed'
    AND OLD.completed_at IS NULL AND NEW.completed_at >= OLD.created_at
    AND EXISTS (
      SELECT 1 FROM root_enrollment_challenges ch
      WHERE ch.ceremony_id = OLD.id AND ch.account_id = OLD.account_id
        AND ch.consumed_at = NEW.completed_at
    )
  ) AND NOT (
    OLD.status = 'pending' AND NEW.status = 'expired'
    AND OLD.completed_at IS NULL AND NEW.completed_at IS NULL
    AND (
      OLD.expires_at <= CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
      OR EXISTS (
        SELECT 1 FROM root_enrollment_challenges ch
        WHERE ch.ceremony_id = OLD.id AND ch.account_id = OLD.account_id
          AND ch.attempt_count >= 5
      )
    )
  ) AND NOT (
    OLD.status = 'pending' AND NEW.status = 'cancelled'
    AND OLD.completed_at IS NULL AND NEW.completed_at IS NULL
    AND EXISTS (
      SELECT 1 FROM root_enrollment_challenges ch
      WHERE ch.ceremony_id = OLD.id AND ch.account_id = OLD.account_id
        AND ch.consumed_at IS NULL
    )
  ) THEN RAISE(ABORT, 'root_enrollment_ceremony_transition_invalid') END;
END;

CREATE TRIGGER device_enrollment_event_guard
BEFORE INSERT ON device_enrollment_events
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM root_enrollment_ceremonies c
    JOIN root_enrollment_challenges ch ON ch.ceremony_id = c.id
    JOIN devices d ON d.account_id = c.account_id
    JOIN device_root_credentials rc ON rc.device_id = d.id
    JOIN device_sessions s ON s.device_id = d.id AND s.account_id = d.account_id
    WHERE c.id = NEW.ceremony_id AND c.account_id = NEW.account_id
      AND c.status = 'completed' AND c.completed_at = NEW.created_at
      AND ch.consumed_at = NEW.created_at
      AND d.id = NEW.device_id AND s.id = NEW.session_id
      AND s.status = 'active'
  ) THEN RAISE(ABORT, 'device_enrollment_event_incomplete') END;
END;

CREATE TRIGGER device_root_credential_update_guard
BEFORE UPDATE ON device_root_credentials
BEGIN
  SELECT CASE WHEN NEW.id <> OLD.id OR NEW.device_id <> OLD.device_id
    OR NEW.account_id <> OLD.account_id OR NEW.credential_id <> OLD.credential_id
    OR NEW.public_key_x <> OLD.public_key_x OR NEW.public_key_y <> OLD.public_key_y
    OR NEW.credential_device_type <> OLD.credential_device_type
    OR NEW.credential_backed_up <> OLD.credential_backed_up
    OR NEW.created_at <> OLD.created_at
    THEN RAISE(ABORT, 'root_credential_immutable_fields') END;
  SELECT CASE WHEN NEW.sign_count < OLD.sign_count
    OR (OLD.last_used_at IS NOT NULL AND (NEW.last_used_at IS NULL OR NEW.last_used_at < OLD.last_used_at))
    THEN RAISE(ABORT, 'root_credential_counter_rollback') END;
END;

CREATE TRIGGER device_update_guard
BEFORE UPDATE ON devices
BEGIN
  SELECT CASE WHEN NEW.id <> OLD.id OR NEW.account_id <> OLD.account_id
    OR NEW.created_at <> OLD.created_at
    THEN RAISE(ABORT, 'device_immutable_fields') END;
  SELECT CASE WHEN NOT (
    OLD.status = 'active' AND NEW.status = 'revoked'
    AND NEW.auth_version = OLD.auth_version + 1
    AND NEW.revoked_at IS NOT NULL AND NEW.revoked_at >= OLD.created_at
  ) THEN RAISE(ABORT, 'device_transition_invalid') END;
END;

CREATE TRIGGER device_session_update_guard
BEFORE UPDATE ON device_sessions
BEGIN
  SELECT CASE WHEN NEW.id <> OLD.id OR NEW.account_id <> OLD.account_id
    OR NEW.device_id <> OLD.device_id OR NEW.token_hash <> OLD.token_hash
    OR NEW.auth_version <> OLD.auth_version OR NEW.created_at <> OLD.created_at
    THEN RAISE(ABORT, 'device_session_immutable_fields') END;
  SELECT CASE WHEN NOT (
    OLD.status = 'active' AND NEW.status = 'active'
    AND OLD.revoked_at IS NULL AND NEW.revoked_at IS NULL
    AND NEW.last_activity_at >= OLD.last_activity_at
    AND NEW.expires_at >= OLD.expires_at
  ) AND NOT (
    OLD.status = 'active' AND NEW.status = 'revoked'
    AND OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL
    AND NEW.last_activity_at = OLD.last_activity_at
    AND NEW.expires_at = OLD.expires_at
    AND NEW.revoked_at >= OLD.last_activity_at
  ) THEN RAISE(ABORT, 'device_session_transition_invalid') END;
END;

CREATE TRIGGER device_enrollment_event_immutable_update
BEFORE UPDATE ON device_enrollment_events
BEGIN
  SELECT RAISE(ABORT, 'device_enrollment_event_immutable');
END;
CREATE TRIGGER device_enrollment_event_immutable_delete
BEFORE DELETE ON device_enrollment_events
BEGIN
  SELECT RAISE(ABORT, 'device_enrollment_event_immutable');
END;
