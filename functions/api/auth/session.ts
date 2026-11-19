import { readSessionCookie, SESSION_COOKIE_NAME } from "../../lib/security/session-cookie.ts";
import { hashSessionToken } from "../../lib/security/session-token.ts";
import { authorizeDeviceSession, type DeviceSessionRecord } from "../../../src/domain/session-authorization.ts";
import { getSessionExpiresAt } from "../../../src/domain/auth-policy.ts";

interface Env { DB: D1Database; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: HEADERS }); }

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) return json({ authenticated: false }, 503);
  const token = readSessionCookie(request);
  if (!token) return json({ authenticated: false }, 401);
  const tokenHash = await hashSessionToken(crypto, token);
  if (!tokenHash) return json({ authenticated: false }, 401);
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  try {
    const row = await env.DB.prepare(
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
        typeof row.expires_at !== "number" || (row.revoked_at !== null && typeof row.revoked_at !== "number") ||
        typeof row.account_status !== "string" || typeof row.device_status !== "string" ||
        typeof row.current_device_auth_version !== "number") return json({ authenticated: false }, 401);

    const session: DeviceSessionRecord = {
      sessionId: row.session_id, accountId: row.account_id, deviceId: row.device_id,
      tokenHash: row.token_hash, status: row.session_status as "active" | "revoked",
      authVersion: row.session_auth_version,
      createdAt: new Date(row.created_at).toISOString(),
      lastActivityAt: new Date(row.last_activity_at).toISOString(),
      expiresAt: new Date(row.expires_at).toISOString(),
      revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at as number).toISOString(),
    };
    const authorization = authorizeDeviceSession(session, {
      expectedAccountId: row.account_id,
      expectedDeviceId: row.device_id,
      accountStatus: row.account_status as "active",
      currentDeviceAuthVersion: row.current_device_auth_version,
      deviceStatus: row.device_status as "active",
      now,
    });
    if (!authorization.ok) return json({ authenticated: false }, 401);

    const nextExpiry = getSessionExpiresAt({ createdAt: session.createdAt, lastActivityAt: now });
    if (!nextExpiry) return json({ authenticated: false }, 401);
    const updated = await env.DB.prepare(
      `UPDATE device_sessions SET last_activity_at = ?, expires_at = ?
       WHERE id = ? AND token_hash = ? AND status = 'active'
         AND auth_version = ? AND last_activity_at <= ? AND expires_at > ?`,
    ).bind(nowMs, Date.parse(nextExpiry), session.sessionId, tokenHash, session.authVersion, nowMs, nowMs).run();
    if (!updated.success || updated.meta.changes !== 1) return json({ authenticated: false }, 401);
    return json({ authenticated: true, accountId: session.accountId, deviceId: session.deviceId, sessionId: session.sessionId });
  } catch { return json({ authenticated: false }, 503); }
};
