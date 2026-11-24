-- SAC — autoriser les missions Support explicitement attribuées à répondre aux tickets.
-- Le périmètre et la permission sont revérifiés dans l'API et dans ce garde D1.
PRAGMA foreign_keys = ON;

DROP TRIGGER IF EXISTS support_message_ticket_open_guard;

CREATE TRIGGER support_message_ticket_open_guard
BEFORE INSERT ON support_messages
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM support_tickets t
    JOIN accounts a ON a.id = NEW.author_account_id AND a.status = 'active'
    WHERE t.id = NEW.ticket_id
      AND (
        (NEW.author_kind = 'requester'
          AND t.requester_account_id = NEW.author_account_id)
        OR
        (NEW.author_kind = 'support'
          AND t.status <> 'closed'
          AND (
            EXISTS (
              SELECT 1 FROM account_roles r
              WHERE r.account_id = NEW.author_account_id
                AND r.role = 'super_admin'
            )
            OR EXISTS (
              SELECT 1
              FROM admin_missions m
              JOIN admin_mission_permissions p ON p.mission_id = m.id
              WHERE m.assigned_account_id = NEW.author_account_id
                AND m.scope_key = 'support'
                AND m.status = 'active'
                AND (m.due_at IS NULL OR m.due_at > NEW.created_at)
                AND p.permission = 'process'
            )
          )
        )
      )
  ) THEN RAISE(ABORT, 'support_message_not_authorized') END;
END;
