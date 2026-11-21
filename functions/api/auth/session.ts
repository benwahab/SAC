import { createSessionCookie } from "../../lib/security/session-cookie.ts";
import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";

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
  try {
    const credential = await env.DB.prepare(
      "SELECT 1 AS configured FROM device_root_credentials WHERE device_id = ? AND account_id = ? LIMIT 1",
    ).bind(session.value.deviceId, session.value.accountId).first<{ configured: number }>();
    securityKeyConfigured = credential?.configured === 1;
  } catch {
    // La session reste utilisable ; aucun rappel n'est affiché si l'état est inconnu.
  }

  return json({
    authenticated: true,
    accountId: session.value.accountId,
    deviceId: session.value.deviceId,
    sessionId: session.value.sessionId,
    securityKeyConfigured,
  }, 200, session.value.token);
};
