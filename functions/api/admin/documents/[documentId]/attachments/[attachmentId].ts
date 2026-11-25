import { requireSuperAdminSession } from "../../../../../lib/security/require-super-admin-session.ts";

interface Env { DB: D1Database; DOCUMENTS?: R2Bucket; }
const JSON_HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS }); }

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const admin = await requireSuperAdminSession(request, env.DB);
  if (!admin.ok) return json({ error: admin.status === 401 ? "authentication_required" : "super_admin_required" }, admin.status);
  if (!env.DOCUMENTS) return json({ error: "private_storage_not_configured" }, 503);
  const documentId = typeof params.documentId === "string" ? params.documentId : "";
  const attachmentId = typeof params.attachmentId === "string" ? params.attachmentId : "";
  try {
    const row = await env.DB.prepare("SELECT id, object_key, file_name, content_type FROM admin_document_attachments WHERE id = ? AND document_id = ?").bind(attachmentId, documentId).first<{id:string;object_key:string;file_name:string;content_type:string}>();
    if (!row) return json({ error: "attachment_not_found" }, 404);
    const object = await env.DOCUMENTS.get(row.object_key);
    if (!object) return json({ error: "attachment_object_missing" }, 404);
    const now = Date.now();
    await env.DB.prepare("INSERT INTO admin_audit_events (id, actor_account_id, actor_device_id, action, scope_key, permission_used, outcome, occurred_at) VALUES (?, ?, ?, 'document.attachment.downloaded', 'documents', 'documents.read', 'success', ?)").bind(crypto.randomUUID(), admin.value.accountId, admin.value.deviceId, now).run();
    const headers = new Headers();
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Content-Type", row.content_type || "application/octet-stream");
    headers.set("Content-Disposition", "attachment; filename*=UTF-8''" + encodeURIComponent(row.file_name));
    headers.set("Content-Length", String(object.size));
    return new Response(object.body, { headers });
  } catch { return json({ error: "attachment_download_failed" }, 503); }
};
