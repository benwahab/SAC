import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";
import { confirmContactChange, requestContactChange, type ContactChangeError } from "../../lib/account/contact-change-service.ts";
import type { SacEmailLanguage } from "../../lib/email/verification.ts";

interface Env {
  DB: D1Database;
  EMAIL_OTP_HMAC_SECRET?: string;
  BREVO_API_KEY?: string;
  BREVO_FROM_EMAIL?: string;
  BREVO_FROM_NAME?: string;
}
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
  switch (error) {
    case "invalid_credentials": return 401;
    case "email_already_used":
    case "phone_already_used":
    case "unchanged": return 409;
    case "rate_limited": return 429;
    case "verification_service_not_configured":
    case "verification_email_unavailable":
    case "storage_unavailable": return 503;
    case "too_many_attempts": return 429;
    default: return 400;
  }
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

  if (body.action === "request") {
    const language = await env.DB.prepare("SELECT preferred_language FROM accounts WHERE id = ? LIMIT 1")
      .bind(session.value.accountId).first<{ preferred_language: SacEmailLanguage }>();
    const result = await requestContactChange(env.DB, crypto, env, {
      accountId: session.value.accountId,
      channel: "phone",
      newValue: body.newPhone,
      currentPassword: body.currentPassword,
      language: language?.preferred_language ?? "fr",
    });
    if (!result.ok) return json({ error: result.error }, statusFor(result.error));
    return json({ requested: true, challengeId: result.value.challengeId, expiresAt: result.value.expiresAt });
  }

  if (body.action === "confirm") {
    const result = await confirmContactChange(env.DB, crypto, env, {
      accountId: session.value.accountId,
      currentSessionId: session.value.sessionId,
      challengeId: body.challengeId,
      code: body.code,
      expectedChannel: "phone",
    });
    if (!result.ok) return json({ error: result.error }, statusFor(result.error));
    return json({ changed: true, phone: result.value.value });
  }

  return json({ error: "invalid_request" }, 400);
};
