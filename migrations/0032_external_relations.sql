-- External relations: organizations, professional contacts and controlled agreements.
PRAGMA foreign_keys = ON;
CREATE TABLE partner_organizations (
  id TEXT PRIMARY KEY,
  public_reference TEXT NOT NULL UNIQUE,
  official_name TEXT NOT NULL,
  organization_type TEXT NOT NULL,
  country_code TEXT NOT NULL,
  intervention_area TEXT NOT NULL DEFAULT '',
  relationship_status TEXT NOT NULL CHECK (relationship_status IN ('prospect','discussion','active','suspended','ended')),
  cooperation_domain TEXT NOT NULL DEFAULT '',
  objectives TEXT NOT NULL DEFAULT '',
  internal_owner_account_id TEXT REFERENCES accounts(id),
  source TEXT NOT NULL DEFAULT '',
  entered_at INTEGER NOT NULL,
  last_activity_at INTEGER,
  created_by TEXT NOT NULL REFERENCES accounts(id),
  updated_by TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX partner_organizations_name ON partner_organizations(official_name);
CREATE INDEX partner_organizations_status ON partner_organizations(relationship_status, updated_at DESC);
CREATE TABLE partner_contacts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  professional_title TEXT NOT NULL DEFAULT '',
  professional_email TEXT NOT NULL DEFAULT '',
  professional_phone TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'restricted' CHECK (visibility IN ('restricted','mission')),
  contact_status TEXT NOT NULL DEFAULT 'active' CHECK (contact_status IN ('active','inactive')),
  created_by TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX partner_contacts_organization ON partner_contacts(organization_id, contact_status, created_at DESC);
CREATE TABLE partner_agreements (
  id TEXT PRIMARY KEY,
  public_reference TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL REFERENCES partner_organizations(id),
  title TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  legal_status TEXT NOT NULL CHECK (legal_status IN ('draft','internal_review','legal_review','approved','signed')),
  operational_status TEXT NOT NULL CHECK (operational_status IN ('planned','active','expired','closed','terminated')),
  starts_on TEXT,
  ends_on TEXT,
  current_version INTEGER NOT NULL DEFAULT 1 CHECK (current_version >= 1),
  created_by TEXT NOT NULL REFERENCES accounts(id),
  updated_by TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX partner_agreements_organization ON partner_agreements(organization_id, updated_at DESC);
CREATE INDEX partner_agreements_end_date ON partner_agreements(ends_on, operational_status);
CREATE TABLE partner_agreement_versions (
  id TEXT PRIMARY KEY,
  agreement_id TEXT NOT NULL REFERENCES partner_agreements(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  title TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  obligations TEXT NOT NULL DEFAULT '',
  deliverables TEXT NOT NULL DEFAULT '',
  starts_on TEXT,
  ends_on TEXT,
  created_by TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  UNIQUE(agreement_id, version_number)
);
CREATE TABLE partner_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
  agreement_id TEXT REFERENCES partner_agreements(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  actor_account_id TEXT NOT NULL REFERENCES accounts(id),
  occurred_at INTEGER NOT NULL
);
CREATE INDEX partner_events_timeline ON partner_events(organization_id, occurred_at DESC);
