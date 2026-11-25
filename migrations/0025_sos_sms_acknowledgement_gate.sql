-- SAC — L'escalade SMS est supprimée dès qu'un destinataire a accusé réception.
-- La responsabilité principale reste un second motif de suppression, même sans accusé.
-- Aucune notification SMS n'est envoyée par cette migration.

DROP TRIGGER alert_sms_escalation_insert_guard;

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
        (
          NEW.status = 'queued'
          AND NOT EXISTS (
            SELECT 1 FROM alert_events acknowledged
            WHERE acknowledged.alert_id = a.id
              AND acknowledged.event_type = 'acknowledged'
          )
          AND NOT EXISTS (
            SELECT 1 FROM alert_responsibility_periods p
            WHERE p.alert_id = a.id
          )
        )
        OR
        (
          NEW.status = 'suppressed'
          AND (
            EXISTS (
              SELECT 1 FROM alert_events acknowledged
              WHERE acknowledged.alert_id = a.id
                AND acknowledged.event_type = 'acknowledged'
            )
            OR EXISTS (
              SELECT 1 FROM alert_responsibility_periods p
              WHERE p.alert_id = a.id
            )
          )
        )
      )
  ) THEN RAISE(ABORT, 'alert_sms_escalation_not_eligible') END;
END;
