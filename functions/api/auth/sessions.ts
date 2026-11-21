import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";

interface Env { DB: D1Database; }

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

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: "authentication_required" }, session.status);

  try {
    const now = Date.now();
    const result = await env.DB.prepare(
      `SELECT s.id, s.created_at, s.last_activity_at, s.expires_at
       FROM device_sessions s
       JOIN devices d ON d.id = s.device_id AND d.account_id = s.account_id
       JOIN accounts a ON a.id = s.account_id AND a.status = 'active'
       WHERE s.account_id = ?
         AND s.status = 'active'
         AND s.expires_at > ?
         AND s.auth_version = d.auth_version
         AND d.status = 'active'
       ORDER BY s.last_activity_at DESC, s.created_at DESC, s.id DESC
       LIMIT 50`,
    ).bind(session.value.accountId, now).all<{
      id: string; created_at: number; last_activity_at: number; expires_at: number;
    }>();

    if (!result.success) return json({ error: "session_list_unavailable" }, 503);
    return json({
      currentSessionId: session.value.sessionId,
      sessions: (result.results ?? []).map((item) => ({
        id: item.id,
        createdAt: item.created_at,
        lastActivityAt: item.last_activity_at,
        expiresAt: item.expires_at,
        current: item.id === session.value.sessionId,
      })),
    });
  } catch {
    return json({ error: "session_list_unavailable" }, 503);
  }
};
