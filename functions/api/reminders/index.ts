import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";
import { createReminder, listReminders, type ReminderError } from "../../lib/reminders/service.ts";

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
    case "quota_exceeded": return 409;
    case "invalid_transition": return 409;
    case "quota_unavailable":
    case "reminder_storage_unavailable": return 503;
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "reminder_service_unavailable" }, session.status);

  const result = await listReminders(env.DB, session.value.accountId);
  if (!result.ok) return json({ error: result.error }, errorStatus(result.error));
  return json({ reminders: result.value });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const originGuard = guardSameOriginJsonPost(request);
  if (originGuard) return originGuard;
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "reminder_service_unavailable" }, session.status);

  const parsed = await readJsonRequestBody(request, 32_768);
  if (!parsed.ok) return json({ error: parsed.reason === "too_large" ? "request_too_large" : "invalid_request" }, parsed.reason === "too_large" ? 413 : 400);

  const result = await createReminder(env.DB, session.value.accountId, parsed.value);
  if (!result.ok) return json({ error: result.error }, errorStatus(result.error));
  return json({ reminder: result.value }, 201);
};
