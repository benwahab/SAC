-- SAC — Enrôlement racine facultatif après une session e-mail + mot de passe.
--
-- Un appareil provisoire peut exister sans credential WebAuthn. La cérémonie
-- d'enrôlement reste interdite dès qu'un credential racine existe pour le compte.

PRAGMA foreign_keys = ON;

DROP TRIGGER IF EXISTS root_enrollment_account_guard;

CREATE TRIGGER root_enrollment_account_guard
BEFORE INSERT ON root_enrollment_ceremonies
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM accounts a
    JOIN account_identities i ON i.account_id = a.id
    WHERE a.id = NEW.account_id AND a.status = 'active'
      AND i.channel = 'email' AND i.is_primary = 1 AND i.verified_at IS NOT NULL
  ) THEN RAISE(ABORT, 'root_enrollment_account_not_verified') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1
    FROM devices d
    JOIN device_root_credentials rc
      ON rc.device_id = d.id AND rc.account_id = d.account_id
    WHERE d.account_id = NEW.account_id
  ) THEN RAISE(ABORT, 'root_device_already_enrolled') END;
END;
