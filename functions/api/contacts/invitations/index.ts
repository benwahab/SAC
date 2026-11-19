import { requireAuthenticatedDeviceSession } from "../../../lib/security/require-authenticated-device-session.ts";
import { guardSameOriginJsonPost } from "../../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../../lib/security/json-request-body.ts";
import { createAndSendContactInvitation } from "../../../lib/trusted-contacts/invitation-delivery.ts";
import { digestContactInvitationToken } from "../../../lib/security/contact-invitation-token.ts";
import type { SacEmailLanguage } from "../../../lib/email/resend.ts";

interface Env {
  DB: D1Database;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  APP_BASE_URL?: string;
  CONTACT_INVITATION_TTL_MS?: string;
  CONTACT_PERMISSION_VERSION?: string;
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

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "invitation_service_unavailable" }, session.status);

  const url = new URL(request.url);
  const invitationId = url.searchParams.get("id") ?? "";
  const token = url.searchParams.get("token") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(invitationId) || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return json({ error: "invitation_not_found" }, 404);
  }

  try {
    const digest = await digestContactInvitationToken(crypto, token);
    const invitation = await env.DB.prepare(
      `SELECT inviter_identity.normalized_value AS inviter_email, invitation.expires_at
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
       WHERE invitation.id = ?
         AND invitation.token_digest = ?
         AND invitation.status = 'pending'
         AND invitation.expires_at > ?
       LIMIT 1`,
    ).bind(session.value.accountId, invitationId, digest, Date.now()).first<{
      inviter_email: string;
      expires_at: number;
    }>();

    if (!invitation) return json({ error: "invitation_not_found" }, 404);
    return json({
      invitation: {
        id: invitationId,
        inviterEmail: invitation.inviter_email,
        expiresAt: invitation.expires_at,
      },
    });
  } catch {
    return json({ error: "invitation_service_unavailable" }, 503);
  }
};

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

  const parsed = await readJsonRequestBody(request, 2_048);
  if (!parsed.ok) {
    return json(
      { error: parsed.reason === "too_large" ? "request_too_large" : "invalid_request" },
      parsed.reason === "too_large" ? 413 : 400,
    );
  }

  if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) {
    return json({ error: "invalid_invitation" }, 400);
  }

  const body = parsed.value as { destinationEmail?: unknown };
  if (typeof body.destinationEmail !== "string" ||
      body.destinationEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.destinationEmail.trim())) {
    return json({ error: "invalid_email" }, 400);
  }

  const ttl = Number(env.CONTACT_INVITATION_TTL_MS);
  const permissionVersion = env.CONTACT_PERMISSION_VERSION?.trim();
  if (!Number.isSafeInteger(ttl) || ttl <= 0 ||
      !permissionVersion || permissionVersion.length > 128 ||
      !env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !env.APP_BASE_URL) {
    return json({ error: "invitation_service_not_configured" }, 503);
  }

  try {
    const account = await env.DB.prepare(
      `SELECT preferred_language
       FROM accounts
       WHERE id = ? AND status = 'active'
       LIMIT 1`,
    ).bind(session.value.accountId).first<{ preferred_language: string }>();

    if (!account || !["fr", "en", "ar"].includes(account.preferred_language)) {
      return json({ error: "invitation_service_unavailable" }, 503);
    }

    const now = Date.now();
    const expiresAt = now + ttl;
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) {
      return json({ error: "invitation_service_not_configured" }, 503);
    }

    const result = await createAndSendContactInvitation(
      env.DB,
      crypto,
      {
        RESEND_API_KEY: env.RESEND_API_KEY,
        RESEND_FROM_EMAIL: env.RESEND_FROM_EMAIL,
        APP_BASE_URL: env.APP_BASE_URL,
      },
      {
        authenticatedAccountId: session.value.accountId,
        destinationEmail: body.destinationEmail,
        permissionVersion,
        expiresAt,
        language: account.preferred_language as SacEmailLanguage,
        now,
      },
    );

    if (!result.ok) {
      const status = result.error === "invalid_input" ? 400 :
        result.error === "self_invitation" || result.error === "relationship_already_active" ? 409 :
        result.error === "account_not_eligible" ? 403 : 503;
      return json({ error: result.error }, status);
    }

    return json({
      invitationSent: true,
      invitationId: result.value.invitationId,
      expiresAt: result.value.expiresAt,
    }, 201);
  } catch {
    return json({ error: "invitation_service_unavailable" }, 503);
  }
};
