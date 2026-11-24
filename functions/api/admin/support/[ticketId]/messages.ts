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
    const result = await env.DB.prepare(
      `INSERT INTO support_messages (id, ticket_id, author_account_id, author_kind, body, created_at)
       VALUES (?, ?, ?, 'support', ?, ?)`,
    ).bind(crypto.randomUUID(), ticketId, admin.value.accountId, body.trim(), now).run();
    if (!result.success || result.meta.changes !== 1) return json({ error: "ticket_not_open" }, 409);
    return json({ sent: true, createdAt: now }, 201);
  } catch { return json({ error: "ticket_not_open" }, 409); }
};
