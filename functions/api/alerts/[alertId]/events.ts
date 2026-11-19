import { requireAuthenticatedDeviceSession } from "../../../lib/security/require-authenticated-device-session.ts";
import { listSosEventsForParticipant } from "../../../lib/alerts/sos-service.ts";

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

export const onRequestGet: PagesFunction<Env, "alertId"> = async ({ request, env, params }) => {
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) {
    return json(
      { error: session.status === 401 ? "authentication_required" : "alert_service_unavailable" },
      session.status,
    );
  }

  const alertId = params.alertId;
  if (typeof alertId !== "string" || !alertId.trim() || alertId.length > 128) {
    return json({ error: "alert_not_found" }, 404);
  }

  const result = await listSosEventsForParticipant(
    env.DB,
    session.value.accountId,
    alertId,
  );
  if (!result.ok) {
    return json(
      { error: result.error === "alert_not_found_or_closed" ? "alert_not_found" : "alert_service_unavailable" },
      result.error === "alert_not_found_or_closed" ? 404 : 503,
    );
  }

  // Return only whether the current viewer holds responsibility. Never expose
  // another participant's account identifier or contact details.
  try {
    const currentLead = await env.DB.prepare(
      `SELECT p.contact_account_id
       FROM alert_responsibility_periods p
       JOIN alerts a ON a.id = p.alert_id
       WHERE p.alert_id = ? AND p.ended_at IS NULL AND a.status = 'active'
       LIMIT 1`,
    ).bind(alertId).first<{ contact_account_id: string }>();

    return json({
      events: result.value.map((event) => ({
        id: event.id,
        actor: event.actorAccountId === session.value.accountId ? "self" : "participant",
        type: event.type,
        occurredAt: event.occurredAt,
        serverSequence: event.serverSequence,
      })),
      responsibility: {
        assigned: Boolean(currentLead),
        isSelf: currentLead?.contact_account_id === session.value.accountId,
      },
    });
  } catch {
    return json({ error: "alert_service_unavailable" }, 503);
  }
};
