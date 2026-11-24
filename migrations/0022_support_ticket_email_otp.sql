-- SAC — défis OTP dédiés à la création de ticket d'assistance sans session.
-- Ce flux prouve le contrôle de l'adresse e-mail, pas l'identité civile ni le droit de réinitialiser un compte.
PRAGMA foreign_keys = ON;

CREATE TABLE support_ticket_intake_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  normalized_email TEXT NOT NULL CHECK (length(normalized_email) BETWEEN 5 AND 254),
  request_ip_hash TEXT NOT NULL CHECK (length(request_ip_hash) = 64 AND request_ip_hash NOT GLOB '*[^a-f0-9]*'),
  digest TEXT NOT NULL CHECK (length(digest) = 64 AND digest NOT GLOB '*[^a-f0-9]*'),
  created_ticket_id TEXT UNIQUE,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 6),
  max_attempts INTEGER NOT NULL DEFAULT 6 CHECK (max_attempts = 6),
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('pending','accepted','failed')),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  consumed_at INTEGER,
  invalidated_at INTEGER,
  CHECK (consumed_at IS NULL OR invalidated_at IS NULL)
);

CREATE INDEX support_intake_email_created
  ON support_ticket_intake_challenges(normalized_email, created_at DESC);

CREATE TRIGGER support_intake_challenge_insert_guard
BEFORE INSERT ON support_ticket_intake_challenges
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM support_ticket_intake_challenges previous
    WHERE previous.normalized_email = NEW.normalized_email
      AND previous.created_at > NEW.created_at - 60000
  ) THEN RAISE(ABORT, 'support_intake_otp_cooldown') END;
  SELECT CASE WHEN (
    SELECT COUNT(*) FROM support_ticket_intake_challenges previous
    WHERE previous.normalized_email = NEW.normalized_email
      AND previous.created_at > NEW.created_at - 3600000
  ) >= 5 THEN RAISE(ABORT, 'support_intake_otp_rate_limited') END;
  SELECT CASE WHEN NEW.delivery_status <> 'pending'
    THEN RAISE(ABORT, 'support_intake_otp_must_start_pending') END;
  SELECT CASE WHEN (
    SELECT COUNT(*) FROM support_ticket_intake_challenges previous
    WHERE previous.request_ip_hash = NEW.request_ip_hash
      AND previous.created_at > NEW.created_at - 3600000
  ) >= 10 THEN RAISE(ABORT, 'support_intake_ip_rate_limited') END;
END;

CREATE TRIGGER support_intake_challenge_update_guard
BEFORE UPDATE ON support_ticket_intake_challenges
BEGIN
  SELECT CASE WHEN NEW.id <> OLD.id OR NEW.normalized_email <> OLD.normalized_email
    OR NEW.request_ip_hash <> OLD.request_ip_hash OR NEW.digest <> OLD.digest OR NEW.max_attempts <> OLD.max_attempts
    OR NEW.created_at <> OLD.created_at OR NEW.expires_at <> OLD.expires_at
    THEN RAISE(ABORT, 'support_intake_otp_immutable_fields') END;
  SELECT CASE WHEN NOT (
    (OLD.delivery_status = 'pending' AND NEW.delivery_status IN ('accepted','failed')
      AND NEW.attempt_count = OLD.attempt_count
      AND NEW.consumed_at IS OLD.consumed_at AND NEW.invalidated_at IS OLD.invalidated_at
      AND NEW.created_ticket_id IS OLD.created_ticket_id)
    OR
    (OLD.delivery_status = 'accepted' AND NEW.delivery_status = 'accepted'
      AND NEW.attempt_count = OLD.attempt_count + 1
      AND OLD.attempt_count < OLD.max_attempts
      AND OLD.consumed_at IS NULL AND OLD.invalidated_at IS NULL
      AND (NEW.consumed_at IS NULL OR (NEW.consumed_at >= OLD.created_at AND NEW.consumed_at < OLD.expires_at))
      AND NEW.invalidated_at IS OLD.invalidated_at
      AND ((NEW.consumed_at IS NULL AND NEW.created_ticket_id IS OLD.created_ticket_id)
        OR (NEW.consumed_at IS NOT NULL AND OLD.created_ticket_id IS NULL AND NEW.created_ticket_id IS NOT NULL)))
  ) THEN RAISE(ABORT, 'support_intake_otp_invalid_transition') END;
END;

CREATE TRIGGER support_intake_challenge_no_delete
BEFORE DELETE ON support_ticket_intake_challenges
BEGIN
  SELECT RAISE(ABORT, 'support_intake_otp_retained_for_audit');
END;
