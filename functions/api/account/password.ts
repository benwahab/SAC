import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";
import { changeAccountPassword, type ContactChangeError } from "../../lib/account/contact-change-service.ts";

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
function statusFor(error: ContactChangeError): number {
  if (error === "storage_unavailable") return 503;
  if (error === "rate_limited") return 429;
  if (error === "invalid_credentials") return 401;
  return 400;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "account_unavailable" }, session.status);
  const parsed = await readJsonRequestBody(request, 8_192);
  if (!parsed.ok) return json({ error: parsed.reason === "too_large" ? "request_too_large" : "invalid_request" }, parsed.reason === "too_large" ? 413 : 400);
  if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) return json({ error: "invalid_request" }, 400);
  const body = parsed.value as Record<string, unknown>;
  const result = await changeAccountPassword(env.DB, crypto, {
    accountId: session.value.accountId,
    currentSessionId: session.value.sessionId,
    currentPassword: body.currentPassword,
    newPassword: body.newPassword,
  });
  if (!result.ok) return json({ error: result.error }, statusFor(result.error));
  return json({ changed: true });
};
