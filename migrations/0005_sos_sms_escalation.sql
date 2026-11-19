-- SAC — Escalade SMS différée après le seuil de rappels push.
-- Cette migration ne connecte aucun fournisseur SMS et ne déclenche aucun envoi.

CREATE TABLE alert_sms_escalations (
  alert_id TEXT PRIMARY KEY NOT NULL,
  threshold_reached_at INTEGER NOT NULL CHECK (threshold_reached_at > 0),
  evaluated_at INTEGER NOT NULL CHECK (evaluated_at >= threshold_reached_at),
  status TEXT NOT NULL CHECK (status IN ('queued', 'suppressed')),
  FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE RESTRICT
);

CREATE TABLE alert_sms_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  alert_id TEXT NOT NULL,
  recipient_account_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'cancelled')),
  scheduled_at INTEGER NOT NULL CHECK (scheduled_at > 0),
  created_at INTEGER NOT NULL CHECK (created_at >= scheduled_at),
  processed_at INTEGER,
  FOREIGN KEY (alert_id) REFERENCES alert_sms_escalations(alert_id) ON DELETE RESTRICT,
  FOREIGN KEY (alert_id, recipient_account_id)
    REFERENCES alert_recipients(alert_id, recipient_account_id) ON DELETE RESTRICT,
  UNIQUE (alert_id, recipient_account_id),
  CHECK (processed_at IS NULL OR processed_at >= created_at)
);

CREATE INDEX alert_sms_outbox_due
  ON alert_sms_outbox(status, scheduled_at);

-- L'évaluation n'est possible qu'une fois le seuil atteint sur une alerte active.
-- La décision queued/suppressed est prise côté D1 au même instant logique.
CREATE TRIGGER alert_sms_escalation_insert_guard
BEFORE INSERT ON alert_sms_escalations
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM alerts a
    WHERE a.id = NEW.alert_id
      AND a.status = 'active'
      AND NEW.threshold_reached_at = a.created_at + (a.push_reminder_limit * 300000)
      AND NEW.evaluated_at >= NEW.threshold_reached_at
      AND (
        SELECT COUNT(*) FROM alert_reminder_outbox r
        WHERE r.alert_id = a.id
          AND r.reminder_number = a.push_reminder_limit
          AND r.status IN ('sent', 'failed')
      ) = (
        SELECT COUNT(*) FROM alert_recipients r
        WHERE r.alert_id = a.id
      )
      AND (
        (NEW.status = 'queued' AND NOT EXISTS (
          SELECT 1 FROM alert_responsibility_periods p
          WHERE p.alert_id = a.id
        ))
        OR
        (NEW.status = 'suppressed' AND EXISTS (
          SELECT 1 FROM alert_responsibility_periods p
          WHERE p.alert_id = a.id AND p.ended_at IS NULL
        ))
      )
  ) THEN RAISE(ABORT, 'alert_sms_escalation_not_eligible') END;
END;

CREATE TRIGGER alert_sms_escalation_immutable
BEFORE UPDATE ON alert_sms_escalations
BEGIN
  SELECT RAISE(ABORT, 'alert_sms_escalation_immutable');
END;

CREATE TRIGGER alert_sms_escalation_no_delete
BEFORE DELETE ON alert_sms_escalations
BEGIN
  SELECT RAISE(ABORT, 'alert_sms_escalation_immutable');
END;

CREATE TRIGGER alert_sms_outbox_insert_guard
BEFORE INSERT ON alert_sms_outbox
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM alert_sms_escalations e
    JOIN alerts a ON a.id = e.alert_id
    JOIN alert_recipients r ON r.alert_id = e.alert_id
    WHERE e.alert_id = NEW.alert_id
      AND e.status = 'queued'
      AND a.status = 'active'
      AND r.recipient_account_id = NEW.recipient_account_id
      AND NEW.scheduled_at = e.threshold_reached_at
      AND NEW.created_at >= e.evaluated_at
  ) THEN RAISE(ABORT, 'alert_sms_task_not_eligible') END;
END;

CREATE TRIGGER alert_close_cancels_pending_sms
AFTER UPDATE OF status ON alerts
WHEN OLD.status = 'active' AND NEW.status = 'closed_by_author'
BEGIN
  UPDATE alert_sms_outbox
  SET status = 'cancelled', processed_at = NEW.closed_at
  WHERE alert_id = NEW.id AND status = 'pending';
END;
