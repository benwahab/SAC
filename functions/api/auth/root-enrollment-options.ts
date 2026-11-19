import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
import { normalizeRegistrationEmail } from "../../../src/domain/registration-policy.ts";
import { verifyAccountPassword } from "../../lib/security/password-hash.ts";
import { createRootRegistrationOptions } from "../../lib/security/webauthn-root-options.ts";
import { isAllowedWebAuthnOrigin } from "../../lib/security/webauthn-origin.ts";

interface Env {
  DB: D1Database;
  WEBAUTHN_RP_ID?: string;
  WEBAUTHN_RP_NAME?: string;
  WEBAUTHN_ALLOWED_ORIGINS?: string;
  EMAIL_OTP_HMAC_SECRET?: string;
}
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
const DUMMY_PASSWORD_HASH = "pbkdf2-sha256$600000$PFp-kbLU9ggaPF5_kLLU9g$UH7I5h10GxoZrC61QkcmamX2kS6MSnPQ8-aJwoD_mWA";
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}
function uuidBytes(value: string): Uint8Array {
  const hex = value.replace(/-/g, "");
  if (!/^[a-f0-9]{32}$/i.test(hex)) throw new Error("account_identifier_invalid");
  return Uint8Array.from(hex.match(/.{2}/g)!, (part) => Number.parseInt(part, 16));
}
function decodeChallenge(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64 + "=".repeat((4 - base64.length % 4) % 4)), (c) => c.charCodeAt(0));
}
function configuredOrigins(value: string | undefined): string[] {
  if (!value || value.length > 4096) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length <= 20 && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch { return []; }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;
  if (!env.DB || !env.WEBAUTHN_RP_ID || !env.WEBAUTHN_RP_NAME || !env.EMAIL_OTP_HMAC_SECRET || env.EMAIL_OTP_HMAC_SECRET.length < 32) return json({ error: "root_enrollment_unavailable" }, 503);
  const origins = configuredOrigins(env.WEBAUTHN_ALLOWED_ORIGINS);
  const origin = request.headers.get("Origin");
  if (!origin || !isAllowedWebAuthnOrigin(origin, env.WEBAUTHN_RP_ID, origins)) {
    return json({ error: "origin_not_allowed" }, 403);
  }

  const parsed = await readJsonRequestBody(request, 8192);
  if (!parsed.ok) return json({ error: parsed.reason === "too_large" ? "request_too_large" : "invalid_request" }, parsed.reason === "too_large" ? 413 : 400);
  if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) return json({ error: "invalid_credentials" }, 400);
  const body = parsed.value as Record<string, unknown>;
  const email = normalizeRegistrationEmail(body.email);
  if (!email || typeof body.password !== "string" || body.password.length < 1 || body.password.length > 1024) {
    return json({ error: "invalid_credentials" }, 400);
  }

  const now = Date.now();
  const rateKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.EMAIL_OTP_HMAC_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);\n  const emailHashBytes = new Uint8Array(await crypto.subtle.sign("HMAC", rateKey, new TextEncoder().encode("SAC:root-enrollment-rate:v1:" + email)));
  const emailHash = Array.from(emailHashBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  try {
    await env.DB.prepare(
      `INSERT INTO root_enrollment_rate_limits (email_hash, window_started_at, attempt_count, updated_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(email_hash) DO UPDATE SET
         attempt_count = CASE WHEN root_enrollment_rate_limits.window_started_at <= ? THEN 1 ELSE root_enrollment_rate_limits.attempt_count + 1 END,
         window_started_at = CASE WHEN root_enrollment_rate_limits.window_started_at <= ? THEN excluded.window_started_at ELSE root_enrollment_rate_limits.window_started_at END,
         updated_at = excluded.updated_at`,
    ).bind(emailHash, now, now, now - WINDOW_MS, now - WINDOW_MS).run();
    const limit = await env.DB.prepare("SELECT attempt_count FROM root_enrollment_rate_limits WHERE email_hash = ?").bind(emailHash).first<{ attempt_count: number }>();
    if (!limit || limit.attempt_count > MAX_ATTEMPTS) return json({ error: "too_many_attempts" }, 429);

    const account = await env.DB.prepare(
      `SELECT a.id, a.status, a.password_hash
       FROM accounts a
       JOIN account_identities i ON i.account_id = a.id
       WHERE i.channel = 'email' AND i.is_primary = 1
         AND i.verified_at IS NOT NULL AND i.normalized_value = ?
       LIMIT 1`,
    ).bind(email).first<{ id: string; status: string; password_hash: string }>();

    const passwordHash = account?.password_hash ?? DUMMY_PASSWORD_HASH;
    const passwordMatches = await verifyAccountPassword(crypto, body.password, passwordHash);
    if (!account || account.status !== "active" || !passwordMatches) {
      return json({ error: "invalid_credentials" }, 401);
    }

    const ceremonyId = crypto.randomUUID();
    const challengeId = crypto.randomUUID();
    const userHandle = uuidBytes(account.id);
    const options = createRootRegistrationOptions({
      rpId: env.WEBAUTHN_RP_ID,
      rpName: env.WEBAUTHN_RP_NAME,
      userHandle,
      userName: "SAC-" + account.id.slice(0, 8),
      userDisplayName: "Compte SAC",
      residentKey: "discouraged",
    }, crypto);
    const challengeDigestBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", decodeChallenge(options.challenge)));
    const challengeDigest = Array.from(challengeDigestBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const expiresAt = now + 5 * 60 * 1000;

    await env.DB.prepare(
      "UPDATE root_enrollment_ceremonies SET status = 'expired' WHERE account_id = ? AND status = 'pending' AND expires_at <= ?",
    ).bind(account.id, now).run();

    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO root_enrollment_ceremonies (id, account_id, status, created_at, expires_at, completed_at) VALUES (?, ?, 'pending', ?, ?, NULL)",
      ).bind(ceremonyId, account.id, now, expiresAt),
      env.DB.prepare(
        "INSERT INTO root_enrollment_challenges (id, ceremony_id, account_id, challenge_digest, created_at, expires_at, consumed_at, attempt_count) VALUES (?, ?, ?, ?, ?, ?, NULL, 0)",
      ).bind(challengeId, ceremonyId, account.id, challengeDigest, now, expiresAt),
    ]);
    return json({ ceremonyId, expiresAt, options });
  } catch {
    return json({ error: "root_enrollment_unavailable" }, 503);
  }
};
