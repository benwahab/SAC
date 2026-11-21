import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";
import { getOwnAccountProfile, updateProfileNames, type AccountServiceError } from "../../lib/account/profile-service.ts";

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
function statusFor(error: AccountServiceError): number {
  switch (error) {
    case "invalid_input":
    case "invalid_first_name":
    case "invalid_last_name":
    case "invalid_photo":
    case "photo_too_large": return 400;
    case "profile_names_required": return 409;
    case "profile_not_found":
    case "photo_not_found": return 404;
    case "storage_unavailable": return 503;
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "account_unavailable" }, session.status);
  const result = await getOwnAccountProfile(env.DB, session.value.accountId);
  if (!result.ok) return json({ error: result.error }, statusFor(result.error));
  return json({ profile: result.value });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "account_unavailable" }, session.status);
  const parsed = await readJsonRequestBody(request, 8_192);
  if (!parsed.ok) return json({ error: parsed.reason === "too_large" ? "request_too_large" : "invalid_request" }, parsed.reason === "too_large" ? 413 : 400);
  if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) return json({ error: "invalid_request" }, 400);
  const body = parsed.value as Record<string, unknown>;
  const result = await updateProfileNames(env.DB, session.value.accountId, {
    firstName: body.firstName,
    lastName: body.lastName,
  });
  if (!result.ok) return json({ error: result.error }, statusFor(result.error));
  const profile = await getOwnAccountProfile(env.DB, session.value.accountId);
  return json({ updated: true, profile: profile.ok ? profile.value : null });
};
