import { requireAuthenticatedDeviceSession } from "../../../lib/security/require-authenticated-device-session.ts";
import { guardSameOriginJsonPost } from "../../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../../lib/security/json-request-body.ts";
import { closeSosAlertByAuthor } from "../../../lib/alerts/sos-service.ts";
import type { AlertClosureReason } from "../../../../src/domain/alert-lifecycle.ts";

interface Env { DB: D1Database; }
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
  return json({ closed: true, closedAt: result.value.closedAt });
};
