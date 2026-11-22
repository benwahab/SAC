import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
import { normalizeRegistrationEmail } from "../../../src/domain/registration-policy.ts";
import { verifyAccountPassword } from "../../lib/security/password-hash.ts";
import { isAllowedWebAuthnOrigin } from "../../lib/security/webauthn-origin.ts";

interface Env {
  DB: D1Database;
  WEBAUTHN_RP_ID?: string;
  WEBAUTHN_ALLOWED_ORIGINS?: string;
  EMAIL_OTP_HMAC_SECRET?: string;
}
interface LoginAccount {
  id: string;
  status: string;
  password_hash?: string;
  device_id: string | null;
  device_status: string | null;
  credential_id: string | null;
}
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
const DUMMY_PASSWORD_HASH = "pbkdf2-sha256$100000$QJCawctZHugzwvMPBYGVgw$aHm2jdlvnZ5DlVbSo7a3_l6N6uW74-bAAAaadoxm10Q";
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}
function originsFromEnv(value: string | undefined): string[] {
  if (!value || value.length > 4096) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length <= 20 && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch { return []; }
}
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function validCredentialId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,1024}$/.test(value);
}
async function enforceRateLimit(env: Env, value: string, now: number): Promise<"ok" | "limited" | "unavailable"> {
  try {
    const rateKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.EMAIL_OTP_HMAC_SECRET as string), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const rateDigest = new Uint8Array(await crypto.subtle.sign("HMAC", rateKey, new TextEncoder().encode("SAC:root-authentication-rate:v1:" + value)));
    const emailHash = Array.from(rateDigest, (byte) => byte.toString(16).padStart(2, "0")).join("");
    await env.DB.prepare(
      `INSERT INTO root_enrollment_rate_limits (email_hash, window_started_at, attempt_count, updated_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(email_hash) DO UPDATE SET
         attempt_count = CASE WHEN root_enrollment_rate_limits.window_started_at <= ? THEN 1 ELSE root_enrollment_rate_limits.attempt_count + 1 END,
         window_started_at = CASE WHEN root_enrollment_rate_limits.window_started_at <= ? THEN excluded.window_started_at ELSE root_enrollment_rate_limits.window_started_at END,
         updated_at = excluded.updated_at`,
    ).bind(emailHash, now, now, now - WINDOW_MS, now - WINDOW_MS).run();
    const rate = await env.DB.prepare("SELECT attempt_count FROM root_enrollment_rate_limits WHERE email_hash = ?").bind(emailHash).first<{ attempt_count: number }>();
    if (!rate || !Number.isSafeInteger(rate.attempt_count)) return "unavailable";
    return rate.attempt_count > MAX_ATTEMPTS ? "limited" : "ok";
  } catch {
    return "unavailable";
  }
}
async function challengeResponse(env: Env, account: LoginAccount, origin: string, now: number): Promise<Response> {
  if (!account.device_id || !account.credential_id) return json({ error: "root_enrollment_required" }, 409);
  if (account.device_status !== "active") return json({ error: "root_device_unavailable" }, 409);
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const challengeDigest = new Uint8Array(await crypto.subtle.digest("SHA-256", challenge));
    const digestHex = Array.from(challengeDigest, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const id = crypto.randomUUID();
    const expiresAt = now + 5 * 60 * 1000;
    await env.DB.prepare(
      "INSERT INTO root_authentication_challenges (id, account_id, device_id, origin, challenge_digest, created_at, expires_at, consumed_at, attempt_count) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0)",
    ).bind(id, account.id, account.device_id, origin, digestHex, now, expiresAt).run();

    return json({
      challengeId: id,
      expiresAt,
      publicKey: {
        challenge: toBase64Url(challenge),
        rpId: env.WEBAUTHN_RP_ID,
        timeout: 300000,
        userVerification: "required",
        allowCredentials: [{ type: "public-key", id: account.credential_id }],
      },
    });
  } catch {
    return json({ error: "authentication_unavailable" }, 503);
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;
  if (!env.DB || !env.WEBAUTHN_RP_ID || !env.EMAIL_OTP_HMAC_SECRET || env.EMAIL_OTP_HMAC_SECRET.length < 32) {
    return json({ error: "authentication_unavailable" }, 503);
  }
  const origin = request.headers.get("Origin");
  const allowedOrigins = originsFromEnv(env.WEBAUTHN_ALLOWED_ORIGINS);
  if (!origin || !isAllowedWebAuthnOrigin(origin, env.WEBAUTHN_RP_ID, allowedOrigins)) {
    return json({ error: "origin_not_allowed" }, 403);
  }
  const parsed = await readJsonRequestBody(request, 8192);
  if (!parsed.ok) return json({ error: parsed.reason === "too_large" ? "request_too_large" : "invalid_request" }, parsed.reason === "too_large" ? 413 : 400);
  if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) return json({ error: "invalid_credentials" }, 400);
  const body = parsed.value as Record<string, unknown>;
  const now = Date.now();

  if (body.credentialId !== undefined) {
    if (!validCredentialId(body.credentialId)) return json({ error: "invalid_credentials" }, 400);
    const rate = await enforceRateLimit(env, "credential:" + body.credentialId, now);
    if (rate === "limited") return json({ error: "too_many_attempts" }, 429);
    if (rate === "unavailable") return json({ error: "authentication_unavailable" }, 503);
    try {
      const account = await env.DB.prepare(
        `SELECT a.id, a.status, d.id AS device_id, d.status AS device_status, c.credential_id
         FROM device_root_credentials c
         JOIN devices d ON d.id = c.device_id AND d.account_id = c.account_id
         JOIN accounts a ON a.id = c.account_id
         WHERE c.credential_id = ? LIMIT 1`,
      ).bind(body.credentialId).first<LoginAccount>();
      if (!account || account.status !== "active" || account.device_status !== "active") {
        return json({ error: "invalid_credentials" }, 401);
      }
      return await challengeResponse(env, account, origin, now);
    } catch {
      return json({ error: "authentication_unavailable" }, 503);
    }
  }

  const email = normalizeRegistrationEmail(body.email);
  if (!email || typeof body.password !== "string" || body.password.length < 1 || body.password.length > 1024) {
    return json({ error: "invalid_credentials" }, 400);
  }
  const rate = await enforceRateLimit(env, email, now);
  if (rate === "limited") return json({ error: "too_many_attempts" }, 429);
  if (rate === "unavailable") return json({ error: "authentication_unavailable" }, 503);

  try {
    const account = await env.DB.prepare(
      `SELECT a.id, a.status, a.password_hash, d.id AS device_id, d.status AS device_status, c.credential_id
       FROM accounts a
       JOIN account_identities i ON i.account_id = a.id
       LEFT JOIN devices d ON d.account_id = a.id
       LEFT JOIN device_root_credentials c ON c.device_id = d.id AND c.account_id = a.id
       WHERE i.channel = 'email' AND i.is_primary = 1 AND i.verified_at IS NOT NULL
         AND i.normalized_value = ?
       LIMIT 1`,
    ).bind(email).first<LoginAccount>();
    const matches = await verifyAccountPassword(crypto, body.password, account?.password_hash ?? DUMMY_PASSWORD_HASH);
    if (!account || account.status !== "active" || !matches) return json({ error: "invalid_credentials" }, 401);
    if (!account.credential_id) return json({ error: "root_enrollment_required" }, 409);
    return await challengeResponse(env, account, origin, now);
  } catch {
    return json({ error: "authentication_unavailable" }, 503);
  }
};
