import { requireSuperAdminSession } from "../../../lib/security/require-super-admin-session.ts";
import { guardSameOriginJsonPost } from "../../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../../lib/security/json-request-body.ts";

interface Env { DB: D1Database; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
const PERMISSIONS = ["read", "create", "update", "process", "export", "delete"] as const;
type Permission = typeof PERMISSIONS[number];
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: HEADERS }); }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const originError = guardSameOriginJsonPost(request);
  if (originError) return originError;
  const admin = await requireSuperAdminSession(request, env.DB);
  if (!admin.ok) return json({ error: admin.status === 401 ? "authentication_required" : admin.status === 403 ? "super_admin_required" : "admin_service_unavailable" }, admin.status);

  const missionId = typeof params.missionId === "string" ? params.missionId : "";
  if (!/^[0-9a-f-]{36}$/i.test(missionId)) return json({ error: "mission_not_found" }, 404);
  const parsed = await readJsonRequestBody(request, 8_192);
  if (!parsed.ok) return json({ error: parsed.reason === "too_large" ? "request_too_large" : "invalid_request" }, parsed.reason === "too_large" ? 413 : 400);
  if (!isObject(parsed.value) || typeof parsed.value.action !== "string") return json({ error: "invalid_mission_action" }, 400);

  const now = Date.now();
  try {
    const current = await env.DB.prepare(
      "SELECT id, assigned_account_id, scope_key, status, due_at FROM admin_missions WHERE id = ? LIMIT 1",
    ).bind(missionId).first<{ id: string; assigned_account_id: string; scope_key: string; status: string; due_at: number | null }>();
    if (!current) return json({ error: "mission_not_found" }, 404);
    if (current.status === "revoked") return json({ error: "mission_revoked" }, 409);

    let nextStatus = current.status;
    let nextAssignee = current.assigned_account_id;
    let nextScope = current.scope_key;
    let nextDueAt = current.due_at;
    let permissionRows: Permission[] | null = null;
    let actionName: string;

    if (parsed.value.action === "suspend") {
      nextStatus = "suspended";
      actionName = "mission_suspended";
    } else if (parsed.value.action === "resume") {
      if (current.due_at !== null && current.due_at <= now) return json({ error: "mission_expired" }, 409);
      nextStatus = "active";
      actionName = "mission_resumed";
    } else if (parsed.value.action === "revoke") {
      nextStatus = "revoked";
      actionName = "mission_revoked";
    } else if (parsed.value.action === "replace") {
      const body = parsed.value;
      if (typeof body.assignedAccountId !== "string" || body.assignedAccountId.length < 1 || body.assignedAccountId.length > 128 ||
          typeof body.scopeKey !== "string" || body.scopeKey.trim().length < 1 || body.scopeKey.trim().length > 200 ||
          !Array.isArray(body.permissions) || body.permissions.length < 1 ||
          !body.permissions.every((permission): permission is Permission => typeof permission === "string" && PERMISSIONS.includes(permission as Permission)) ||
          new Set(body.permissions).size !== body.permissions.length ||
          (body.dueAt !== null && body.dueAt !== undefined && (typeof body.dueAt !== "number" || !Number.isSafeInteger(body.dueAt) || body.dueAt <= now))) {
        return json({ error: "invalid_mission" }, 400);
      }
      const assignee = await env.DB.prepare("SELECT id FROM accounts WHERE id = ? AND status = 'active' LIMIT 1")
        .bind(body.assignedAccountId).first<{ id: string }>();
      if (!assignee) return json({ error: "assignee_not_active" }, 404);
      nextAssignee = body.assignedAccountId;
      nextScope = body.scopeKey.trim();
      nextDueAt = body.dueAt === undefined ? null : body.dueAt as number | null;
      permissionRows = body.permissions as Permission[];
      actionName = "mission_replaced";
    } else {
      return json({ error: "invalid_mission_action" }, 400);
    }

    const statements: D1PreparedStatement[] = [
      env.DB.prepare(
        `UPDATE admin_missions
         SET assigned_account_id = ?, scope_key = ?, status = ?, due_at = ?,
             updated_at = ?, version = version + 1
         WHERE id = ? AND status <> 'revoked'`,
      ).bind(nextAssignee, nextScope, nextStatus, nextDueAt, now, missionId),
    ];
    if (permissionRows) {
      statements.push(env.DB.prepare("DELETE FROM admin_mission_permissions WHERE mission_id = ?").bind(missionId));
      for (const permission of permissionRows) {
        statements.push(env.DB.prepare(
          "INSERT INTO admin_mission_permissions (mission_id, permission, granted_at) VALUES (?, ?, ?)",
        ).bind(missionId, permission, now));
      }
    }
    statements.push(env.DB.prepare(
      `INSERT INTO admin_audit_events
       (id, actor_account_id, actor_device_id, mission_id, action, scope_key, permission_used, outcome, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, 'admin.missions.manage', 'success', ?)`,
    ).bind(crypto.randomUUID(), admin.value.accountId, admin.value.deviceId, missionId, actionName, nextScope, now));

    const results = await env.DB.batch(statements);
    if (results.some((result) => !result.success)) return json({ error: "admin_service_unavailable" }, 503);
    return json({ updated: true, missionId, status: nextStatus, assignedAccountId: nextAssignee, scopeKey: nextScope, dueAt: nextDueAt, permissions: permissionRows ?? undefined, updatedAt: now });
  } catch {
    return json({ error: "admin_service_unavailable" }, 503);
  }
};
