-- SAC D1 restore-rehearsal fixture ONLY.
-- This schema is isolated under tests/ and is never a production migration.
PRAGMA foreign_keys = ON;

CREATE TABLE test_restore_projection (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  sequence INTEGER NOT NULL CHECK (sequence >= 0),
  root_status TEXT NOT NULL CHECK (root_status IN ('none', 'active', 'revoked')),
  secondary_status TEXT NOT NULL CHECK (secondary_status IN ('none', 'pending', 'active', 'revoked')),
  event_hash TEXT NOT NULL
    CHECK (length(event_hash) = 64 AND event_hash NOT GLOB '*[^a-f0-9]*')
);

INSERT INTO test_restore_projection (id, sequence, root_status, secondary_status, event_hash)
VALUES (1, 0, 'none', 'none', '0000000000000000000000000000000000000000000000000000000000000000');
