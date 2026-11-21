import { guardSameOriginJsonPost } from "../../../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../../../lib/security/json-request-body.ts";
import { requireAuthenticatedDeviceSession } from "../../../../lib/security/require-authenticated-device-session.ts";
import { closeOccurrence, type ReminderError } from "../../../../lib/reminders/service.ts";

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
    case "occurrence_not_found": return 404;
    case "invalid_transition": return 409;
    case "reminder_storage_unavailable": return 503;
    default: return 400;
  }
}

export const onRequestPost: PagesFunction<Env, "occurrenceId"> = async ({ request, env, params }) => {
  const originGuard = guardSameOriginJsonPost(request);
  if (originGuard) return originGuard;
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "reminder_service_unavailable" }, session.status);

  const occurrenceId = params.occurrenceId;
  if (typeof occurrenceId !== "string" || !occurrenceId.trim() || occurrenceId.length > 256) {
    return json({ error: "occurrence_not_found" }, 404);
  }
  const parsed = await readJsonRequestBody(request, 1_024);
  if (!parsed.ok) return json({ error: parsed.reason === "too_large" ? "request_too_large" : "invalid_request" }, parsed.reason === "too_large" ? 413 : 400);

  const result = await closeOccurrence(env.DB, session.value.accountId, occurrenceId, parsed.value);
  if (!result.ok) return json({ error: result.error }, errorStatus(result.error));
  return json({ occurrence: result.value });
};
