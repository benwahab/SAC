-- SAC — Invitations de proches et relations directionnelles
-- Horodatages en millisecondes Unix UTC.
-- Aucun délai d'expiration par défaut : expires_at est fourni par le service
-- après validation de la politique produit. Aucun quota n'est inventé ici.

PRAGMA foreign_keys = ON;

CREATE TABLE contact_invitations (
  id TEXT PRIMARY KEY NOT NULL,
  inviter_account_id TEXT NOT NULL,
  destination_email TEXT NOT NULL CHECK (
    length(destination_email) BETWEEN 3 AND 254
    AND destination_email = lower(trim(destination_email))
    AND instr(destination_email, ' ') = 0
    AND instr(destination_email, '@') > 1
  ),
  recipient_account_id TEXT,
  token_digest TEXT NOT NULL UNIQUE CHECK (
    length(token_digest) = 64 AND token_digest NOT GLOB '*[^a-f0-9]*'
  ),
  permission_version TEXT NOT NULL CHECK (length(trim(permission_version)) BETWEEN 1 AND 128),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  decided_at INTEGER,
  FOREIGN KEY (inviter_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (recipient_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CHECK (
    (status = 'pending' AND recipient_account_id IS NULL AND decided_at IS NULL)
    OR
    (status IN ('accepted', 'declined') AND recipient_account_id IS NOT NULL
      AND decided_at IS NOT NULL AND decided_at >= created_at AND decided_at < expires_at)
    OR
    (status IN ('revoked', 'expired') AND recipient_account_id IS NULL
      AND decided_at IS NOT NULL AND decided_at >= created_at)
  ),
  CHECK (recipient_account_id IS NULL OR recipient_account_id <> inviter_account_id)
);

CREATE UNIQUE INDEX contact_invitations_one_pending_destination
  ON contact_invitations(inviter_account_id, destination_email)
  WHERE status = 'pending';

CREATE INDEX contact_invitations_inbox
  ON contact_invitations(destination_email, status, created_at DESC);

CREATE INDEX contact_invitations_inviter
  ON contact_invitations(inviter_account_id, status, created_at DESC);

CREATE TABLE trusted_contacts (
  owner_account_id TEXT NOT NULL,
  contact_account_id TEXT NOT NULL,
  invitation_id TEXT NOT NULL UNIQUE,
  permission_version TEXT NOT NULL CHECK (length(trim(permission_version)) BETWEEN 1 AND 128),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  revoked_at INTEGER,
  PRIMARY KEY (owner_account_id, contact_account_id),
  FOREIGN KEY (owner_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (contact_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (invitation_id) REFERENCES contact_invitations(id) ON DELETE RESTRICT,
  CHECK (owner_account_id <> contact_account_id),
  CHECK (
    (status = 'active' AND revoked_at IS NULL)
    OR (status = 'revoked' AND revoked_at IS NOT NULL AND revoked_at >= created_at)
  )
);

CREATE INDEX trusted_contacts_owner_status
  ON trusted_contacts(owner_account_id, status, created_at DESC);

CREATE INDEX trusted_contacts_contact_status
  ON trusted_contacts(contact_account_id, status, created_at DESC);

-- Les éléments d'identité et de preuve d'une invitation sont immuables.
-- Seule une transition depuis pending vers un état terminal est admise.
CREATE TRIGGER contact_invitation_guard_update
BEFORE UPDATE ON contact_invitations
BEGIN
  SELECT CASE WHEN
    NEW.id <> OLD.id
    OR NEW.inviter_account_id <> OLD.inviter_account_id
    OR NEW.destination_email <> OLD.destination_email
    OR NEW.token_digest <> OLD.token_digest
    OR NEW.permission_version <> OLD.permission_version
    OR NEW.created_at <> OLD.created_at
    OR NEW.expires_at <> OLD.expires_at
  THEN RAISE(ABORT, 'contact_invitation_immutable_fields') END;

  SELECT CASE WHEN OLD.status <> 'pending'
    THEN RAISE(ABORT, 'contact_invitation_terminal_state') END;

  SELECT CASE WHEN NEW.status NOT IN ('accepted', 'declined', 'revoked', 'expired')
    THEN RAISE(ABORT, 'contact_invitation_invalid_transition') END;

  SELECT CASE WHEN NEW.status IN ('accepted', 'declined') AND NOT EXISTS (
    SELECT 1
    FROM accounts a
    JOIN account_identities i ON i.account_id = a.id
    WHERE a.id = NEW.recipient_account_id
      AND a.status = 'active'
      AND i.channel = 'email'
      AND i.is_primary = 1
      AND i.verified_at IS NOT NULL
      AND i.normalized_value = OLD.destination_email
  ) THEN RAISE(ABORT, 'contact_invitation_recipient_not_eligible') END;

  SELECT CASE WHEN NEW.status = 'expired' AND NEW.decided_at < OLD.expires_at
    THEN RAISE(ABORT, 'contact_invitation_not_yet_expired') END;

  SELECT CASE WHEN NEW.status IN ('accepted', 'declined') AND NEW.decided_at >= OLD.expires_at
    THEN RAISE(ABORT, 'contact_invitation_expired') END;
END;

-- Une invitation acceptée ne peut créer qu'une relation directionnelle
-- correspondant exactement à l'invitation et à sa version de permissions.
CREATE TRIGGER trusted_contact_insert_guard
BEFORE INSERT ON trusted_contacts
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM contact_invitations i
    WHERE i.id = NEW.invitation_id
      AND i.status = 'accepted'
      AND i.inviter_account_id = NEW.owner_account_id
      AND i.recipient_account_id = NEW.contact_account_id
      AND i.permission_version = NEW.permission_version
      AND i.decided_at = NEW.created_at
  ) THEN RAISE(ABORT, 'trusted_contact_requires_matching_acceptance') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM trusted_contacts t
    WHERE t.owner_account_id = NEW.owner_account_id
      AND t.contact_account_id = NEW.contact_account_id
  ) THEN RAISE(ABORT, 'trusted_contact_relationship_already_exists') END;
END;

-- Une relation ne peut être réactivée après révocation.
CREATE TRIGGER trusted_contact_guard_update
BEFORE UPDATE ON trusted_contacts
BEGIN
  SELECT CASE WHEN
    NEW.owner_account_id <> OLD.owner_account_id
    OR NEW.contact_account_id <> OLD.contact_account_id
    OR NEW.invitation_id <> OLD.invitation_id
    OR NEW.permission_version <> OLD.permission_version
    OR NEW.created_at <> OLD.created_at
  THEN RAISE(ABORT, 'trusted_contact_immutable_fields') END;

  SELECT CASE WHEN OLD.status <> 'active'
    THEN RAISE(ABORT, 'trusted_contact_already_revoked') END;

  SELECT CASE WHEN NEW.status <> 'revoked' OR NEW.revoked_at IS NULL OR NEW.revoked_at < OLD.created_at
    THEN RAISE(ABORT, 'trusted_contact_invalid_transition') END;
END;
