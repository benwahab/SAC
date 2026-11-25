-- SAC — Retrait d'un proche : révocation immédiate de tous les accès SOS.
-- Le snapshot des destinataires reste immuable pour l'audit ; les droits courants
-- sont toujours vérifiés contre trusted_contacts.status = 'active'.

PRAGMA foreign_keys = ON;

ALTER TABLE trusted_contacts
  ADD COLUMN revocation_reason TEXT
  CHECK (revocation_reason IS NULL OR revocation_reason IN ('owner_revoked', 'contact_withdrew'));

ALTER TABLE trusted_contacts
  ADD COLUMN revoked_by_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT;

-- Les relations déjà révoquées avant cette migration l'ont été par leur propriétaire.
-- Conserver leur comportement historique pour les SOS déjà actifs.
DROP TRIGGER trusted_contact_guard_update;
UPDATE trusted_contacts
SET revocation_reason = 'owner_revoked',
    revoked_by_account_id = owner_account_id
WHERE status = 'revoked' AND revocation_reason IS NULL;

CREATE INDEX trusted_contacts_active_recipient
  ON trusted_contacts(contact_account_id, owner_account_id)
  WHERE status = 'active';

CREATE TRIGGER trusted_contacts_revocation_guard
BEFORE UPDATE ON trusted_contacts
BEGIN
  SELECT CASE WHEN
    NEW.owner_account_id <> OLD.owner_account_id
    OR NEW.contact_account_id <> OLD.contact_account_id
    OR NEW.invitation_id <> OLD.invitation_id
    OR NEW.permission_version <> OLD.permission_version
    OR NEW.created_at <> OLD.created_at
  THEN RAISE(ABORT, 'trusted_contact_identity_immutable') END;

  SELECT CASE WHEN OLD.status <> 'active'
    THEN RAISE(ABORT, 'trusted_contact_terminal_state') END;

  SELECT CASE WHEN NEW.status <> 'revoked'
    OR NEW.revoked_at IS NULL
    OR NEW.revoked_at < OLD.created_at
    OR NEW.revocation_reason NOT IN ('owner_revoked', 'contact_withdrew')
    OR NEW.revoked_by_account_id IS NULL
    OR NOT (
      (NEW.revocation_reason = 'owner_revoked'
        AND NEW.revoked_by_account_id = OLD.owner_account_id)
      OR
      (NEW.revocation_reason = 'contact_withdrew'
        AND NEW.revoked_by_account_id = OLD.contact_account_id)
    )
  THEN RAISE(ABORT, 'trusted_contact_revocation_not_authorized') END;
END;

-- L'événement de retrait est append-only. Une fois la relation révoquée,
-- aucun nouvel événement fonctionnel ne peut être ajouté par l'ancien proche.
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
             AND (t.status = 'active' OR (t.status = 'revoked' AND t.revocation_reason = 'owner_revoked'))
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
              AND t.revoked_by_account_id IS NOT NULL
          ))
      )
  ) THEN RAISE(ABORT, 'alert_event_not_authorized_or_out_of_order') END;

  SELECT CASE WHEN NEW.event_type = 'volunteered' AND EXISTS (
    SELECT 1 FROM alert_events e
    WHERE e.alert_id = NEW.alert_id AND e.server_sequence = NEW.server_sequence
  ) THEN RAISE(ABORT, 'alert_volunteer_sequence_duplicate') END;
END;

-- Une révocation coupe les rappels déjà en attente/en cours, les tâches SMS
-- déjà mises en file et tous les tickets GPS encore non consommés.
CREATE TRIGGER trusted_contacts_revoke_access
AFTER UPDATE OF status ON trusted_contacts
WHEN OLD.status = 'active' AND NEW.status = 'revoked'
  AND NEW.revocation_reason = 'contact_withdrew'
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
  WHERE a.author_account_id = NEW.owner_account_id
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
    AND e.server_sequence = (
      SELECT MIN(candidate.server_sequence)
      FROM alert_events candidate
      WHERE candidate.alert_id = e.alert_id
        AND candidate.event_type = 'volunteered'
        AND candidate.actor_account_id <> NEW.contact_account_id
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

-- Le snapshot d'origine ne change pas, mais il n'autorise plus la création
-- de rappels ni l'envoi d'une tâche SMS après la révocation.
DROP TRIGGER alert_reminder_insert_guard;
CREATE TRIGGER alert_reminder_insert_guard
BEFORE INSERT ON alert_reminder_outbox
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM alerts a
    JOIN trusted_contacts t
      ON t.owner_account_id = a.author_account_id
     AND t.contact_account_id = NEW.recipient_account_id
     AND (t.status = 'active' OR (t.status = 'revoked' AND t.revocation_reason = 'owner_revoked'))
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
     AND (t.status = 'active' OR (t.status = 'revoked' AND t.revocation_reason = 'owner_revoked'))
    WHERE e.alert_id = NEW.alert_id
      AND e.status = 'queued'
      AND a.status = 'active'
      AND r.recipient_account_id = NEW.recipient_account_id
      AND NEW.scheduled_at = e.threshold_reached_at
      AND NEW.created_at >= e.evaluated_at
  ) THEN RAISE(ABORT, 'alert_sms_task_not_eligible') END;
END;

-- Un destinataire qui a quitté le cercle compte comme traité pour le seuil,
-- mais ne reçoit jamais de tâche SMS.
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
          AND r.status IN ('sent', 'failed', 'cancelled')
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
