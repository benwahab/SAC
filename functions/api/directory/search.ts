import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";
import { searchDirectory, type SocialError } from "../../lib/account/social-service.ts";

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
  if (error === "rate_limited") return 429;
  if (error === "storage_unavailable") return 503;
  return 400;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "directory_unavailable" }, session.status);
  const url = new URL(request.url);
  const result = await searchDirectory(env.DB, session.value.accountId, url.searchParams.get("mode"), url.searchParams.get("q"));
  if (!result.ok) return json({ error: result.error }, statusFor(result.error));
  return json({ results: result.value });
};
