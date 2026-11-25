import { requireSuperAdminSession } from "../../../lib/security/require-super-admin-session.ts";
import { guardSameOriginJsonPost } from "../../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../../lib/security/json-request-body.ts";

interface Env { DB: D1Database; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: HEADERS }); }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const admin = await requireSuperAdminSession(request, env.DB);
  if (!admin.ok) return json({ error: admin.status === 401 ? "authentication_required" : "super_admin_required" }, admin.status);
  const id = typeof params.documentId === "string" ? params.documentId : "";
  try {
    const document = await env.DB.prepare("SELECT id, public_reference, title, category, status, current_version, created_at, updated_at, archived_at FROM admin_documents WHERE id = ?").bind(id).first<{ id: string; public_reference: string; title: string; category: string; status: string; current_version: number; created_at: number; updated_at: number; archived_at: number | null }>();
    if (!document) return json({ error: "document_not_found" }, 404);
    const version = await env.DB.prepare("SELECT v.version_number, v.content, v.created_at, COALESCE(i.normalized_value, 'Compte SAC') AS author_label FROM admin_document_versions v LEFT JOIN account_identities i ON i.account_id = v.author_account_id AND i.channel = 'email' AND i.is_primary = 1 AND i.verified_at IS NOT NULL WHERE v.document_id = ? AND v.version_number = ?").bind(id, document.current_version).first<Record<string, unknown>>();
    const history = await env.DB.prepare("SELECT version_number, created_at FROM admin_document_versions WHERE document_id = ? ORDER BY version_number DESC LIMIT 50").bind(id).all<Record<string, unknown>>();
    const events = await env.DB.prepare("SELECT event_type, version_number, occurred_at FROM admin_document_events WHERE document_id = ? ORDER BY occurred_at DESC LIMIT 100").bind(id).all<Record<string, unknown>>();
    return json({ document, version, history: history.results ?? [], events: events.results ?? [] });
  } catch { return json({ error: "document_service_unavailable" }, 503); }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;
  const admin = await requireSuperAdminSession(request, env.DB);
  if (!admin.ok) return json({ error: admin.status === 401 ? "authentication_required" : "super_admin_required" }, admin.status);
  const id = typeof params.documentId === "string" ? params.documentId : "";
  const parsed = await readJsonRequestBody(request, 300_000);
  if (!parsed.ok || !isObject(parsed.value)) return json({ error: "invalid_request" }, 400);
  const action = clean(parsed.value.action, 20);
  const now = Date.now();
  try {
    const current = await env.DB.prepare("SELECT status, current_version FROM admin_documents WHERE id = ?").bind(id).first<{status:string;current_version:number}>();
    if (!current) return json({ error: "document_not_found" }, 404);
    if (action === "print") {
      const result = await env.DB.batch([
        env.DB.prepare("INSERT INTO admin_document_events (id, document_id, version_number, actor_account_id, event_type, occurred_at) VALUES (?, ?, ?, ?, 'printed', ?)").bind(crypto.randomUUID(), id, current.current_version, admin.value.accountId, now),
        env.DB.prepare("INSERT INTO admin_audit_events (id, actor_account_id, actor_device_id, action, scope_key, permission_used, outcome, occurred_at) VALUES (?, ?, ?, 'document.printed', 'documents', 'documents.read', 'success', ?)").bind(crypto.randomUUID(), admin.value.accountId, admin.value.deviceId, now),
      ]);
      return result.every(x => x.success) ? json({ printed: true, version: current.current_version, occurredAt: now }) : json({ error: "document_event_failed" }, 503);
    }
    if (action === "archive") {
      if (current.status === "archived") return json({ archived: true });
      const result = await env.DB.batch([
        env.DB.prepare("UPDATE admin_documents SET status = 'archived', archived_at = ?, updated_at = ?, updated_by = ? WHERE id = ? AND status <> 'archived'").bind(now, now, admin.value.accountId, id),
        env.DB.prepare("INSERT INTO admin_document_events (id, document_id, version_number, actor_account_id, event_type, occurred_at) VALUES (?, ?, ?, ?, 'archived', ?)").bind(crypto.randomUUID(), id, current.current_version, admin.value.accountId, now),
        env.DB.prepare("INSERT INTO admin_audit_events (id, actor_account_id, actor_device_id, action, scope_key, permission_used, outcome, occurred_at) VALUES (?, ?, ?, 'document.archived', 'documents', 'documents.update', 'success', ?)").bind(crypto.randomUUID(), admin.value.accountId, admin.value.deviceId, now),
      ]);
      return result.every(x => x.success) ? json({ archived: true }) : json({ error: "document_update_failed" }, 503);
    }
    if (action !== "save" || current.status === "archived") return json({ error: "invalid_document_action" }, 400);
    const title = clean(parsed.value.title, 180);
    const category = clean(parsed.value.category, 60);
    const content = typeof parsed.value.content === "string" ? parsed.value.content : "";
    const expectedVersion = parsed.value.expectedVersion;
    if (!title || !category || !content.trim() || content.length > 250_000 || expectedVersion !== current.current_version) return json({ error: "document_version_conflict_or_invalid" }, 409);
    const next = current.current_version + 1;
    const results = await env.DB.batch([
      env.DB.prepare("UPDATE admin_documents SET title = ?, category = ?, current_version = ?, updated_by = ?, updated_at = ? WHERE id = ? AND current_version = ? AND status <> 'archived'").bind(title, category, next, admin.value.accountId, now, id, current.current_version),
      env.DB.prepare("INSERT INTO admin_document_versions (id, document_id, version_number, content, author_account_id, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM admin_documents WHERE id = ? AND current_version = ? AND status <> 'archived')").bind(crypto.randomUUID(), id, next, content, admin.value.accountId, now, id, next),
      env.DB.prepare("INSERT INTO admin_audit_events (id, actor_account_id, actor_device_id, action, scope_key, permission_used, outcome, occurred_at) SELECT ?, ?, ?, 'document.version.created', 'documents', 'documents.update', 'success', ? WHERE EXISTS (SELECT 1 FROM admin_documents WHERE id = ? AND current_version = ?)").bind(crypto.randomUUID(), admin.value.accountId, admin.value.deviceId, now, id, next),
    ]);
    if (results.some(x => !x.success || x.meta.changes !== 1)) return json({ error: "document_version_conflict" }, 409);
    return json({ saved: true, version: next });
  } catch { return json({ error: "document_update_failed" }, 503); }
};
