import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";
import { encryptPushSubscription, type PushSubscriptionPayload } from "../../lib/notifications/push-subscription-crypto.ts";

interface Env {
  DB: D1Database;
  PUSH_SUBSCRIPTION_ENCRYPTION_KEY?: string;
}

const HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(
      atob(base64 + "=".repeat((4 - base64.length % 4) % 4)),
      (character) => character.charCodeAt(0),
    );
  } catch {
    return null;
  }
}

function parseSubscription(value: unknown): PushSubscriptionPayload | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.endpoint !== "string" || record.endpoint.length < 12 || record.endpoint.length > 2048) return null;
  if (typeof record.keys !== "object" || record.keys === null || Array.isArray(record.keys)) return null;
  const keys = record.keys as Record<string, unknown>;
  if (typeof keys.p256dh !== "string" || typeof keys.auth !== "string") return null;
  const p256dh = decodeBase64Url(keys.p256dh);
  const auth = decodeBase64Url(keys.auth);
  if (!p256dh || p256dh.byteLength !== 65 || !auth || auth.byteLength !== 16) return null;
  try {
    const endpoint = new URL(record.endpoint);
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.hostname.length > 253) return null;
  } catch {
    return null;
  }
  return { endpoint: record.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const originGuard = guardSameOriginJsonPost(request);
  if (originGuard) return originGuard;
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "service_unavailable" }, session.status);

  const parsed = await readJsonRequestBody(request, 8192);
  if (!parsed.ok) return json({ error: parsed.reason === "too_large" ? "request_too_large" : "invalid_request" }, parsed.reason === "too_large" ? 413 : 400);
  if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) return json({ error: "invalid_request" }, 400);
  const body = parsed.value as Record<string, unknown>;

  if (body.action === "remove") {
    try {
      const result = await env.DB.prepare(
        "DELETE FROM push_subscriptions WHERE account_id = ? AND device_id = ?",
      ).bind(session.value.accountId, session.value.deviceId).run();
      if (!result.success) return json({ error: "subscription_storage_unavailable" }, 503);
      return json({ removed: true });
    } catch {
      return json({ error: "subscription_storage_unavailable" }, 503);
    }
  }

  if (body.action !== "subscribe") return json({ error: "invalid_action" }, 400);
  const subscription = parseSubscription(body.subscription);
  if (!subscription) return json({ error: "invalid_push_subscription" }, 400);
  if (!env.PUSH_SUBSCRIPTION_ENCRYPTION_KEY) return json({ error: "push_subscription_storage_not_configured" }, 503);

  try {
    const encrypted = await encryptPushSubscription(subscription, env.PUSH_SUBSCRIPTION_ENCRYPTION_KEY, crypto);
    if (!encrypted) return json({ error: "push_subscription_storage_not_configured" }, 503);
    const now = Date.now();
    const result = await env.DB.prepare(
      `INSERT INTO push_subscriptions
         (id, account_id, device_id, endpoint_hash, encrypted_subscription, iv, status, created_at, updated_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, NULL)
       ON CONFLICT(endpoint_hash) DO UPDATE SET
         encrypted_subscription = excluded.encrypted_subscription,
         iv = excluded.iv,
         updated_at = excluded.updated_at
       WHERE push_subscriptions.account_id = excluded.account_id
         AND push_subscriptions.device_id = excluded.device_id
         AND push_subscriptions.status = 'active'`,
    ).bind(
      crypto.randomUUID(),
      session.value.accountId,
      session.value.deviceId,
      encrypted.endpointHash,
      encrypted.ciphertext,
      encrypted.iv,
      now,
      now,
    ).run();
    if (!result.success) return json({ error: "subscription_storage_unavailable" }, 503);
    if (result.meta.changes !== 1) return json({ error: "push_subscription_conflict" }, 409);
    return json({ registered: true });
  } catch {
    return json({ error: "subscription_storage_unavailable" }, 503);
  }
};
