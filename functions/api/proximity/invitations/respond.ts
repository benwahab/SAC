import { guardSameOriginJsonPost } from "../../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../../lib/security/json-request-body.ts";
import { requireAuthenticatedDeviceSession } from "../../../lib/security/require-authenticated-device-session.ts";
import { respondProximityInvitation, type SocialError } from "../../../lib/account/social-service.ts";

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
function statusFor(error: SocialError): number {
  if (error === "storage_unavailable") return 503;
  if (error === "relationship_already_active") return 409;
  if (error === "invalid_or_expired_invitation") return 409;
  return 400;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "invitation_service_unavailable" }, session.status);
  const parsed = await readJsonRequestBody(request, 4_096);
  if (!parsed.ok) return json({ error: parsed.reason === "too_large" ? "request_too_large" : "invalid_request" }, parsed.reason === "too_large" ? 413 : 400);
  if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) return json({ error: "invalid_request" }, 400);
  const body = parsed.value as Record<string, unknown>;
  const result = await respondProximityInvitation(env.DB, session.value.accountId, body.invitationId, body.action);
  if (!result.ok) return json({ error: result.error }, statusFor(result.error));
  return json({ responded: true, ...result.value });
};
