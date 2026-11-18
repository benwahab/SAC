-- SAC — Comptes initiaux et défis de vérification e-mail
-- Périmètre volontairement limité à l'inscription et à l'OTP e-mail.
-- Horodatages stockés en millisecondes Unix UTC.

PRAGMA foreign_keys = ON;

CREATE TABLE accounts (
  id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'pending_verification', 'active', 'suspended', 'deletion_pending', 'deleted'
  )),
  preferred_language TEXT NOT NULL CHECK (preferred_language IN ('fr', 'en', 'ar')),
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
);

CREATE TABLE account_identities (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'phone')),
  normalized_value TEXT NOT NULL,
  verified_at INTEGER,
  is_primary INTEGER NOT NULL DEFAULT 1 CHECK (is_primary IN (0, 1)),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  UNIQUE (channel, normalized_value),
  UNIQUE (account_id, id),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CHECK (verified_at IS NULL OR verified_at >= created_at)
);

CREATE UNIQUE INDEX account_identities_one_primary_channel
  ON account_identities(account_id, channel)
  WHERE is_primary = 1;

CREATE INDEX account_identities_account_channel
  ON account_identities(account_id, channel);

CREATE TABLE email_otp_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  identity_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose = 'account_email_verification'),
  digest TEXT NOT NULL CHECK (length(digest) = 64 AND digest NOT GLOB '*[^a-f0-9]*'),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 6),
  max_attempts INTEGER NOT NULL DEFAULT 6 CHECK (max_attempts = 6),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  consumed_at INTEGER,
  invalidated_at INTEGER,
  UNIQUE (id, account_id),
  FOREIGN KEY (account_id, identity_id)
    REFERENCES account_identities(account_id, id) ON DELETE RESTRICT,
  CHECK (consumed_at IS NULL OR invalidated_at IS NULL),
  CHECK (consumed_at IS NULL OR consumed_at >= created_at),
  CHECK (invalidated_at IS NULL OR invalidated_at >= created_at)
);

CREATE INDEX email_otp_challenges_identity_created
  ON email_otp_challenges(identity_id, created_at DESC);

CREATE INDEX email_otp_challenges_account_created
  ON email_otp_challenges(account_id, created_at DESC);

-- Refuse un défi qui ne concerne pas l'adresse e-mail principale d'un compte
-- encore en attente de vérification.
CREATE TRIGGER email_otp_challenge_validate_insert
BEFORE INSERT ON email_otp_challenges
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM accounts a
    JOIN account_identities i ON i.account_id = a.id
    WHERE a.id = NEW.account_id
      AND a.status = 'pending_verification'
      AND i.id = NEW.identity_id
      AND i.channel = 'email'
      AND i.is_primary = 1
      AND i.verified_at IS NULL
  ) THEN RAISE(ABORT, 'otp_account_or_identity_not_eligible') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1
    FROM email_otp_challenges previous
    WHERE previous.identity_id = NEW.identity_id
      AND previous.created_at > NEW.created_at - 60000
  ) THEN RAISE(ABORT, 'otp_resend_cooldown') END;
END;

-- L'insertion réussie d'un nouveau défi invalide l'ancien dans la même
-- transaction SQLite. Si l'insertion échoue, l'invalidation est annulée.
CREATE TRIGGER email_otp_challenge_invalidate_previous
AFTER INSERT ON email_otp_challenges
BEGIN
  UPDATE email_otp_challenges
  SET invalidated_at = NEW.created_at
  WHERE identity_id = NEW.identity_id
    AND id <> NEW.id
    AND consumed_at IS NULL
    AND invalidated_at IS NULL;
END;

-- Les données d'identité du défi et son empreinte sont immuables.
-- Chaque tentative admissible consomme exactement une unité.
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

  -- Seule exception sans tentative : invalidation provoquée par l'insertion
  -- d'un nouveau défi pour la même identité.
  SELECT CASE WHEN NOT (
    (
      NEW.attempt_count = OLD.attempt_count
      AND NEW.consumed_at IS OLD.consumed_at
      AND OLD.invalidated_at IS NULL
      AND NEW.invalidated_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM email_otp_challenges newer
        WHERE newer.id <> OLD.id
          AND newer.identity_id = OLD.identity_id
          AND newer.created_at = NEW.invalidated_at
      )
    )
    OR
    (
      NEW.attempt_count = OLD.attempt_count + 1
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

  SELECT CASE WHEN NEW.consumed_at IS NOT NULL AND OLD.consumed_at IS NULL AND NOT EXISTS (
    SELECT 1
    FROM accounts a
    JOIN account_identities i ON i.account_id = a.id
    WHERE a.id = OLD.account_id
      AND a.status = 'pending_verification'
      AND i.id = OLD.identity_id
      AND i.channel = 'email'
      AND i.verified_at IS NULL
  ) THEN RAISE(ABORT, 'otp_account_no_longer_pending') END;
END;

-- La vérification réussie consomme le défi, vérifie l'identité e-mail
-- et active le compte dans la même transaction SQLite.
CREATE TRIGGER email_otp_challenge_activate_account
AFTER UPDATE OF consumed_at ON email_otp_challenges
WHEN OLD.consumed_at IS NULL AND NEW.consumed_at IS NOT NULL
BEGIN
  UPDATE account_identities
  SET verified_at = NEW.consumed_at
  WHERE id = NEW.identity_id
    AND account_id = NEW.account_id
    AND channel = 'email'
    AND verified_at IS NULL;

  UPDATE accounts
  SET status = 'active',
      updated_at = NEW.consumed_at
  WHERE id = NEW.account_id
    AND status = 'pending_verification'
    AND EXISTS (
      SELECT 1
      FROM account_identities i
      WHERE i.id = NEW.identity_id
        AND i.account_id = NEW.account_id
        AND i.channel = 'email'
        AND i.verified_at = NEW.consumed_at
    );
END;

-- Une identité e-mail ne peut être vérifiée que par la consommation d'un
-- défi OTP correspondant. Le téléphone reste non vérifié dans ce parcours.
CREATE TRIGGER account_identity_verification_guard
BEFORE UPDATE OF verified_at ON account_identities
BEGIN
  SELECT CASE WHEN NEW.channel = 'phone' AND NEW.verified_at IS NOT NULL
    THEN RAISE(ABORT, 'phone_identity_verification_not_supported') END;

  SELECT CASE WHEN OLD.verified_at IS NOT NULL AND NEW.verified_at IS NOT OLD.verified_at
    THEN RAISE(ABORT, 'identity_verification_is_immutable') END;

  SELECT CASE WHEN OLD.verified_at IS NULL AND NEW.verified_at IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM email_otp_challenges c
    WHERE c.account_id = NEW.account_id
      AND c.identity_id = NEW.id
      AND c.purpose = 'account_email_verification'
      AND c.consumed_at = NEW.verified_at
  ) THEN RAISE(ABORT, 'email_identity_requires_consumed_otp') END;
END;

-- Aucun code serveur ne peut activer un compte en contournant la preuve e-mail.
CREATE TRIGGER account_activation_requires_verified_email
BEFORE UPDATE OF status ON accounts
WHEN OLD.status = 'pending_verification' AND NEW.status = 'active'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM account_identities i
    JOIN email_otp_challenges c
      ON c.account_id = i.account_id
     AND c.identity_id = i.id
     AND c.consumed_at = i.verified_at
    WHERE i.account_id = NEW.id
      AND i.channel = 'email'
      AND i.is_primary = 1
      AND i.verified_at IS NOT NULL
      AND c.purpose = 'account_email_verification'
  ) THEN RAISE(ABORT, 'account_activation_requires_email_otp') END;
END;

-- Les coordonnées déclarées ne peuvent pas être réécrites silencieusement.
-- Un changement d'adresse/numéro devra passer par un futur flux dédié.
CREATE TRIGGER account_identity_immutable_fields
BEFORE UPDATE ON account_identities
BEGIN
  SELECT CASE WHEN
    NEW.id <> OLD.id
    OR NEW.account_id <> OLD.account_id
    OR NEW.channel <> OLD.channel
    OR NEW.normalized_value <> OLD.normalized_value
    OR NEW.is_primary <> OLD.is_primary
    OR NEW.created_at <> OLD.created_at
  THEN RAISE(ABORT, 'account_identity_immutable_fields') END;
END;

-- Toute création de compte commence obligatoirement en attente de vérification.
CREATE TRIGGER accounts_initial_state_guard
BEFORE INSERT ON accounts
WHEN NEW.status <> 'pending_verification'
BEGIN
  SELECT RAISE(ABORT, 'account_must_start_pending_verification');
END;
