import { requireAuthenticatedDeviceSession } from "../../../../lib/security/require-authenticated-device-session.ts";
import { guardSameOriginJsonPost } from "../../../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../../../lib/security/json-request-body.ts";
import { declineContactInvitation } from "../../../../lib/trusted-contacts/service.ts";

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

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;

  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) {
    return json(
      { error: session.status === 401 ? "authentication_required" : "invitation_service_unavailable" },
      session.status,
    );
  }

  const parsed = await readJsonRequestBody(request, 4_096);
  if (!parsed.ok) {
    return json(
      { error: parsed.reason === "too_large" ? "request_too_large" : "invalid_request" },
      parsed.reason === "too_large" ? 413 : 400,
    );
  }

  if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) {
    return json({ error: "invalid_invitation" }, 400);
  }

  const body = parsed.value as { invitationId?: unknown; token?: unknown };
  if (typeof body.invitationId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(body.invitationId) ||
      typeof body.token !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(body.token)) {
    return json({ error: "invalid_invitation" }, 400);
  }

  const result = await declineContactInvitation(env.DB, crypto, {
    authenticatedAccountId: session.value.accountId,
    invitationId: body.invitationId,
    token: body.token,
  });

  if (!result.ok) {
    const status = result.error === "invalid_input" ? 400 :
      result.error === "storage_unavailable" ? 503 : 409;
    return json({ error: result.error }, status);
  }

  return json({ declined: true });
};
