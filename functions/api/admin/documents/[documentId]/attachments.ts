import { requireSuperAdminSession } from "../../../../lib/security/require-super-admin-session.ts";

interface Env { DB: D1Database; DOCUMENTS?: R2Bucket; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: HEADERS }); }
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
const safeName = (name: string) => name.replace(/[\\/\\0-\\x1f\\x7f]/g, "_").replace(/\s+/g, " ").trim().slice(0, 240) || "document";

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const admin = await requireSuperAdminSession(request, env.DB);
  if (!admin.ok) return json({ error: admin.status === 401 ? "authentication_required" : "super_admin_required" }, admin.status);
  const documentId = typeof params.documentId === "string" ? params.documentId : "";
  try {
    const document = await env.DB.prepare("SELECT id FROM admin_documents WHERE id = ?").bind(documentId).first();
    if (!document) return json({ error: "document_not_found" }, 404);
    const rows = await env.DB.prepare("SELECT id, version_number, file_name, content_type, size_bytes, uploaded_by, created_at FROM admin_document_attachments WHERE document_id = ? ORDER BY created_at DESC, id DESC").bind(documentId).all<Record<string, unknown>>();
    return json({ attachments: rows.results ?? [] });
  } catch { return json({ error: "attachment_service_unavailable" }, 503); }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!sameOrigin(request)) return json({ error: "invalid_origin" }, 403);
  const admin = await requireSuperAdminSession(request, env.DB);
  if (!admin.ok) return json({ error: admin.status === 401 ? "authentication_required" : "super_admin_required" }, admin.status);
  if (!env.DOCUMENTS) return json({ error: "private_storage_not_configured" }, 503);
  const documentId = typeof params.documentId === "string" ? params.documentId : "";
  if (!request.body) return json({ error: "file_required" }, 400);
  const url = new URL(request.url);
  let requestedName = url.searchParams.get("filename") || "document";
  try { requestedName = decodeURIComponent(requestedName); } catch { return json({ error: "invalid_file_name" }, 400); }
  const fileName = safeName(requestedName);
  const contentType = request.headers.get("Content-Type")?.slice(0, 180) || "application/octet-stream";
  try {
    const document = await env.DB.prepare("SELECT current_version, status FROM admin_documents WHERE id = ?").bind(documentId).first<{current_version:number;status:string}>();
    if (!document) return json({ error: "document_not_found" }, 404);
    if (document.status === "archived") return json({ error: "document_archived" }, 409);
    const id = crypto.randomUUID();
    const objectKey = "admin-documents/" + documentId + "/" + id;
    const stored = await env.DOCUMENTS.put(objectKey, request.body, { httpMetadata: { contentType }, customMetadata: { documentId, attachmentId: id } });
    const now = Date.now();
    const result = await env.DB.batch([
      env.DB.prepare("INSERT INTO admin_document_attachments (id, document_id, version_number, object_key, file_name, content_type, size_bytes, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, documentId, document.current_version, objectKey, fileName, contentType, stored.size, admin.value.accountId, now),
      env.DB.prepare("INSERT INTO admin_audit_events (id, actor_account_id, actor_device_id, action, scope_key, permission_used, outcome, occurred_at) VALUES (?, ?, ?, 'document.attachment.uploaded', 'documents', 'documents.update', 'success', ?)").bind(crypto.randomUUID(), admin.value.accountId, admin.value.deviceId, now),
    ]);
    if (result.some(x => !x.success)) { await env.DOCUMENTS.delete(objectKey); return json({ error: "attachment_save_failed" }, 503); }
    return json({ uploaded: true, attachment: { id, file_name: fileName, content_type: contentType, size_bytes: stored.size, version_number: document.current_version, created_at: now } }, 201);
  } catch { return json({ error: "attachment_upload_failed" }, 503); }
};
