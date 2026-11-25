import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { clearSessionCookie, readSessionCookie } from "../../lib/security/session-cookie.ts";
import { hashSessionToken } from "../../lib/security/session-token.ts";
interface Env { DB: D1Database; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
function json(body: unknown, status = 200): Response { const headers = new Headers(HEADERS); headers.append("Set-Cookie", clearSessionCookie()); return new Response(JSON.stringify(body), { status, headers }); }
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;
  if (!env.DB) return json({ loggedOut: false }, 503);
  const token = readSessionCookie(request);
  if (!token) return json({ loggedOut: true });
  const tokenHash = await hashSessionToken(crypto, token);
  if (!tokenHash) return json({ loggedOut: true });
  try {
    const now = Date.now();
    const revoked = await env.DB.prepare(
      "UPDATE device_sessions SET status = 'revoked', revoked_at = ? WHERE token_hash = ? AND status = 'active' AND last_activity_at <= ?",
    ).bind(now, tokenHash, now).run();
    if (!revoked.success) return json({ loggedOut: false }, 503);

    // Supprime immédiatement la session fermée lorsqu'aucune trace
    // d'enrôlement immuable ne dépend de sa conservation.
    const cleanup = await env.DB.prepare(
      `DELETE FROM device_sessions
       WHERE token_hash = ?
         AND status = 'revoked'
         AND NOT EXISTS (
           SELECT 1 FROM device_enrollment_events e
           WHERE e.session_id = device_sessions.id
         )`,
    ).bind(tokenHash).run();
    if (!cleanup.success) return json({ loggedOut: false }, 503);
    return json({ loggedOut: true });
  } catch { return json({ loggedOut: false }, 503); }
};
