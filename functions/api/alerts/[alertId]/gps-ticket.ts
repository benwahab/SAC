import { requireAuthenticatedDeviceSession } from "../../../lib/security/require-authenticated-device-session.ts";
import { guardSameOriginJsonPost } from "../../../lib/security/http-request-guard.ts";

interface Env {
  DB: D1Database;
  GPS_RELAY_PUBLIC_URL?: string;
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

function createOpaqueTicket(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hashTicket(ticket: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ticket)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Émet un ticket aléatoire à usage unique pour un participant de l'alerte active.
 * Seule son empreinte SHA-256 est conservée dans D1 ; aucune position n'est reçue.
 */
export const onRequestPost: PagesFunction<Env, "alertId"> = async ({ request, env, params }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;

  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) {
    return json(
      { error: session.status === 401 ? "authentication_required" : "gps_service_unavailable" },
      session.status,
    );
  }

  const alertId = params.alertId;
  if (typeof alertId !== "string" || !alertId.trim() || alertId.length > 128) {
    return json({ error: "alert_not_found" }, 404);
  }
  if (!env.GPS_RELAY_PUBLIC_URL) return json({ error: "gps_service_not_configured" }, 503);

  try {
    const row = await env.DB.prepare(
      `SELECT a.id,
        CASE WHEN a.author_account_id = ? THEN 'author' ELSE 'recipient' END AS participant_role
       FROM alerts a
       WHERE a.id = ? AND a.status = 'active'
         AND (a.author_account_id = ? OR EXISTS (
           SELECT 1 FROM alert_recipients r
           JOIN trusted_contacts t
             ON t.owner_account_id = a.author_account_id
            AND t.contact_account_id = r.recipient_account_id
            AND (t.status = 'active' OR (t.status = 'revoked' AND t.revocation_reason = 'owner_revoked'))
            AND t.created_at <= a.created_at
            AND t.invitation_id = (SELECT latest.invitation_id FROM trusted_contacts latest WHERE latest.owner_account_id = a.author_account_id AND latest.contact_account_id = t.contact_account_id ORDER BY latest.created_at DESC, latest.invitation_id DESC LIMIT 1)
           WHERE r.alert_id = a.id AND r.recipient_account_id = ?
         ))
       LIMIT 1`,
    ).bind(session.value.accountId, alertId, session.value.accountId, session.value.accountId)
      .first<{ id: string; participant_role: "author" | "recipient" }>();

    if (!row) return json({ error: "alert_not_found_or_closed" }, 404);

    const now = Date.now();
    const expiresAt = now + 120_000;
    const ticket = createOpaqueTicket();
    const ticketHash = await hashTicket(ticket);

    await env.DB.prepare("DELETE FROM gps_relay_tickets WHERE expires_at <= ?").bind(now).run();
    const inserted = await env.DB.prepare(
      `INSERT INTO gps_relay_tickets
         (ticket_hash, alert_id, account_id, device_id, session_id, role, created_at, expires_at)
       SELECT ?, a.id, ?, ?, ?, ?, ?, ?
       FROM alerts a
       WHERE a.id = ? AND a.status = 'active'
         AND (a.author_account_id = ? OR EXISTS (
           SELECT 1 FROM alert_recipients r
           JOIN trusted_contacts t
             ON t.owner_account_id = a.author_account_id
            AND t.contact_account_id = r.recipient_account_id
            AND (t.status = 'active' OR (t.status = 'revoked' AND t.revocation_reason = 'owner_revoked'))
            AND t.created_at <= a.created_at
            AND t.invitation_id = (SELECT latest.invitation_id FROM trusted_contacts latest WHERE latest.owner_account_id = a.author_account_id AND latest.contact_account_id = t.contact_account_id ORDER BY latest.created_at DESC, latest.invitation_id DESC LIMIT 1)
           WHERE r.alert_id = a.id AND r.recipient_account_id = ?
         ))`,
    ).bind(
      ticketHash, session.value.accountId, session.value.deviceId, session.value.sessionId, row.participant_role, now, expiresAt,
      row.id, session.value.accountId, session.value.accountId,
    ).run();

    if (!inserted.success || inserted.meta.changes !== 1) {
      return json({ error: "alert_not_found_or_closed" }, 409);
    }

    const relayUrl = new URL(
      "/v1/alerts/" + encodeURIComponent(row.id) + "/socket",
      env.GPS_RELAY_PUBLIC_URL,
    );
    relayUrl.protocol = relayUrl.protocol === "https:" ? "wss:" : "ws:";

    return json({
      ticket,
      websocketUrl: relayUrl.toString(),
      websocketProtocol: "sac-gps-v1",
      expiresInSeconds: 120,
    });
  } catch {
    return json({ error: "gps_service_unavailable" }, 503);
  }
};
