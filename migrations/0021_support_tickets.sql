-- SAC — tickets d'assistance distincts des alertes SOS.
-- Les tickets du premier lot sont liés à un compte actif et vérifié par session.
-- Le parcours public de récupération de compte sera ajouté séparément avec OTP e-mail.
PRAGMA foreign_keys = ON;

CREATE TABLE support_tickets (
  id TEXT PRIMARY KEY NOT NULL,
  public_reference TEXT NOT NULL UNIQUE CHECK (length(public_reference) BETWEEN 12 AND 32),
  requester_account_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'account_access', 'app_device', 'notifications', 'billing',
    'general_question', 'complaint', 'technical_incident'
  )),
  subject TEXT NOT NULL CHECK (length(trim(subject)) BETWEEN 3 AND 160),
  description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 5 AND 5000),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'high', 'critical_support')),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'open', 'waiting_requester', 'waiting_internal', 'resolved', 'closed')),
  assigned_account_id TEXT,
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  resolved_at INTEGER,
  closed_at INTEGER,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  FOREIGN KEY (requester_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (assigned_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CHECK (resolved_at IS NULL OR resolved_at >= created_at),
  CHECK (closed_at IS NULL OR closed_at >= created_at)
);

CREATE INDEX support_tickets_status_created
  ON support_tickets(status, created_at DESC);
CREATE INDEX support_tickets_requester_created
  ON support_tickets(requester_account_id, created_at DESC);
CREATE INDEX support_tickets_assignee_status
  ON support_tickets(assigned_account_id, status, updated_at DESC);

CREATE TABLE support_messages (
  id TEXT PRIMARY KEY NOT NULL,
  ticket_id TEXT NOT NULL,
  author_account_id TEXT NOT NULL,
  author_kind TEXT NOT NULL CHECK (author_kind IN ('requester', 'support')),
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 5000),
  created_at INTEGER NOT NULL CHECK (created_at > 0),
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE RESTRICT,
  FOREIGN KEY (author_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
);

CREATE INDEX support_messages_ticket_created
  ON support_messages(ticket_id, created_at, id);

CREATE TABLE support_ticket_events (
  id TEXT PRIMARY KEY NOT NULL,
  ticket_id TEXT NOT NULL,
  actor_account_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'status_changed', 'assigned', 'priority_changed', 'resolved', 'reopened', 'closed'
  )),
  previous_value TEXT,
  new_value TEXT,
  reason TEXT,
  occurred_at INTEGER NOT NULL CHECK (occurred_at > 0),
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE RESTRICT,
  FOREIGN KEY (actor_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
);

CREATE INDEX support_ticket_events_chronology
  ON support_ticket_events(ticket_id, occurred_at, id);

CREATE TRIGGER support_ticket_requester_active_guard
BEFORE INSERT ON support_tickets
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM accounts WHERE id = NEW.requester_account_id AND status = 'active'
  ) THEN RAISE(ABORT, 'support_requester_not_active') END;
END;

CREATE TRIGGER support_message_ticket_open_guard
BEFORE INSERT ON support_messages
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM support_tickets t
    JOIN accounts a ON a.id = NEW.author_account_id AND a.status = 'active'
    WHERE t.id = NEW.ticket_id
      AND (
        (NEW.author_kind = 'requester' AND t.requester_account_id = NEW.author_account_id)
        OR
        (NEW.author_kind = 'support' AND t.status NOT IN ('closed'))
      )
  ) THEN RAISE(ABORT, 'support_message_not_authorized') END;
END;

CREATE TRIGGER support_message_no_update
BEFORE UPDATE ON support_messages
BEGIN
  SELECT RAISE(ABORT, 'support_messages_are_append_only');
END;

CREATE TRIGGER support_message_no_delete
BEFORE DELETE ON support_messages
BEGIN
  SELECT RAISE(ABORT, 'support_messages_are_append_only');
END;

CREATE TRIGGER support_ticket_event_no_update
BEFORE UPDATE ON support_ticket_events
BEGIN
  SELECT RAISE(ABORT, 'support_ticket_events_are_append_only');
END;

CREATE TRIGGER support_ticket_event_no_delete
BEFORE DELETE ON support_ticket_events
BEGIN
  SELECT RAISE(ABORT, 'support_ticket_events_are_append_only');
END;

CREATE TRIGGER support_ticket_event_actor_active_guard
BEFORE INSERT ON support_ticket_events
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM accounts WHERE id = NEW.actor_account_id AND status = 'active'
  ) THEN RAISE(ABORT, 'support_event_actor_not_active') END;
END;
