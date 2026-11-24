import { requireSupportMissionAccess } from "../../../lib/security/require-support-mission-access.ts";
import { recordAdminReadEvent } from "../../../lib/security/admin-audit.ts";
import { guardSameOriginJsonPost } from "../../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../../lib/security/json-request-body.ts";

interface Env { DB: D1Database; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: HEADERS }); }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
const STATUSES = ["new","open","waiting_requester","waiting_internal","resolved","closed"] as const;

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const admin = await requireSupportMissionAccess(request, env.DB, "read");
  if (!admin.ok) return json({ error: admin.status === 401 ? "authentication_required" : admin.status === 403 ? "support_permission_required" : "admin_service_unavailable" }, admin.status);
  const ticketId = params.ticketId;
  if (typeof ticketId !== "string" || ticketId.length > 128) return json({ error: "ticket_not_found" }, 404);
  try {
    const [ticket, messages, events] = await Promise.all([
      env.DB.prepare(
        `SELECT t.id, t.public_reference, t.requester_account_id, t.category, t.subject, t.description,
                t.priority, t.status, t.assigned_account_id, t.created_at, t.updated_at,
                t.resolved_at, t.closed_at, t.version,
                CASE WHEN ? = 1 THEN i.normalized_value ELSE NULL END AS requester_email
         FROM support_tickets t JOIN account_identities i ON i.account_id = t.requester_account_id
          AND i.channel = 'email' AND i.is_primary = 1 AND i.verified_at IS NOT NULL
         WHERE t.id = ? LIMIT 1`,
      ).bind(admin.isSuperAdmin ? 1 : 0, ticketId).first<Record<string, unknown>>(),
      env.DB.prepare("SELECT id, author_kind, body, created_at FROM support_messages WHERE ticket_id = ? ORDER BY created_at, id LIMIT 200").bind(ticketId).all<Record<string, unknown>>(),
      env.DB.prepare("SELECT id, event_type, previous_value, new_value, reason, occurred_at FROM support_ticket_events WHERE ticket_id = ? ORDER BY occurred_at, id LIMIT 200").bind(ticketId).all<Record<string, unknown>>(),
    ]);
    if (!ticket) return json({ error: "ticket_not_found" }, 404);
    if (!messages.success || !events.success) return json({ error: "admin_service_unavailable" }, 503);
    await recordAdminReadEvent(env.DB, admin.value, "admin.support.ticket.read", "support.read", Date.now(), admin.missionId, "support");
    return json({ ticket, messages: messages.results ?? [], events: events.results ?? [] });
  } catch { return json({ error: "admin_service_unavailable" }, 503); }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;
  const admin = await requireSupportMissionAccess(request, env.DB, "process");
  if (!admin.ok) return json({ error: admin.status === 401 ? "authentication_required" : admin.status === 403 ? "support_permission_required" : "admin_service_unavailable" }, admin.status);
  const ticketId = params.ticketId;
  if (typeof ticketId !== "string" || ticketId.length > 128) return json({ error: "ticket_not_found" }, 404);
  const parsed = await readJsonRequestBody(request, 4096);
  if (!parsed.ok) return json({ error: "invalid_request" }, 400);
  if (!isObject(parsed.value) || typeof parsed.value.status !== "string" || !STATUSES.includes(parsed.value.status as typeof STATUSES[number]) ||
      typeof parsed.value.expectedVersion !== "number" || !Number.isSafeInteger(parsed.value.expectedVersion) || parsed.value.expectedVersion < 1) return json({ error: "invalid_ticket_update" }, 400);
  const nextStatus = parsed.value.status;
  const now = Date.now();
  try {
    const current = await env.DB.prepare("SELECT status, version FROM support_tickets WHERE id = ? LIMIT 1").bind(ticketId).first<{status:string;version:number}>();
    if (!current) return json({ error: "ticket_not_found" }, 404);
    if (current.version !== parsed.value.expectedVersion) return json({ error: "ticket_version_conflict" }, 409);
    const transitions: Record<string, string[]> = {
      new: ["open", "waiting_internal", "closed"],
      open: ["waiting_requester", "waiting_internal", "resolved", "closed"],
      waiting_requester: ["open", "resolved", "closed"],
      waiting_internal: ["open", "resolved", "closed"],
      resolved: ["open", "closed"],
      closed: [],
    };
    if (!transitions[current.status]?.includes(nextStatus)) return json({ error: "invalid_status_transition" }, 409);
    const eventType = nextStatus === "resolved" ? "resolved" : nextStatus === "closed" ? "closed" : nextStatus === "open" && current.status === "resolved" ? "reopened" : "status_changed";
    const results = await env.DB.batch([
      env.DB.prepare(
        `UPDATE support_tickets SET status = ?, updated_at = ?,
          resolved_at = CASE WHEN ? = 'resolved' THEN COALESCE(resolved_at, ?) WHEN ? IN ('new','open','waiting_requester','waiting_internal') THEN NULL ELSE resolved_at END,
          closed_at = CASE WHEN ? = 'closed' THEN COALESCE(closed_at, ?) ELSE closed_at END,
          version = version + 1
         WHERE id = ? AND version = ? AND status = ?`,
      ).bind(nextStatus, now, nextStatus, now, nextStatus, nextStatus, now, ticketId, current.version, current.status),
      env.DB.prepare(
        `INSERT INTO support_ticket_events (id, ticket_id, actor_account_id, event_type, previous_value, new_value, occurred_at)
         SELECT ?, ?, ?, ?, ?, ?, ?
         WHERE EXISTS (SELECT 1 FROM support_tickets WHERE id = ? AND version = ? AND status = ?)`,
      ).bind(crypto.randomUUID(), ticketId, admin.value.accountId, eventType, current.status, nextStatus, now, ticketId, current.version + 1, nextStatus),
      env.DB.prepare(
        `INSERT INTO admin_audit_events
         (id, actor_account_id, actor_device_id, mission_id, action, scope_key, permission_used, outcome, occurred_at)
         SELECT ?, ?, ?, ?, 'support.ticket.status', 'support', 'support.process', 'success', ?
         WHERE EXISTS (SELECT 1 FROM support_tickets WHERE id = ? AND version = ? AND status = ?)`,
      ).bind(crypto.randomUUID(), admin.value.accountId, admin.value.deviceId, admin.missionId, now, ticketId, current.version + 1, nextStatus),
    ]);
    if (results.some((result) => !result.success || result.meta.changes !== 1)) return json({ error: "ticket_version_conflict" }, 409);
    return json({ updated: true, status: nextStatus, version: current.version + 1, updatedAt: now });
  } catch { return json({ error: "admin_service_unavailable" }, 503); }
};
