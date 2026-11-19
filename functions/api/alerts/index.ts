import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";
import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
import { createSosAlert, type SosCategory, type SosLevel } from "../../lib/alerts/sos-service.ts";

interface Env { DB: D1Database; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: HEADERS }); }

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "alert_service_unavailable" }, session.status);

  const parsed = await readJsonRequestBody(request, 8_192);
  if (!parsed.ok) return json({ error: parsed.reason === "too_large" ? "request_too_large" : "invalid_request" }, parsed.reason === "too_large" ? 413 : 400);
  if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) return json({ error: "invalid_alert" }, 400);

  const body = parsed.value as {
    category?: unknown; level?: unknown; customDescription?: unknown;
    pushReminderCount?: unknown; recipientAccountIds?: unknown;
  };
  if (typeof body.category !== "string" || typeof body.level !== "string" ||
      !Array.isArray(body.recipientAccountIds) ||
      !body.recipientAccountIds.every((id) => typeof id === "string")) {
    return json({ error: "invalid_alert" }, 400);
  }

  const result = await createSosAlert(env.DB, crypto, {
    authenticatedAccountId: session.value.accountId,
    recipientAccountIds: body.recipientAccountIds as string[],
    recipientLimit: 2,
    category: body.category as SosCategory,
    level: body.level as SosLevel,
    customDescription: typeof body.customDescription === "string" ? body.customDescription : null,
    pushReminderCount: typeof body.pushReminderCount === "number" ? body.pushReminderCount : Number.NaN,
  });

  if (!result.ok) {
    const status = result.error === "invalid_input" ? 400 :
      result.error === "account_not_eligible" ? 403 :
      result.error === "recipient_not_trusted" ? 403 :
      result.error === "recipient_limit_exceeded" ? 409 : 503;
    return json({ error: result.error }, status);
  }

  return json({
    created: true,
    alertId: result.value.alertId,
    createdAt: result.value.createdAt,
    recipientAccountIds: result.value.recipientAccountIds,
  }, 201);
};
