import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
import { isAllowedWebAuthnOrigin } from "../../lib/security/webauthn-origin.ts";
import { createSessionToken } from "../../lib/security/session-token.ts";
import { createSessionCookie } from "../../lib/security/session-cookie.ts";

interface Env {
  DB: D1Database;
  WEBAUTHN_RP_ID?: string;
  WEBAUTHN_ALLOWED_ORIGINS?: string;
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
function decodeBase64Url(value: unknown, maxBytes: number): Uint8Array {
  if (typeof value !== "string" || value.length < 1 || value.length > Math.ceil(maxBytes * 4 / 3) + 4 || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) throw new Error("invalid_base64url");
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(base64 + "=".repeat((4 - base64.length % 4) % 4)), c => c.charCodeAt(0));
  if (bytes.length > maxBytes) throw new Error("invalid_base64url");
  return bytes;
}
function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
function derToRaw(signature: Uint8Array): Uint8Array {
  if (signature.length < 8 || signature[0] !== 0x30 || signature[1] !== signature.length - 2 || signature[2] !== 0x02) throw new Error("invalid_signature");
  const rLength = signature[3];
  const rStart = 4;
  const sTag = rStart + rLength;
  if (rLength < 1 || sTag + 2 > signature.length || signature[sTag] !== 0x02) throw new Error("invalid_signature");
  const sLength = signature[sTag + 1];
  const sStart = sTag + 2;
  if (sLength < 1 || sStart + sLength !== signature.length) throw new Error("invalid_signature");
  const normalize = (part: Uint8Array): Uint8Array => {
    let value = part;
    if (value[0] === 0) value = value.slice(1);
    if (value.length > 32) throw new Error("invalid_signature");
    const out = new Uint8Array(32);
    out.set(value, 32 - value.length);
    return out;
  };
  const raw = new Uint8Array(64);
  raw.set(normalize(signature.slice(rStart, sTag)), 0);
  raw.set(normalize(signature.slice(sStart)), 32);
  return raw;
}
function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a); out.set(b, a.length); return out;
}
function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64 + "=".repeat((4 - base64.length % 4) % 4)), c => c.charCodeAt(0));
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;
  if (!env.DB || !env.WEBAUTHN_RP_ID) return json({ error: "authentication_unavailable" }, 503);
  const origin = request.headers.get("Origin");
  const allowedOrigins = originsFromEnv(env.WEBAUTHN_ALLOWED_ORIGINS);
  if (!origin || !isAllowedWebAuthnOrigin(origin, env.WEBAUTHN_RP_ID, allowedOrigins)) return json({ error: "origin_not_allowed" }, 403);
  const parsed = await readJsonRequestBody(request, 40_000);
  if (!parsed.ok) return json({ error: parsed.reason === "too_large" ? "request_too_large" : "invalid_request" }, parsed.reason === "too_large" ? 413 : 400);
  if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) return json({ error: "invalid_authentication" }, 400);
  const body = parsed.value as Record<string, unknown>;
  if (typeof body.challengeId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.challengeId) || typeof body.credential !== "object" || body.credential === null || Array.isArray(body.credential)) return json({ error: "invalid_authentication" }, 400);

  const now = Date.now();
  type Challenge = { id: string; account_id: string; device_id: string; origin: string; challenge_digest: string; expires_at: number; consumed_at: number | null; attempt_count: number; account_status: string; device_status: string; auth_version: number; credential_id: string; public_key_x: string; public_key_y: string; sign_count: number };
  let challenge: Challenge | null;
  try {
    challenge = await env.DB.prepare(
      `SELECT ch.id, ch.account_id, ch.device_id, ch.origin, ch.challenge_digest, ch.expires_at, ch.consumed_at, ch.attempt_count,
              a.status AS account_status, d.status AS device_status, d.auth_version,
              c.credential_id, c.public_key_x, c.public_key_y, c.sign_count
       FROM root_authentication_challenges ch
       JOIN accounts a ON a.id = ch.account_id
       JOIN devices d ON d.id = ch.device_id AND d.account_id = ch.account_id
       JOIN device_root_credentials c ON c.device_id = d.id AND c.account_id = d.account_id
       WHERE ch.id = ? LIMIT 1`,
    ).bind(body.challengeId).first<Challenge>();
  } catch { return json({ error: "authentication_unavailable" }, 503); }
  if (!challenge || challenge.origin !== origin || challenge.expires_at <= now || challenge.consumed_at !== null ||
      challenge.attempt_count >= 5 || challenge.account_status !== "active" || challenge.device_status !== "active") {
    return json({ error: "authentication_expired_or_unavailable" }, 401);
  }

  try {
    const credential = body.credential as Record<string, unknown>;
    if (credential.type !== "public-key" || typeof credential.id !== "string" || typeof credential.response !== "object" || credential.response === null) throw new Error("invalid_credential");
    const rawId = decodeBase64Url(credential.rawId, 1024);
    const credentialId = credential.id;
    const response = credential.response as Record<string, unknown>;
    const clientDataBytes = decodeBase64Url(response.clientDataJSON, 16_384);
    const clientData = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(clientDataBytes)) as Record<string, unknown>;
    const challengeBytes = decodeBase64Url(clientData.challenge, 64);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", challengeBytes));
    const expectedDigest = Uint8Array.from(challenge.challenge_digest.match(/.{2}/g) ?? [], x => Number.parseInt(x, 16));
    if (clientData.type !== "webauthn.get" || clientData.origin !== challenge.origin ||
        (clientData.crossOrigin !== undefined && clientData.crossOrigin !== false) || !equal(digest, expectedDigest) ||
        !isAllowedWebAuthnOrigin(clientData.origin, env.WEBAUTHN_RP_ID, allowedOrigins)) throw new Error("client_data_rejected");

    const storedId = fromBase64Url(challenge.credential_id);
    if (!equal(rawId, storedId) || credentialId !== challenge.credential_id) throw new Error("credential_mismatch");
    const authData = decodeBase64Url(response.authenticatorData, 4096);
    if (authData.length < 37) throw new Error("authenticator_data_invalid");
    const rpHash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.WEBAUTHN_RP_ID)));
    if (!equal(authData.slice(0, 32), rpHash)) throw new Error("rp_id_mismatch");
    const flags = authData[32];
    if ((flags & 0x01) === 0 || (flags & 0x04) === 0 || (flags & 0x10) !== 0 || (flags & 0x22) !== 0) throw new Error("authenticator_flags_rejected");
    const signCount = new DataView(authData.buffer, authData.byteOffset, authData.byteLength).getUint32(33, false);
    if (challenge.sign_count > 0 && signCount <= challenge.sign_count) throw new Error("signature_counter_rejected");

    const clientHash = new Uint8Array(await crypto.subtle.digest("SHA-256", clientDataBytes));
    const signedData = concat(authData, clientHash);
    const x = fromBase64Url(challenge.public_key_x);
    const y = fromBase64Url(challenge.public_key_y);
    const publicKey = await crypto.subtle.importKey("jwk", {
      kty: "EC", crv: "P-256",
      x: challenge.public_key_x, y: challenge.public_key_y,
      ext: true, key_ops: ["verify"],
    }, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const signature = derToRaw(decodeBase64Url(response.signature, 1024));
    const valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, signature, signedData);
    if (!valid || x.length !== 32 || y.length !== 32) throw new Error("signature_rejected");

    const session = await createSessionToken(crypto);
    const sessionId = crypto.randomUUID();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000;
    const results = await env.DB.batch([
      env.DB.prepare("UPDATE root_authentication_challenges SET consumed_at = ?, attempt_count = attempt_count + 1 WHERE id = ? AND consumed_at IS NULL AND expires_at > ? AND attempt_count < 5").bind(now, challenge.id, now),
      env.DB.prepare("UPDATE device_root_credentials SET sign_count = ?, last_used_at = ? WHERE device_id = ? AND account_id = ? AND credential_id = ? AND sign_count = ?").bind(signCount, now, challenge.device_id, challenge.account_id, challenge.credential_id, challenge.sign_count),
      env.DB.prepare("INSERT INTO device_sessions (id, account_id, device_id, token_hash, status, auth_version, created_at, last_activity_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, NULL)").bind(sessionId, challenge.account_id, challenge.device_id, session.tokenHash, challenge.auth_version, now, now, expiresAt),
    ]);
    if (results.some(result => !result.success || result.meta.changes !== 1)) return json({ error: "authentication_conflict" }, 409);
    return json({ authenticated: true, session: { id: sessionId, expiresAt: new Date(expiresAt).toISOString() } }, 200, createSessionCookie(session.token));
  } catch {
    try {
      await env.DB.prepare("UPDATE root_authentication_challenges SET attempt_count = attempt_count + 1 WHERE id = ? AND consumed_at IS NULL AND expires_at > ? AND attempt_count < 5").bind(challenge.id, now).run();
    } catch { /* Fail closed. */ }
    return json({ error: "invalid_authentication" }, 401);
  }
};
