import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";
import { clearSessionCookie } from "../../lib/security/session-cookie.ts";
import { requestAccountDeletion, type DeletionError } from "../../lib/account/deletion-service.ts";

interface Env { DB: D1Database; }
const HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};
function json(body: unknown, status = 200, clearCookie = false): Response {
  const headers = new Headers(HEADERS);
  if (clearCookie) headers.append("Set-Cookie", clearSessionCookie());
  return new Response(JSON.stringify(body), { status, headers });
}
function statusFor(error: DeletionError): number {
  if (error === "invalid_credentials") return 401;
  if (error === "account_not_eligible") return 409;
  if (error === "storage_unavailable") return 503;
  return 400;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "account_unavailable" }, session.status);
  const parsed = await readJsonRequestBody(request, 4_096);
  if (!parsed.ok) return json({ error: parsed.reason === "too_large" ? "request_too_large" : "invalid_request" }, parsed.reason === "too_large" ? 413 : 400);
  if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) return json({ error: "invalid_request" }, 400);
  const body = parsed.value as Record<string, unknown>;
  const result = await requestAccountDeletion(env.DB, crypto, {
    accountId: session.value.accountId,
    currentSessionId: session.value.sessionId,
    password: body.password,
  });
  if (!result.ok) return json({ error: result.error }, statusFor(result.error));
  return json({ deletionRequested: true }, 200, true);
};
