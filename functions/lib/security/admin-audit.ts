import type { AuthenticatedDeviceSession } from "./require-authenticated-device-session.ts";

/**
 * Consigne une consultation administrative sensible sans jamais journaliser
 * la recherche brute, qui peut contenir une adresse e-mail.
 */
export async function recordAdminReadEvent(
  db: D1Database,
  session: AuthenticatedDeviceSession,
  action: string,
  permissionUsed: string,
  nowMs = Date.now(),
  missionId: string | null = null,
  scopeKey: string | null = null,
): Promise<void> {
  try {
    await db.prepare(
      `INSERT INTO admin_audit_events
       (id, actor_account_id, actor_device_id, mission_id, action, scope_key, permission_used, outcome, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'success', ?)`,
    ).bind(crypto.randomUUID(), session.accountId, session.deviceId, missionId, action, scopeKey, permissionUsed, nowMs).run();
  } catch {
    // L'audit ne doit jamais casser la lecture ni révéler la donnée consultée.
  }
}
