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
    const [summary, levels, categories] = await Promise.all([
      env.DB.prepare(
        `SELECT
          COUNT(*) AS active_total,
          (SELECT COUNT(*) FROM alerts created WHERE created.created_at >= ?) AS created_last_24h,
          SUM(CASE WHEN EXISTS (
            SELECT 1 FROM alert_events e WHERE e.alert_id = alerts.id
              AND e.event_type IN ('acknowledged', 'volunteered')
          ) THEN 1 ELSE 0 END) AS active_with_response,
          SUM(CASE WHEN EXISTS (
            SELECT 1 FROM alert_responsibility_periods p
            WHERE p.alert_id = alerts.id AND p.ended_at IS NULL
          ) THEN 1 ELSE 0 END) AS active_with_responsible,
          (SELECT COUNT(*) FROM alerts closed
            WHERE closed.status = 'closed_by_author' AND closed.closed_at >= ?) AS closed_last_24h
         FROM alerts WHERE status = 'active'`,
      ).bind(since, since).first<Record<string, number>>(),
      env.DB.prepare(
        "SELECT level, COUNT(*) AS total FROM alerts WHERE status = 'active' GROUP BY level",
      ).all<{ level: string; total: number }>(),
      env.DB.prepare(
        "SELECT category, COUNT(*) AS total FROM alerts WHERE status = 'active' GROUP BY category",
      ).all<{ category: string; total: number }>(),
    ]);
    if (!summary || !levels.success || !categories.success) return json({ error: "admin_service_unavailable" }, 503);
    await recordAdminReadEvent(env.DB, admin.value, "admin.alerts.read", "admin.alerts.read");
    const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
    return json({
      generatedAt: now,
      period: "last_24_hours",
      summary: {
        active: count(summary.active_total),
        createdLast24h: count(summary.created_last_24h),
        closedLast24h: count(summary.closed_last_24h),
        activeWithResponse: count(summary.active_with_response),
        activeWithResponsible: count(summary.active_with_responsible),
        activeWithoutResponse: Math.max(0, count(summary.active_total) - count(summary.active_with_response)),
      },
      byLevel: (levels.results ?? []).map((row) => ({ level: row.level, total: count(row.total) })),
      byCategory: (categories.results ?? []).map((row) => ({ category: row.category, total: count(row.total) })),
    });
  } catch {
    return json({ error: "admin_service_unavailable" }, 503);
  }
};
