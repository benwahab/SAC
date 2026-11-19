-- SAC — SOS déclenchés, destinataires figés, réponses et rappels
-- Horodatages en millisecondes Unix UTC. Aucune coordonnée GPS n'est stockée ici.
-- La migration ne rend pas encore l'API publique : une session authentifiée reste requise.

PRAGMA foreign_keys = ON;

CREATE TABLE alerts (
  id TEXT PRIMARY KEY NOT NULL,
  author_account_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'personal_danger', 'accident', 'home_intrusion',
    'medical_emergency', 'lost_or_disoriented_person', 'custom_alert'
  )),
  level TEXT NOT NULL CHECK (level IN ('preventive', 'urgent', 'critical')),
  custom_description TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'closed_by_author')),
  push_reminder_limit INTEGER NOT NULL CHECK (push_reminder_limit BETWEEN 1 AND 5),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  closed_at INTEGER,
  closure_reason TEXT CHECK (closure_reason IN ('completed', 'cancelled')),
  FOREIGN KEY (author_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CHECK (
    (status = 'active' AND closed_at IS NULL AND closure_reason IS NULL)
    OR
    (status = 'closed_by_author' AND closed_at IS NOT NULL
      AND closed_at >= created_at AND closure_reason IS NOT NULL)
  ),
  CHECK (custom_description IS NULL OR length(custom_description) <= 2000)
);

CREATE INDEX alerts_author_created ON alerts(author_account_id, created_at DESC);
CREATE INDEX alerts_active_created ON alerts(status, created_at);

CREATE TABLE alert_recipients (
  alert_id TEXT NOT NULL,
  recipient_account_id TEXT NOT NULL,
  selected_at INTEGER NOT NULL CHECK (selected_at > 0),
  PRIMARY KEY (alert_id, recipient_account_id),
  FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE RESTRICT,
  FOREIGN KEY (recipient_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
);

CREATE INDEX alert_recipients_inbox
  ON alert_recipients(recipient_account_id, alert_id);

CREATE TABLE alert_events (
  id TEXT PRIMARY KEY NOT NULL,
  alert_id TEXT NOT NULL,
  actor_account_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'triggered', 'acknowledged', 'volunteered', 'withdrew',
    'closed_by_author'
  )),
  occurred_at INTEGER NOT NULL CHECK (occurred_at > 0),
  server_sequence INTEGER,
  details_code TEXT,
  FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE RESTRICT,
  FOREIGN KEY (actor_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CHECK (
    (event_type = 'volunteered' AND server_sequence IS NOT NULL AND server_sequence > 0)
    OR
    (event_type <> 'volunteered' AND server_sequence IS NULL)
  )
);

CREATE UNIQUE INDEX alert_events_volunteer_sequence
  ON alert_events(alert_id, server_sequence)
  WHERE server_sequence IS NOT NULL;
CREATE INDEX alert_events_chronology
  ON alert_events(alert_id, occurred_at, id);

CREATE TABLE alert_responsibility_periods (
  id TEXT PRIMARY KEY NOT NULL,
  alert_id TEXT NOT NULL,
  contact_account_id TEXT NOT NULL,
  started_at INTEGER NOT NULL CHECK (started_at > 0),
  ended_at INTEGER,
  end_reason TEXT CHECK (end_reason IN ('withdrawn', 'alert_closed')),
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  FOREIGN KEY (alert_id, contact_account_id)
    REFERENCES alert_recipients(alert_id, recipient_account_id) ON DELETE RESTRICT,
  UNIQUE (alert_id, sequence),
  CHECK (
    (ended_at IS NULL AND end_reason IS NULL)
    OR (ended_at IS NOT NULL AND ended_at >= started_at AND end_reason IS NOT NULL)
  )
);

CREATE UNIQUE INDEX alert_one_current_responsible
  ON alert_responsibility_periods(alert_id)
  WHERE ended_at IS NULL;

CREATE TABLE alert_reminder_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  alert_id TEXT NOT NULL,
  recipient_account_id TEXT NOT NULL,
  reminder_number INTEGER NOT NULL CHECK (reminder_number >= 0),
  scheduled_at INTEGER NOT NULL CHECK (scheduled_at > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'cancelled', 'failed')),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  processed_at INTEGER,
  FOREIGN KEY (alert_id, recipient_account_id)
    REFERENCES alert_recipients(alert_id, recipient_account_id) ON DELETE RESTRICT,
  UNIQUE (alert_id, recipient_account_id, reminder_number),
  CHECK (processed_at IS NULL OR processed_at >= created_at)
);

CREATE INDEX alert_reminder_due
  ON alert_reminder_outbox(status, scheduled_at);

-- Une alerte ne peut être créée que par un compte actif.
CREATE TRIGGER alert_insert_author_guard
BEFORE INSERT ON alerts
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM accounts
    WHERE id = NEW.author_account_id AND status = 'active'
  ) THEN RAISE(ABORT, 'alert_author_not_active') END;
END;

-- Le destinataire doit être un proche actif au moment précis du déclenchement.
CREATE TRIGGER alert_recipient_insert_guard
BEFORE INSERT ON alert_recipients
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM alerts a
    JOIN trusted_contacts t
      ON t.owner_account_id = a.author_account_id
     AND t.contact_account_id = NEW.recipient_account_id
     AND t.status = 'active'
    JOIN accounts c
      ON c.id = NEW.recipient_account_id AND c.status = 'active'
    WHERE a.id = NEW.alert_id
      AND a.status = 'active'
      AND NEW.selected_at = a.created_at
  ) THEN RAISE(ABORT, 'alert_recipient_not_trusted_at_trigger') END;
  SELECT CASE WHEN NEW.recipient_account_id = (
    SELECT author_account_id FROM alerts WHERE id = NEW.alert_id
  ) THEN RAISE(ABORT, 'alert_author_cannot_be_recipient') END;
END;

-- Le snapshot est immuable : une révocation ultérieure ne réécrit pas les
-- destinataires de l'alerte déjà partie.
CREATE TRIGGER alert_recipient_immutable
BEFORE UPDATE ON alert_recipients
BEGIN
  SELECT RAISE(ABORT, 'alert_recipient_snapshot_immutable');
END;

CREATE TRIGGER alert_recipient_no_delete
BEFORE DELETE ON alert_recipients
BEGIN
  SELECT RAISE(ABORT, 'alert_recipient_snapshot_immutable');
END;

-- Les événements sont append-only et doivent suivre la chronologie du SOS.
CREATE TRIGGER alert_event_insert_guard
BEFORE INSERT ON alert_events
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM alerts a
    WHERE a.id = NEW.alert_id
      AND NEW.occurred_at >= a.created_at
      AND (
        (NEW.event_type = 'triggered' AND NEW.actor_account_id = a.author_account_id
          AND NEW.occurred_at = a.created_at
          AND NOT EXISTS (SELECT 1 FROM alert_events e WHERE e.alert_id = a.id))
        OR
        (NEW.event_type = 'closed_by_author' AND a.status = 'closed_by_author'
          AND NEW.actor_account_id = a.author_account_id
          AND NEW.occurred_at = a.closed_at)
        OR
        (NEW.event_type IN ('acknowledged', 'volunteered', 'withdrew')
          AND a.status = 'active'
          AND EXISTS (SELECT 1 FROM alert_recipients r
            WHERE r.alert_id = a.id AND r.recipient_account_id = NEW.actor_account_id))
      )
  ) THEN RAISE(ABORT, 'alert_event_not_authorized_or_out_of_order') END;
  SELECT CASE WHEN NEW.event_type = 'volunteered' AND EXISTS (
    SELECT 1 FROM alert_events e
    WHERE e.alert_id = NEW.alert_id AND e.server_sequence = NEW.server_sequence
  ) THEN RAISE(ABORT, 'alert_volunteer_sequence_duplicate') END;
END;

CREATE TRIGGER alert_event_no_update
BEFORE UPDATE ON alert_events
BEGIN
  SELECT RAISE(ABORT, 'alert_events_append_only');
END;

CREATE TRIGGER alert_event_no_delete
BEFORE DELETE ON alert_events
BEGIN
  SELECT RAISE(ABORT, 'alert_events_append_only');
END;

-- Une période de responsabilité ne peut être ouverte que pour un proche
-- ayant volontairement accepté la prise en charge (événement serveur).
CREATE TRIGGER alert_responsibility_insert_guard
BEFORE INSERT ON alert_responsibility_periods
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM alerts a
    JOIN alert_events e ON e.alert_id = a.id
    WHERE a.id = NEW.alert_id
      AND a.status = 'active'
      AND e.actor_account_id = NEW.contact_account_id
      AND e.event_type = 'volunteered'
      AND e.server_sequence = NEW.sequence
      AND e.occurred_at <= NEW.started_at
  ) THEN RAISE(ABORT, 'alert_responsibility_requires_volunteer') END;
END;

CREATE TRIGGER alert_responsibility_immutable_fields
BEFORE UPDATE ON alert_responsibility_periods
BEGIN
  SELECT CASE WHEN
    NEW.id <> OLD.id OR NEW.alert_id <> OLD.alert_id
    OR NEW.contact_account_id <> OLD.contact_account_id
    OR NEW.started_at <> OLD.started_at OR NEW.sequence <> OLD.sequence
  THEN RAISE(ABORT, 'alert_responsibility_immutable_fields') END;
  SELECT CASE WHEN OLD.ended_at IS NOT NULL
    THEN RAISE(ABORT, 'alert_responsibility_already_ended') END;
  SELECT CASE WHEN NEW.ended_at IS NULL OR NEW.end_reason IS NULL
    THEN RAISE(ABORT, 'alert_responsibility_invalid_end') END;
  SELECT CASE WHEN NEW.end_reason = 'alert_closed' AND NOT EXISTS (
    SELECT 1 FROM alerts a
    WHERE a.id = OLD.alert_id AND a.status = 'closed_by_author'
      AND a.closed_at = NEW.ended_at
  ) THEN RAISE(ABORT, 'alert_responsibility_close_mismatch') END;
  SELECT CASE WHEN NEW.end_reason = 'withdrawn' AND NOT EXISTS (
    SELECT 1 FROM alert_events e
    WHERE e.alert_id = OLD.alert_id
      AND e.actor_account_id = OLD.contact_account_id
      AND e.event_type = 'withdrew'
      AND e.occurred_at = NEW.ended_at
  ) THEN RAISE(ABORT, 'alert_responsibility_withdrawal_missing') END;
END;

-- Push initial et rappels continus au snapshot, espacés d'au moins cinq minutes.
CREATE TRIGGER alert_reminder_insert_guard
BEFORE INSERT ON alert_reminder_outbox
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM alerts a
    WHERE a.id = NEW.alert_id
      AND a.status = 'active'
      AND (
        (NEW.reminder_number = 0 AND NEW.scheduled_at = a.created_at)
        OR
        (NEW.reminder_number BETWEEN 1 AND a.push_reminder_limit
          AND NEW.scheduled_at >= a.created_at + (NEW.reminder_number * 300000))
      )
      AND NEW.created_at >= a.created_at
  ) THEN RAISE(ABORT, 'alert_reminder_not_eligible') END;
END;

CREATE TRIGGER alert_close_cancels_pending_reminders
AFTER UPDATE OF status ON alerts
WHEN OLD.status = 'active' AND NEW.status = 'closed_by_author'
BEGIN
  UPDATE alert_reminder_outbox
  SET status = 'cancelled', processed_at = NEW.closed_at
  WHERE alert_id = NEW.id AND status IN ('pending', 'processing');
END;

CREATE TRIGGER alert_close_guard
BEFORE UPDATE OF status ON alerts
BEGIN
  SELECT CASE WHEN
    OLD.status <> 'active' OR NEW.status <> 'closed_by_author'
    OR NEW.author_account_id <> OLD.author_account_id
    OR NEW.category <> OLD.category OR NEW.level <> OLD.level
    OR NEW.custom_description IS NOT OLD.custom_description
    OR NEW.push_reminder_limit <> OLD.push_reminder_limit
    OR NEW.created_at <> OLD.created_at
    OR NEW.closed_at IS NULL OR NEW.closed_at < OLD.created_at
    OR NEW.closure_reason NOT IN ('completed', 'cancelled')
  THEN RAISE(ABORT, 'alert_invalid_closure_transition') END;
END;
