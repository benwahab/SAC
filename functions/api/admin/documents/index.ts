import { requireSuperAdminSession } from "../../../lib/security/require-super-admin-session.ts";
import { guardSameOriginJsonPost } from "../../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../../lib/security/json-request-body.ts";

interface Env { DB: D1Database; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: HEADERS }); }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const admin = await requireSuperAdminSession(request, env.DB);
  if (!admin.ok) return json({ error: admin.status === 401 ? "authentication_required" : "super_admin_required" }, admin.status);
  const url = new URL(request.url);
  const q = clean(url.searchParams.get("q"), 120);
  const category = clean(url.searchParams.get("category"), 60);
  try {
    const rows = await env.DB.prepare(
      `SELECT d.id, d.public_reference, d.title, d.category, d.status, d.current_version,
              d.created_at, d.updated_at, d.archived_at,
              creator.id AS creator_id,
              COALESCE(identity.normalized_value, 'Compte SAC') AS author_label
       FROM admin_documents d
       JOIN accounts creator ON creator.id = d.created_by
       LEFT JOIN account_identities identity ON identity.account_id = creator.id
         AND identity.channel = 'email' AND identity.is_primary = 1 AND identity.verified_at IS NOT NULL
       WHERE (? = '' OR d.title LIKE '%' || ? || '%' OR d.public_reference LIKE '%' || ? || '%')
         AND (? = '' OR d.category = ?)
       ORDER BY d.updated_at DESC, d.id DESC LIMIT 200`,
    ).bind(q, q, q, category, category).all<Record<string, unknown>>();
    if (!rows.success) return json({ error: "document_service_unavailable" }, 503);
    return json({ documents: rows.results ?? [] });
  } catch { return json({ error: "document_service_unavailable" }, 503); }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;
  const admin = await requireSuperAdminSession(request, env.DB);
  if (!admin.ok) return json({ error: admin.status === 401 ? "authentication_required" : "super_admin_required" }, admin.status);
  const parsed = await readJsonRequestBody(request, 300_000);
  if (!parsed.ok || !isObject(parsed.value)) return json({ error: "invalid_request" }, 400);
  const title = clean(parsed.value.title, 180);
  const category = clean(parsed.value.category, 60);
  const content = typeof parsed.value.content === "string" ? parsed.value.content : "";
  if (!title || !category || !content.trim() || content.length > 250_000) return json({ error: "invalid_document" }, 400);
  const now = Date.now();
  const id = crypto.randomUUID();
  const reference = `SAC-DOC-${new Date(now).toISOString().slice(0,10).replaceAll("-","")}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  try {
    const result = await env.DB.batch([
      env.DB.prepare(`INSERT INTO admin_documents (id, public_reference, title, category, status, current_version, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', 1, ?, ?, ?, ?)`).bind(id, reference, title, category, admin.value.accountId, admin.value.accountId, now, now),
      env.DB.prepare(`INSERT INTO admin_document_versions (id, document_id, version_number, content, author_account_id, created_at) VALUES (?, ?, 1, ?, ?, ?)`).bind(crypto.randomUUID(), id, content, admin.value.accountId, now),
      env.DB.prepare(`INSERT INTO admin_audit_events (id, actor_account_id, actor_device_id, action, scope_key, permission_used, outcome, occurred_at) VALUES (?, ?, ?, 'document.created', 'documents', 'documents.create', 'success', ?)`).bind(crypto.randomUUID(), admin.value.accountId, admin.value.deviceId, now),
    ]);
    if (result.some(x => !x.success)) return json({ error: "document_save_failed" }, 503);
    return json({ created: true, id, reference, version: 1 }, 201);
  } catch { return json({ error: "document_save_failed" }, 503); }
};
