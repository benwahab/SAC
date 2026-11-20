import { requireAuthenticatedDeviceSession } from "../../../lib/security/require-authenticated-device-session.ts";

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
  if (!session.ok) {
    return json(
      { error: session.status === 401 ? "authentication_required" : "invitation_service_unavailable" },
      session.status,
    );
  }

  try {
    const now = Date.now();
    const [received, sent] = await Promise.all([
      env.DB.prepare(
        `SELECT invitation.id, inviter_identity.normalized_value AS inviter_email,
                invitation.created_at, invitation.expires_at
         FROM contact_invitations invitation
         JOIN accounts recipient ON recipient.id = ? AND recipient.status = 'active'
         JOIN account_identities recipient_identity
           ON recipient_identity.account_id = recipient.id
          AND recipient_identity.channel = 'email'
          AND recipient_identity.is_primary = 1
          AND recipient_identity.verified_at IS NOT NULL
          AND recipient_identity.normalized_value = invitation.destination_email
         JOIN accounts inviter ON inviter.id = invitation.inviter_account_id AND inviter.status = 'active'
         JOIN account_identities inviter_identity
           ON inviter_identity.account_id = inviter.id
          AND inviter_identity.channel = 'email'
          AND inviter_identity.is_primary = 1
          AND inviter_identity.verified_at IS NOT NULL
         WHERE invitation.status = 'pending' AND invitation.expires_at > ?
         ORDER BY invitation.created_at DESC, invitation.id DESC
         LIMIT 50`,
      ).bind(session.value.accountId, now).all<{
        id: string; inviter_email: string; created_at: number; expires_at: number;
      }>(),
      env.DB.prepare(
        `SELECT invitation.id, invitation.destination_email,
                invitation.created_at, invitation.expires_at
         FROM contact_invitations invitation
         WHERE invitation.inviter_account_id = ?
           AND invitation.status = 'pending'
           AND invitation.expires_at > ?
         ORDER BY invitation.created_at DESC, invitation.id DESC
         LIMIT 50`,
      ).bind(session.value.accountId, now).all<{
        id: string; destination_email: string; created_at: number; expires_at: number;
      }>(),
    ]);

    if (!received.success || !sent.success) {
      return json({ error: "invitation_service_unavailable" }, 503);
    }

    return json({
      received: (received.results ?? []).map((row) => ({
        id: row.id, inviterEmail: row.inviter_email,
        createdAt: row.created_at, expiresAt: row.expires_at,
      })),
      sent: (sent.results ?? []).map((row) => ({
        id: row.id, destinationEmail: row.destination_email,
        createdAt: row.created_at, expiresAt: row.expires_at,
      })),
    });
  } catch {
    return json({ error: "invitation_service_unavailable" }, 503);
  }
};
