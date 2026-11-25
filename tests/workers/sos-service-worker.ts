import { acceptContactInvitation, createContactInvitation, withdrawTrustedContact } from "../../functions/lib/trusted-contacts/service.ts";
import {
  claimDueSosReminders,
  closeSosAlertByAuthor,
  completeSosReminderDelivery,
  createSosAlert,
  dispatchDueSosReminders,
  scheduleDueSosSmsEscalations,
  getSosAlertForParticipant,
  getSosResponsibilityForParticipant,
  listSosEventsForParticipant,
  respondToSosAlert,
} from "../../functions/lib/alerts/sos-service.ts";

interface Env { DB: D1Database; }
function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}
async function body(request: Request): Promise<Record<string, unknown> | null> {
  try { const value: unknown = await request.json(); return typeof value === "object" && value !== null ? value as Record<string, unknown> : null; }
  catch { return null; }
}

/** Test-only harness: account identifiers are deliberately supplied by the test process. */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true });
    if (request.method !== "POST") return json({ error: "not_found" }, 404);
    const input = await body(request);
    if (!input) return json({ error: "invalid_request" }, 400);
    const now = Number(input.now ?? Date.now());

    if (url.pathname === "/seed") {
      const owner = crypto.randomUUID(), contact = crypto.randomUUID(), contact2 = crypto.randomUUID(), outsider = crypto.randomUUID();
      const stamp = Date.now();
      const statements: D1PreparedStatement[] = [];
      for (const [id, email] of [[owner, "owner"], [contact, "contact"], [contact2, "contact2"], [outsider, "outsider"]] as const) {
        const emailIdentity = crypto.randomUUID();
        const phoneIdentity = crypto.randomUUID();
        const challenge = crypto.randomUUID();
        statements.push(
          env.DB.prepare("INSERT INTO accounts (id,status,preferred_language,password_hash,created_at,updated_at) VALUES (?,'pending_verification','fr','test-only',?,?)").bind(id, stamp, stamp),
          env.DB.prepare("INSERT INTO account_identities (id,account_id,channel,normalized_value,verified_at,is_primary,created_at) VALUES (?,?,'email',?,NULL,1,?)").bind(emailIdentity, id, email + "-" + id + "@example.ne", stamp),
          env.DB.prepare("INSERT INTO account_identities (id,account_id,channel,normalized_value,verified_at,is_primary,created_at) VALUES (?,?,'phone',?,NULL,1,?)").bind(phoneIdentity, id, "+227" + id.replaceAll("-", "").slice(0, 8), stamp),
          env.DB.prepare("INSERT INTO email_otp_challenges (id,account_id,identity_id,purpose,digest,attempt_count,max_attempts,created_at,expires_at,delivery_status) VALUES (?,?,?,'account_email_verification',?,0,6,?,?, 'pending')").bind(challenge, id, emailIdentity, "b".repeat(64), stamp, stamp + 600000),
          env.DB.prepare("UPDATE email_otp_challenges SET delivery_status='accepted' WHERE id=?").bind(challenge),
          env.DB.prepare("UPDATE email_otp_challenges SET attempt_count=1,consumed_at=? WHERE id=?").bind(stamp + 1, challenge),
        );
      }
      for (const [recipient, label] of [[contact, "contact"], [contact2, "contact2"]] as const) {
        const invitation = crypto.randomUUID();
        statements.push(
          env.DB.prepare("INSERT INTO contact_invitations (id,inviter_account_id,destination_email,token_digest,permission_version,status,created_at,expires_at) VALUES (?,?,?,?,?,'pending',?,?)").bind(invitation, owner, label + "-" + recipient + "@example.ne", "a".repeat(63) + (label === "contact" ? "1" : "2"), "v1", stamp, stamp + 600000),
          env.DB.prepare("UPDATE contact_invitations SET status='accepted',recipient_account_id=?,decided_at=? WHERE id=?").bind(recipient, stamp + 1, invitation),
          env.DB.prepare("INSERT INTO trusted_contacts (owner_account_id,contact_account_id,invitation_id,permission_version,status,created_at) VALUES (?, ?, ?, 'v1','active',?)").bind(owner, recipient, invitation, stamp + 1),
        );
      }
      try { await env.DB.batch(statements); return json({ owner, contact, contact2, outsider, stamp }); }
      catch (error) { return json({ error: "seed_failed", detail: String(error) }, 500); }
    }

    if (url.pathname === "/revoke") {
      const result = await env.DB.prepare(
        "UPDATE trusted_contacts SET status='revoked',revoked_at=?,revocation_reason='owner_revoked',revoked_by_account_id=? WHERE owner_account_id=? AND contact_account_id=? AND status='active'",
      ).bind(now, String(input.owner), String(input.owner), String(input.contact)).run();
      return result.success && result.meta.changes === 1 ? json({ revoked: true }) : json({ error: "not_revoked" }, 409);
    }
    if (url.pathname === "/withdraw") {
      const result = await withdrawTrustedContact(env.DB, {
        authenticatedContactAccountId: String(input.contact),
        ownerAccountId: String(input.owner),
        now,
      });
      return result.ok ? json({ withdrawn: true }) : json({ error: result.error }, 409);
    }
    if (url.pathname === "/reinvite") {
      const ownerId = String(input.owner);
      const contactId = String(input.contact);
      const identity = await env.DB.prepare(
        "SELECT normalized_value FROM account_identities WHERE account_id=? AND channel='email' AND is_primary=1 AND verified_at IS NOT NULL",
      ).bind(contactId).first<{ normalized_value: string }>();
      if (!identity) return json({ error: "identity_missing" }, 409);
      const invitation = await createContactInvitation(env.DB, crypto, {
        authenticatedAccountId: ownerId,
        destinationEmail: identity.normalized_value,
        permissionVersion: "v1",
        expiresAt: now + 86_400_000,
        now,
      });
      if (!invitation.ok) return json({ error: invitation.error }, 409);
      const accepted = await acceptContactInvitation(env.DB, crypto, {
        authenticatedAccountId: contactId,
        invitationId: invitation.value.invitationId,
        token: invitation.value.token,
        permissionVersion: "v1",
        maxActiveContacts: 2,
        now: now + 1,
      });
      return accepted.ok ? json({ accepted: true }) : json({ error: accepted.error }, 409);
    }
    if (url.pathname === "/create") {
      const result = await createSosAlert(env.DB, crypto, {
        authenticatedAccountId: String(input.owner),
        recipientAccountIds: Array.isArray(input.recipients) ? input.recipients.map(String) : [],
        recipientLimit: 2,
        category: "personal_danger",
        level: "urgent",
        pushReminderCount: Number(input.reminders ?? 2),
        now,
      });
      return result.ok ? json(result.value) : json({ error: result.error }, 409);
    }
    if (url.pathname === "/read") {
      const result = await getSosAlertForParticipant(env.DB, String(input.actor), String(input.alertId));
      return result.ok ? json(result.value) : json({ error: result.error }, 404);
    }
    if (url.pathname === "/events") {
      const result = await listSosEventsForParticipant(env.DB, String(input.actor), String(input.alertId));
      return result.ok ? json(result.value) : json({ error: result.error }, 404);
    }
    if (url.pathname === "/responsibility") {
      const result = await getSosResponsibilityForParticipant(env.DB, String(input.actor), String(input.alertId));
      return result.ok ? json(result.value) : json({ error: result.error }, 404);
    }
    if (url.pathname === "/respond") {
      const result = await respondToSosAlert(env.DB, crypto, {
        authenticatedAccountId: String(input.actor), alertId: String(input.alertId),
        action: input.action as "acknowledge" | "volunteer" | "withdraw", now,
      });
      return result.ok ? json(result.value) : json({ error: result.error }, 409);
    }
    if (url.pathname === "/close") {
      const result = await closeSosAlertByAuthor(env.DB, crypto, {
        authenticatedAccountId: String(input.actor), alertId: String(input.alertId),
        reason: "completed", now,
      });
      return result.ok ? json(result.value) : json({ error: result.error }, 409);
    }
    if (url.pathname === "/dispatch") {
      const result = await dispatchDueSosReminders(env.DB, crypto, {
        async send(envelope) {
          if (input.throwRecipient === envelope.recipientAccountId) throw new Error("test-only provider failure");
          if (input.failRecipient === envelope.recipientAccountId) return false;
          return true;
        },
      }, { now, batchSize: 10, leaseMilliseconds: 30_000 });
      return result.ok ? json(result.value) : json({ error: result.error }, 409);
    }
    if (url.pathname === "/sms-escalate") {
      const result = await scheduleDueSosSmsEscalations(env.DB, crypto, { now, batchSize: 20 });
      return result.ok ? json(result.value) : json({ error: result.error }, 409);
    }
    if (url.pathname === "/sms-state") {
      const rows = await env.DB.prepare(
        "SELECT recipient_account_id,status,scheduled_at,created_at FROM alert_sms_outbox WHERE alert_id=? ORDER BY recipient_account_id",
      ).bind(String(input.alertId)).all();
      const evaluation = await env.DB.prepare(
        "SELECT status,threshold_reached_at,evaluated_at FROM alert_sms_escalations WHERE alert_id=?",
      ).bind(String(input.alertId)).first();
      return json({ evaluation, rows: rows.results });
    }
    if (url.pathname === "/push-state") {
      const rows = await env.DB.prepare(
        "SELECT recipient_account_id,reminder_number,status,scheduled_at,attempt_count FROM alert_reminder_outbox WHERE alert_id=? ORDER BY recipient_account_id,reminder_number",
      ).bind(String(input.alertId)).all();
      return json({ rows: rows.results });
    }
    if (url.pathname === "/claim") {
      const result = await claimDueSosReminders(env.DB, crypto, { now, batchSize: 10, leaseMilliseconds: 30_000 });
      return result.ok ? json(result.value) : json({ error: result.error }, 409);
    }
    if (url.pathname === "/complete") {
      const result = await completeSosReminderDelivery(env.DB, {
        reminderId: String(input.reminderId), leaseToken: String(input.leaseToken),
        outcome: input.outcome as "sent" | "retry", now,
      });
      return result.ok ? json(result.value) : json({ error: result.error }, 409);
    }
    return json({ error: "not_found" }, 404);
  },
};
