import { requireSuperAdminSession } from "../../../lib/security/require-super-admin-session.ts";

interface Env { DB: D1Database; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: HEADERS }); }

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const admin = await requireSuperAdminSession(request, env.DB);
  if (!admin.ok) return json({ error: admin.status === 401 ? "authentication_required" : admin.status === 403 ? "super_admin_required" : "admin_service_unavailable" }, admin.status);
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase();
  if (query.length > 120) return json({ error: "invalid_query" }, 400);
  try {
    const rows = await env.DB.prepare(
      `SELECT a.id, i.normalized_value AS email
       FROM accounts a
       JOIN account_identities i ON i.account_id = a.id
       WHERE a.status = 'active'
         AND i.channel = 'email' AND i.is_primary = 1 AND i.verified_at IS NOT NULL
         AND lower(i.normalized_value) LIKE ?
       ORDER BY lower(i.normalized_value), a.id
       LIMIT 25`,
    ).bind(query ? `%${query.replace(/[\\%_]/g, "\\$&")}%` : "%").all<{ id: string; email: string }>();
    if (!rows.success) return json({ error: "admin_service_unavailable" }, 503);
    return json({ accounts: rows.results ?? [] });
  } catch {
    return json({ error: "admin_service_unavailable" }, 503);
  }
};
