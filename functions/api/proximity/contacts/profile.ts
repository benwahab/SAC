import { requireAuthenticatedDeviceSession } from "../../../lib/security/require-authenticated-device-session.ts";
import { getCloseContact } from "../../../lib/account/social-service.ts";

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

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "contacts_unavailable" }, session.status);
  const accountId = new URL(request.url).searchParams.get("accountId") ?? "";
  const result = await getCloseContact(env.DB, session.value.accountId, accountId);
  if (!result.ok) return json({ error: result.error }, result.error === "contact_not_found" ? 404 : result.error === "storage_unavailable" ? 503 : 400);
  return json({ contact: result.value });
};
