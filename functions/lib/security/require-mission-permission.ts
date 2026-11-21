import {
  requireAuthenticatedDeviceSession,
  type AuthenticatedDeviceSession,
} from "./require-authenticated-device-session.ts";

export type MissionPermission = "read" | "create" | "update" | "process" | "export" | "delete";
export interface AuthorizedMission {
  readonly missionId: string;
  readonly scopeKey: string;
  readonly permission: MissionPermission;
  readonly version: number;
}
export type MissionPermissionResult =
  | { readonly ok: true; readonly session: AuthenticatedDeviceSession; readonly mission: AuthorizedMission }
  | { readonly ok: false; readonly status: 401 | 403 | 503 };

/**
 * Autorisation déléguée sans héritage : session active, mission active,
 * échéance valide, permission explicitement accordée et périmètre exact.
 * Aucun délégué ne reçoit de capacité de création ou de gestion de mission.
 */
export async function requireMissionPermission(
  request: Request,
  db: D1Database | undefined,
  missionId: string,
  permission: MissionPermission,
  expectedScopeKey: string,
): Promise<MissionPermissionResult> {
  const authenticated = await requireAuthenticatedDeviceSession(request, db);
  if (!authenticated.ok) return authenticated;
  if (!db || !missionId || !expectedScopeKey) return { ok: false, status: 403 };

  try {
    const row = await db.prepare(
      `SELECT m.id, m.scope_key, m.version
       FROM admin_missions m
       JOIN admin_mission_permissions p ON p.mission_id = m.id
       WHERE m.id = ?
         AND m.assigned_account_id = ?
         AND m.status = 'active'
         AND (m.due_at IS NULL OR m.due_at > ?)
         AND m.scope_key = ?
         AND p.permission = ?
       LIMIT 1`,
    ).bind(missionId, authenticated.value.accountId, Date.now(), expectedScopeKey, permission)
      .first<{ id: string; scope_key: string; version: number }>();

    if (!row) {
      await db.prepare(
        `INSERT INTO admin_audit_events
         (id, actor_account_id, actor_device_id, mission_id, action, scope_key,
          permission_used, outcome, occurred_at)
         VALUES (?, ?, ?, ?, 'mission_permission_denied', ?, ?, 'denied', ?)`,
      ).bind(
        crypto.randomUUID(), authenticated.value.accountId, authenticated.value.deviceId,
        missionId, expectedScopeKey, permission, Date.now(),
      ).run();
      return { ok: false, status: 403 };
    }

    return {
      ok: true,
      session: authenticated.value,
      mission: { missionId: row.id, scopeKey: row.scope_key, permission, version: row.version },
    };
  } catch {
    return { ok: false, status: 503 };
  }
}
