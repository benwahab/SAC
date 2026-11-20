-- SAC — tickets de connexion GPS à usage unique.
-- Contient uniquement des empreintes de tickets et des métadonnées d'autorisation,
-- jamais de coordonnées, de clés GPS ou de contenu de localisation.

CREATE TABLE gps_relay_tickets (
  ticket_hash TEXT PRIMARY KEY NOT NULL
    CHECK (length(ticket_hash) = 64 AND ticket_hash NOT GLOB '*[^0-9a-f]*'),
  alert_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('author', 'recipient')),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX gps_relay_tickets_expiry
  ON gps_relay_tickets(expires_at);
