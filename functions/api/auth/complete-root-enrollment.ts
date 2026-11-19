import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
import { isAllowedWebAuthnOrigin } from "../../lib/security/webauthn-origin.ts";
import { verifyRootRegistrationResponse } from "../../lib/security/webauthn-root-verifier.ts";
import { createSessionToken } from "../../lib/security/session-token.ts";
import { createSessionCookie } from "../../lib/security/session-cookie.ts";

interface Env {
  DB: D1Database;
  WEBAUTHN_RP_ID?: string;
  WEBAUTHN_ALLOWED_ORIGINS?: string;
  WEBAUTHN_ROOT_ENROLLMENT_ENABLED?: string;
}
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
function json(body: unknown, status = 200, cookie?: string): Response {
  const headers = new Headers(HEADERS);
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers });
}
function originsFromEnv(value: string | undefined): string[] {
  if (!value || value.length > 4096) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length <= 20 && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch { return []; }
}
function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function b64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64 + "=".repeat((4 - base64.length % 4) % 4)), (c) => c.charCodeAt(0));
}
function digestHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;
  if (!env.DB || !env.WEBAUTHN_RP_ID) return json({ error: "root_enrollment_unavailable" }, 503);
  const origin = request.headers.get("Origin");
  const allowedOrigins = originsFromEnv(env.WEBAUTHN_ALLOWED_ORIGINS);
  if (!origin || !isAllowedWebAuthnOrigin(origin, env.WEBAUTHN_RP_ID, allowedOrigins)) return json({ error: "origin_not_allowed" }, 403);

  const parsed = await readJsonRequestBody(request, 40_000);
  if (!parsed.ok) return json({ error: parsed.reason === "too_large" ? "request_too_large" : "invalid_request" }, parsed.reason === "too_large" ? 413 : 400);
  if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) return json({ error: "invalid_enrollment" }, 400);
  const body = parsed.value as Record<string, unknown>;
  if (!isUuid(body.ceremonyId) || typeof body.credential !== "object" || body.credential === null || Array.isArray(body.credential)) return json({ error: "invalid_enrollment" }, 400);
  if (env.WEBAUTHN_ROOT_ENROLLMENT_ENABLED !== "true") return json({ error: "root_enrollment_not_approved" }, 503);

  const now = Date.now();
  type Ceremony = { id: string; account_id: string; origin: string; status: string; expires_at: number; challenge_id: string; challenge_digest: string; attempt_count: number; account_status: string };
  let ceremony: Ceremony | null;
  try {
    ceremony = await env.DB.prepare(
      `SELECT c.id, c.account_id, c.origin, c.status, c.expires_at,
              ch.id AS challenge_id, ch.challenge_digest, ch.attempt_count,
              a.status AS account_status
       FROM root_enrollment_ceremonies c
       JOIN root_enrollment_challenges ch ON ch.ceremony_id = c.id AND ch.account_id = c.account_id
       JOIN accounts a ON a.id = c.account_id
       WHERE c.id = ? LIMIT 1`,
    ).bind(body.ceremonyId).first<Ceremony>();
  } catch { return json({ error: "root_enrollment_unavailable" }, 503); }
  if (!ceremony || ceremony.origin !== origin || ceremony.status !== "pending" || ceremony.account_status !== "active" ||
      ceremony.expires_at <= now || ceremony.attempt_count >= 5) {
    return json({ error: "enrollment_expired_or_unavailable" }, 409);
  }

  let verified: Awaited<ReturnType<typeof verifyRootRegistrationResponse>>;
  try {
    verified = await verifyRootRegistrationResponse({
      response: body.credential,
      expectedChallengeDigest: ceremony.challenge_digest,
      expectedOrigin: ceremony.origin,
      rpId: env.WEBAUTHN_RP_ID,
      allowedOrigins,
      cryptoProvider: crypto,
    });
  } catch {
    try {
      await env.DB.prepare(
        "UPDATE root_enrollment_challenges SET attempt_count = attempt_count + 1 WHERE id = ? AND ceremony_id = ? AND consumed_at IS NULL AND expires_at > ? AND attempt_count < 5",
      ).bind(ceremony.challenge_id, ceremony.id, now).run();
      await env.DB.prepare(
        "UPDATE root_enrollment_ceremonies SET status = 'expired' WHERE id = ? AND status = 'pending' AND EXISTS (SELECT 1 FROM root_enrollment_challenges WHERE ceremony_id = ? AND attempt_count >= 5)",
      ).bind(ceremony.id, ceremony.id).run();
    } catch { /* Fail closed; do not reveal verifier details. */ }
    return json({ error: "root_credential_rejected" }, 400);
  }

  const deviceId = crypto.randomUUID();
  const credentialRecordId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  let session: Awaited<ReturnType<typeof createSessionToken>>;
  try { session = await createSessionToken(crypto); }
  catch { return json({ error: "session_creation_unavailable" }, 503); }
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000;

  try {
    const results = await env.DB.batch([
      env.DB.prepare(
        `UPDATE root_enrollment_challenges
         SET consumed_at = ?, attempt_count = attempt_count + 1
         WHERE id = ? AND ceremony_id = ? AND account_id = ?
           AND challenge_digest = ? AND consumed_at IS NULL
           AND expires_at > ? AND attempt_count < 5`,
      ).bind(now, ceremony.challenge_id, ceremony.id, ceremony.account_id, ceremony.challenge_digest, now),
      env.DB.prepare(
        `INSERT INTO devices (id, account_id, status, auth_version, created_at, revoked_at)
         SELECT ?, ?, 'active', 1, ?, NULL
         WHERE EXISTS (SELECT 1 FROM root_enrollment_challenges
           WHERE id = ? AND ceremony_id = ? AND account_id = ? AND consumed_at = ?)`,
      ).bind(deviceId, ceremony.account_id, now, ceremony.challenge_id, ceremony.id, ceremony.account_id, now),
      env.DB.prepare(
        `INSERT INTO device_root_credentials
         (id, device_id, account_id, credential_id, public_key_x, public_key_y, sign_count, credential_device_type, credential_backed_up, created_at, last_used_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, 'singleDevice', 0, ?, NULL
         WHERE EXISTS (SELECT 1 FROM devices WHERE id = ? AND account_id = ? AND status = 'active')`,
      ).bind(credentialRecordId, deviceId, ceremony.account_id, verified.credentialId, verified.publicKeyX, verified.publicKeyY, verified.signCount, now, deviceId, ceremony.account_id),
      env.DB.prepare(
        `INSERT INTO device_sessions
         (id, account_id, device_id, token_hash, status, auth_version, created_at, last_activity_at, expires_at, revoked_at)
         SELECT ?, ?, ?, ?, 'active', d.auth_version, ?, ?, ?, NULL
         FROM devices d JOIN device_root_credentials rc ON rc.device_id = d.id
         WHERE d.id = ? AND d.account_id = ? AND d.status = 'active'`,
      ).bind(sessionId, ceremony.account_id, deviceId, session.tokenHash, now, now, expiresAt, deviceId, ceremony.account_id),
      env.DB.prepare(
        "UPDATE root_enrollment_ceremonies SET status = 'completed', completed_at = ? WHERE id = ? AND account_id = ? AND status = 'pending' AND EXISTS (SELECT 1 FROM root_enrollment_challenges WHERE ceremony_id = ? AND consumed_at = ?)",
      ).bind(now, ceremony.id, ceremony.account_id, ceremony.id, now),
      env.DB.prepare(
        "INSERT INTO device_enrollment_events (id, ceremony_id, account_id, device_id, session_id, event_type, created_at) VALUES (?, ?, ?, ?, ?, 'root_device_enrolled', ?)",
      ).bind(eventId, ceremony.id, ceremony.account_id, deviceId, sessionId, now),
    ]);
    if (results.some((result) => !result.success) || results.some((result) => result.meta.changes !== 1)) {
      return json({ error: "root_enrollment_conflict" }, 409);
    }
  } catch {
    return json({ error: "root_enrollment_conflict" }, 409);
  }

  return json({
    enrolled: true,
    device: { id: deviceId, status: "active", credentialType: "singleDevice", backedUp: false },
    session: { id: sessionId, expiresAt: new Date(expiresAt).toISOString() },
  }, 201, createSessionCookie(session.token));
};
