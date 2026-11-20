import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";
import { getSosAlertForParticipant } from "../../lib/alerts/sos-service.ts";

interface Env { DB: D1Database; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: HEADERS }); }

export const onRequestGet: PagesFunction<Env, "alertId"> = async ({ request, env, params }) => {
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "alert_service_unavailable" }, session.status);

  const alertId = params.alertId;
  if (typeof alertId !== "string" || !alertId.trim() || alertId.length > 128) return json({ error: "alert_not_found" }, 404);

  const result = await getSosAlertForParticipant(env.DB, session.value.accountId, alertId);
  if (!result.ok) {
    return json({ error: result.error === "alert_not_found_or_closed" ? "alert_not_found" : "alert_service_unavailable" },
      result.error === "alert_not_found_or_closed" ? 404 : 503);
  }
  // Ne jamais divulguer les identifiants de compte de l'auteur ou des
  // autres destinataires à un participant. Le rôle de l'appelant est fourni
  // séparément et seul le nombre de destinataires est nécessaire ici.
  const { authorAccountId: _authorAccountId, recipientSnapshot, ...safeAlert } = result.value.alert;
  return json({
    alert: {
      ...safeAlert,
      recipientCount: recipientSnapshot.length,
    },
    isAuthor: result.value.isAuthor,
  });
};
