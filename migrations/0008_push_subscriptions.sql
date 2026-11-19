-- Push endpoints and subscription keys are encrypted before they enter D1.
-- The encryption key is supplied only as a Cloudflare secret; no secret is stored here.
CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  endpoint_hash TEXT NOT NULL UNIQUE
    CHECK (length(endpoint_hash) = 64 AND endpoint_hash NOT GLOB '*[^a-f0-9]*'),
  encrypted_subscription TEXT NOT NULL CHECK (length(encrypted_subscription) BETWEEN 32 AND 8192),
  encryption_key_version TEXT NOT NULL DEFAULT 'v1' CHECK (encryption_key_version = 'v1'),
  iv TEXT NOT NULL CHECK (length(iv) = 16),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  revoked_at INTEGER,
  FOREIGN KEY (device_id, account_id) REFERENCES devices(id, account_id) ON DELETE RESTRICT,
  CHECK ((status = 'active' AND revoked_at IS NULL) OR
         (status = 'revoked' AND revoked_at IS NOT NULL AND revoked_at >= updated_at))
);

CREATE INDEX push_subscriptions_account_device
  ON push_subscriptions(account_id, device_id, status);

CREATE UNIQUE INDEX push_subscriptions_one_active_per_device
  ON push_subscriptions(device_id) WHERE status = 'active';

CREATE TRIGGER push_subscription_update_guard
BEFORE UPDATE ON push_subscriptions
BEGIN
  SELECT CASE WHEN NEW.id <> OLD.id
    OR NEW.account_id <> OLD.account_id
    OR NEW.device_id <> OLD.device_id
    OR NEW.endpoint_hash <> OLD.endpoint_hash
    OR NEW.created_at <> OLD.created_at
    THEN RAISE(ABORT, 'push_subscription_identity_immutable') END;
  SELECT CASE WHEN OLD.status = 'revoked'
    THEN RAISE(ABORT, 'push_subscription_revoked') END;
  SELECT CASE WHEN NEW.status = 'revoked'
    AND (NEW.revoked_at IS NULL OR NEW.revoked_at < OLD.updated_at)
    THEN RAISE(ABORT, 'push_subscription_revocation_invalid') END;
END;

-- Device revocation immediately removes the encrypted endpoint and key material.
CREATE TRIGGER device_revoke_push_subscriptions
AFTER UPDATE OF status ON devices
WHEN OLD.status = 'active' AND NEW.status = 'revoked'
BEGIN
  DELETE FROM push_subscriptions WHERE device_id = NEW.id AND account_id = NEW.account_id;
END;
