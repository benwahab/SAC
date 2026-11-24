import { onRequestPost as passwordSession } from "../../functions/api/auth/password-session.ts";
import { hashAccountPassword } from "../../functions/lib/security/password-hash.ts";

interface Env {
  DB: D1Database;
  EMAIL_OTP_HMAC_SECRET: string;
  MULTI_DEVICE_PASSWORD_LOGIN_ENABLED?: string;
}

const HEADERS = { "content-type": "application/json" };
const EMAIL = "multi-device@example.test";
const PASSWORD = "phrase de passe multi appareil 2026";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

async function readBody<T>(request: Request): Promise<T | null> {
  try { return await request.json() as T; } catch { return null; }
}

async function seed(env: Env): Promise<Record<string, string>> {
  const now = Date.now();
  const accountId = crypto.randomUUID();
  const identityId = crypto.randomUUID();
  const challengeId = crypto.randomUUID();
  const rootDeviceId = crypto.randomUUID();
  const credentialId = crypto.randomUUID();
  const passwordHash = await hashAccountPassword(crypto, PASSWORD);

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO accounts (id,status,preferred_language,password_hash,created_at,updated_at) VALUES (?, 'pending_verification','fr',?,?,?)",
    ).bind(accountId, passwordHash, now, now),
    env.DB.prepare(
      "INSERT INTO account_identities (id,account_id,channel,normalized_value,verified_at,is_primary,created_at) VALUES (?,?,'email',?,NULL,1,?)",
    ).bind(identityId, accountId, EMAIL, now),
    env.DB.prepare(
      `INSERT INTO email_otp_challenges
       (id,account_id,identity_id,purpose,digest,created_at,expires_at,delivery_status)
       VALUES (?,?,?,'account_email_verification',?,?,?,'pending')`,
    ).bind(challengeId, accountId, identityId, "a".repeat(64), now, now + 600000),
  ]);
  await env.DB.prepare("UPDATE email_otp_challenges SET delivery_status='accepted' WHERE id=?").bind(challengeId).run();
  await env.DB.prepare("UPDATE email_otp_challenges SET attempt_count=attempt_count+1, consumed_at=? WHERE id=?").bind(now + 1, challengeId).run();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO devices (id,account_id,status,auth_version,created_at,revoked_at) VALUES (?,?,'active',1,?,NULL)",
    ).bind(rootDeviceId, accountId, now + 2),
    env.DB.prepare(
      `INSERT INTO device_root_credentials
       (id,device_id,account_id,credential_id,public_key_x,public_key_y,sign_count,credential_device_type,credential_backed_up,created_at,last_used_at)
       VALUES (?,?,?,?,?,?,0,'singleDevice',0,?,NULL)`,
    ).bind(crypto.randomUUID(), rootDeviceId, accountId, credentialId, "A".repeat(43), "B".repeat(43), now + 2),
  ]);

  return { email: EMAIL, password: PASSWORD, accountId, rootDeviceId };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true });

    if (url.pathname === "/seed" && request.method === "POST") {
      return json(await seed(env), 201);
    }

    if (url.pathname === "/state" && request.method === "GET") {
      const devices = await env.DB.prepare(
        "SELECT id, status, auth_version FROM devices ORDER BY created_at",
      ).all();
      const sessions = await env.DB.prepare(
        "SELECT id, device_id, status FROM device_sessions ORDER BY created_at",
      ).all();
      const credentials = await env.DB.prepare(
        "SELECT id, device_id, account_id FROM device_root_credentials",
      ).all();
      return json({ devices: devices.results, sessions: sessions.results, credentials: credentials.results });
    }

    if (url.pathname === "/revoke" && request.method === "POST") {
      const body = await readBody<{ deviceId?: string }>(request);
      if (!body?.deviceId) return json({ error: "device_id_required" }, 400);
      const now = Date.now();
      await env.DB.batch([
        env.DB.prepare("UPDATE devices SET status='revoked', auth_version=auth_version+1, revoked_at=? WHERE id=? AND status='active'").bind(now, body.deviceId),
        env.DB.prepare("UPDATE device_sessions SET status='revoked', revoked_at=? WHERE device_id=? AND status='active'").bind(now, body.deviceId),
      ]);
      return json({ revoked: true });
    }

    if (url.pathname === "/api/auth/password-session" && request.method === "POST") {
      return await passwordSession({ request, env } as never);
    }

    return json({ error: "not_found" }, 404);
  },
};
