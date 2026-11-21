-- SAC — attribution initiale et protégée du rôle Super Admin.
-- Le rôle n'est attribué qu'après vérification OTP de l'adresse de bootstrap.
-- Aucun compte ni secret n'est créé par cette migration.

PRAGMA foreign_keys = ON;

CREATE TABLE account_roles (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role = 'super_admin'),
  source_identity_id TEXT NOT NULL,
  grant_reason TEXT NOT NULL CHECK (grant_reason = 'verified_bootstrap_email'),
  granted_at INTEGER NOT NULL CHECK (granted_at > 0),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (account_id, source_identity_id)
    REFERENCES account_identities(account_id, id) ON DELETE RESTRICT,
  UNIQUE (account_id, role)
);

-- SAC ne possède qu'un seul Super Admin initial.
CREATE UNIQUE INDEX account_roles_single_super_admin
  ON account_roles(role);

CREATE INDEX account_roles_account
  ON account_roles(account_id, role);

-- Même un appel SQL interne ne peut attribuer ce rôle à une autre identité,
-- à une adresse non vérifiée ou à une vérification différente de l'OTP.
CREATE TRIGGER account_roles_super_admin_insert_guard
BEFORE INSERT ON account_roles
BEGIN
  SELECT CASE WHEN NEW.role <> 'super_admin'
    THEN RAISE(ABORT, 'account_role_not_allowed') END;

  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM account_identities i
    WHERE i.id = NEW.source_identity_id
      AND i.account_id = NEW.account_id
      AND i.channel = 'email'
      AND i.is_primary = 1
      AND i.verified_at IS NOT NULL
      AND i.verified_at = NEW.granted_at
      AND lower(trim(i.normalized_value)) = 'benwahab111@gmail.com'
      AND NEW.grant_reason = 'verified_bootstrap_email'
  ) THEN RAISE(ABORT, 'super_admin_bootstrap_identity_not_verified') END;
END;

-- Attribution automatique et atomique avec la vérification OTP de l'adresse.
-- La migration ne dépend jamais de l'adresse déclarée dans une requête cliente.
CREATE TRIGGER account_identity_grant_initial_super_admin
AFTER UPDATE OF verified_at ON account_identities
WHEN OLD.verified_at IS NULL
  AND NEW.verified_at IS NOT NULL
  AND NEW.channel = 'email'
  AND NEW.is_primary = 1
  AND lower(trim(NEW.normalized_value)) = 'benwahab111@gmail.com'
BEGIN
  INSERT INTO account_roles
    (id, account_id, role, source_identity_id, grant_reason, granted_at)
  VALUES
    (lower(hex(randomblob(16))), NEW.account_id, 'super_admin',
     NEW.id, 'verified_bootstrap_email', NEW.verified_at);
END;

-- Rattrapage idempotent si la migration est appliquée après une vérification
-- déjà terminée. Le compte doit toujours prouver la même identité vérifiée.
INSERT OR IGNORE INTO account_roles
  (id, account_id, role, source_identity_id, grant_reason, granted_at)
SELECT
  lower(hex(randomblob(16))),
  i.account_id,
  'super_admin',
  i.id,
  'verified_bootstrap_email',
  i.verified_at
FROM account_identities i
JOIN accounts a ON a.id = i.account_id
WHERE i.channel = 'email'
  AND i.is_primary = 1
  AND i.verified_at IS NOT NULL
  AND lower(trim(i.normalized_value)) = 'benwahab111@gmail.com'
  AND a.status = 'active';
