import { recordAdminReadEvent } from "../../lib/security/admin-audit.ts";
import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";

interface Env { DB: D1Database; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
const PERMISSIONS = ["read", "create", "update", "process", "export", "delete"] as const;
type Permission = typeof PERMISSIONS[number];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "admin_service_unavailable" }, session.status);

  try {
    const rows = await env.DB.prepare(
      `SELECT m.id, m.scope_key, m.status, m.due_at, m.created_at, m.updated_at,
              m.version, p.permission
       FROM admin_missions m
       LEFT JOIN admin_mission_permissions p ON p.mission_id = m.id
       WHERE m.assigned_account_id = ? AND m.status IN ('active', 'suspended')
       ORDER BY m.created_at DESC, m.id DESC, p.permission
       LIMIT 100`,
    ).bind(session.value.accountId).all<Record<string, unknown>>();
    if (!rows.success) return json({ error: "admin_service_unavailable" }, 503);

    const byMission = new Map<string, { id: string; scopeKey: string; status: string; dueAt: number | null; createdAt: number; updatedAt: number; version: number; permissions: Permission[] }>();
    for (const row of rows.results ?? []) {
      const id = String(row.id);
      const current = byMission.get(id) ?? {
        id,
        scopeKey: String(row.scope_key),
        status: String(row.status),
        dueAt: row.due_at === null ? null : Number(row.due_at),
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
        version: Number(row.version),
        permissions: [],
      };
      if (typeof row.permission === "string" && PERMISSIONS.includes(row.permission as Permission)) {
        current.permissions.push(row.permission as Permission);
      }
      byMission.set(id, current);
    }

    await recordAdminReadEvent(env.DB, session.value, "admin.my_missions.read", "admin.my_missions.read");
    return json({ missions: Array.from(byMission.values()) });
  } catch {
    return json({ error: "admin_service_unavailable" }, 503);
  }
};
