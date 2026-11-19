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

  return json({
    authenticated: true,
    accountId: session.value.accountId,
    deviceId: session.value.deviceId,
    sessionId: session.value.sessionId,
  }, 200, session.value.token);
};
