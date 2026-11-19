import type { TriggeredAlertRecord, AlertClosureReason } from "../../../src/domain/alert-lifecycle.ts";

type SosDatabase = Pick<D1Database, "prepare" | "batch">;

export type SosCategory =
  | "personal_danger"
  | "accident"
  | "home_intrusion"
  | "medical_emergency"
  | "lost_or_disoriented_person"
  | "custom_alert";

export type SosLevel = "preventive" | "urgent" | "critical";

export type SosServiceError =
  | "invalid_input"
  | "account_not_eligible"
  | "recipient_not_trusted"
  | "recipient_limit_exceeded"
  | "alert_not_found_or_closed"
  | "storage_unavailable";

export type SosResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SosServiceError };

function fail<T>(error: SosServiceError): SosResult<T> {
  return { ok: false, error };
}

const categories = new Set<SosCategory>([
  "personal_danger",
  "accident",
  "home_intrusion",
  "medical_emergency",
  "lost_or_disoriented_person",
  "custom_alert",
]);
const levels = new Set<SosLevel>(["preventive", "urgent", "critical"]);

function validId(value: string): boolean {
  return typeof value === "string" && value.length >= 1 && value.length <= 128 && value.trim() === value;
}

/**
 * Persists a SOS and its immutable recipient snapshot in one D1 batch.
 * authenticatedAccountId and recipientLimit MUST come from server-side
 * session/entitlement checks, never from request JSON.
 */
export async function createSosAlert(
  db: SosDatabase,
  cryptoProvider: Crypto,
  input: {
    readonly authenticatedAccountId: string;
    readonly recipientAccountIds: readonly string[];
    readonly recipientLimit: 2 | 10;
    readonly category: SosCategory;
    readonly level: SosLevel;
    readonly customDescription?: string | null;
    readonly pushReminderCount: number;
    readonly now?: number;
  },
): Promise<SosResult<{ readonly alertId: string; readonly createdAt: number; readonly recipientAccountIds: readonly string[] }>> {
  const now = input.now ?? Date.now();
  const recipients = [...input.recipientAccountIds];
  const description = input.customDescription ?? null;

  if (
    !validId(input.authenticatedAccountId) ||
    (input.recipientLimit !== 2 && input.recipientLimit !== 10) ||
    recipients.length < 1 ||
    recipients.length > input.recipientLimit ||
    recipients.some((id) => !validId(id) || id === input.authenticatedAccountId) ||
    new Set(recipients).size !== recipients.length ||
    !categories.has(input.category) ||
    !levels.has(input.level) ||
    !Number.isSafeInteger(input.pushReminderCount) ||
    input.pushReminderCount < 0 ||
    !Number.isSafeInteger(now) ||
    now <= 0 ||
    (description !== null && (typeof description !== "string" || description.length > 2000)) ||
    (input.category === "custom_alert" && (!description || !description.trim()))
  ) return fail("invalid_input");

  try {
    const eligible = await db.prepare(
      `SELECT t.contact_account_id AS account_id
       FROM trusted_contacts t
       JOIN accounts a ON a.id = t.contact_account_id AND a.status = 'active'
       WHERE t.owner_account_id = ?
         AND t.status = 'active'
         AND t.contact_account_id IN (${recipients.map(() => "?").join(", ")})`,
    ).bind(input.authenticatedAccountId, ...recipients).all<{ account_id: string }>();

    if (!eligible.success) return fail("storage_unavailable");
    const eligibleIds = new Set((eligible.results ?? []).map((row) => row.account_id));
    if (eligibleIds.size !== recipients.length || recipients.some((id) => !eligibleIds.has(id))) {
      return fail("recipient_not_trusted");
    }

    const alertId = cryptoProvider.randomUUID();
    const statements = [
      db.prepare(
        `INSERT INTO alerts
         (id, author_account_id, category, level, custom_description,
          status, push_reminder_limit, created_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
      ).bind(alertId, input.authenticatedAccountId, input.category, input.level, description, input.pushReminderCount, now),
      ...recipients.map((recipientId) => db.prepare(
        `INSERT INTO alert_recipients (alert_id, recipient_account_id, selected_at)
         VALUES (?, ?, ?)`,
      ).bind(alertId, recipientId, now)),
      db.prepare(
        `INSERT INTO alert_events (id, alert_id, actor_account_id, event_type, occurred_at)
         VALUES (?, ?, ?, 'triggered', ?)`,
      ).bind(cryptoProvider.randomUUID(), alertId, input.authenticatedAccountId, now),
    ];

    for (const recipientId of recipients) {
      for (let number = 1; number <= input.pushReminderCount; number += 1) {
        statements.push(db.prepare(
          `INSERT INTO alert_reminder_outbox
           (id, alert_id, recipient_account_id, reminder_number, scheduled_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).bind(
          cryptoProvider.randomUUID(),
          alertId,
          recipientId,
          number,
          now + number * 300_000,
          now,
        ));
      }
    }

    const results = await db.batch(statements);
    if (results.length !== statements.length || results.some((result) => !result.success)) {
      return fail("storage_unavailable");
    }

    return { ok: true, value: { alertId, createdAt: now, recipientAccountIds: recipients } };
  } catch {
    return fail("storage_unavailable");
  }
}

/**
 * Author-only closure. The conditional event INSERT is coupled to changes()
 * from the preceding UPDATE, preventing duplicate closure events on races.
 * The D1 batch also ends the current responsibility period and the schema
 * trigger cancels pending reminder rows.
 */
export async function closeSosAlertByAuthor(
  db: SosDatabase,
  cryptoProvider: Crypto,
  input: {
    readonly authenticatedAccountId: string;
    readonly alertId: string;
    readonly reason: AlertClosureReason;
    readonly now?: number;
  },
): Promise<SosResult<{ readonly closed: true; readonly closedAt: number }>> {
  const now = input.now ?? Date.now();
  if (
    !validId(input.authenticatedAccountId) ||
    !validId(input.alertId) ||
    (input.reason !== "completed" && input.reason !== "cancelled") ||
    !Number.isSafeInteger(now) ||
    now <= 0
  ) return fail("invalid_input");

  try {
    const results = await db.batch([
      db.prepare(
        `UPDATE alerts
         SET status = 'closed_by_author', closed_at = ?, closure_reason = ?
         WHERE id = ? AND author_account_id = ? AND status = 'active'
           AND created_at <= ?`,
      ).bind(now, input.reason, input.alertId, input.authenticatedAccountId, now),
      db.prepare(
        `INSERT INTO alert_events
         (id, alert_id, actor_account_id, event_type, occurred_at)
         SELECT ?, id, author_account_id, 'closed_by_author', ?
         FROM alerts
         WHERE id = ? AND author_account_id = ?
           AND status = 'closed_by_author' AND closed_at = ?
           AND changes() = 1`,
      ).bind(cryptoProvider.randomUUID(), now, input.alertId, input.authenticatedAccountId, now),
      db.prepare(
        `UPDATE alert_responsibility_periods
         SET ended_at = ?, end_reason = 'alert_closed'
         WHERE alert_id = ? AND ended_at IS NULL`,
      ).bind(now, input.alertId),
    ]);

    if (results.length !== 3 || results.some((result) => !result.success)) {
      return fail("alert_not_found_or_closed");
    }
    if (results[0].meta.changes !== 1 || results[1].meta.changes !== 1) {
      return fail("alert_not_found_or_closed");
    }
    return { ok: true, value: { closed: true, closedAt: now } };
  } catch {
    return fail("alert_not_found_or_closed");
  }
}

/** Narrow read projection; never returns GPS or other contacts' private data. */
export async function getSosAlertForParticipant(
  db: SosDatabase,
  authenticatedAccountId: string,
  alertId: string,
): Promise<SosResult<{
  readonly alert: TriggeredAlertRecord & { readonly category: SosCategory; readonly level: SosLevel };
  readonly isAuthor: boolean;
}>> {
  if (!validId(authenticatedAccountId) || !validId(alertId)) return fail("invalid_input");

  try {
    const row = await db.prepare(
      `SELECT a.id, a.author_account_id, a.status, a.created_at, a.closed_at,
              a.closure_reason, a.category, a.level
       FROM alerts a
       WHERE a.id = ?
         AND (a.author_account_id = ? OR EXISTS (
           SELECT 1 FROM alert_recipients r
           WHERE r.alert_id = a.id AND r.recipient_account_id = ?
         ))
       LIMIT 1`,
    ).bind(alertId, authenticatedAccountId, authenticatedAccountId).first<{
      id: string;
      author_account_id: string;
      status: "active" | "closed_by_author";
      created_at: number;
      closed_at: number | null;
      closure_reason: AlertClosureReason | null;
      category: SosCategory;
      level: SosLevel;
    }>();

    if (!row) return fail("alert_not_found_or_closed");
    const recipients = await db.prepare(
      `SELECT recipient_account_id, selected_at
       FROM alert_recipients WHERE alert_id = ?
       ORDER BY selected_at, recipient_account_id`,
    ).bind(alertId).all<{ recipient_account_id: string; selected_at: number }>();
    if (!recipients.success) return fail("storage_unavailable");

    return {
      ok: true,
      value: {
        isAuthor: row.author_account_id === authenticatedAccountId,
        alert: {
          alertId: row.id,
          authorAccountId: row.author_account_id,
          status: row.status,
          createdAt: new Date(row.created_at).toISOString(),
          closedAt: row.closed_at === null ? null : new Date(row.closed_at).toISOString(),
          closureReason: row.closure_reason,
          category: row.category,
          level: row.level,
          recipientSnapshot: (recipients.results ?? []).map((recipient) => ({
            contactUserId: recipient.recipient_account_id,
            selectedAt: new Date(recipient.selected_at).toISOString(),
          })),
        },
      },
    };
  } catch {
    return fail("storage_unavailable");
  }
}
