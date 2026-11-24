import {
  requireAuthenticatedDeviceSession,
  type AuthenticatedDeviceSession,
} from "./require-authenticated-device-session.ts";

export type SupportMissionPermission = "read" | "process";
export type SupportMissionAccessResult =
  | { readonly ok: true; readonly value: AuthenticatedDeviceSession; readonly isSuperAdmin: boolean; readonly missionId: string | null }
  | { readonly ok: false; readonly status: 401 | 403 | 503 };

/**
 * Autorise le Super Admin ou un collaborateur muni d'une mission active
 * explicitement limitée au périmètre support et à la permission demandée.
 * Les rôles et périmètres sont toujours lus depuis D1, jamais depuis le client.
 */
export async function requireSupportMissionAccess(
  request: Request,
  db: D1Database | undefined,
  permission: SupportMissionPermission,
  nowMs = Date.now(),
): Promise<SupportMissionAccessResult> {
  const authenticated = await requireAuthenticatedDeviceSession(request, db);
  if (!authenticated.ok) return authenticated;
  if (!db || !Number.isSafeInteger(nowMs) || nowMs < 0) return { ok: false, status: 503 };

  try {
    const role = await db.prepare(
      "SELECT 1 AS allowed FROM account_roles WHERE account_id = ? AND role = 'super_admin' LIMIT 1",
    ).bind(authenticated.value.accountId).first<{ allowed: number }>();
    if (role?.allowed) {
      return { ok: true, value: authenticated.value, isSuperAdmin: true, missionId: null };
    }

    const mission = await db.prepare(
      `SELECT m.id
       FROM admin_missions m
       JOIN admin_mission_permissions p ON p.mission_id = m.id
       WHERE m.assigned_account_id = ?
         AND m.scope_key = 'support'
         AND m.status = 'active'
         AND (m.due_at IS NULL OR m.due_at > ?)
         AND p.permission = ?
         AND (? <> 'process' OR EXISTS (
           SELECT 1 FROM admin_mission_permissions reader
           WHERE reader.mission_id = m.id AND reader.permission = 'read'
         ))
       ORDER BY m.created_at DESC, m.id
       LIMIT 1`,
    ).bind(authenticated.value.accountId, nowMs, permission, permission).first<{ id: string }>();

    if (!mission) return { ok: false, status: 403 };
    return { ok: true, value: authenticated.value, isSuperAdmin: false, missionId: mission.id };
  } catch {
    return { ok: false, status: 503 };
  }
}
