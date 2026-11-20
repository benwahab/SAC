-- SAC — registre Web Push par appareil et contrôle de rétention technique.
-- Horodatages Unix UTC en millisecondes. Migration additive ; ne supprime aucune donnée existante.
-- Cette migration n'est pas une autorisation d'application sur la D1 distante.

CREATE TABLE notification_device_deliveries (
  id TEXT PRIMARY KEY NOT NULL,
  outbox_id TEXT NOT NULL,
  alert_id TEXT NOT NULL,
  recipient_account_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'processing', 'retry_wait', 'accepted',
      'permanent_failure', 'unknown_exhausted', 'cancelled'
    )),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 2),
  next_attempt_at INTEGER,
  lease_until INTEGER,
  lease_token TEXT,
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  cycle_terminal_at INTEGER,
  retention_expires_at INTEGER,
  error_code TEXT CHECK (error_code IS NULL OR error_code IN (
    'network_ambiguous', 'temporary_provider_failure',
    'invalid_subscription', 'provider_rejected',
    'configuration_error', 'lease_expired', 'cancelled'
  )),
  FOREIGN KEY (outbox_id) REFERENCES alert_reminder_outbox(id) ON DELETE RESTRICT,
  UNIQUE (outbox_id, subscription_id),
  CHECK (
    (status = 'processing' AND attempt_count BETWEEN 1 AND 2
      AND lease_until IS NOT NULL
      AND lease_token IS NOT NULL AND length(lease_token) >= 16)
    OR
    (status <> 'processing' AND lease_until IS NULL AND lease_token IS NULL)
  ),
  CHECK (status <> 'retry_wait' OR next_attempt_at IS NOT NULL),
  CHECK (
    (cycle_terminal_at IS NULL AND retention_expires_at IS NULL)
    OR
    (cycle_terminal_at IS NOT NULL AND retention_expires_at IS NOT NULL
      AND cycle_terminal_at >= created_at
      AND retention_expires_at = cycle_terminal_at + 2592000000)
  ),
  CHECK (
    status NOT IN ('accepted', 'permanent_failure', 'unknown_exhausted', 'cancelled')
    OR (cycle_terminal_at IS NULL OR retention_expires_at IS NOT NULL)
  )
);

CREATE INDEX notification_device_deliveries_outbox_state
  ON notification_device_deliveries(outbox_id, status);

CREATE INDEX notification_device_deliveries_retention_due
  ON notification_device_deliveries(retention_expires_at, status, id)
  WHERE retention_expires_at IS NOT NULL
    AND status IN ('accepted', 'permanent_failure', 'unknown_exhausted', 'cancelled');

CREATE TABLE notification_delivery_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  delivery_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL CHECK (attempt_number IN (1, 2)),
  reserved_at INTEGER NOT NULL CHECK (reserved_at > 0),
  started_at INTEGER,
  finished_at INTEGER,
  result TEXT NOT NULL
    CHECK (result IN ('processing', 'accepted', 'retry_wait',
      'permanent_failure', 'unknown', 'cancelled')),
  http_status INTEGER CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599),
  error_code TEXT CHECK (error_code IS NULL OR error_code IN (
    'network_ambiguous', 'temporary_provider_failure',
    'invalid_subscription', 'provider_rejected',
    'configuration_error', 'lease_expired', 'cancelled'
  )),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  FOREIGN KEY (delivery_id) REFERENCES notification_device_deliveries(id) ON DELETE RESTRICT,
  UNIQUE (delivery_id, attempt_number),
  CHECK (started_at IS NULL OR started_at >= reserved_at),
  CHECK (finished_at IS NULL OR (started_at IS NOT NULL AND finished_at >= started_at)),
  CHECK ((result = 'processing' AND finished_at IS NULL)
      OR (result <> 'processing' AND finished_at IS NOT NULL))
);

CREATE INDEX notification_delivery_attempts_delivery
  ON notification_delivery_attempts(delivery_id, attempt_number);

-- Singleton de contrôle : uniquement des compteurs et horodatages agrégés.
CREATE TABLE notification_retention_control (
  singleton_id INTEGER PRIMARY KEY NOT NULL CHECK (singleton_id = 1),
  lease_until INTEGER,
  lease_token TEXT,
  last_started_at INTEGER,
  last_success_at INTEGER,
  deleted_deliveries_last_run INTEGER NOT NULL DEFAULT 0
    CHECK (deleted_deliveries_last_run >= 0),
  deleted_attempts_last_run INTEGER NOT NULL DEFAULT 0
    CHECK (deleted_attempts_last_run >= 0),
  overdue_rows INTEGER NOT NULL DEFAULT 0 CHECK (overdue_rows >= 0),
  oldest_overdue_at INTEGER,
  consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  last_error_code TEXT CHECK (last_error_code IS NULL OR last_error_code IN (
    'database_error', 'lease_conflict', 'integrity_mismatch', 'unknown_error'
  )),
  CHECK ((lease_until IS NULL AND lease_token IS NULL)
      OR (lease_until IS NOT NULL AND lease_token IS NOT NULL AND length(lease_token) >= 16))
);

INSERT INTO notification_retention_control (singleton_id) VALUES (1);

CREATE TRIGGER notification_delivery_outbox_guard
BEFORE INSERT ON notification_device_deliveries
WHEN NOT EXISTS (
  SELECT 1 FROM alert_reminder_outbox o
  WHERE o.id = NEW.outbox_id
    AND o.alert_id = NEW.alert_id
    AND o.recipient_account_id = NEW.recipient_account_id
    AND o.status IN ('pending', 'processing')
)
BEGIN
  SELECT RAISE(ABORT, 'notification_delivery_outbox_scope_mismatch');
END;

CREATE TRIGGER notification_delivery_retention_insert_guard
BEFORE INSERT ON notification_device_deliveries
WHEN NEW.cycle_terminal_at IS NOT NULL
BEGIN
  SELECT CASE WHEN NEW.status NOT IN ('accepted', 'permanent_failure', 'unknown_exhausted', 'cancelled')
    THEN RAISE(ABORT, 'notification_retention_requires_terminal_delivery') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM alert_reminder_outbox o
    WHERE o.id = NEW.outbox_id
      AND o.alert_id = NEW.alert_id
      AND o.recipient_account_id = NEW.recipient_account_id
      AND o.status IN ('sent', 'failed')
      AND o.processed_at = NEW.cycle_terminal_at
  ) THEN RAISE(ABORT, 'notification_retention_requires_aggregated_outbox') END;
END;

CREATE TRIGGER notification_delivery_retention_start_guard
BEFORE UPDATE OF cycle_terminal_at, retention_expires_at ON notification_device_deliveries
WHEN NEW.cycle_terminal_at IS NOT NULL
BEGIN
  SELECT CASE WHEN NEW.status NOT IN ('accepted', 'permanent_failure', 'unknown_exhausted', 'cancelled')
    THEN RAISE(ABORT, 'notification_retention_requires_terminal_delivery') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM alert_reminder_outbox o
    WHERE o.id = NEW.outbox_id
      AND o.alert_id = NEW.alert_id
      AND o.recipient_account_id = NEW.recipient_account_id
      AND o.status IN ('sent', 'failed')
      AND o.processed_at = NEW.cycle_terminal_at
  ) THEN RAISE(ABORT, 'notification_retention_requires_aggregated_outbox') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM notification_device_deliveries other
    WHERE other.outbox_id = NEW.outbox_id
      AND other.id <> NEW.id
      AND other.status NOT IN ('accepted', 'permanent_failure', 'unknown_exhausted', 'cancelled')
  ) THEN RAISE(ABORT, 'notification_retention_waits_for_all_devices') END;
END;

CREATE TRIGGER notification_delivery_attempt_limit_guard
BEFORE INSERT ON notification_delivery_attempts
BEGIN
  SELECT CASE WHEN NEW.attempt_number > (
    SELECT attempt_count FROM notification_device_deliveries WHERE id = NEW.delivery_id
  ) THEN RAISE(ABORT, 'notification_attempt_not_reserved') END;
  SELECT CASE WHEN NEW.attempt_number <> (
    SELECT COUNT(*) FROM notification_delivery_attempts WHERE delivery_id = NEW.delivery_id
  ) + 1 THEN RAISE(ABORT, 'notification_attempt_sequence_invalid') END;
END;

CREATE TRIGGER notification_delivery_identity_guard
BEFORE UPDATE ON notification_device_deliveries
BEGIN
  SELECT CASE WHEN
    NEW.id <> OLD.id OR NEW.outbox_id <> OLD.outbox_id
    OR NEW.alert_id <> OLD.alert_id
    OR NEW.recipient_account_id <> OLD.recipient_account_id
    OR NEW.device_id <> OLD.device_id
    OR NEW.subscription_id <> OLD.subscription_id
    OR NEW.created_at <> OLD.created_at
  THEN RAISE(ABORT, 'notification_delivery_identity_immutable') END;
  SELECT CASE WHEN NEW.attempt_count < OLD.attempt_count OR NEW.attempt_count > 2
    THEN RAISE(ABORT, 'notification_attempt_count_invalid') END;
  SELECT CASE WHEN OLD.status IN ('accepted', 'permanent_failure', 'unknown_exhausted', 'cancelled')
    AND NEW.status <> OLD.status
    THEN RAISE(ABORT, 'notification_delivery_terminal_state') END;
  SELECT CASE WHEN OLD.cycle_terminal_at IS NOT NULL
    AND (NEW.cycle_terminal_at IS NOT OLD.cycle_terminal_at
      OR NEW.retention_expires_at IS NOT OLD.retention_expires_at)
    THEN RAISE(ABORT, 'notification_retention_timestamp_immutable') END;
END;

CREATE TRIGGER notification_delivery_attempt_immutable
BEFORE UPDATE ON notification_delivery_attempts
BEGIN
  SELECT CASE WHEN
    NEW.id <> OLD.id OR NEW.delivery_id <> OLD.delivery_id
    OR NEW.attempt_number <> OLD.attempt_number
    OR NEW.reserved_at <> OLD.reserved_at
    THEN RAISE(ABORT, 'notification_attempt_identity_immutable') END;
  SELECT CASE WHEN OLD.result <> 'processing'
    THEN RAISE(ABORT, 'notification_attempt_result_terminal') END;
END;

CREATE TRIGGER notification_delivery_attempt_no_delete
BEFORE DELETE ON notification_delivery_attempts
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM notification_device_deliveries d
    WHERE d.id = OLD.delivery_id
      AND (d.retention_expires_at IS NULL OR d.retention_expires_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000)
  ) THEN RAISE(ABORT, 'notification_attempt_retention_not_expired') END;
END;

CREATE TRIGGER notification_delivery_no_delete
BEFORE DELETE ON notification_device_deliveries
BEGIN
  SELECT CASE WHEN OLD.retention_expires_at IS NULL
    OR OLD.retention_expires_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000
    THEN RAISE(ABORT, 'notification_delivery_retention_not_expired') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM notification_delivery_attempts a WHERE a.delivery_id = OLD.id
  ) THEN RAISE(ABORT, 'notification_delivery_attempts_remain') END;
END;
