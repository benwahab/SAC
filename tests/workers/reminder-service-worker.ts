import {
  closeOccurrence,
  createReminder,
  getReminder,
  listNotifications,
  listReminders,
  markNotificationRead,
  updateReminder,
} from "../../functions/lib/reminders/service.ts";
import { runOrdinaryNotificationDispatch, type OrdinaryDispatchEnvironment } from "../../functions/lib/notifications/ordinary-dispatch.ts";

interface Env { DB: D1Database; }

const HEADERS = { "content-type": "application/json" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

async function body<T>(request: Request): Promise<T> {
  return await request.json() as T;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true });

    if (url.pathname === "/seed" && request.method === "POST") {
      const now = Date.now();
      const owner = crypto.randomUUID();
      const other = crypto.randomUUID();
      const statements: D1PreparedStatement[] = [];
      for (const [id, email] of [
        [owner, `owner-${owner}@example.invalid`],
        [other, `other-${other}@example.invalid`],
      ] as const) {
        statements.push(
          env.DB.prepare(
            `INSERT OR IGNORE INTO accounts (id, status, preferred_language, password_hash, created_at, updated_at)
             VALUES (?, 'pending_verification', 'fr', 'not-a-real-password-hash', ?, ?)`,
          ).bind(id, now, now),
          env.DB.prepare(
            `INSERT OR IGNORE INTO account_identities
               (id, account_id, channel, normalized_value, verified_at, is_primary, created_at)
             VALUES (?, ?, 'email', ?, NULL, 1, ?)`,
          ).bind(`identity-${id}`, id, email, now),
          env.DB.prepare(
            `INSERT OR IGNORE INTO email_otp_challenges
               (id, account_id, identity_id, purpose, digest, attempt_count, max_attempts,
                created_at, expires_at, consumed_at, invalidated_at, delivery_status)
             VALUES (?, ?, ?, 'account_email_verification', ?, 0, 6, ?, ?, NULL, NULL, 'pending')`,
          ).bind(
            `challenge-${id}`, id, `identity-${id}`,
            "a".repeat(64), now - 1_000, now + 60_000,
          ),
          env.DB.prepare(
            `UPDATE email_otp_challenges SET delivery_status = 'accepted' WHERE id = ? AND delivery_status = 'pending'`,
          ).bind(`challenge-${id}`),
          env.DB.prepare(
            `UPDATE email_otp_challenges SET consumed_at = ?, attempt_count = 1 WHERE id = ? AND consumed_at IS NULL`,
          ).bind(now, `challenge-${id}`),
          env.DB.prepare(
            `INSERT OR IGNORE INTO account_entitlements (account_id, plan, source, updated_at)
             VALUES (?, 'free', 'default', ?)`,
          ).bind(id, now),
        );
      }
      await env.DB.batch(statements);
      return json({ owner, other, now });
    }

    if (url.pathname === "/create" && request.method === "POST") {
      const input = await body<{ accountId: string; draft: unknown; now?: number }>(request);
      const result = await createReminder(env.DB, input.accountId, input.draft, input.now);
      return json(result, result.ok ? 201 : 400);
    }

    if (url.pathname === "/list" && request.method === "GET") {
      const result = await listReminders(env.DB, url.searchParams.get("accountId") ?? "");
      return json(result, result.ok ? 200 : 400);
    }

    if (url.pathname === "/get" && request.method === "GET") {
      const result = await getReminder(
        env.DB,
        url.searchParams.get("accountId") ?? "",
        url.searchParams.get("reminderId") ?? "",
      );
      return json(result, result.ok ? 200 : result.error === "reminder_not_found" ? 404 : 400);
    }

    if (url.pathname === "/update" && request.method === "POST") {
      const input = await body<{ accountId: string; reminderId: string; action: string; now?: number }>(request);
      const result = await updateReminder(env.DB, input.accountId, input.reminderId, { action: input.action }, input.now);
      return json(result, result.ok ? 200 : 400);
    }

    if (url.pathname === "/close" && request.method === "POST") {
      const input = await body<{ accountId: string; occurrenceId: string; status: string; now?: number }>(request);
      const result = await closeOccurrence(
        env.DB,
        input.accountId,
        input.occurrenceId,
        { status: input.status },
        input.now,
      );
      return json(result, result.ok ? 200 : 400);
    }

    if (url.pathname === "/notifications" && request.method === "GET") {
      const result = await listNotifications(
        env.DB,
        url.searchParams.get("accountId") ?? "",
        Number(url.searchParams.get("now") ?? Date.now()),
      );
      return json(result, result.ok ? 200 : 400);
    }

    if (url.pathname === "/read" && request.method === "POST") {
      const input = await body<{ accountId: string; notificationId: string; now?: number }>(request);
      const result = await markNotificationRead(env.DB, input.accountId, input.notificationId, input.now);
      return json(result, result.ok ? 200 : 400);
    }

    if (url.pathname === "/dispatch" && request.method === "POST") {
      const input = await body<{ now?: number }>(request);
      const deliveryEnv: OrdinaryDispatchEnvironment = { DB: env.DB };
      await runOrdinaryNotificationDispatch(env.DB, deliveryEnv, input.now);
      return json({ ok: true });
    }

    if (url.pathname === "/outbox" && request.method === "GET") {
      const accountId = url.searchParams.get("accountId") ?? "";
      const rows = await env.DB.prepare(
        `SELECT id, kind, source_id, recipient_account_id, scheduled_at, status,
                attempt_count, next_attempt_at, lease_until, lease_token, error_code
         FROM ordinary_notification_outbox
         WHERE recipient_account_id = ?
         ORDER BY scheduled_at, id`,
      ).bind(accountId).all();
      return json({ ok: true, rows: rows.results });
    }

    return json({ error: "not_found" }, 404);
  },
};
