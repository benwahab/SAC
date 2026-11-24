import { requireAuthenticatedDeviceSession } from "../../../../lib/security/require-authenticated-device-session.ts";
import { guardSameOriginJsonPost } from "../../../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../../../lib/security/json-request-body.ts";

interface Env { DB: D1Database; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: HEADERS }); }

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "support_unavailable" }, session.status);
  const ticketId = params.ticketId;
  if (typeof ticketId !== "string" || ticketId.length > 128) return json({ error: "ticket_not_found" }, 404);
  const parsed = await readJsonRequestBody(request, 8192);
  if (!parsed.ok || typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) return json({ error: "invalid_message" }, 400);
  const body = (parsed.value as Record<string, unknown>).body;
  if (typeof body !== "string" || body.trim().length < 1 || body.trim().length > 5000) return json({ error: "invalid_message" }, 400);
  try {
    const result = await env.DB.prepare(
      `INSERT INTO support_messages (id, ticket_id, author_account_id, author_kind, body, created_at)
       SELECT ?, t.id, ?, 'requester', ?, ?
       FROM support_tickets t WHERE t.id = ? AND t.requester_account_id = ? AND t.status <> 'closed'`,
    ).bind(crypto.randomUUID(), session.value.accountId, body.trim(), Date.now(), ticketId, session.value.accountId).run();
    if (!result.success || result.meta.changes !== 1) return json({ error: "ticket_not_found_or_closed" }, 404);
    return json({ sent: true }, 201);
  } catch { return json({ error: "support_unavailable" }, 503); }
};
