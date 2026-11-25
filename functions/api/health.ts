interface Env { DB: D1Database }

const REQUIRED_TABLES = [
  "accounts",
  "account_identities",
  "email_otp_challenges",
  "contact_invitations",
  "trusted_contacts",
  "alerts",
  "alert_recipients",
  "alert_events",
  "alert_responsibility_periods",
  "alert_reminder_outbox",
  "alert_sms_escalations",
  "alert_sms_outbox",
  "root_enrollment_rate_limits",
  "root_enrollment_ceremonies",
  "root_enrollment_challenges",
  "devices",
  "device_root_credentials",
  "device_sessions",
  "device_enrollment_events",
  "push_subscriptions",
  "account_profiles",
  "account_privacy_settings",
  "proximity_invitations",
  "close_relations",
  "close_relation_permissions",
  "account_contact_change_challenges",
  "account_action_rate_limits",
  "account_activity_log",
  "admin_documents",
  "admin_document_versions",
  "admin_document_events",
  "admin_document_attachments",
  "partner_organizations",
  "partner_contacts",
  "partner_agreements",
  "partner_agreement_versions",
  "partner_events",
  "hr_staff",
  "logistics_assets",
  "logistics_asset_assignments",
  "hr_logistics_events",
  "system_settings",
  "setting_change_events",
  "initiatives",
  "project_milestones",
  "project_events",
  "project_risks",
  "project_risk_events",
] as const;

const HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};

function unavailable(database: "unavailable" | "schema_incomplete"): Response {
  return Response.json(
    { ok: false, service: "sac-api", database },
    { status: 503, headers: HEADERS },
  );
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.DB) return unavailable("unavailable");

  try {
    const placeholders = REQUIRED_TABLES.map(() => "?").join(", ");
    const result = await env.DB.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})`,
    ).bind(...REQUIRED_TABLES).all<{ name: string }>();

    if (!result.success) return unavailable("unavailable");

    const available = new Set((result.results ?? []).map((row) => row.name));
    if (REQUIRED_TABLES.some((table) => !available.has(table))) {
      return unavailable("schema_incomplete");
    }

    return Response.json(
      { ok: true, service: "sac-api", database: "connected" },
      { headers: HEADERS },
    );
  } catch {
    return unavailable("unavailable");
  }
};
