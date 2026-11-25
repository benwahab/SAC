PRAGMA foreign_keys = ON;

CREATE TABLE admin_mission_tasks (
  id TEXT PRIMARY KEY NOT NULL,
  mission_id TEXT NOT NULL,
  assigned_account_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 180),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'blocked', 'submitted', 'done')),
  due_at INTEGER,
  created_by_account_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (mission_id) REFERENCES admin_missions(id) ON DELETE RESTRICT,
  FOREIGN KEY (assigned_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CHECK (updated_at >= created_at),
  CHECK (due_at IS NULL OR due_at > 0)
);
CREATE INDEX admin_mission_tasks_assignee_status ON admin_mission_tasks(assigned_account_id, status, due_at);
CREATE INDEX admin_mission_tasks_mission ON admin_mission_tasks(mission_id, created_at DESC);

CREATE TABLE admin_mission_task_events (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL,
  actor_account_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL CHECK (to_status IN ('todo', 'in_progress', 'blocked', 'submitted', 'done')),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 4000),
  occurred_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES admin_mission_tasks(id) ON DELETE RESTRICT,
  FOREIGN KEY (actor_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
);
CREATE INDEX admin_mission_task_events_task ON admin_mission_task_events(task_id, occurred_at DESC);
CREATE TRIGGER admin_mission_task_events_no_update BEFORE UPDATE ON admin_mission_task_events BEGIN SELECT RAISE(ABORT, 'task_events_are_append_only'); END;
CREATE TRIGGER admin_mission_task_events_no_delete BEFORE DELETE ON admin_mission_task_events BEGIN SELECT RAISE(ABORT, 'task_events_are_append_only'); END;
