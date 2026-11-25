PRAGMA foreign_keys = ON;
CREATE TABLE hr_staff (
 id TEXT PRIMARY KEY, staff_reference TEXT NOT NULL UNIQUE, account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
 full_name TEXT NOT NULL, job_title TEXT NOT NULL DEFAULT '', department TEXT NOT NULL DEFAULT '', work_email TEXT NOT NULL DEFAULT '',
 work_phone TEXT NOT NULL DEFAULT '', work_location TEXT NOT NULL DEFAULT '',
 employment_status TEXT NOT NULL CHECK (employment_status IN ('active','leave','suspended','departed')),
 start_date TEXT, end_date TEXT, notes TEXT NOT NULL DEFAULT '',
 created_by TEXT NOT NULL REFERENCES accounts(id), updated_by TEXT NOT NULL REFERENCES accounts(id), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX hr_staff_name ON hr_staff(full_name);
CREATE INDEX hr_staff_status ON hr_staff(employment_status, department);
CREATE TABLE logistics_assets (
 id TEXT PRIMARY KEY, inventory_reference TEXT NOT NULL UNIQUE, asset_name TEXT NOT NULL, asset_category TEXT NOT NULL,
 serial_number TEXT NOT NULL DEFAULT '', asset_condition TEXT NOT NULL CHECK (asset_condition IN ('new','good','fair','needs_repair','out_of_service')),
 asset_status TEXT NOT NULL CHECK (asset_status IN ('available','assigned','maintenance','retired')),
 current_location TEXT NOT NULL DEFAULT '', acquired_on TEXT, notes TEXT NOT NULL DEFAULT '',
 created_by TEXT NOT NULL REFERENCES accounts(id), updated_by TEXT NOT NULL REFERENCES accounts(id), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX logistics_assets_name ON logistics_assets(asset_name);
CREATE INDEX logistics_assets_status ON logistics_assets(asset_status, asset_category);
CREATE TABLE logistics_asset_assignments (
 id TEXT PRIMARY KEY, asset_id TEXT NOT NULL REFERENCES logistics_assets(id), staff_id TEXT NOT NULL REFERENCES hr_staff(id),
 assigned_by TEXT NOT NULL REFERENCES accounts(id), assigned_at INTEGER NOT NULL, returned_at INTEGER, return_condition TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX logistics_assignments_asset ON logistics_asset_assignments(asset_id, assigned_at DESC);
CREATE INDEX logistics_assignments_staff ON logistics_asset_assignments(staff_id, assigned_at DESC);
CREATE TABLE hr_logistics_events (
 id TEXT PRIMARY KEY, entity_type TEXT NOT NULL CHECK (entity_type IN ('staff','asset','assignment')), entity_id TEXT NOT NULL,
 event_type TEXT NOT NULL, summary TEXT NOT NULL, actor_account_id TEXT NOT NULL REFERENCES accounts(id), occurred_at INTEGER NOT NULL
);
CREATE INDEX hr_logistics_events_entity ON hr_logistics_events(entity_type, entity_id, occurred_at DESC);
