-- SAC — défis d'authentification WebAuthn de l'appareil racine.
-- Aucun secret ni challenge brut n'est persisté. Horodatages Unix ms UTC.

PRAGMA foreign_keys = ON;

CREATE TABLE root_authentication_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (length(origin) BETWEEN 9 AND 255),
  challenge_digest TEXT NOT NULL CHECK (length(challenge_digest) = 64 AND challenge_digest NOT GLOB '*[^a-f0-9]*'),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at AND expires_at <= created_at + 300000),
  consumed_at INTEGER,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  FOREIGN KEY (device_id, account_id) REFERENCES devices(id, account_id) ON DELETE RESTRICT,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);

CREATE INDEX root_authentication_challenges_expiry
  ON root_authentication_challenges(expires_at, consumed_at);

CREATE INDEX root_authentication_challenges_account
  ON root_authentication_challenges(account_id, created_at DESC);

CREATE TRIGGER root_authentication_challenge_insert_guard
BEFORE INSERT ON root_authentication_challenges
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM accounts a
    JOIN devices d ON d.account_id = a.id
    JOIN device_root_credentials c ON c.device_id = d.id AND c.account_id = a.id
    WHERE a.id = NEW.account_id AND a.status = 'active'
      AND d.id = NEW.device_id AND d.status = 'active'
  ) THEN RAISE(ABORT, 'root_authentication_device_unavailable') END;
END;

CREATE TRIGGER root_authentication_challenge_update_guard
BEFORE UPDATE ON root_authentication_challenges
BEGIN
  SELECT CASE WHEN NEW.id <> OLD.id OR NEW.account_id <> OLD.account_id
    OR NEW.device_id <> OLD.device_id OR NEW.origin <> OLD.origin
    OR NEW.challenge_digest <> OLD.challenge_digest
    OR NEW.created_at <> OLD.created_at OR NEW.expires_at <> OLD.expires_at
    THEN RAISE(ABORT, 'root_authentication_challenge_immutable') END;
  SELECT CASE WHEN NOT (
    OLD.consumed_at IS NULL AND NEW.attempt_count = OLD.attempt_count + 1
    AND NEW.attempt_count <= 5
    AND (NEW.consumed_at IS OLD.consumed_at OR
      (NEW.consumed_at IS NOT NULL AND NEW.consumed_at >= OLD.created_at))
  ) THEN RAISE(ABORT, 'root_authentication_challenge_transition_invalid') END;
END;
