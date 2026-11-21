-- SAC — Profils, confidentialité, annuaire et relations réciproques « Mes proches »
-- Horodatages en millisecondes Unix UTC.

PRAGMA foreign_keys = ON;

CREATE TABLE account_profiles (
  account_id TEXT PRIMARY KEY NOT NULL,
  first_name TEXT NOT NULL CHECK (length(trim(first_name)) BETWEEN 1 AND 80),
  last_name TEXT NOT NULL CHECK (length(trim(last_name)) BETWEEN 1 AND 80),
  photo_mime TEXT CHECK (photo_mime IN ('image/jpeg', 'image/png', 'image/webp')),
  photo_data TEXT,
  photo_version INTEGER NOT NULL DEFAULT 0 CHECK (photo_version >= 0),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CHECK (
    (photo_mime IS NULL AND photo_data IS NULL)
    OR (photo_mime IS NOT NULL AND photo_data IS NOT NULL AND length(photo_data) BETWEEN 1 AND 400000)
  )
);

CREATE INDEX account_profiles_name_order
  ON account_profiles(last_name, first_name, account_id);

CREATE TABLE account_privacy_settings (
  account_id TEXT PRIMARY KEY NOT NULL,
  search_by_name INTEGER NOT NULL DEFAULT 0 CHECK (search_by_name IN (0, 1)),
  search_by_email INTEGER NOT NULL DEFAULT 0 CHECK (search_by_email IN (0, 1)),
  photo_visible_in_search INTEGER NOT NULL DEFAULT 0 CHECK (photo_visible_in_search IN (0, 1)),
  photo_visible_to_contacts INTEGER NOT NULL DEFAULT 1 CHECK (photo_visible_to_contacts IN (0, 1)),
  updated_at INTEGER NOT NULL CHECK (updated_at > 0),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
);

CREATE TABLE proximity_invitations (
  id TEXT PRIMARY KEY NOT NULL,
  inviter_account_id TEXT NOT NULL,
  recipient_account_id TEXT NOT NULL,
  pair_key TEXT NOT NULL CHECK (length(pair_key) BETWEEN 3 AND 257),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  decided_at INTEGER,
  FOREIGN KEY (inviter_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (recipient_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CHECK (inviter_account_id <> recipient_account_id),
  CHECK (
    (status = 'pending' AND decided_at IS NULL)
    OR (status IN ('accepted', 'declined', 'cancelled', 'expired') AND decided_at IS NOT NULL AND decided_at >= created_at)
  )
);

CREATE UNIQUE INDEX proximity_invitations_one_pending_pair
  ON proximity_invitations(pair_key)
  WHERE status = 'pending';

CREATE INDEX proximity_invitations_inbox
  ON proximity_invitations(recipient_account_id, status, created_at DESC);

CREATE INDEX proximity_invitations_outbox
  ON proximity_invitations(inviter_account_id, status, created_at DESC);

CREATE TABLE close_relations (
  id TEXT PRIMARY KEY NOT NULL,
  account_low_id TEXT NOT NULL,
  account_high_id TEXT NOT NULL,
  invitation_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  removed_at INTEGER,
  removed_by_account_id TEXT,
  FOREIGN KEY (account_low_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (account_high_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (invitation_id) REFERENCES proximity_invitations(id) ON DELETE RESTRICT,
  FOREIGN KEY (removed_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CHECK (account_low_id < account_high_id),
  CHECK (
    (status = 'active' AND removed_at IS NULL AND removed_by_account_id IS NULL)
    OR (status = 'removed' AND removed_at IS NOT NULL AND removed_by_account_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX close_relations_one_active_pair
  ON close_relations(account_low_id, account_high_id)
  WHERE status = 'active';

CREATE INDEX close_relations_low
  ON close_relations(account_low_id, status, created_at DESC);

CREATE INDEX close_relations_high
  ON close_relations(account_high_id, status, created_at DESC);

CREATE TABLE close_relation_permissions (
  relation_id TEXT NOT NULL,
  grantor_account_id TEXT NOT NULL,
  grantee_account_id TEXT NOT NULL,
  permission_key TEXT NOT NULL CHECK (permission_key IN ('profile_photo', 'contact_details')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  granted_at INTEGER NOT NULL CHECK (granted_at > 0),
  revoked_at INTEGER,
  updated_at INTEGER NOT NULL CHECK (updated_at >= granted_at),
  PRIMARY KEY (relation_id, grantor_account_id, permission_key),
  FOREIGN KEY (relation_id) REFERENCES close_relations(id) ON DELETE RESTRICT,
  FOREIGN KEY (grantor_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (grantee_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CHECK (grantor_account_id <> grantee_account_id),
  CHECK (
    (status = 'active' AND revoked_at IS NULL)
    OR (status = 'revoked' AND revoked_at IS NOT NULL AND revoked_at >= granted_at)
  )
);

CREATE INDEX close_relation_permissions_grantee
  ON close_relation_permissions(grantee_account_id, status);

CREATE TABLE account_contact_change_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  identity_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'phone')),
  purpose TEXT NOT NULL CHECK (purpose IN ('account_email_change', 'account_phone_change')),
  new_value TEXT NOT NULL CHECK (length(new_value) BETWEEN 3 AND 254),
  delivery_target TEXT NOT NULL CHECK (length(delivery_target) BETWEEN 3 AND 254),
  digest TEXT NOT NULL CHECK (length(digest) = 64 AND digest NOT GLOB '*[^a-f0-9]*'),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 6),
  max_attempts INTEGER NOT NULL DEFAULT 6 CHECK (max_attempts = 6),
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'accepted', 'failed')),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  consumed_at INTEGER,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (account_id, identity_id) REFERENCES account_identities(account_id, id) ON DELETE RESTRICT,
  CHECK (
    (channel = 'email' AND purpose = 'account_email_change')
    OR (channel = 'phone' AND purpose = 'account_phone_change')
  ),
  CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);

CREATE INDEX account_contact_change_challenges_account
  ON account_contact_change_challenges(account_id, created_at DESC);

CREATE TRIGGER account_contact_change_challenge_insert_guard
BEFORE INSERT ON account_contact_change_challenges
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM accounts a
    JOIN account_identities i ON i.account_id = a.id
    WHERE a.id = NEW.account_id
      AND a.status = 'active'
      AND i.id = NEW.identity_id
      AND i.channel = NEW.channel
      AND i.is_primary = 1
      AND (NEW.channel = 'phone' OR i.verified_at IS NOT NULL)
  ) THEN RAISE(ABORT, 'contact_change_identity_not_eligible') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM account_contact_change_challenges previous
    WHERE previous.identity_id = NEW.identity_id
      AND previous.created_at > NEW.created_at - 60000
  ) THEN RAISE(ABORT, 'contact_change_resend_cooldown') END;
END;

CREATE TRIGGER account_contact_change_challenge_guard_update
BEFORE UPDATE ON account_contact_change_challenges
BEGIN
  SELECT CASE WHEN
    NEW.id <> OLD.id
    OR NEW.account_id <> OLD.account_id
    OR NEW.identity_id <> OLD.identity_id
    OR NEW.channel <> OLD.channel
    OR NEW.purpose <> OLD.purpose
    OR NEW.new_value <> OLD.new_value
    OR NEW.delivery_target <> OLD.delivery_target
    OR NEW.digest <> OLD.digest
    OR NEW.max_attempts <> OLD.max_attempts
    OR NEW.created_at <> OLD.created_at
    OR NEW.expires_at <> OLD.expires_at
  THEN RAISE(ABORT, 'contact_change_challenge_immutable_fields') END;

  SELECT CASE WHEN OLD.consumed_at IS NOT NULL
    THEN RAISE(ABORT, 'contact_change_challenge_already_consumed') END;

  SELECT CASE WHEN NEW.consumed_at IS NOT NULL AND OLD.consumed_at IS NULL
    AND (NEW.delivery_status <> 'accepted' OR NEW.consumed_at > NEW.expires_at)
    THEN RAISE(ABORT, 'contact_change_challenge_not_consumable') END;

  SELECT CASE WHEN NEW.attempt_count <> OLD.attempt_count AND NEW.attempt_count <> OLD.attempt_count + 1
    THEN RAISE(ABORT, 'contact_change_challenge_invalid_attempt_count') END;
END;

CREATE TABLE account_action_rate_limits (
  account_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('directory_search', 'proximity_invite', 'email_change_request', 'phone_change_request', 'password_change')),
  window_started_at INTEGER NOT NULL CHECK (window_started_at > 0),
  action_count INTEGER NOT NULL CHECK (action_count >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at > 0),
  PRIMARY KEY (account_id, action),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
);

CREATE TABLE account_activity_log (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (length(event_type) BETWEEN 1 AND 80),
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (length(metadata_json) BETWEEN 2 AND 2000),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
);

CREATE INDEX account_activity_log_account_created
  ON account_activity_log(account_id, created_at DESC);

CREATE TRIGGER proximity_invitation_guard_update
BEFORE UPDATE ON proximity_invitations
BEGIN
  SELECT CASE WHEN
    NEW.id <> OLD.id
    OR NEW.inviter_account_id <> OLD.inviter_account_id
    OR NEW.recipient_account_id <> OLD.recipient_account_id
    OR NEW.pair_key <> OLD.pair_key
    OR NEW.created_at <> OLD.created_at
    OR NEW.expires_at <> OLD.expires_at
  THEN RAISE(ABORT, 'proximity_invitation_immutable_fields') END;

  SELECT CASE WHEN OLD.status <> 'pending'
    THEN RAISE(ABORT, 'proximity_invitation_terminal_state') END;

  SELECT CASE WHEN NEW.status NOT IN ('accepted', 'declined', 'cancelled', 'expired')
    THEN RAISE(ABORT, 'proximity_invitation_invalid_transition') END;

  SELECT CASE WHEN NEW.decided_at IS NULL OR NEW.decided_at < OLD.created_at
    THEN RAISE(ABORT, 'proximity_invitation_invalid_decision') END;

  SELECT CASE WHEN NEW.status = 'expired' AND NEW.decided_at < OLD.expires_at
    THEN RAISE(ABORT, 'proximity_invitation_not_yet_expired') END;

  SELECT CASE WHEN NEW.status IN ('accepted', 'declined') AND NEW.decided_at >= OLD.expires_at
    THEN RAISE(ABORT, 'proximity_invitation_expired') END;
END;

CREATE TRIGGER close_relation_insert_guard
BEFORE INSERT ON close_relations
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM proximity_invitations i
    JOIN accounts low ON low.id = NEW.account_low_id AND low.status = 'active'
    JOIN accounts high ON high.id = NEW.account_high_id AND high.status = 'active'
    WHERE i.id = NEW.invitation_id
      AND i.status = 'accepted'
      AND i.decided_at = NEW.created_at
      AND NEW.account_low_id = MIN(i.inviter_account_id, i.recipient_account_id)
      AND NEW.account_high_id = MAX(i.inviter_account_id, i.recipient_account_id)
  ) THEN RAISE(ABORT, 'close_relation_requires_matching_acceptance') END;
END;

CREATE TRIGGER close_relation_guard_update
BEFORE UPDATE ON close_relations
BEGIN
  SELECT CASE WHEN
    NEW.id <> OLD.id
    OR NEW.account_low_id <> OLD.account_low_id
    OR NEW.account_high_id <> OLD.account_high_id
    OR NEW.invitation_id <> OLD.invitation_id
    OR NEW.created_at <> OLD.created_at
  THEN RAISE(ABORT, 'close_relation_immutable_fields') END;

  SELECT CASE WHEN OLD.status <> 'active'
    THEN RAISE(ABORT, 'close_relation_already_removed') END;

  SELECT CASE WHEN NEW.status <> 'removed'
    OR NEW.removed_at IS NULL
    OR NEW.removed_by_account_id IS NULL
    OR NEW.removed_at < OLD.created_at
    OR NEW.removed_by_account_id NOT IN (OLD.account_low_id, OLD.account_high_id)
  THEN RAISE(ABORT, 'close_relation_invalid_removal') END;
END;

CREATE TRIGGER close_relation_permission_insert_guard
BEFORE INSERT ON close_relation_permissions
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM close_relations r
    WHERE r.id = NEW.relation_id
      AND r.status = 'active'
      AND (
        (r.account_low_id = NEW.grantor_account_id AND r.account_high_id = NEW.grantee_account_id)
        OR (r.account_low_id = NEW.grantee_account_id AND r.account_high_id = NEW.grantor_account_id)
      )
  ) THEN RAISE(ABORT, 'close_relation_permission_requires_active_relation') END;
END;

CREATE TRIGGER close_relation_permission_guard_update
BEFORE UPDATE ON close_relation_permissions
BEGIN
  SELECT CASE WHEN
    NEW.relation_id <> OLD.relation_id
    OR NEW.grantor_account_id <> OLD.grantor_account_id
    OR NEW.grantee_account_id <> OLD.grantee_account_id
    OR NEW.permission_key <> OLD.permission_key
  THEN RAISE(ABORT, 'close_relation_permission_immutable_fields') END;

  SELECT CASE WHEN NEW.status NOT IN ('active', 'revoked')
    THEN RAISE(ABORT, 'close_relation_permission_invalid_status') END;

  SELECT CASE WHEN NEW.status = 'active' AND NEW.revoked_at IS NOT NULL
    THEN RAISE(ABORT, 'close_relation_permission_invalid_grant') END;

  SELECT CASE WHEN NEW.status = 'revoked' AND (NEW.revoked_at IS NULL OR NEW.revoked_at < OLD.granted_at)
    THEN RAISE(ABORT, 'close_relation_permission_invalid_revocation') END;
END;

CREATE TRIGGER account_profile_guard_update
BEFORE UPDATE ON account_profiles
BEGIN
  SELECT CASE WHEN
    NEW.account_id <> OLD.account_id
    OR NEW.created_at <> OLD.created_at
    OR NEW.updated_at < OLD.created_at
  THEN RAISE(ABORT, 'account_profile_immutable_fields') END;
END;

CREATE TRIGGER account_privacy_settings_guard_update
BEFORE UPDATE ON account_privacy_settings
BEGIN
  SELECT CASE WHEN NEW.account_id <> OLD.account_id
    THEN RAISE(ABORT, 'account_privacy_account_immutable') END;
END;

CREATE TRIGGER account_activity_log_append_only_update
BEFORE UPDATE ON account_activity_log
BEGIN
  SELECT RAISE(ABORT, 'account_activity_log_append_only');
END;

CREATE TRIGGER account_activity_log_append_only_delete
BEFORE DELETE ON account_activity_log
BEGIN
  SELECT RAISE(ABORT, 'account_activity_log_append_only');
END;
