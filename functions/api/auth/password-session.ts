import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
import { normalizeRegistrationEmail } from "../../../src/domain/registration-policy.ts";
import { verifyAccountPassword } from "../../lib/security/password-hash.ts";
import { createSessionToken } from "../../lib/security/session-token.ts";
import { createSessionCookie } from "../../lib/security/session-cookie.ts";
import { createDeviceCookie, readDeviceCookie } from "../../lib/security/device-cookie.ts";

interface Env {
  DB: D1Database;
  EMAIL_OTP_HMAC_SECRET?: string;
  MULTI_DEVICE_PASSWORD_LOGIN_ENABLED?: string;
}

const HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};
const DUMMY_PASSWORD_HASH = "pbkdf2-sha256$100000$QJCawctZHugzwvMPBYGVgw$aHm2jdlvnZ5DlVbSo7a3_l6N6uW74-bAAAaadoxm10Q";
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

interface LegacyAccountRow {
  id: string;
  status: string;
  password_hash: string;
  device_id: string | null;
  device_status: string | null;
  credential_id: string | null;
}

interface MultiDeviceAccountRow {
  id: string;
  status: string;
  password_hash: string;
}

function json(body: unknown, status = 200, cookies: string[] = []): Response {
  const headers = new Headers(HEADERS);
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;
  if (!env.DB || !env.EMAIL_OTP_HMAC_SECRET || env.EMAIL_OTP_HMAC_SECRET.length < 32) {
    return json({ error: "authentication_unavailable" }, 503);
  }

  const parsed = await readJsonRequestBody(request, 8192);
  if (!parsed.ok) {
    return json({ error: parsed.reason === "too_large" ? "request_too_large" : "invalid_request" }, parsed.reason === "too_large" ? 413 : 400);
  }
  if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) {
    return json({ error: "invalid_credentials" }, 400);
  }
  const body = parsed.value as Record<string, unknown>;
  const email = normalizeRegistrationEmail(body.email);
  if (!email || typeof body.password !== "string" || body.password.length < 1 || body.password.length > 1024) {
    return json({ error: "invalid_credentials" }, 400);
  }

  const multiDeviceEnabled = env.MULTI_DEVICE_PASSWORD_LOGIN_ENABLED === "true";
  const now = Date.now();
  try {
    const rateKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(env.EMAIL_OTP_HMAC_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const rateDigest = new Uint8Array(await crypto.subtle.sign(
      "HMAC",
      rateKey,
      new TextEncoder().encode("SAC:password-session-rate:v1:" + email),
    ));
    const emailHash = Array.from(rateDigest, (byte) => byte.toString(16).padStart(2, "0")).join("");
    await env.DB.prepare(
      `INSERT INTO root_enrollment_rate_limits (email_hash, window_started_at, attempt_count, updated_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(email_hash) DO UPDATE SET
         attempt_count = CASE WHEN root_enrollment_rate_limits.window_started_at <= ? THEN 1 ELSE root_enrollment_rate_limits.attempt_count + 1 END,
         window_started_at = CASE WHEN root_enrollment_rate_limits.window_started_at <= ? THEN excluded.window_started_at ELSE root_enrollment_rate_limits.window_started_at END,
         updated_at = excluded.updated_at`,
    ).bind(emailHash, now, now, now - WINDOW_MS, now - WINDOW_MS).run();
    const rate = await env.DB.prepare("SELECT attempt_count FROM root_enrollment_rate_limits WHERE email_hash = ?")
      .bind(emailHash)
      .first<{ attempt_count: number }>();
    if (!rate || rate.attempt_count > MAX_ATTEMPTS) return json({ error: "too_many_attempts" }, 429);

    let account: LegacyAccountRow | MultiDeviceAccountRow | null;
    if (multiDeviceEnabled) {
      account = await env.DB.prepare(
        `SELECT a.id, a.status, a.password_hash
         FROM accounts a
         JOIN account_identities i ON i.account_id = a.id
         WHERE i.channel = 'email' AND i.is_primary = 1 AND i.verified_at IS NOT NULL
           AND i.normalized_value = ?
         LIMIT 1`,
      ).bind(email).first<MultiDeviceAccountRow>();
    } else {
      account = await env.DB.prepare(
        `SELECT a.id, a.status, a.password_hash,
                d.id AS device_id, d.status AS device_status,
                c.credential_id
         FROM accounts a
         JOIN account_identities i ON i.account_id = a.id
         LEFT JOIN devices d ON d.account_id = a.id
         LEFT JOIN device_root_credentials c ON c.device_id = d.id AND c.account_id = a.id
         WHERE i.channel = 'email' AND i.is_primary = 1 AND i.verified_at IS NOT NULL
           AND i.normalized_value = ?
         LIMIT 1`,
      ).bind(email).first<LegacyAccountRow>();
    }

    const matches = await verifyAccountPassword(crypto, body.password, account?.password_hash ?? DUMMY_PASSWORD_HASH);
    if (!account || account.status !== "active" || !matches) {
      return json({ error: "invalid_credentials" }, 401);
    }

    let deviceId: string;
    let securityKeyConfigured: boolean;

    if (!multiDeviceEnabled) {
      const legacy = account as LegacyAccountRow;
      if (legacy.credential_id) return json({ error: "security_key_required" }, 409);
      if (legacy.device_status !== null && legacy.device_status !== "active") {
        return json({ error: "root_device_unavailable" }, 409);
      }
      deviceId = legacy.device_id ?? crypto.randomUUID();
      securityKeyConfigured = false;
      if (!legacy.device_id) {
        await env.DB.prepare(
          "INSERT INTO devices (id, account_id, status, auth_version, created_at, revoked_at) VALUES (?, ?, 'active', 1, ?, NULL)",
        ).bind(deviceId, account.id, now).run();
      }
    } else {
      const cookieDeviceId = readDeviceCookie(request);
      const existingDevice = cookieDeviceId
        ? await env.DB.prepare(
          "SELECT id, status FROM devices WHERE id = ? AND account_id = ? LIMIT 1",
        ).bind(cookieDeviceId, account.id).first<{ id: string; status: string }>()
        : null;

      if (existingDevice?.status === "active") {
        deviceId = existingDevice.id;
      } else {
        deviceId = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO devices (id, account_id, status, auth_version, created_at, revoked_at) VALUES (?, ?, 'active', 1, ?, NULL)",
        ).bind(deviceId, account.id, now).run();
      }

      const accountCredential = await env.DB.prepare(
        "SELECT credential_id FROM device_root_credentials WHERE account_id = ? LIMIT 1",
      ).bind(account.id).first<{ credential_id: string }>();
      securityKeyConfigured = Boolean(accountCredential?.credential_id);
    }

    const session = await createSessionToken(crypto);
    const sessionId = crypto.randomUUID();
    const expiresAt = now + SESSION_DURATION_MS;
    await env.DB.prepare(
      `INSERT INTO device_sessions
       (id, account_id, device_id, token_hash, status, auth_version, created_at, last_activity_at, expires_at, revoked_at)
       VALUES (?, ?, ?, ?, 'active', 1, ?, ?, ?, NULL)`,
    ).bind(sessionId, account.id, deviceId, session.tokenHash, now, now, expiresAt).run();

    const cookies = [createSessionCookie(session.token)];
    if (multiDeviceEnabled) cookies.push(createDeviceCookie(deviceId));

    return json({
      authenticated: true,
      securityKeyConfigured,
      session: { id: sessionId, expiresAt: new Date(expiresAt).toISOString() },
    }, 201, cookies);
  } catch {
    return json({ error: "authentication_unavailable" }, 503);
  }
};
