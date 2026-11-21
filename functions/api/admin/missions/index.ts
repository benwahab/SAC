import { recordAdminReadEvent } from "../../../lib/security/admin-audit.ts";
import { requireSuperAdminSession } from "../../../lib/security/require-super-admin-session.ts";
import { guardSameOriginJsonPost } from "../../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../../lib/security/json-request-body.ts";

interface Env { DB: D1Database; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
const PERMISSIONS = ["read", "create", "update", "process", "export", "delete"] as const;
type Permission = typeof PERMISSIONS[number];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const admin = await requireSuperAdminSession(request, env.DB);
  if (!admin.ok) return json({ error: admin.status === 401 ? "authentication_required" : admin.status === 403 ? "super_admin_required" : "admin_service_unavailable" }, admin.status);
  try {
    const [missions, permissions] = await Promise.all([
      env.DB.prepare(
        `SELECT m.id, m.assigned_account_id, i.normalized_value AS assigned_email,
                m.created_by_account_id, m.scope_key, m.status, m.due_at,
                m.created_at, m.updated_at, m.version
         FROM admin_missions m
         LEFT JOIN account_identities i ON i.account_id = m.assigned_account_id
           AND i.channel = 'email' AND i.is_primary = 1 AND i.verified_at IS NOT NULL
         ORDER BY m.created_at DESC, m.id DESC LIMIT 200`,
      ).all<Record<string, unknown>>(),
      env.DB.prepare(
        "SELECT mission_id, permission FROM admin_mission_permissions ORDER BY mission_id, permission",
      ).all<{ mission_id: string; permission: Permission }>(),
    ]);
    if (!missions.success || !permissions.success) return json({ error: "admin_service_unavailable" }, 503);
    const byMission = new Map<string, Permission[]>();
    for (const item of permissions.results ?? []) {
      const current = byMission.get(item.mission_id) ?? [];
      current.push(item.permission);
      byMission.set(item.mission_id, current);
    }
    await recordAdminReadEvent(env.DB, admin.value, "admin.missions.read", "admin.missions.read");
    return json({ missions: (missions.results ?? []).map((row) => ({
      id: row.id, assignedAccountId: row.assigned_account_id,
      assignedEmail: row.assigned_email, createdByAccountId: row.created_by_account_id, scopeKey: row.scope_key,
      status: row.status, dueAt: row.due_at, createdAt: row.created_at,
      updatedAt: row.updated_at, version: row.version,
      permissions: byMission.get(String(row.id)) ?? [],
    })) });
  } catch {
    return json({ error: "admin_service_unavailable" }, 503);
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const originError = guardSameOriginJsonPost(request);
  if (originError) return originError;
  const admin = await requireSuperAdminSession(request, env.DB);
  if (!admin.ok) return json({ error: admin.status === 401 ? "authentication_required" : admin.status === 403 ? "super_admin_required" : "admin_service_unavailable" }, admin.status);
  const parsed = await readJsonRequestBody(request, 8_192);
  if (!parsed.ok) return json({ error: parsed.reason === "too_large" ? "request_too_large" : "invalid_request" }, parsed.reason === "too_large" ? 413 : 400);
  if (!isObject(parsed.value)) return json({ error: "invalid_mission" }, 400);

  const body = parsed.value;
  const assignedAccountId = body.assignedAccountId;
  const scopeKey = body.scopeKey;
  const rawPermissions = body.permissions;
  const dueAt = body.dueAt === undefined ? null : body.dueAt;
  if (typeof assignedAccountId !== "string" || assignedAccountId.length < 1 || assignedAccountId.length > 128 ||
      typeof scopeKey !== "string" || scopeKey.trim().length < 1 || scopeKey.trim().length > 200 ||
      !Array.isArray(rawPermissions) || rawPermissions.length < 1 ||
      !rawPermissions.every((permission): permission is Permission => typeof permission === "string" && PERMISSIONS.includes(permission as Permission)) ||
      new Set(rawPermissions).size !== rawPermissions.length ||
      (dueAt !== null && (typeof dueAt !== "number" || !Number.isSafeInteger(dueAt) || dueAt <= Date.now()))) {
    return json({ error: "invalid_mission" }, 400);
  }

  const now = Date.now();
  const missionId = crypto.randomUUID();
  try {
    const assignee = await env.DB.prepare(
      "SELECT id FROM accounts WHERE id = ? AND status = 'active' LIMIT 1",
    ).bind(assignedAccountId).first<{ id: string }>();
    if (!assignee) return json({ error: "assignee_not_active" }, 404);

    const statements = [
      env.DB.prepare(
        `INSERT INTO admin_missions
         (id, assigned_account_id, created_by_account_id, scope_key, status, due_at, created_at, updated_at, version)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?, 1)`,
      ).bind(missionId, assignedAccountId, admin.value.accountId, scopeKey.trim(), dueAt, now, now),
      ...rawPermissions.map((permission) => env.DB.prepare(
        "INSERT INTO admin_mission_permissions (mission_id, permission, granted_at) VALUES (?, ?, ?)",
      ).bind(missionId, permission, now)),
      env.DB.prepare(
        `INSERT INTO admin_audit_events
         (id, actor_account_id, actor_device_id, mission_id, action, scope_key, permission_used, outcome, occurred_at)
         VALUES (?, ?, ?, ?, 'mission_created', ?, 'admin.missions.create', 'success', ?)`,
      ).bind(crypto.randomUUID(), admin.value.accountId, admin.value.deviceId, missionId, scopeKey.trim(), now),
    ];
    const results = await env.DB.batch(statements);
    if (results.some((result) => !result.success)) return json({ error: "admin_service_unavailable" }, 503);
    return json({ created: true, missionId, status: "active", permissions: rawPermissions, createdAt: now }, 201);
  } catch {
    return json({ error: "admin_service_unavailable" }, 503);
  }
};
