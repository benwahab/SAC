import { guardSameOriginJsonPost } from "../../../lib/security/http-request-guard.ts";
import { requireAuthenticatedDeviceSession } from "../../../lib/security/require-authenticated-device-session.ts";
import { markNotificationRead, type ReminderError } from "../../../lib/reminders/service.ts";

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

function errorStatus(error: ReminderError): number {
  if (error === "notification_not_found") return 404;
  if (error === "reminder_storage_unavailable") return 503;
  return 400;
}

export const onRequestPost: PagesFunction<Env, "notificationId"> = async ({ request, env, params }) => {
  const originGuard = guardSameOriginJsonPost(request);
  if (originGuard) return originGuard;
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "notification_service_unavailable" }, session.status);

  const notificationId = params.notificationId;
  if (typeof notificationId !== "string" || !notificationId.trim() || notificationId.length > 128) {
    return json({ error: "notification_not_found" }, 404);
  }
  const result = await markNotificationRead(env.DB, session.value.accountId, notificationId);
  if (!result.ok) return json({ error: result.error }, errorStatus(result.error));
  return json(result.value);
};
