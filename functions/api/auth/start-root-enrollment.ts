import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";
import { createRootEnrollmentCeremony } from "../../lib/security/root-enrollment-ceremony.ts";
import { isAllowedWebAuthnOrigin } from "../../lib/security/webauthn-origin.ts";

interface Env {
  DB: D1Database;
  WEBAUTHN_RP_ID?: string;
  WEBAUTHN_RP_NAME?: string;
  WEBAUTHN_ALLOWED_ORIGINS?: string;
  WEBAUTHN_ROOT_ENROLLMENT_ENABLED?: string;
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

function configuredOrigins(value: string | undefined): string[] {
  if (!value || value.length > 4096) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length <= 20 && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch { return []; }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;
  if (!env.DB || !env.WEBAUTHN_RP_ID || !env.WEBAUTHN_RP_NAME) {
    return json({ error: "root_enrollment_unavailable" }, 503);
  }
  const rpId = env.WEBAUTHN_RP_ID;
  const rpName = env.WEBAUTHN_RP_NAME;
  if (env.WEBAUTHN_ROOT_ENROLLMENT_ENABLED !== "true") {
    return json({ error: "root_enrollment_not_approved" }, 503);
  }

  const origin = request.headers.get("Origin");
  if (!origin || !isAllowedWebAuthnOrigin(origin, env.WEBAUTHN_RP_ID, configuredOrigins(env.WEBAUTHN_ALLOWED_ORIGINS))) {
    return json({ error: "origin_not_allowed" }, 403);
  }

  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) {
    return json({ error: session.status === 401 ? "authentication_required" : "root_enrollment_unavailable" }, session.status);
  }

  try {
    const credential = await env.DB.prepare(
      "SELECT 1 AS configured FROM device_root_credentials WHERE device_id = ? AND account_id = ? LIMIT 1",
    ).bind(session.value.deviceId, session.value.accountId).first<{ configured: number }>();
    if (credential?.configured === 1) {
      return json({ error: "security_key_already_configured" }, 409);
    }

    const ceremony = await createRootEnrollmentCeremony({ DB: env.DB, WEBAUTHN_RP_ID: rpId, WEBAUTHN_RP_NAME: rpName }, session.value.accountId, origin);
    return json(ceremony);
  } catch {
    return json({ error: "root_enrollment_unavailable" }, 503);
  }
};
