import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";
import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
import { withdrawTrustedContact } from "../../lib/trusted-contacts/service.ts";

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
      { error: session.status === 401 ? "authentication_required" : "contacts_unavailable" },
      session.status,
    );
  }

  const parsed = await readJsonRequestBody(request, 2_048);
  if (!parsed.ok) {
    return json(
      { error: parsed.reason === "too_large" ? "request_too_large" : "invalid_request" },
      parsed.reason === "too_large" ? 413 : 400,
    );
  }

  if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) {
    return json({ error: "invalid_contact" }, 400);
  }

  const body = parsed.value as { ownerAccountId?: unknown };
  if (typeof body.ownerAccountId !== "string" ||
      body.ownerAccountId.length < 1 ||
      body.ownerAccountId.length > 128 ||
      body.ownerAccountId.trim() !== body.ownerAccountId) {
    return json({ error: "invalid_contact" }, 400);
  }

  const result = await withdrawTrustedContact(env.DB, {
    authenticatedContactAccountId: session.value.accountId,
    ownerAccountId: body.ownerAccountId,
  });

  if (!result.ok) {
    if (result.error === "relationship_not_withdrawn") {
      return json({ error: "relationship_not_found_or_already_ended" }, 404);
    }
    if (result.error === "invalid_input") return json({ error: "invalid_contact" }, 400);
    return json({ error: "contacts_unavailable" }, 503);
  }

  return json({ withdrawn: true });
};
