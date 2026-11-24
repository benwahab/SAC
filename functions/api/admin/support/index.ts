import { requireSupportMissionAccess } from "../../../lib/security/require-support-mission-access.ts";
import { recordAdminReadEvent } from "../../../lib/security/admin-audit.ts";

interface Env { DB: D1Database; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: HEADERS }); }

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const admin = await requireSupportMissionAccess(request, env.DB, "read");
  if (!admin.ok) return json({ error: admin.status === 401 ? "authentication_required" : admin.status === 403 ? "support_permission_required" : "admin_service_unavailable" }, admin.status);
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const allowed = ["new","open","waiting_requester","waiting_internal","resolved","closed"];
  if (status && !allowed.includes(status)) return json({ error: "invalid_status" }, 400);
  try {
    const [counts, tickets] = await Promise.all([
      env.DB.prepare(
        `SELECT
          SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new_count,
          SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_count,
          SUM(CASE WHEN status IN ('waiting_requester','waiting_internal') THEN 1 ELSE 0 END) AS waiting_count,
          SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_count
         FROM support_tickets`,
      ).first<Record<string, number>>(),
      env.DB.prepare(
        `SELECT t.id, t.public_reference, t.category, t.subject, t.priority, t.status,
                t.created_at, t.updated_at, t.resolved_at, t.version,
                i.normalized_value AS requester_email
         FROM support_tickets t
         JOIN account_identities i ON i.account_id = t.requester_account_id
           AND i.channel = 'email' AND i.is_primary = 1 AND i.verified_at IS NOT NULL
         WHERE (? IS NULL OR t.status = ?)
         ORDER BY CASE t.priority WHEN 'critical_support' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
                  t.updated_at DESC, t.id DESC
         LIMIT 100`,
      ).bind(status, status).all<Record<string, unknown>>(),
    ]);
    if (!counts || !tickets.success) return json({ error: "admin_service_unavailable" }, 503);
    await recordAdminReadEvent(env.DB, admin.value, "admin.support.read", "support.read", Date.now(), admin.missionId, "support");
    const number = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
    return json({
      counts: { new: number(counts.new_count), open: number(counts.open_count), waiting: number(counts.waiting_count), resolved: number(counts.resolved_count) },
      tickets: tickets.results ?? [],
    });
  } catch { return json({ error: "admin_service_unavailable" }, 503); }
};
