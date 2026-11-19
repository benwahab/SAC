import {
  claimDueSosReminders,
  closeSosAlertByAuthor,
  completeSosReminderDelivery,
  createSosAlert,
  getSosAlertForParticipant,
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
      const owner = crypto.randomUUID(), contact = crypto.randomUUID(), outsider = crypto.randomUUID();
      const stamp = Date.now();
      const statements: D1PreparedStatement[] = [];
      for (const [id, email] of [[owner, "owner"], [contact, "contact"], [outsider, "outsider"]] as const) {
        const identity = crypto.randomUUID();
        statements.push(
          env.DB.prepare("INSERT INTO accounts (id,status,preferred_language,password_hash,created_at,updated_at) VALUES (?,'pending_verification','fr','test-only',?,?)").bind(id, stamp, stamp),
          env.DB.prepare("INSERT INTO account_identities (id,account_id,channel,normalized_value,verified_at,is_primary,created_at) VALUES (?,?,'email',?,?,1,?)").bind(identity, id, email + "-" + id + "@example.ne", stamp, stamp),
          env.DB.prepare("UPDATE accounts SET status='active',updated_at=? WHERE id=?").bind(stamp, id),
        );
      }
      const invitation = crypto.randomUUID();
      statements.push(
        env.DB.prepare("INSERT INTO contact_invitations (id,inviter_account_id,destination_email,token_digest,permission_version,status,created_at,expires_at) SELECT ?,?,?,?,'v1','pending',?,?").bind(invitation, owner, "contact-" + contact + "@example.ne", "a".repeat(64), stamp, stamp + 600000),
        env.DB.prepare("UPDATE contact_invitations SET status='accepted',recipient_account_id=?,decided_at=? WHERE id=?").bind(contact, stamp + 1, invitation),
        env.DB.prepare("INSERT INTO trusted_contacts (owner_account_id,contact_account_id,invitation_id,permission_version,status,created_at) VALUES (?, ?, ?, 'v1','active',?)").bind(owner, contact, invitation, stamp + 1),
      );
      try { await env.DB.batch(statements); return json({ owner, contact, outsider, stamp }); }
      catch (error) { return json({ error: "seed_failed", detail: String(error) }, 500); }
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
