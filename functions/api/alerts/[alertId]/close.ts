import { requireAuthenticatedDeviceSession } from "../../../lib/security/require-authenticated-device-session.ts";
import { guardSameOriginJsonPost } from "../../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../../lib/security/json-request-body.ts";
import { closeSosAlertByAuthor } from "../../../lib/alerts/sos-service.ts";
import { signGpsRelayTicket } from "../../../lib/location/gps-relay-ticket.ts";
import type { AlertClosureReason } from "../../../../src/domain/alert-lifecycle.ts";

interface Env { DB: D1Database; GPS_RELAY_HMAC_SECRET?: string; GPS_RELAY_PUBLIC_URL?: string; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: HEADERS }); }

export const onRequestPost: PagesFunction<Env, "alertId"> = async ({ request, env, params }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "alert_service_unavailable" }, session.status);

  const alertId = params.alertId;
  if (typeof alertId !== "string" || !alertId.trim() || alertId.length > 128) return json({ error: "invalid_alert" }, 400);

  const parsed = await readJsonRequestBody(request, 1_024);
  if (!parsed.ok) return json({ error: "invalid_request" }, parsed.reason === "too_large" ? 413 : 400);
  if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) return json({ error: "invalid_closure" }, 400);

  const reason = (parsed.value as { reason?: unknown }).reason;
  if (reason !== "completed" && reason !== "cancelled") return json({ error: "invalid_closure" }, 400);

  const result = await closeSosAlertByAuthor(env.DB, crypto, {
    authenticatedAccountId: session.value.accountId,
    alertId,
    reason: reason as AlertClosureReason,
  });
  if (!result.ok) {
    return json({ error: result.error }, result.error === "invalid_input" ? 400 :
      result.error === "alert_not_found_or_closed" ? 404 : 503);
  }
  let gpsRelayClosed = false;
  let gpsTicketsRevoked = false;
  try {
    const revoked = await env.DB.prepare("DELETE FROM gps_relay_tickets WHERE alert_id = ?")
      .bind(alertId).run();
    gpsTicketsRevoked = revoked.success;
  } catch {
    // The alert is already closed; active-status checks still reject every ticket.
  }
  if (env.GPS_RELAY_HMAC_SECRET && env.GPS_RELAY_HMAC_SECRET.length >= 32 && env.GPS_RELAY_PUBLIC_URL) {
    try {
      const ticket = await signGpsRelayTicket(env.GPS_RELAY_HMAC_SECRET, {
        alertId,
        accountId: session.value.accountId,
        deviceId: session.value.deviceId,
        sessionId: session.value.sessionId,
        role: "author",
        exp: Math.floor(Date.now() / 1000) + 60,
        scope: "close",
      });
      const relayResponse = await fetch(new URL(
        "/v1/alerts/" + encodeURIComponent(alertId) + "/close",
        env.GPS_RELAY_PUBLIC_URL,
      ), {
        method: "POST",
        headers: { Authorization: "Bearer " + ticket, "Cache-Control": "no-store" },
      });
      gpsRelayClosed = relayResponse.ok;
    } catch {
      // The alert is already closed in D1. The relay itself fails closed on
      // every subsequent message by rechecking the persisted alert status.
    }
  }

  return json({
    closed: true,
    closedAt: result.value.closedAt,
    gpsRelayRevocation: gpsRelayClosed ? "confirmed" : "pending_configuration_or_retry",
    gpsTicketsRevoked,
  });
};
