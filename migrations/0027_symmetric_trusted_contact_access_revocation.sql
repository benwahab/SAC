-- SAC — Coupure symétrique des accès après toute rupture de confiance.
-- Les deux motifs de révocation appliquent désormais la même interdiction d'accès.
PRAGMA foreign_keys = ON;

DROP TRIGGER alert_event_insert_guard;
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
          AND EXISTS (
            SELECT 1 FROM alert_recipients r
            JOIN trusted_contacts t
              ON t.owner_account_id = a.author_account_id
             AND t.contact_account_id = r.recipient_account_id
             AND t.status = 'active'
             AND t.created_at <= a.created_at
             AND NOT EXISTS (
              SELECT 1 FROM trusted_contacts exited
              WHERE exited.owner_account_id = t.owner_account_id
                AND exited.contact_account_id = t.contact_account_id
                AND exited.revocation_reason = 'contact_withdrew'
                AND (
                  exited.relationship_sequence > t.relationship_sequence
                )
            )
            WHERE r.alert_id = a.id
              AND r.recipient_account_id = NEW.actor_account_id
          ))
        OR
        (NEW.event_type = 'withdrew'
          AND NEW.details_code = 'trusted_contact_revoked'
          AND a.status = 'active'
          AND EXISTS (
            SELECT 1 FROM alert_recipients r
            JOIN trusted_contacts t
              ON t.owner_account_id = a.author_account_id
             AND t.contact_account_id = r.recipient_account_id
            WHERE r.alert_id = a.id
              AND r.recipient_account_id = NEW.actor_account_id
              AND t.status = 'revoked'
              AND t.revoked_at = NEW.occurred_at
              AND t.revocation_reason = 'contact_withdrew'
              AND t.revoked_by_account_id = NEW.actor_account_id
          ))
      )
  ) THEN RAISE(ABORT, 'alert_event_not_authorized_or_out_of_order') END;

  SELECT CASE WHEN NEW.event_type = 'volunteered' AND EXISTS (
    SELECT 1 FROM alert_events e
    WHERE e.alert_id = NEW.alert_id AND e.server_sequence = NEW.server_sequence
  ) THEN RAISE(ABORT, 'alert_volunteer_sequence_duplicate') END;
END;


DROP TRIGGER trusted_contacts_revoke_access;
CREATE TRIGGER trusted_contacts_revoke_access
AFTER UPDATE OF status ON trusted_contacts
WHEN OLD.status = 'active' AND NEW.status = 'revoked'
BEGIN
  UPDATE alert_reminder_outbox
  SET status = 'cancelled',
      processed_at = CASE WHEN NEW.revoked_at >= created_at THEN NEW.revoked_at ELSE created_at END,
      lease_until = NULL,
      lease_token = NULL
  WHERE recipient_account_id = NEW.contact_account_id
    AND status IN ('pending', 'processing')
    AND alert_id IN (
      SELECT a.id FROM alerts a
      WHERE a.author_account_id = NEW.owner_account_id AND a.status = 'active'
    );

  UPDATE alert_sms_outbox
  SET status = 'cancelled',
      processed_at = CASE WHEN NEW.revoked_at >= created_at THEN NEW.revoked_at ELSE created_at END
  WHERE recipient_account_id = NEW.contact_account_id
    AND status = 'pending'
    AND alert_id IN (
      SELECT a.id FROM alerts a
      WHERE a.author_account_id = NEW.owner_account_id AND a.status = 'active'

    );

  DELETE FROM gps_relay_tickets
  WHERE account_id = NEW.contact_account_id
    AND alert_id IN (
      SELECT a.id FROM alerts a
      WHERE a.author_account_id = NEW.owner_account_id AND a.status = 'active'
        
    );

  -- Un proche ayant accepté la prise en charge est retiré de la coordination.
  INSERT INTO alert_events
    (id, alert_id, actor_account_id, event_type, occurred_at, server_sequence, details_code)
  SELECT lower(hex(randomblob(16))), a.id, NEW.contact_account_id,
         'withdrew', NEW.revoked_at, NULL, 'trusted_contact_revoked'
  FROM alerts a
  JOIN alert_recipients r ON r.alert_id = a.id
    AND r.recipient_account_id = NEW.contact_account_id
  WHERE NEW.revocation_reason = 'contact_withdrew'
    AND a.author_account_id = NEW.owner_account_id
    AND a.status = 'active' 
    AND EXISTS (
      SELECT 1 FROM alert_events v
      WHERE v.alert_id = a.id AND v.actor_account_id = NEW.contact_account_id
        AND v.event_type = 'volunteered'
    )
    AND NOT EXISTS (
      SELECT 1 FROM alert_events w
      WHERE w.alert_id = a.id AND w.actor_account_id = NEW.contact_account_id
        AND w.event_type = 'withdrew'
    );

  UPDATE alert_responsibility_periods
  SET ended_at = CASE WHEN NEW.revoked_at >= started_at THEN NEW.revoked_at ELSE started_at END,
      end_reason = 'withdrawn'
  WHERE contact_account_id = NEW.contact_account_id
    AND ended_at IS NULL
    AND alert_id IN (
      SELECT a.id FROM alerts a
      WHERE a.author_account_id = NEW.owner_account_id AND a.status = 'active'
        
    );

  -- Si le proche sortant était responsable, le prochain volontaire encore
  -- éligible prend le relais. Le SOS de l'auteur reste actif.
  INSERT INTO alert_responsibility_periods
    (id, alert_id, contact_account_id, started_at, sequence)
  SELECT lower(hex(randomblob(16))), e.alert_id, e.actor_account_id,
         CASE WHEN NEW.revoked_at >= e.occurred_at THEN NEW.revoked_at ELSE e.occurred_at END,
         e.server_sequence
  FROM alert_events e
  JOIN alerts a ON a.id = e.alert_id AND a.status = 'active'
  WHERE a.author_account_id = NEW.owner_account_id
    
    AND e.event_type = 'volunteered'
    AND e.actor_account_id <> NEW.contact_account_id
    AND EXISTS (
      SELECT 1 FROM trusted_contacts eligible
      WHERE eligible.owner_account_id = NEW.owner_account_id
        AND eligible.contact_account_id = e.actor_account_id
        AND eligible.status = 'active'
    )
    AND e.server_sequence = (
      SELECT MIN(candidate.server_sequence)
      FROM alert_events candidate
      WHERE candidate.alert_id = e.alert_id
        AND candidate.event_type = 'volunteered'
        AND candidate.actor_account_id <> NEW.contact_account_id
        AND EXISTS (
          SELECT 1 FROM trusted_contacts eligible
          WHERE eligible.owner_account_id = NEW.owner_account_id
            AND eligible.contact_account_id = candidate.actor_account_id
            AND eligible.status = 'active'
        )
        AND NOT EXISTS (
          SELECT 1 FROM alert_events withdrew
          WHERE withdrew.alert_id = candidate.alert_id
            AND withdrew.actor_account_id = candidate.actor_account_id
            AND withdrew.event_type = 'withdrew'
        )
        AND NOT EXISTS (
          SELECT 1 FROM alert_responsibility_periods prior
          WHERE prior.alert_id = candidate.alert_id
            AND prior.sequence = candidate.server_sequence
        )
    )
    AND EXISTS (
      SELECT 1 FROM alert_responsibility_periods ended
      WHERE ended.alert_id = e.alert_id
        AND ended.contact_account_id = NEW.contact_account_id
        AND ended.ended_at = CASE WHEN NEW.revoked_at >= ended.started_at THEN NEW.revoked_at ELSE ended.started_at END
        AND ended.end_reason = 'withdrawn'
    )
    AND NOT EXISTS (
      SELECT 1 FROM alert_responsibility_periods current
      WHERE current.alert_id = e.alert_id AND current.ended_at IS NULL
    );
END;


DROP TRIGGER alert_reminder_insert_guard;
CREATE TRIGGER alert_reminder_insert_guard
BEFORE INSERT ON alert_reminder_outbox
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM alerts a
    JOIN trusted_contacts t
      ON t.owner_account_id = a.author_account_id
     AND t.contact_account_id = NEW.recipient_account_id
     AND t.status = 'active'
     AND t.created_at <= a.created_at
     AND NOT EXISTS (
        SELECT 1 FROM trusted_contacts exited
        WHERE exited.owner_account_id = t.owner_account_id
          AND exited.contact_account_id = t.contact_account_id
          AND exited.revocation_reason = 'contact_withdrew'
          AND (
            exited.relationship_sequence > t.relationship_sequence
          )
      )
    WHERE a.id = NEW.alert_id
      AND a.status = 'active'
      AND (
        (NEW.reminder_number = 0 AND NEW.scheduled_at = a.created_at)
        OR
        (NEW.reminder_number >= 1
          AND NEW.scheduled_at >= a.created_at + (NEW.reminder_number * 300000))
      )
      AND NEW.created_at >= a.created_at
  ) THEN RAISE(ABORT, 'alert_reminder_not_eligible') END;
END;


DROP TRIGGER alert_sms_outbox_insert_guard;
CREATE TRIGGER alert_sms_outbox_insert_guard
BEFORE INSERT ON alert_sms_outbox
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM alert_sms_escalations e
    JOIN alerts a ON a.id = e.alert_id
    JOIN alert_recipients r ON r.alert_id = e.alert_id
    JOIN trusted_contacts t
      ON t.owner_account_id = a.author_account_id
     AND t.contact_account_id = r.recipient_account_id
     AND t.status = 'active'
     AND t.created_at <= a.created_at
     AND NOT EXISTS (
        SELECT 1 FROM trusted_contacts exited
        WHERE exited.owner_account_id = t.owner_account_id
          AND exited.contact_account_id = t.contact_account_id
          AND exited.revocation_reason = 'contact_withdrew'
          AND (
            exited.relationship_sequence > t.relationship_sequence
          )
      )
    WHERE e.alert_id = NEW.alert_id
      AND e.status = 'queued'
      AND a.status = 'active'
      AND r.recipient_account_id = NEW.recipient_account_id
      AND NEW.scheduled_at = e.threshold_reached_at
      AND NEW.created_at >= e.evaluated_at
  ) THEN RAISE(ABORT, 'alert_sms_task_not_eligible') END;
END;

