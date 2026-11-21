import { recordAdminReadEvent } from "../../lib/security/admin-audit.ts";
import { requireSuperAdminSession } from "../../lib/security/require-super-admin-session.ts";

interface Env { DB: D1Database; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: HEADERS }); }

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const admin = await requireSuperAdminSession(request, env.DB);
  if (!admin.ok) return json({ error: admin.status === 401 ? "authentication_required" : admin.status === 403 ? "super_admin_required" : "admin_service_unavailable" }, admin.status);
  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isSafeInteger(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 50;
  try {
    const rows = await env.DB.prepare(
      `SELECT e.id, e.actor_account_id, identity.normalized_value AS actor_email,
              e.actor_device_id, e.mission_id, e.action, e.scope_key,
              e.permission_used, e.outcome, e.occurred_at
       FROM admin_audit_events e
       LEFT JOIN account_identities identity ON identity.account_id = e.actor_account_id
         AND identity.channel = 'email' AND identity.is_primary = 1 AND identity.verified_at IS NOT NULL
       ORDER BY e.occurred_at DESC, e.id DESC LIMIT ?`,
    ).bind(limit).all<Record<string, unknown>>();
    if (!rows.success) return json({ error: "admin_service_unavailable" }, 503);
    await recordAdminReadEvent(env.DB, admin.value, "admin.audit.read", "admin.audit.read");
    return json({ events: rows.results ?? [] });
  } catch {
    return json({ error: "admin_service_unavailable" }, 503);
  }
};
