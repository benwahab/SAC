import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";
import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";

interface Env { DB: D1Database; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: HEADERS }); }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
const CATEGORIES = ["account_access","app_device","notifications","billing","general_question","complaint","technical_incident"] as const;

function makeReference(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return "SAC-" + Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "support_unavailable" }, session.status);
  try {
    const rows = await env.DB.prepare(
      `SELECT id, public_reference, category, subject, priority, status, created_at, updated_at, resolved_at, closed_at, version
       FROM support_tickets WHERE requester_account_id = ?
       ORDER BY updated_at DESC, id DESC LIMIT 100`,
    ).bind(session.value.accountId).all<Record<string, unknown>>();
    if (!rows.success) return json({ error: "support_unavailable" }, 503);
    return json({ tickets: rows.results ?? [] });
  } catch { return json({ error: "support_unavailable" }, 503); }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "support_unavailable" }, session.status);
  const parsed = await readJsonRequestBody(request, 8_192);
  if (!parsed.ok) return json({ error: parsed.reason === "too_large" ? "request_too_large" : "invalid_request" }, parsed.reason === "too_large" ? 413 : 400);
  if (!isObject(parsed.value)) return json({ error: "invalid_ticket" }, 400);
  const { category, subject, description } = parsed.value;
  if (typeof category !== "string" || !CATEGORIES.includes(category as typeof CATEGORIES[number]) ||
      typeof subject !== "string" || subject.trim().length < 3 || subject.trim().length > 160 ||
      typeof description !== "string" || description.trim().length < 5 || description.trim().length > 5000) {
    return json({ error: "invalid_ticket" }, 400);
  }
  const now = Date.now();
  const id = crypto.randomUUID();
  const reference = makeReference();
  try {
    const results = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO support_tickets
         (id, public_reference, requester_account_id, category, subject, description, priority, status, created_at, updated_at, version)
         VALUES (?, ?, ?, ?, ?, ?, 'normal', 'new', ?, ?, 1)`,
      ).bind(id, reference, session.value.accountId, category, subject.trim(), description.trim(), now, now),
      env.DB.prepare(
        `INSERT INTO support_ticket_events
         (id, ticket_id, actor_account_id, event_type, new_value, occurred_at)
         VALUES (?, ?, ?, 'created', 'new', ?)`,
      ).bind(crypto.randomUUID(), id, session.value.accountId, now),
    ]);
    if (results.some((result) => !result.success)) return json({ error: "support_unavailable" }, 503);
    return json({ created: true, id, reference, status: "new", createdAt: now }, 201);
  } catch { return json({ error: "support_unavailable" }, 503); }
};
