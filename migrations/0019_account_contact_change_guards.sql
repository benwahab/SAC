-- SAC — Autoriser le changement contrôlé d'e-mail/téléphone par défi consommé.
-- Les triggers d'origine interdisaient toute réécriture d'identité. Ils sont
-- remplacés pour n'autoriser que la valeur exacte d'un défi consommé.

PRAGMA foreign_keys = ON;

DROP TRIGGER account_identity_immutable_fields;
CREATE TRIGGER account_identity_immutable_fields
BEFORE UPDATE ON account_identities
BEGIN
  SELECT CASE WHEN
    NEW.id <> OLD.id
    OR NEW.account_id <> OLD.account_id
    OR NEW.channel <> OLD.channel
    OR NEW.is_primary <> OLD.is_primary
    OR NEW.created_at <> OLD.created_at
  THEN RAISE(ABORT, 'account_identity_immutable_fields') END;

  SELECT CASE WHEN NEW.normalized_value <> OLD.normalized_value AND NOT EXISTS (
    SELECT 1
    FROM account_contact_change_challenges c
    WHERE c.account_id = OLD.account_id
      AND c.identity_id = OLD.id
      AND c.channel = OLD.channel
      AND c.new_value = NEW.normalized_value
      AND c.consumed_at IS NOT NULL
      AND c.delivery_status = 'accepted'
      AND c.consumed_at >= OLD.created_at
      AND c.consumed_at <= c.expires_at
      AND (
        (OLD.channel = 'email' AND NEW.verified_at = c.consumed_at)
        OR (OLD.channel = 'phone' AND NEW.verified_at IS NULL)
      )
  ) THEN RAISE(ABORT, 'identity_change_requires_consumed_challenge') END;
END;

DROP TRIGGER account_identity_verification_guard;
CREATE TRIGGER account_identity_verification_guard
BEFORE UPDATE OF verified_at ON account_identities
BEGIN
  SELECT CASE WHEN NEW.channel = 'phone' AND NEW.verified_at IS NOT NULL
    THEN RAISE(ABORT, 'phone_identity_verification_not_supported') END;

  SELECT CASE WHEN OLD.verified_at IS NOT NULL AND NEW.verified_at IS NOT OLD.verified_at AND NOT EXISTS (
    SELECT 1
    FROM account_contact_change_challenges c
    WHERE c.account_id = NEW.account_id
      AND c.identity_id = NEW.id
      AND c.channel = NEW.channel
      AND c.new_value = NEW.normalized_value
      AND c.delivery_status = 'accepted'
      AND c.consumed_at = NEW.verified_at
      AND c.consumed_at <= c.expires_at
  ) THEN RAISE(ABORT, 'identity_verification_is_immutable') END;

  SELECT CASE WHEN OLD.verified_at IS NULL AND NEW.verified_at IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM email_otp_challenges c
    WHERE c.account_id = NEW.account_id
      AND c.identity_id = NEW.id
      AND c.purpose = 'account_email_verification'
      AND c.consumed_at = NEW.verified_at
    UNION ALL
    SELECT 1
    FROM account_contact_change_challenges c
    WHERE c.account_id = NEW.account_id
      AND c.identity_id = NEW.id
      AND c.channel = NEW.channel
      AND c.new_value = NEW.normalized_value
      AND c.delivery_status = 'accepted'
      AND c.consumed_at = NEW.verified_at
      AND c.consumed_at <= c.expires_at
  ) THEN RAISE(ABORT, 'email_identity_requires_consumed_otp') END;
END;
