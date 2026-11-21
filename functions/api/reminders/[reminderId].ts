import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";
import { getReminder, updateReminder, type ReminderError } from "../../lib/reminders/service.ts";

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
  switch (error) {
    case "invalid_request": return 400;
    case "reminder_not_found":
    case "occurrence_not_found":
    case "notification_not_found": return 404;
    case "quota_exceeded":
    case "invalid_transition": return 409;
    case "quota_unavailable":
    case "reminder_storage_unavailable": return 503;
  }
}

function reminderId(params: Record<string, string | string[]>): string | null {
  const value = params.reminderId;
  return typeof value === "string" && value.trim() && value.length <= 128 ? value : null;
}

export const onRequestGet: PagesFunction<Env, "reminderId"> = async ({ request, env, params }) => {
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "reminder_service_unavailable" }, session.status);

  const id = reminderId(params);
  if (!id) return json({ error: "reminder_not_found" }, 404);
  const result = await getReminder(env.DB, session.value.accountId, id);
  if (!result.ok) return json({ error: result.error }, errorStatus(result.error));
  return json({ reminder: result.value });
};

export const onRequestPost: PagesFunction<Env, "reminderId"> = async ({ request, env, params }) => {
  const originGuard = guardSameOriginJsonPost(request);
  if (originGuard) return originGuard;
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "reminder_service_unavailable" }, session.status);

  const id = reminderId(params);
  if (!id) return json({ error: "reminder_not_found" }, 404);
  const parsed = await readJsonRequestBody(request, 8_192);
  if (!parsed.ok) return json({ error: parsed.reason === "too_large" ? "request_too_large" : "invalid_request" }, parsed.reason === "too_large" ? 413 : 400);

  const result = await updateReminder(env.DB, session.value.accountId, id, parsed.value);
  if (!result.ok) return json({ error: result.error }, errorStatus(result.error));
  return json({ reminder: result.value });
};
