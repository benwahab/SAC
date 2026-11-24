import { requireAuthenticatedDeviceSession } from "../../../lib/security/require-authenticated-device-session.ts";

interface Env { DB: D1Database; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: HEADERS }); }

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "support_unavailable" }, session.status);
  const ticketId = params.ticketId;
  if (typeof ticketId !== "string" || ticketId.length > 128) return json({ error: "ticket_not_found" }, 404);
  try {
    const [ticket, messages] = await Promise.all([
      env.DB.prepare(
        `SELECT id, public_reference, category, subject, priority, status, created_at, updated_at, resolved_at, closed_at, version
         FROM support_tickets WHERE id = ? AND requester_account_id = ? LIMIT 1`,
      ).bind(ticketId, session.value.accountId).first<Record<string, unknown>>(),
      env.DB.prepare(
        `SELECT id, author_kind, body, created_at FROM support_messages
         WHERE ticket_id = ? AND EXISTS (
           SELECT 1 FROM support_tickets WHERE id = ? AND requester_account_id = ?
         ) ORDER BY created_at, id LIMIT 200`,
      ).bind(ticketId, ticketId, session.value.accountId).all<Record<string, unknown>>(),
    ]);
    if (!ticket) return json({ error: "ticket_not_found" }, 404);
    if (!messages.success) return json({ error: "support_unavailable" }, 503);
    return json({ ticket, messages: messages.results ?? [] });
  } catch { return json({ error: "support_unavailable" }, 503); }
};
