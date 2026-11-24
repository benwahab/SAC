import { requireSuperAdminSession } from "../../../lib/security/require-super-admin-session.ts";

interface Env { DB: D1Database; }

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const admin = await requireSuperAdminSession(request, env.DB);
  if (!admin.ok) {
    return new Response(JSON.stringify({ error: admin.status === 401 ? "authentication_required" : admin.status === 403 ? "super_admin_required" : "admin_service_unavailable" }), {
      status: admin.status,
      headers: { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff" },
    });
  }

  try {
    const rows = await env.DB.prepare(
      `SELECT e.id, identity.normalized_value AS actor_email, e.actor_device_id,
              e.mission_id, e.action, e.scope_key, e.permission_used,
              e.outcome, e.occurred_at
       FROM admin_audit_events e
       LEFT JOIN account_identities identity ON identity.account_id = e.actor_account_id
         AND identity.channel = 'email' AND identity.is_primary = 1 AND identity.verified_at IS NOT NULL
       ORDER BY e.occurred_at DESC, e.id DESC
       LIMIT 5000`,
    ).all<Record<string, unknown>>();
    if (!rows.success) throw new Error("audit_export_unavailable");

    const columns = ["id", "actor_email", "actor_device_id", "mission_id", "action", "scope_key", "permission_used", "outcome", "occurred_at_utc"];
    const lines = [columns.join(",")];
    for (const row of rows.results ?? []) {
      lines.push([
        row.id, row.actor_email, row.actor_device_id, row.mission_id, row.action,
        row.scope_key, row.permission_used, row.outcome,
        row.occurred_at === null || row.occurred_at === undefined ? "" : new Date(Number(row.occurred_at)).toISOString(),
      ].map(csvCell).join(","));
    }
    return new Response("\uFEFF" + lines.join("\r\n") + "\r\n", {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="sac-admin-audit.csv"',
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "X-Frame-Options": "DENY",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "admin_service_unavailable" }), {
      status: 503,
      headers: { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff" },
    });
  }
};
