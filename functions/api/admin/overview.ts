import { recordAdminReadEvent } from "../../lib/security/admin-audit.ts";
import { requireSuperAdminSession } from "../../lib/security/require-super-admin-session.ts";

interface Env { DB: D1Database; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: HEADERS }); }

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const admin = await requireSuperAdminSession(request, env.DB);
  if (!admin.ok) return json({ error: admin.status === 401 ? "authentication_required" : admin.status === 403 ? "super_admin_required" : "admin_service_unavailable" }, admin.status);
  const now = Date.now();
  const since = now - 24 * 60 * 60 * 1000;
  try {
    const result = await env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM accounts WHERE status = 'active') AS active_accounts,
        (SELECT COUNT(*) FROM alerts WHERE status = 'active') AS active_alerts,
        (SELECT COUNT(*) FROM alerts WHERE created_at >= ?) AS alerts_last_24h,
        (SELECT COUNT(*) FROM admin_missions WHERE status = 'active' AND (due_at IS NULL OR due_at > ?)) AS active_missions,
        (SELECT COUNT(DISTINCT assigned_account_id) FROM admin_missions WHERE status = 'active' AND (due_at IS NULL OR due_at > ?)) AS active_delegates,
        (SELECT COUNT(*) FROM admin_audit_events WHERE occurred_at >= ?) AS audit_events_last_24h`,
    ).bind(since, now, now, since).first<Record<string, number>>();
    if (!result) return json({ error: "admin_service_unavailable" }, 503);
    await recordAdminReadEvent(env.DB, admin.value, "admin.overview.read", "admin.overview.read");
    const safeCount = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
    return json({
      generatedAt: now,
      period: "last_24_hours",
      metrics: {
        activeAccounts: safeCount(result.active_accounts),
        activeAlerts: safeCount(result.active_alerts),
        alertsLast24h: safeCount(result.alerts_last_24h),
        activeMissions: safeCount(result.active_missions),
        activeDelegates: safeCount(result.active_delegates),
        auditEventsLast24h: safeCount(result.audit_events_last_24h),
      },
    });
  } catch {
    return json({ error: "admin_service_unavailable" }, 503);
  }
};
