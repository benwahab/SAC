-- Lie chaque consommation d'un défi WebAuthn à une tentative de création de session unique.
-- Empêche une validation concurrente de créer une session orpheline non remise au client.

ALTER TABLE root_authentication_challenges
  ADD COLUMN consumed_by_request_id TEXT
  CHECK (
    consumed_by_request_id IS NULL OR (
      length(consumed_by_request_id) = 36
      AND substr(consumed_by_request_id, 9, 1) = '-'
      AND substr(consumed_by_request_id, 14, 1) = '-'
      AND substr(consumed_by_request_id, 19, 1) = '-'
      AND substr(consumed_by_request_id, 24, 1) = '-'
      AND consumed_by_request_id NOT GLOB '*[^0-9a-f-]*'
    )
  );

CREATE UNIQUE INDEX root_authentication_challenge_claim_unique
  ON root_authentication_challenges(consumed_by_request_id)
  WHERE consumed_by_request_id IS NOT NULL;

CREATE TRIGGER root_authentication_challenge_claim_guard
BEFORE UPDATE ON root_authentication_challenges
BEGIN
  SELECT CASE WHEN NEW.consumed_by_request_id IS NOT OLD.consumed_by_request_id
    AND NOT (
      OLD.consumed_by_request_id IS NULL
      AND NEW.consumed_by_request_id IS NOT NULL
      AND OLD.consumed_at IS NULL
      AND NEW.consumed_at IS NOT NULL
    )
    THEN RAISE(ABORT, 'root_authentication_challenge_claim_immutable') END;

  SELECT CASE WHEN NEW.consumed_at IS NOT NULL
    AND NEW.consumed_by_request_id IS NULL
    THEN RAISE(ABORT, 'root_authentication_challenge_claim_required') END;
END;
