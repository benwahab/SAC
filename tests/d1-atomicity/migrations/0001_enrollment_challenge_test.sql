-- SAC D1 atomicity proof fixture ONLY.
-- This schema is isolated under tests/ and is never a production migration.
PRAGMA foreign_keys = ON;

CREATE TABLE test_enrollment_ceremonies (
  id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved')),
  approved_at INTEGER,
  CHECK (
    (status = 'pending' AND approved_at IS NULL)
    OR (status = 'approved' AND approved_at IS NOT NULL)
  )
);

CREATE TABLE test_enrollment_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  ceremony_id TEXT NOT NULL UNIQUE,
  challenge_digest TEXT NOT NULL
    CHECK (length(challenge_digest) = 64 AND challenge_digest NOT GLOB '*[^a-f0-9]*'),
  issued_at INTEGER NOT NULL CHECK (issued_at > 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > issued_at),
  consumed_at INTEGER,
  FOREIGN KEY (ceremony_id) REFERENCES test_enrollment_ceremonies(id) ON DELETE RESTRICT,
  CHECK (consumed_at IS NULL OR (consumed_at >= issued_at AND consumed_at < expires_at))
);

CREATE TABLE test_enrollment_commit_guard (
  ceremony_id TEXT PRIMARY KEY NOT NULL,
  accepted_rows INTEGER NOT NULL CHECK (accepted_rows = 1),
  FOREIGN KEY (ceremony_id) REFERENCES test_enrollment_ceremonies(id) ON DELETE RESTRICT
);

CREATE TRIGGER test_enrollment_challenge_immutable
BEFORE UPDATE ON test_enrollment_challenges
BEGIN
  SELECT CASE WHEN
    NEW.id <> OLD.id
    OR NEW.ceremony_id <> OLD.ceremony_id
    OR NEW.challenge_digest <> OLD.challenge_digest
    OR NEW.issued_at <> OLD.issued_at
    OR NEW.expires_at <> OLD.expires_at
  THEN RAISE(ABORT, 'test_challenge_immutable_fields') END;

  SELECT CASE WHEN
    OLD.consumed_at IS NOT NULL
    OR NEW.consumed_at IS NULL
    OR NEW.consumed_at < OLD.issued_at
    OR NEW.consumed_at >= OLD.expires_at
  THEN RAISE(ABORT, 'test_challenge_one_time_transition_only') END;
END;
