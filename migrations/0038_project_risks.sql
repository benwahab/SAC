CREATE TABLE project_risks (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
 title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', probability INTEGER NOT NULL CHECK (probability BETWEEN 1 AND 5),
 impact INTEGER NOT NULL CHECK (impact BETWEEN 1 AND 5), mitigation_plan TEXT NOT NULL DEFAULT '',
 risk_status TEXT NOT NULL CHECK (risk_status IN ('open','mitigating','accepted','closed')),
 owner_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL, review_on TEXT,
 created_by TEXT NOT NULL REFERENCES accounts(id), updated_by TEXT NOT NULL REFERENCES accounts(id), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX project_risks_project ON project_risks(project_id, risk_status, updated_at DESC);
CREATE TABLE project_risk_events (
 id TEXT PRIMARY KEY, risk_id TEXT NOT NULL REFERENCES project_risks(id) ON DELETE CASCADE, event_type TEXT NOT NULL,
 summary TEXT NOT NULL, actor_account_id TEXT NOT NULL REFERENCES accounts(id), occurred_at INTEGER NOT NULL
);
CREATE INDEX project_risk_events_timeline ON project_risk_events(risk_id, occurred_at DESC);
