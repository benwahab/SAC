-- Lease et reprise contrôlée de la file de rappels SOS.
ALTER TABLE alert_reminder_outbox ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0);
ALTER TABLE alert_reminder_outbox ADD COLUMN lease_until INTEGER;
ALTER TABLE alert_reminder_outbox ADD COLUMN lease_token TEXT;

CREATE INDEX alert_reminder_lease
  ON alert_reminder_outbox(status, lease_until, scheduled_at);

CREATE TRIGGER alert_reminder_state_guard
BEFORE UPDATE OF status, attempt_count, lease_until, lease_token, processed_at
ON alert_reminder_outbox
BEGIN
  SELECT CASE WHEN OLD.status IN ('sent', 'cancelled')
    THEN RAISE(ABORT, 'alert_reminder_terminal_state') END;
  SELECT CASE WHEN NEW.attempt_count < OLD.attempt_count
    THEN RAISE(ABORT, 'alert_reminder_attempts_cannot_decrease') END;
  SELECT CASE WHEN NEW.status = 'processing'
    AND (NEW.lease_until IS NULL OR NEW.lease_token IS NULL OR length(NEW.lease_token) < 16)
    THEN RAISE(ABORT, 'alert_reminder_processing_requires_lease') END;
  SELECT CASE WHEN NEW.status <> 'processing'
    AND (NEW.lease_until IS NOT NULL OR NEW.lease_token IS NOT NULL)
    THEN RAISE(ABORT, 'alert_reminder_nonprocessing_cannot_hold_lease') END;
END;

DROP TRIGGER alert_close_cancels_pending_reminders;
CREATE TRIGGER alert_close_cancels_pending_reminders
AFTER UPDATE OF status ON alerts
WHEN OLD.status = 'active' AND NEW.status = 'closed_by_author'
BEGIN
  UPDATE alert_reminder_outbox
  SET status = 'cancelled',
      processed_at = NEW.closed_at,
      lease_until = NULL,
      lease_token = NULL
  WHERE alert_id = NEW.id AND status IN ('pending', 'processing');
END;
