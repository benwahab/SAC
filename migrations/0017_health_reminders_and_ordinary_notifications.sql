-- SAC — Rappels ordinaires et notifications non urgentes.
-- Migration additive. Aucune table, aucun trigger et aucune donnée SOS n'est modifié.
-- Les rappels cliniques restent désactivés par un trigger explicite jusqu'au lot SAC Santé.
-- Horodatages en millisecondes Unix UTC.

PRAGMA foreign_keys = ON;

CREATE TABLE account_entitlements (
  account_id TEXT PRIMARY KEY NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium', 'professional')),
  source TEXT NOT NULL DEFAULT 'default' CHECK (source IN ('default', 'manual', 'billing')),
  updated_at INTEGER NOT NULL CHECK (updated_at > 0),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
);

CREATE TABLE health_reminders (
  id TEXT PRIMARY KEY NOT NULL,
  owner_account_id TEXT NOT NULL,
  created_by_account_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('personal', 'family', 'clinic')),
  kind TEXT NOT NULL CHECK (kind IN ('medication', 'appointment', 'activity', 'visit', 'event', 'other')),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  description TEXT CHECK (description IS NULL OR length(description) <= 2000),
  timezone TEXT NOT NULL CHECK (length(trim(timezone)) BETWEEN 1 AND 64),
  recurrence_type TEXT NOT NULL CHECK (recurrence_type IN ('once', 'daily', 'weekly', 'monthly')),
  local_date TEXT CHECK (local_date IS NULL OR (
    length(local_date) = 10
    AND local_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'
  )),
  local_time TEXT NOT NULL CHECK (
    length(local_time) = 5
    AND local_time GLOB '[0-2][0-9]:[0-5][0-9]'
    AND local_time < '24:00'
  ),
  start_date TEXT CHECK (start_date IS NULL OR (
    length(start_date) = 10
    AND start_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'
  )),
  end_date TEXT CHECK (end_date IS NULL OR (
    length(end_date) = 10
    AND end_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'
  )),
  weekdays_json TEXT CHECK (weekdays_json IS NULL OR (
    length(weekdays_json) BETWEEN 2 AND 64
    AND json_valid(weekdays_json)
  )),
  day_of_month INTEGER CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 31),
  medication_name TEXT CHECK (medication_name IS NULL OR length(trim(medication_name)) BETWEEN 1 AND 200),
  medication_dosage TEXT CHECK (medication_dosage IS NULL OR length(trim(medication_dosage)) BETWEEN 1 AND 200),
  medication_instructions TEXT CHECK (medication_instructions IS NULL OR length(medication_instructions) <= 1000),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'completed')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  FOREIGN KEY (owner_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CHECK (
    (recurrence_type = 'once'
      AND local_date IS NOT NULL
      AND start_date IS NULL
      AND end_date IS NULL
      AND weekdays_json IS NULL
      AND day_of_month IS NULL)
    OR
    (recurrence_type = 'daily'
      AND local_date IS NULL
      AND start_date IS NOT NULL
      AND end_date IS NOT NULL
      AND weekdays_json IS NULL
      AND day_of_month IS NULL)
    OR
    (recurrence_type = 'weekly'
      AND local_date IS NULL
      AND start_date IS NOT NULL
      AND end_date IS NOT NULL
      AND weekdays_json IS NOT NULL
      AND day_of_month IS NULL)
    OR
    (recurrence_type = 'monthly'
      AND local_date IS NULL
      AND start_date IS NOT NULL
      AND end_date IS NOT NULL
      AND weekdays_json IS NULL
      AND day_of_month IS NOT NULL)
  ),
  CHECK (
    (kind = 'medication'
      AND medication_name IS NOT NULL
      AND medication_dosage IS NOT NULL)
    OR
    (kind <> 'medication'
      AND medication_name IS NULL
      AND medication_dosage IS NULL
      AND medication_instructions IS NULL)
  ),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE INDEX health_reminders_owner_status
  ON health_reminders(owner_account_id, status, created_at DESC);

CREATE INDEX health_reminders_creator
  ON health_reminders(created_by_account_id, created_at DESC);

CREATE TRIGGER health_reminder_insert_guard
BEFORE INSERT ON health_reminders
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM accounts a WHERE a.id = NEW.owner_account_id AND a.status = 'active'
  ) THEN RAISE(ABORT, 'reminder_owner_not_active') END;

  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM accounts a WHERE a.id = NEW.created_by_account_id AND a.status = 'active'
  ) THEN RAISE(ABORT, 'reminder_creator_not_active') END;

  SELECT CASE WHEN NEW.source = 'clinic'
    THEN RAISE(ABORT, 'clinic_reminders_not_enabled') END;
END;

CREATE TRIGGER health_reminder_update_guard
BEFORE UPDATE ON health_reminders
BEGIN
  SELECT CASE WHEN
    NEW.id <> OLD.id
    OR NEW.owner_account_id <> OLD.owner_account_id
    OR NEW.created_by_account_id <> OLD.created_by_account_id
    OR NEW.source <> OLD.source
    OR NEW.kind <> OLD.kind
    OR NEW.timezone <> OLD.timezone
    OR NEW.recurrence_type <> OLD.recurrence_type
    OR NEW.local_date IS NOT OLD.local_date
    OR NEW.local_time <> OLD.local_time
    OR NEW.start_date IS NOT OLD.start_date
    OR NEW.end_date IS NOT OLD.end_date
    OR NEW.weekdays_json IS NOT OLD.weekdays_json
    OR NEW.day_of_month IS NOT OLD.day_of_month
    OR NEW.medication_name IS NOT OLD.medication_name
    OR NEW.medication_dosage IS NOT OLD.medication_dosage
    OR NEW.medication_instructions IS NOT OLD.medication_instructions
  THEN RAISE(ABORT, 'reminder_schedule_immutable') END;

  SELECT CASE WHEN OLD.status IN ('cancelled', 'completed') AND NEW.status <> OLD.status
    THEN RAISE(ABORT, 'reminder_terminal_state') END;

  SELECT CASE WHEN NEW.version <> OLD.version + 1
    THEN RAISE(ABORT, 'reminder_version_increment_required') END;

  SELECT CASE WHEN NEW.updated_at < OLD.updated_at
    THEN RAISE(ABORT, 'reminder_timestamp_regression') END;
END;

CREATE TABLE health_reminder_occurrences (
  id TEXT PRIMARY KEY NOT NULL,
  reminder_id TEXT NOT NULL,
  owner_account_id TEXT NOT NULL,
  scheduled_at INTEGER NOT NULL CHECK (scheduled_at > 0),
  local_date TEXT NOT NULL CHECK (
    length(local_date) = 10
    AND local_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'
  ),
  local_time TEXT NOT NULL CHECK (
    length(local_time) = 5
    AND local_time GLOB '[0-2][0-9]:[0-5][0-9]'
    AND local_time < '24:00'
  ),
  timezone TEXT NOT NULL CHECK (length(trim(timezone)) BETWEEN 1 AND 64),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'notified', 'cancelled', 'completed')),
  deduplication_key TEXT NOT NULL UNIQUE CHECK (length(deduplication_key) BETWEEN 1 AND 256),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  notified_at INTEGER,
  closed_at INTEGER,
  FOREIGN KEY (reminder_id) REFERENCES health_reminders(id) ON DELETE RESTRICT,
  FOREIGN KEY (owner_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  UNIQUE (reminder_id, scheduled_at),
  CHECK (notified_at IS NULL OR notified_at >= created_at),
  CHECK (closed_at IS NULL OR closed_at >= created_at),
  CHECK (status NOT IN ('cancelled', 'completed') OR closed_at IS NOT NULL),
  CHECK (status NOT IN ('scheduled', 'notified') OR closed_at IS NULL)
);

CREATE INDEX health_reminder_occurrences_reminder
  ON health_reminder_occurrences(reminder_id, scheduled_at);

CREATE INDEX health_reminder_occurrences_due
  ON health_reminder_occurrences(status, scheduled_at);

CREATE TRIGGER health_reminder_occurrence_insert_guard
BEFORE INSERT ON health_reminder_occurrences
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM health_reminders r
    WHERE r.id = NEW.reminder_id
      AND r.owner_account_id = NEW.owner_account_id
      AND r.status = 'active'
  ) THEN RAISE(ABORT, 'occurrence_reminder_not_active') END;
END;

CREATE TRIGGER health_reminder_occurrence_update_guard
BEFORE UPDATE ON health_reminder_occurrences
BEGIN
  SELECT CASE WHEN
    NEW.id <> OLD.id
    OR NEW.reminder_id <> OLD.reminder_id
    OR NEW.owner_account_id <> OLD.owner_account_id
    OR NEW.scheduled_at <> OLD.scheduled_at
    OR NEW.local_date <> OLD.local_date
    OR NEW.local_time <> OLD.local_time
    OR NEW.timezone <> OLD.timezone
    OR NEW.deduplication_key <> OLD.deduplication_key
    OR NEW.created_at <> OLD.created_at
  THEN RAISE(ABORT, 'occurrence_identity_immutable') END;

  SELECT CASE WHEN OLD.status IN ('cancelled', 'completed') AND NEW.status <> OLD.status
    THEN RAISE(ABORT, 'occurrence_terminal_state') END;

  SELECT CASE WHEN OLD.status = 'notified' AND NEW.status = 'scheduled'
    THEN RAISE(ABORT, 'occurrence_invalid_transition') END;

  SELECT CASE WHEN NEW.status = 'notified' AND (
    OLD.status <> 'scheduled' OR NEW.notified_at IS NULL
  ) THEN RAISE(ABORT, 'occurrence_invalid_transition') END;

  SELECT CASE WHEN NEW.status IN ('cancelled', 'completed') AND NEW.closed_at IS NULL
    THEN RAISE(ABORT, 'occurrence_close_timestamp_required') END;
END;

CREATE TRIGGER health_reminder_occurrence_no_delete
BEFORE DELETE ON health_reminder_occurrences
BEGIN
  SELECT RAISE(ABORT, 'occurrence_no_delete');
END;

CREATE TRIGGER health_reminder_terminal_cancels_occurrences
AFTER UPDATE OF status ON health_reminders
WHEN NEW.status IN ('cancelled', 'completed')
BEGIN
  UPDATE health_reminder_occurrences
  SET status = 'cancelled', closed_at = NEW.updated_at
  WHERE reminder_id = NEW.id
    AND status IN ('scheduled', 'notified');
END;

CREATE TRIGGER health_reminder_occurrence_terminal_cancels_notification
AFTER UPDATE OF status ON health_reminder_occurrences
WHEN NEW.status IN ('cancelled', 'completed')
BEGIN
  UPDATE ordinary_notification_outbox
  SET status = 'cancelled',
      processed_at = NEW.closed_at,
      updated_at = NEW.closed_at,
      lease_until = NULL,
      lease_token = NULL
  WHERE kind = 'reminder_due'
    AND source_id = NEW.id
    AND status = 'pending';
END;

CREATE TABLE health_reminder_events (
  id TEXT PRIMARY KEY NOT NULL,
  reminder_id TEXT NOT NULL,
  occurrence_id TEXT,
  actor_account_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'updated', 'paused', 'resumed', 'cancelled', 'completed',
    'occurrence_notified', 'occurrence_completed', 'occurrence_cancelled'
  )),
  occurred_at INTEGER NOT NULL CHECK (occurred_at > 0),
  metadata_json TEXT CHECK (metadata_json IS NULL OR (
    length(metadata_json) <= 4000 AND json_valid(metadata_json)
  )),
  FOREIGN KEY (reminder_id) REFERENCES health_reminders(id) ON DELETE RESTRICT,
  FOREIGN KEY (occurrence_id) REFERENCES health_reminder_occurrences(id) ON DELETE RESTRICT,
  FOREIGN KEY (actor_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
);

CREATE INDEX health_reminder_events_reminder
  ON health_reminder_events(reminder_id, occurred_at);

CREATE TRIGGER health_reminder_event_no_update
BEFORE UPDATE ON health_reminder_events
BEGIN
  SELECT RAISE(ABORT, 'reminder_event_immutable');
END;

CREATE TRIGGER health_reminder_event_no_delete
BEFORE DELETE ON health_reminder_events
BEGIN
  SELECT RAISE(ABORT, 'reminder_event_immutable');
END;

CREATE TABLE reminder_shares (
  id TEXT PRIMARY KEY NOT NULL,
  owner_account_id TEXT NOT NULL,
  grantee_account_id TEXT NOT NULL,
  reminder_id TEXT,
  can_read INTEGER NOT NULL DEFAULT 1 CHECK (can_read IN (0, 1)),
  can_edit INTEGER NOT NULL DEFAULT 0 CHECK (can_edit IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  revoked_at INTEGER,
  FOREIGN KEY (owner_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (grantee_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (reminder_id) REFERENCES health_reminders(id) ON DELETE RESTRICT,
  CHECK (owner_account_id <> grantee_account_id),
  CHECK (can_read = 1 OR can_edit = 0),
  CHECK ((status = 'active' AND revoked_at IS NULL) OR (status = 'revoked' AND revoked_at IS NOT NULL AND revoked_at >= created_at))
);

CREATE INDEX reminder_shares_grantee
  ON reminder_shares(grantee_account_id, status, created_at DESC);

CREATE INDEX reminder_shares_owner
  ON reminder_shares(owner_account_id, status, created_at DESC);

CREATE TRIGGER reminder_share_insert_guard
BEFORE INSERT ON reminder_shares
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM accounts a WHERE a.id = NEW.owner_account_id AND a.status = 'active'
  ) THEN RAISE(ABORT, 'share_owner_not_active') END;

  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM accounts a WHERE a.id = NEW.grantee_account_id AND a.status = 'active'
  ) THEN RAISE(ABORT, 'share_grantee_not_active') END;

  SELECT CASE WHEN NEW.reminder_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM health_reminders r
    WHERE r.id = NEW.reminder_id AND r.owner_account_id = NEW.owner_account_id
  ) THEN RAISE(ABORT, 'share_reminder_owner_mismatch') END;
END;

CREATE TRIGGER reminder_share_update_guard
BEFORE UPDATE ON reminder_shares
BEGIN
  SELECT CASE WHEN
    NEW.id <> OLD.id
    OR NEW.owner_account_id <> OLD.owner_account_id
    OR NEW.grantee_account_id <> OLD.grantee_account_id
    OR NEW.reminder_id IS NOT OLD.reminder_id
    OR NEW.can_read <> OLD.can_read
    OR NEW.can_edit <> OLD.can_edit
    OR NEW.created_at <> OLD.created_at
  THEN RAISE(ABORT, 'share_identity_immutable') END;

  SELECT CASE WHEN OLD.status <> 'active' OR NEW.status <> 'revoked' OR NEW.revoked_at IS NULL
    THEN RAISE(ABORT, 'share_invalid_transition') END;
END;

CREATE TRIGGER reminder_share_no_delete
BEFORE DELETE ON reminder_shares
BEGIN
  SELECT RAISE(ABORT, 'share_no_delete');
END;

CREATE TABLE ordinary_notification_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'reminder_due', 'family_event_created', 'family_event_updated',
    'family_event_cancelled', 'clinic_reminder_due'
  )),
  source_id TEXT NOT NULL,
  recipient_account_id TEXT NOT NULL,
  scheduled_at INTEGER NOT NULL CHECK (scheduled_at > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'accepted', 'permanent_failure', 'cancelled'
  )),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 2),
  next_attempt_at INTEGER,
  lease_until INTEGER,
  lease_token TEXT,
  deduplication_key TEXT NOT NULL UNIQUE CHECK (length(deduplication_key) BETWEEN 1 AND 256),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  processed_at INTEGER,
  error_code TEXT CHECK (error_code IS NULL OR error_code IN (
    'network_ambiguous', 'temporary_provider_failure', 'invalid_subscription',
    'provider_rejected', 'configuration_error', 'lease_expired', 'cancelled'
  )),
  FOREIGN KEY (recipient_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CHECK (
    (status = 'processing'
      AND attempt_count BETWEEN 1 AND 2
      AND lease_until IS NOT NULL
      AND lease_token IS NOT NULL
      AND length(lease_token) >= 16)
    OR
    (status <> 'processing' AND lease_until IS NULL AND lease_token IS NULL)
  ),
  CHECK (status <> 'pending' OR next_attempt_at IS NOT NULL),
  CHECK (
    (status IN ('accepted', 'permanent_failure', 'cancelled') AND processed_at IS NOT NULL)
    OR
    (status IN ('pending', 'processing') AND processed_at IS NULL)
  )
);

CREATE INDEX ordinary_notification_outbox_due
  ON ordinary_notification_outbox(status, scheduled_at, id);

CREATE INDEX ordinary_notification_outbox_recipient
  ON ordinary_notification_outbox(recipient_account_id, scheduled_at DESC);

CREATE TRIGGER ordinary_notification_outbox_insert_guard
BEFORE INSERT ON ordinary_notification_outbox
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM accounts a WHERE a.id = NEW.recipient_account_id AND a.status = 'active'
  ) THEN RAISE(ABORT, 'ordinary_notification_recipient_not_active') END;
END;

CREATE TRIGGER ordinary_notification_outbox_update_guard
BEFORE UPDATE ON ordinary_notification_outbox
BEGIN
  SELECT CASE WHEN
    NEW.id <> OLD.id
    OR NEW.kind <> OLD.kind
    OR NEW.source_id <> OLD.source_id
    OR NEW.recipient_account_id <> OLD.recipient_account_id
    OR NEW.scheduled_at <> OLD.scheduled_at
    OR NEW.deduplication_key <> OLD.deduplication_key
    OR NEW.created_at <> OLD.created_at
  THEN RAISE(ABORT, 'ordinary_notification_identity_immutable') END;

  SELECT CASE WHEN OLD.status IN ('accepted', 'permanent_failure', 'cancelled') AND NEW.status <> OLD.status
    THEN RAISE(ABORT, 'ordinary_notification_terminal_state') END;

  SELECT CASE WHEN NEW.attempt_count < OLD.attempt_count OR NEW.attempt_count > 2
    THEN RAISE(ABORT, 'ordinary_notification_attempt_count_invalid') END;

  SELECT CASE WHEN NEW.updated_at < OLD.updated_at
    THEN RAISE(ABORT, 'ordinary_notification_timestamp_regression') END;
END;

CREATE TABLE ordinary_notification_reads (
  notification_id TEXT PRIMARY KEY NOT NULL,
  recipient_account_id TEXT NOT NULL,
  read_at INTEGER NOT NULL CHECK (read_at > 0),
  dismissed_at INTEGER,
  FOREIGN KEY (notification_id) REFERENCES ordinary_notification_outbox(id) ON DELETE RESTRICT,
  FOREIGN KEY (recipient_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CHECK (dismissed_at IS NULL OR dismissed_at >= read_at)
);

CREATE TRIGGER ordinary_notification_read_insert_guard
BEFORE INSERT ON ordinary_notification_reads
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM ordinary_notification_outbox o
    WHERE o.id = NEW.notification_id
      AND o.recipient_account_id = NEW.recipient_account_id
  ) THEN RAISE(ABORT, 'ordinary_read_recipient_mismatch') END;
END;

CREATE TRIGGER ordinary_notification_read_update_guard
BEFORE UPDATE ON ordinary_notification_reads
BEGIN
  SELECT CASE WHEN
    NEW.notification_id <> OLD.notification_id
    OR NEW.recipient_account_id <> OLD.recipient_account_id
    OR NEW.read_at <> OLD.read_at
  THEN RAISE(ABORT, 'ordinary_read_identity_immutable') END;
END;

CREATE TABLE ordinary_notification_deliveries (
  id TEXT PRIMARY KEY NOT NULL,
  outbox_id TEXT NOT NULL,
  recipient_account_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'accepted', 'permanent_failure', 'cancelled'
  )),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 2),
  next_attempt_at INTEGER,
  lease_until INTEGER,
  lease_token TEXT,
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  error_code TEXT CHECK (error_code IS NULL OR error_code IN (
    'network_ambiguous', 'temporary_provider_failure', 'invalid_subscription',
    'provider_rejected', 'configuration_error', 'lease_expired', 'cancelled'
  )),
  FOREIGN KEY (outbox_id) REFERENCES ordinary_notification_outbox(id) ON DELETE RESTRICT,
  FOREIGN KEY (recipient_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (device_id, recipient_account_id) REFERENCES devices(id, account_id) ON DELETE RESTRICT,
  FOREIGN KEY (subscription_id) REFERENCES push_subscriptions(id) ON DELETE RESTRICT,
  UNIQUE (outbox_id, subscription_id),
  CHECK (
    (status = 'processing'
      AND attempt_count BETWEEN 1 AND 2
      AND lease_until IS NOT NULL
      AND lease_token IS NOT NULL
      AND length(lease_token) >= 16)
    OR
    (status <> 'processing' AND lease_until IS NULL AND lease_token IS NULL)
  ),
  CHECK (status <> 'pending' OR next_attempt_at IS NOT NULL)
);

CREATE INDEX ordinary_notification_deliveries_outbox
  ON ordinary_notification_deliveries(outbox_id, status);

CREATE INDEX ordinary_notification_deliveries_due
  ON ordinary_notification_deliveries(status, next_attempt_at, id);

CREATE TRIGGER ordinary_notification_delivery_insert_guard
BEFORE INSERT ON ordinary_notification_deliveries
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM ordinary_notification_outbox o
    JOIN push_subscriptions p
      ON p.id = NEW.subscription_id
     AND p.account_id = NEW.recipient_account_id
     AND p.device_id = NEW.device_id
     AND p.status = 'active'
    JOIN devices d
      ON d.id = NEW.device_id
     AND d.account_id = NEW.recipient_account_id
     AND d.status = 'active'
    WHERE o.id = NEW.outbox_id
      AND o.recipient_account_id = NEW.recipient_account_id
      AND o.status IN ('pending', 'processing')
  ) THEN RAISE(ABORT, 'ordinary_delivery_scope_mismatch') END;
END;

CREATE TRIGGER ordinary_notification_delivery_update_guard
BEFORE UPDATE ON ordinary_notification_deliveries
BEGIN
  SELECT CASE WHEN
    NEW.id <> OLD.id
    OR NEW.outbox_id <> OLD.outbox_id
    OR NEW.recipient_account_id <> OLD.recipient_account_id
    OR NEW.device_id <> OLD.device_id
    OR NEW.subscription_id <> OLD.subscription_id
    OR NEW.created_at <> OLD.created_at
  THEN RAISE(ABORT, 'ordinary_delivery_identity_immutable') END;

  SELECT CASE WHEN OLD.status IN ('accepted', 'permanent_failure', 'cancelled') AND NEW.status <> OLD.status
    THEN RAISE(ABORT, 'ordinary_delivery_terminal_state') END;

  SELECT CASE WHEN NEW.attempt_count < OLD.attempt_count OR NEW.attempt_count > 2
    THEN RAISE(ABORT, 'ordinary_delivery_attempt_count_invalid') END;

  SELECT CASE WHEN NEW.updated_at < OLD.updated_at
    THEN RAISE(ABORT, 'ordinary_delivery_timestamp_regression') END;
END;

CREATE TABLE ordinary_notification_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  delivery_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL CHECK (attempt_number IN (1, 2)),
  reserved_at INTEGER NOT NULL CHECK (reserved_at > 0),
  started_at INTEGER,
  finished_at INTEGER,
  result TEXT NOT NULL CHECK (result IN (
    'processing', 'accepted', 'retry_wait', 'permanent_failure', 'cancelled'
  )),
  http_status INTEGER CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599),
  error_code TEXT CHECK (error_code IS NULL OR error_code IN (
    'network_ambiguous', 'temporary_provider_failure', 'invalid_subscription',
    'provider_rejected', 'configuration_error', 'lease_expired', 'cancelled'
  )),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  FOREIGN KEY (delivery_id) REFERENCES ordinary_notification_deliveries(id) ON DELETE RESTRICT,
  UNIQUE (delivery_id, attempt_number),
  CHECK (started_at IS NULL OR started_at >= reserved_at),
  CHECK (finished_at IS NULL OR (started_at IS NOT NULL AND finished_at >= started_at)),
  CHECK ((result = 'processing' AND finished_at IS NULL) OR (result <> 'processing' AND finished_at IS NOT NULL))
);

CREATE INDEX ordinary_notification_attempts_delivery
  ON ordinary_notification_attempts(delivery_id, attempt_number);

CREATE TRIGGER ordinary_notification_attempt_insert_guard
BEFORE INSERT ON ordinary_notification_attempts
BEGIN
  SELECT CASE WHEN NEW.attempt_number > (
    SELECT attempt_count FROM ordinary_notification_deliveries WHERE id = NEW.delivery_id
  ) THEN RAISE(ABORT, 'ordinary_attempt_not_reserved') END;

  SELECT CASE WHEN NEW.attempt_number <> (
    SELECT COUNT(*) FROM ordinary_notification_attempts WHERE delivery_id = NEW.delivery_id
  ) + 1 THEN RAISE(ABORT, 'ordinary_attempt_sequence_invalid') END;
END;

CREATE TRIGGER ordinary_notification_attempt_update_guard
BEFORE UPDATE ON ordinary_notification_attempts
BEGIN
  SELECT CASE WHEN
    NEW.id <> OLD.id
    OR NEW.delivery_id <> OLD.delivery_id
    OR NEW.attempt_number <> OLD.attempt_number
    OR NEW.reserved_at <> OLD.reserved_at
  THEN RAISE(ABORT, 'ordinary_attempt_identity_immutable') END;

  SELECT CASE WHEN OLD.result <> 'processing'
    THEN RAISE(ABORT, 'ordinary_attempt_result_terminal') END;
END;
