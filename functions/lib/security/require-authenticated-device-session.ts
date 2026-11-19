import { readSessionCookie } from "./session-cookie.ts";
import { hashSessionToken } from "./session-token.ts";
import { authorizeDeviceSession, type DeviceSessionRecord, type SessionAuthorizationContext } from "../../../src/domain/session-authorization.ts";
import { getSessionExpiresAt } from "../../../src/domain/auth-policy.ts";

export interface AuthenticatedDeviceSession {
  readonly accountId: string;
  readonly deviceId: string;
  readonly sessionId: string;
  readonly token: string;
}

export type DeviceSessionGuardResult =
  | { readonly ok: true; readonly value: AuthenticatedDeviceSession }
  | { readonly ok: false; readonly status: 401 | 503 };

/**
 * Vérifie à chaque requête l'identité de session, le compte et l'appareil
 * depuis D1. L'identifiant de compte n'est jamais accepté depuis le JSON client.
 */
export async function requireAuthenticatedDeviceSession(
  request: Request,
  db: D1Database | undefined,
  nowMs = Date.now(),
  cryptoProvider: Crypto = crypto,
): Promise<DeviceSessionGuardResult> {
  if (!db || !Number.isSafeInteger(nowMs) || nowMs < 0) {
    return { ok: false, status: 503 };
  }

  const token = readSessionCookie(request);
  if (!token) return { ok: false, status: 401 };

  try {
    const tokenHash = await hashSessionToken(cryptoProvider, token);
    if (!tokenHash) return { ok: false, status: 401 };

    const now = new Date(nowMs).toISOString();
    const row = await db.prepare(
      `SELECT s.id AS session_id, s.account_id, s.device_id, s.token_hash,
              s.status AS session_status, s.auth_version AS session_auth_version,
              s.created_at, s.last_activity_at, s.expires_at, s.revoked_at,
              a.status AS account_status, d.status AS device_status,
              d.auth_version AS current_device_auth_version
       FROM device_sessions s
       JOIN accounts a ON a.id = s.account_id
       JOIN devices d ON d.id = s.device_id AND d.account_id = s.account_id
       WHERE s.token_hash = ? LIMIT 1`,
    ).bind(tokenHash).first<Record<string, unknown>>();

    if (!row || typeof row.session_id !== "string" || typeof row.account_id !== "string" ||
        typeof row.device_id !== "string" || typeof row.token_hash !== "string" ||
        typeof row.session_status !== "string" || typeof row.session_auth_version !== "number" ||
        typeof row.created_at !== "number" || typeof row.last_activity_at !== "number" ||
        typeof row.expires_at !== "number" ||
        (row.revoked_at !== null && typeof row.revoked_at !== "number") ||
        typeof row.account_status !== "string" || typeof row.device_status !== "string" ||
        typeof row.current_device_auth_version !== "number") {
      return { ok: false, status: 401 };
    }

    const session: DeviceSessionRecord = {
      sessionId: row.session_id,
      accountId: row.account_id,
      deviceId: row.device_id,
      tokenHash: row.token_hash,
      status: row.session_status as "active" | "revoked",
      authVersion: row.session_auth_version,
      createdAt: new Date(row.created_at).toISOString(),
      lastActivityAt: new Date(row.last_activity_at).toISOString(),
      expiresAt: new Date(row.expires_at).toISOString(),
      revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at as number).toISOString(),
    };

    const authorization = authorizeDeviceSession(session, {
      expectedAccountId: row.account_id,
      expectedDeviceId: row.device_id,
      accountStatus: row.account_status as SessionAuthorizationContext["accountStatus"],
      currentDeviceAuthVersion: row.current_device_auth_version,
      deviceStatus: row.device_status as SessionAuthorizationContext["deviceStatus"],
      now,
    });
    if (!authorization.ok) return { ok: false, status: 401 };

    const nextExpiry = getSessionExpiresAt({ createdAt: session.createdAt, lastActivityAt: now });
    if (!nextExpiry) return { ok: false, status: 401 };

    const updated = await db.prepare(
      `UPDATE device_sessions SET last_activity_at = ?, expires_at = ?
       WHERE id = ? AND token_hash = ? AND status = 'active'
         AND auth_version = ? AND last_activity_at <= ? AND expires_at > ?`,
    ).bind(nowMs, Date.parse(nextExpiry), session.sessionId, tokenHash, session.authVersion, nowMs, nowMs).run();

    if (!updated.success || updated.meta.changes !== 1) return { ok: false, status: 401 };
    return {
      ok: true,
      value: {
        accountId: session.accountId,
        deviceId: session.deviceId,
        sessionId: session.sessionId,
        token,
      },
    };
  } catch {
    return { ok: false, status: 503 };
  }
}
