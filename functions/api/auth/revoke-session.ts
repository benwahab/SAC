import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
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

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;

  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: "authentication_required" }, session.status);

  const parsed = await readJsonRequestBody(request, 4096);
  if (!parsed.ok) {
    return json(
      { error: parsed.reason === "too_large" ? "request_too_large" : "invalid_request" },
      parsed.reason === "too_large" ? 413 : 400,
    );
  }
  if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) {
    return json({ error: "invalid_request" }, 400);
  }

  const sessionId = (parsed.value as Record<string, unknown>).sessionId;
  if (!isUuid(sessionId)) return json({ error: "invalid_session_id" }, 400);
  if (sessionId === session.value.sessionId) return json({ error: "cannot_revoke_current_session" }, 409);

  const now = Date.now();
  try {
    const result = await env.DB.prepare(
      `UPDATE device_sessions
       SET status = 'revoked', revoked_at = ?
       WHERE id = ?
         AND account_id = ?
         AND status = 'active'
         AND last_activity_at <= ?
         AND expires_at > ?`,
    ).bind(now, sessionId, session.value.accountId, now, now).run();

    if (!result.success) return json({ error: "session_revoke_unavailable" }, 503);
    if (result.meta.changes !== 1) return json({ error: "session_not_found_or_inactive" }, 404);

    // La session fermée disparaît immédiatement de la base, sauf si elle
    // est référencée par la trace d'enrôlement immuable.
    const cleanup = await env.DB.prepare(
      `DELETE FROM device_sessions
       WHERE id = ?
         AND account_id = ?
         AND status = 'revoked'
         AND NOT EXISTS (
           SELECT 1 FROM device_enrollment_events e
           WHERE e.session_id = device_sessions.id
         )`,
    ).bind(sessionId, session.value.accountId).run();
    if (!cleanup.success) return json({ error: "session_revoke_unavailable" }, 503);
    return json({ revoked: true, sessionId });
  } catch {
    return json({ error: "session_revoke_unavailable" }, 503);
  }
};
