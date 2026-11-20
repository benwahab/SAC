import { requireAuthenticatedDeviceSession } from "../../../lib/security/require-authenticated-device-session.ts";
import { guardSameOriginJsonPost } from "../../../lib/security/http-request-guard.ts";
import { signGpsRelayTicket } from "../../../lib/location/gps-relay-ticket.ts";

interface Env {
  DB: D1Database;
  GPS_RELAY_HMAC_SECRET?: string;
  GPS_RELAY_PUBLIC_URL?: string;
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

/**
 * Issues a two-minute, alert-scoped relay ticket only to the author or a
 * recipient frozen in the active SOS snapshot. No GPS coordinate is accepted
 * or written by this endpoint.
 */
export const onRequestPost: PagesFunction<Env, "alertId"> = async ({ request, env, params }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;

  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) {
    return json(
      { error: session.status === 401 ? "authentication_required" : "gps_service_unavailable" },
      session.status,
    );
  }

  const alertId = params.alertId;
  if (typeof alertId !== "string" || !alertId.trim() || alertId.length > 128) {
    return json({ error: "alert_not_found" }, 404);
  }

  if (!env.GPS_RELAY_HMAC_SECRET || env.GPS_RELAY_HMAC_SECRET.length < 32 ||
      !env.GPS_RELAY_PUBLIC_URL) {
    return json({ error: "gps_service_not_configured" }, 503);
  }

  try {
    const row = await env.DB.prepare(
      `SELECT a.id, a.status, a.author_account_id,
        CASE WHEN a.author_account_id = ? THEN 'author' ELSE 'recipient' END AS participant_role
       FROM alerts a
       WHERE a.id = ? AND a.status = 'active'
         AND (a.author_account_id = ? OR EXISTS (
           SELECT 1 FROM alert_recipients r
           WHERE r.alert_id = a.id AND r.recipient_account_id = ?
         ))
       LIMIT 1`,
    ).bind(session.value.accountId, alertId, session.value.accountId, session.value.accountId)
      .first<{ id: string; status: string; author_account_id: string; participant_role: "author" | "recipient" }>();

    if (!row) return json({ error: "alert_not_found_or_closed" }, 404);

    const ticket = await signGpsRelayTicket(env.GPS_RELAY_HMAC_SECRET, {
      alertId: row.id,
      accountId: session.value.accountId,
      role: row.participant_role,
      exp: Math.floor(Date.now() / 1000) + 120,
      scope: "connect",
    });

    const relayUrl = new URL("/v1/alerts/" + encodeURIComponent(row.id) + "/socket", env.GPS_RELAY_PUBLIC_URL);
    relayUrl.protocol = relayUrl.protocol === "https:" ? "wss:" : "ws:";
    relayUrl.searchParams.set("ticket", ticket);

    return json({ ticket, websocketUrl: relayUrl.toString(), expiresInSeconds: 120 });
  } catch {
    return json({ error: "gps_service_unavailable" }, 503);
  }
};
