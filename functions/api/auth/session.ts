import { createSessionCookie } from "../../lib/security/session-cookie.ts";
import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";
import { readAdminAccess, type AdminAccessSummary } from "../../lib/admin/access-service.ts";

interface Env { DB: D1Database; }

const HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};

function json(body: unknown, status = 200, token?: string): Response {
  const headers = new Headers(HEADERS);
  if (token) headers.append("Set-Cookie", createSessionCookie(token));
  return new Response(JSON.stringify(body), { status, headers });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) {
    return json(
      { authenticated: false },
      session.status,
    );
  }

  let securityKeyConfigured = true;
  let credentialId: string | null = null;
  let adminAccess: AdminAccessSummary = { canAccess: false, role: null, activeMissions: 0 };
  try {
    const deviceCredential = await env.DB.prepare(
      "SELECT credential_id FROM device_root_credentials WHERE device_id = ? AND account_id = ? LIMIT 1",
    ).bind(session.value.deviceId, session.value.accountId).first<{ credential_id: string }>();
    credentialId = deviceCredential?.credential_id ?? null;
    const accountCredential = await env.DB.prepare(
      "SELECT credential_id FROM device_root_credentials WHERE account_id = ? LIMIT 1",
    ).bind(session.value.accountId).first<{ credential_id: string }>();
    securityKeyConfigured = Boolean(accountCredential?.credential_id);
    adminAccess = await readAdminAccess(env.DB, session.value.accountId);
  } catch {
    // La session reste utilisable ; les rappels et l'accès admin sont recalculés côté client.
  }

  return json({
    authenticated: true,
    accountId: session.value.accountId,
    deviceId: session.value.deviceId,
    sessionId: session.value.sessionId,
    securityKeyConfigured,
    credentialId,
    adminAccess,
  }, 200, session.value.token);
};
