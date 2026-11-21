import { requireAuthenticatedDeviceSession } from "../../../lib/security/require-authenticated-device-session.ts";
import { getReminder, type ReminderError } from "../../../lib/reminders/service.ts";

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
  return error === "reminder_not_found" ? 404 : error === "reminder_storage_unavailable" ? 503 : 400;
}

export const onRequestGet: PagesFunction<Env, "reminderId"> = async ({ request, env, params }) => {
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "reminder_service_unavailable" }, session.status);

  const reminderId = params.reminderId;
  if (typeof reminderId !== "string" || !reminderId.trim() || reminderId.length > 128) return json({ error: "reminder_not_found" }, 404);

  const result = await getReminder(env.DB, session.value.accountId, reminderId);
  if (!result.ok) return json({ error: result.error }, errorStatus(result.error));
  return json({ occurrences: result.value.occurrences });
};
