import { requireSuperAdminSession } from "../../../../lib/security/require-super-admin-session.ts";
import { guardSameOriginJsonPost } from "../../../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../../../lib/security/json-request-body.ts";

interface Env { DB: D1Database; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: HEADERS }); }

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;
  const admin = await requireSuperAdminSession(request, env.DB);
  if (!admin.ok) return json({ error: admin.status === 401 ? "authentication_required" : admin.status === 403 ? "super_admin_required" : "admin_service_unavailable" }, admin.status);
  const ticketId = params.ticketId;
  if (typeof ticketId !== "string" || ticketId.length > 128) return json({ error: "ticket_not_found" }, 404);
  const parsed = await readJsonRequestBody(request, 8192);
  if (!parsed.ok || typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) return json({ error: "invalid_message" }, 400);
  const body = (parsed.value as Record<string, unknown>).body;
  if (typeof body !== "string" || body.trim().length < 1 || body.trim().length > 5000) return json({ error: "invalid_message" }, 400);
  const now = Date.now();
  try {
    const results = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO support_messages (id, ticket_id, author_account_id, author_kind, body, created_at)
         VALUES (?, ?, ?, 'support', ?, ?)`,
      ).bind(crypto.randomUUID(), ticketId, admin.value.accountId, body.trim(), now),
      env.DB.prepare(
        `UPDATE support_tickets SET updated_at = ?, version = version + 1
         WHERE id = ? AND status <> 'closed'`,
      ).bind(now, ticketId),
      env.DB.prepare(
        `INSERT INTO admin_audit_events
         (id, actor_account_id, actor_device_id, mission_id, action, scope_key, permission_used, outcome, occurred_at)
         SELECT ?, ?, ?, NULL, 'support.ticket.reply', 'support', 'support.reply', 'success', ?
         WHERE EXISTS (SELECT 1 FROM support_tickets WHERE id = ? AND status <> 'closed')`,
      ).bind(crypto.randomUUID(), admin.value.accountId, admin.value.deviceId, now, ticketId),
    ]);
    if (results.some((result) => !result.success)) return json({ error: "ticket_not_open" }, 409);
    if (results[0].meta.changes !== 1 || results[1].meta.changes !== 1 || results[2].meta.changes !== 1) return json({ error: "ticket_not_open" }, 409);
    return json({ sent: true, createdAt: now }, 201);
  } catch { return json({ error: "ticket_not_open" }, 409); }
};
