CREATE TABLE initiatives (
 id TEXT PRIMARY KEY, public_reference TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 project_status TEXT NOT NULL CHECK (project_status IN ('proposed','planned','active','on_hold','completed','cancelled')),
 priority TEXT NOT NULL CHECK (priority IN ('low','normal','high','critical')),
 progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
 owner_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL, starts_on TEXT, ends_on TEXT,
 created_by TEXT NOT NULL REFERENCES accounts(id), updated_by TEXT NOT NULL REFERENCES accounts(id), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX initiatives_status ON initiatives(project_status, priority, updated_at DESC);
CREATE TABLE project_milestones (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE, title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '', due_on TEXT, milestone_status TEXT NOT NULL CHECK (milestone_status IN ('pending','in_progress','completed','delayed','cancelled')),
 owner_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL, created_by TEXT NOT NULL REFERENCES accounts(id),
 updated_by TEXT NOT NULL REFERENCES accounts(id), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX project_milestones_project ON project_milestones(project_id, due_on, created_at);
CREATE TABLE project_events (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE, milestone_id TEXT REFERENCES project_milestones(id) ON DELETE SET NULL,
 event_type TEXT NOT NULL, summary TEXT NOT NULL, actor_account_id TEXT NOT NULL REFERENCES accounts(id), occurred_at INTEGER NOT NULL
);
CREATE INDEX project_events_timeline ON project_events(project_id, occurred_at DESC);
