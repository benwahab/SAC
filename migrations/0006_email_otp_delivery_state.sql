-- SAC — Livraison atomique des codes OTP e-mail
-- Un nouveau défi ne remplace le précédent qu'après acceptation par le fournisseur.
-- Les défis déjà présents lors de cette migration restent considérés comme livrés.

ALTER TABLE email_otp_challenges
  ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'accepted'
  CHECK (delivery_status IN ('pending', 'accepted', 'failed'));

DROP TRIGGER IF EXISTS email_otp_challenge_invalidate_previous;
DROP TRIGGER IF EXISTS email_otp_challenge_guard_update;

-- Toute nouvelle insertion doit déclarer explicitement pending.
-- Le DEFAULT historique 'accepted' ne doit jamais rendre un futur défi
-- vérifiable si un nouvel appelant oublie le champ de livraison.
CREATE TRIGGER email_otp_challenge_insert_pending_guard
BEFORE INSERT ON email_otp_challenges
WHEN NEW.delivery_status <> 'pending'
BEGIN
  SELECT RAISE(ABORT, 'otp_new_challenge_must_start_pending');
END;

-- L'insertion ne révoque plus le code précédent. La révocation intervient
-- uniquement lorsque le fournisseur a accepté le nouvel e-mail.
CREATE TRIGGER email_otp_challenge_invalidate_previous
AFTER UPDATE OF delivery_status ON email_otp_challenges
WHEN OLD.delivery_status = 'pending'
 AND NEW.delivery_status = 'accepted'
BEGIN
  UPDATE email_otp_challenges
  SET invalidated_at = NEW.created_at
  WHERE identity_id = NEW.identity_id
    AND id <> NEW.id
    AND delivery_status = 'accepted'
    AND consumed_at IS NULL
    AND invalidated_at IS NULL;
END;

CREATE TRIGGER email_otp_challenge_guard_update
BEFORE UPDATE ON email_otp_challenges
BEGIN
  SELECT CASE WHEN
    NEW.id <> OLD.id
    OR NEW.account_id <> OLD.account_id
    OR NEW.identity_id <> OLD.identity_id
    OR NEW.purpose <> OLD.purpose
    OR NEW.digest <> OLD.digest
    OR NEW.max_attempts <> OLD.max_attempts
    OR NEW.created_at <> OLD.created_at
    OR NEW.expires_at <> OLD.expires_at
  THEN RAISE(ABORT, 'otp_challenge_immutable_fields') END;

  SELECT CASE WHEN NOT (
    -- Invalidation déclenchée exclusivement par l'acceptation d'un défi
    -- plus récent pour la même identité.
    (
      NEW.delivery_status = OLD.delivery_status
      AND NEW.attempt_count = OLD.attempt_count
      AND NEW.consumed_at IS OLD.consumed_at
      AND OLD.invalidated_at IS NULL
      AND NEW.invalidated_at IS NOT NULL
      AND OLD.delivery_status = 'accepted'
      AND EXISTS (
        SELECT 1 FROM email_otp_challenges newer
        WHERE newer.id <> OLD.id
          AND newer.identity_id = OLD.identity_id
          AND newer.delivery_status = 'accepted'
          AND newer.created_at = NEW.invalidated_at
      )
    )
    OR
    -- Seule transition de livraison autorisée : pending vers accepted/failed.
    (
      OLD.delivery_status = 'pending'
      AND NEW.delivery_status IN ('accepted', 'failed')
      AND NEW.attempt_count = OLD.attempt_count
      AND NEW.consumed_at IS OLD.consumed_at
      AND NEW.invalidated_at IS OLD.invalidated_at
      AND (
        NEW.delivery_status = 'failed'
        OR EXISTS (
          SELECT 1
          FROM accounts a
          JOIN account_identities i ON i.account_id = a.id
          WHERE a.id = OLD.account_id
            AND a.status = 'pending_verification'
            AND i.id = OLD.identity_id
            AND i.channel = 'email'
            AND i.is_primary = 1
            AND i.verified_at IS NULL
        )
      )
    )
    OR
    -- Les tentatives ne peuvent être consommées que sur un code livré.
    (
      OLD.delivery_status = 'accepted'
      AND NEW.delivery_status = 'accepted'
      AND NEW.attempt_count = OLD.attempt_count + 1
      AND OLD.consumed_at IS NULL
      AND OLD.invalidated_at IS NULL
      AND OLD.attempt_count < OLD.max_attempts
      AND (
        NEW.consumed_at IS NULL
        OR (
          NEW.invalidated_at IS NULL
          AND NEW.consumed_at >= OLD.created_at
          AND NEW.consumed_at < OLD.expires_at
        )
      )
      AND (
        NEW.invalidated_at IS NULL
        OR (NEW.consumed_at IS NULL AND NEW.attempt_count = OLD.max_attempts)
      )
    )
  ) THEN RAISE(ABORT, 'otp_invalid_challenge_transition') END;

  SELECT CASE WHEN NEW.consumed_at IS NOT NULL
    AND OLD.consumed_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM accounts a
      JOIN account_identities i ON i.account_id = a.id
      WHERE a.id = OLD.account_id
        AND a.status = 'pending_verification'
        AND i.id = OLD.identity_id
        AND i.channel = 'email'
        AND i.verified_at IS NULL
    )
  THEN RAISE(ABORT, 'otp_account_no_longer_pending') END;
END;
