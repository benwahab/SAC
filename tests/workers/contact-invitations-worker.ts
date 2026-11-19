import { createAndSendContactInvitation } from "../../functions/lib/trusted-contacts/invitation-delivery.ts";
import {
  acceptContactInvitation,
  createContactInvitation,
  declineContactInvitation,
  listTrustedContacts,
  revokeTrustedContact,
} from "../../functions/lib/trusted-contacts/service.ts";

interface Env {
  DB: D1Database;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/**
 * Test-only Worker. The account IDs below are deliberately supplied by the
 * harness; this file is never part of functions/api and is not deployable.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true });

    if (request.method !== "POST") return json({ error: "not_found" }, 404);
    const body = await readBody(request);
    if (!body) return json({ error: "invalid_request" }, 400);

    if (url.pathname === "/seed") {
      const now = Date.now();
      const ownerEmail = "owner-" + crypto.randomUUID() + "@example.ne";
      const contactEmail = "contact-" + crypto.randomUUID() + "@example.ne";
      const contact2Email = "contact2-" + crypto.randomUUID() + "@example.ne";
      const contact3Email = "contact3-" + crypto.randomUUID() + "@example.ne";
      const ownerId = crypto.randomUUID();
      const contactId = crypto.randomUUID();
      const contact2Id = crypto.randomUUID();
      const contact3Id = crypto.randomUUID();

      function accountStatements(id: string, email: string) {
        const identityId = crypto.randomUUID();
        const challengeId = crypto.randomUUID();
        return [
          env.DB.prepare(
            "INSERT INTO accounts (id,status,preferred_language,password_hash,created_at,updated_at) VALUES (?,'pending_verification','fr','test-only',?,?)",
          ).bind(id, now, now),
          env.DB.prepare(
            "INSERT INTO account_identities (id,account_id,channel,normalized_value,verified_at,is_primary,created_at) VALUES (?,?,'email',?,NULL,1,?)",
          ).bind(identityId, id, email, now),
          env.DB.prepare(
            "INSERT INTO email_otp_challenges (id,account_id,identity_id,purpose,digest,attempt_count,max_attempts,created_at,expires_at) VALUES (?,?,?,'account_email_verification',?,0,6,?,?)",
          ).bind(challengeId, id, identityId, "a".repeat(64), now - 1000, now + 600000),
          env.DB.prepare(
            "UPDATE email_otp_challenges SET attempt_count=1,consumed_at=? WHERE id=?",
          ).bind(now, challengeId),
        ];
      }

      try {
        await env.DB.batch([
          ...accountStatements(ownerId, ownerEmail),
          ...accountStatements(contactId, contactEmail),
          ...accountStatements(contact2Id, contact2Email),
          ...accountStatements(contact3Id, contact3Email),
        ]);
        return json({ ownerId, ownerEmail, contactId, contactEmail, contact2Id, contact2Email, contact3Id, contact3Email });
      } catch {
        return json({ error: "seed_failed" }, 500);
      }
    }

    if (url.pathname === "/create") {
      const result = await createContactInvitation(env.DB, crypto, {
        authenticatedAccountId: String(body.ownerId ?? ""),
        destinationEmail: String(body.destinationEmail ?? ""),
        permissionVersion: "permissions-v1",
        expiresAt: Number(body.expiresAt),
        now: Number(body.now),
      });
      return result.ok ? json(result.value) : json({ error: result.error }, 400);
    }

    if (url.pathname === "/create-and-send") {
      const result = await createAndSendContactInvitation(
        env.DB,
        crypto,
        {
          RESEND_API_KEY: "test-only",
          RESEND_FROM_EMAIL: "SAC <test@example.ne>",
          APP_BASE_URL: "https://sac.example.ne",
        },
        {
          authenticatedAccountId: String(body.ownerId ?? ""),
          destinationEmail: String(body.destinationEmail ?? ""),
          permissionVersion: "permissions-v1",
          expiresAt: Number(body.expiresAt),
          language: "fr",
          now: Number(body.now),
        },
        async () => body.failDelivery
          ? new Response("provider failure", { status: 503 })
          : Response.json({ id: "test-email-delivered" }),
      );
      return result.ok ? json(result.value) : json({ error: result.error, invitationId: result.invitationId }, 400);
    }

    if (url.pathname === "/invitation-status") {
      const row = await env.DB.prepare(
        "SELECT status FROM contact_invitations WHERE id = ?",
      ).bind(String(body.invitationId ?? "")).first<{ status: string }>();
      return row ? json(row) : json({ error: "not_found" }, 404);
    }

    if (url.pathname === "/accept") {
      const result = await acceptContactInvitation(env.DB, crypto, {
        authenticatedAccountId: String(body.contactId ?? ""),
        invitationId: String(body.invitationId ?? ""),
        token: String(body.token ?? ""),
        permissionVersion: "permissions-v1",
        maxActiveContacts: 2,
        now: Number(body.now),
      });
      return result.ok ? json(result.value) : json({ error: result.error }, 409);
    }

    if (url.pathname === "/decline") {
      const result = await declineContactInvitation(env.DB, crypto, {
        authenticatedAccountId: String(body.contactId ?? ""),
        invitationId: String(body.invitationId ?? ""),
        token: String(body.token ?? ""),
        now: Number(body.now),
      });
      return result.ok ? json(result.value) : json({ error: result.error }, 409);
    }

    if (url.pathname === "/contacts") {
      const result = await listTrustedContacts(env.DB, String(body.ownerId ?? ""));
      return result.ok ? json({ contacts: result.value }) : json({ error: result.error }, 500);
    }

    if (url.pathname === "/revoke") {
      const result = await revokeTrustedContact(env.DB, {
        authenticatedOwnerAccountId: String(body.ownerId ?? ""),
        contactAccountId: String(body.contactId ?? ""),
        now: Number(body.now),
      });
      return result.ok ? json(result.value) : json({ error: result.error }, 409);
    }

    return json({ error: "not_found" }, 404);
  },
};
