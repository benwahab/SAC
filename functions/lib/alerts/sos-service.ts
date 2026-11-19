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
    input.pushReminderCount < 1 ||
    input.pushReminderCount > 5 ||
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
      // Le push initial (séquence 0) est distinct des rappels 1 à 5.
      for (let number = 0; number <= input.pushReminderCount; number += 1) {
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
 * Author-only closure. The event INSERT is guarded by the persisted terminal
 * state and absence of a prior closure event, so concurrent retries cannot
 * append a second closure event. The D1 batch also ends the current
 * responsibility period and the schema trigger cancels pending reminder rows.
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
    await db.batch([
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
           AND NOT EXISTS (
             SELECT 1 FROM alert_events
             WHERE alert_id = ? AND event_type = 'closed_by_author'
           )`,
      ).bind(cryptoProvider.randomUUID(), now, input.alertId, input.authenticatedAccountId, now, input.alertId),
      db.prepare(
        `UPDATE alert_responsibility_periods
         SET ended_at = ?, end_reason = 'alert_closed'
         WHERE alert_id = ? AND ended_at IS NULL`,
      ).bind(now, input.alertId),
    ]);
  } catch {
    // A concurrent identical close may win the transaction first. Verify
    // persisted state below rather than treating that race as a false failure.
  }

  try {
    const committed = await db.prepare(
      `SELECT a.status, a.author_account_id, a.closed_at, a.closure_reason,
         EXISTS (
           SELECT 1 FROM alert_events e
           WHERE e.alert_id = a.id
             AND e.actor_account_id = a.author_account_id
             AND e.event_type = 'closed_by_author'
             AND e.occurred_at = a.closed_at
         ) AS closure_event_recorded
       FROM alerts a WHERE a.id = ? LIMIT 1`,
    ).bind(input.alertId).first<{
      status: string;
      author_account_id: string;
      closed_at: number | null;
      closure_reason: AlertClosureReason | null;
      closure_event_recorded: number;
    }>();

    if (
      !committed ||
      committed.status !== "closed_by_author" ||
      committed.author_account_id !== input.authenticatedAccountId ||
      committed.closed_at !== now ||
      committed.closure_reason !== input.reason ||
      committed.closure_event_recorded !== 1
    ) return fail("alert_not_found_or_closed");

    return { ok: true, value: { closed: true, closedAt: now } };
  } catch {
    return fail("storage_unavailable");
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


export type SosResponseAction = "acknowledge" | "volunteer" | "withdraw";

/**
 * Records a recipient response and maintains the single active lead-responder
 * period. Volunteer order is assigned by D1, never by a client timestamp.
 */
export async function respondToSosAlert(
  db: SosDatabase,
  cryptoProvider: Crypto,
  input: {
    readonly authenticatedAccountId: string;
    readonly alertId: string;
    readonly action: SosResponseAction;
    readonly now?: number;
  },
): Promise<SosResult<{ readonly recorded: true; readonly responsibilityAssigned: boolean }>> {
  const now = input.now ?? Date.now();
  if (
    !validId(input.authenticatedAccountId) ||
    !validId(input.alertId) ||
    !["acknowledge", "volunteer", "withdraw"].includes(input.action) ||
    !Number.isSafeInteger(now) ||
    now <= 0
  ) return fail("invalid_input");

  try {
    const participant = await db.prepare(
      `SELECT a.created_at
       FROM alerts a
       JOIN alert_recipients r ON r.alert_id = a.id
       WHERE a.id = ? AND a.status = 'active'
         AND r.recipient_account_id = ? AND a.created_at <= ?
       LIMIT 1`,
    ).bind(input.alertId, input.authenticatedAccountId, now).first<{ created_at: number }>();
    if (!participant) return fail("alert_not_found_or_closed");

    if (input.action === "acknowledge") {
      const result = await db.prepare(
        `INSERT INTO alert_events (id, alert_id, actor_account_id, event_type, occurred_at)
         SELECT ?, ?, ?, 'acknowledged', ?
         WHERE NOT EXISTS (
           SELECT 1 FROM alert_events
           WHERE alert_id = ? AND actor_account_id = ? AND event_type = 'acknowledged'
         )`,
      ).bind(
        cryptoProvider.randomUUID(), input.alertId, input.authenticatedAccountId,
        now, input.alertId, input.authenticatedAccountId,
      ).run();
      if (!result.success) return fail("storage_unavailable");
      return { ok: true, value: { recorded: true, responsibilityAssigned: false } };
    }

    if (input.action === "volunteer") {
      const existing = await db.prepare(
        `SELECT
           EXISTS(SELECT 1 FROM alert_events WHERE alert_id = ? AND actor_account_id = ? AND event_type = 'volunteered') AS volunteered,
           EXISTS(SELECT 1 FROM alert_events WHERE alert_id = ? AND actor_account_id = ? AND event_type = 'withdrew') AS withdrew`,
      ).bind(input.alertId, input.authenticatedAccountId, input.alertId, input.authenticatedAccountId)
        .first<{ volunteered: number; withdrew: number }>();
      if (!existing) return fail("storage_unavailable");
      if (existing.withdrew) return fail("invalid_input");
      if (existing.volunteered) {
        const current = await db.prepare(
          `SELECT 1 AS assigned FROM alert_responsibility_periods
           WHERE alert_id = ? AND contact_account_id = ? AND ended_at IS NULL`,
        ).bind(input.alertId, input.authenticatedAccountId).first<{ assigned: number }>();
        return { ok: true, value: { recorded: true, responsibilityAssigned: Boolean(current) } };
      }

      const results = await db.batch([
        db.prepare(
          `INSERT INTO alert_events
           (id, alert_id, actor_account_id, event_type, occurred_at, server_sequence)
           SELECT ?, ?, ?, 'volunteered', ?,
             COALESCE((SELECT MAX(server_sequence) FROM alert_events WHERE alert_id = ?), 0) + 1
           WHERE EXISTS (SELECT 1 FROM alerts WHERE id = ? AND status = 'active')
             AND NOT EXISTS (
               SELECT 1 FROM alert_events
               WHERE alert_id = ? AND actor_account_id = ? AND event_type IN ('volunteered', 'withdrew')
             )`,
        ).bind(
          cryptoProvider.randomUUID(), input.alertId, input.authenticatedAccountId,
          now, input.alertId, input.alertId, input.alertId, input.authenticatedAccountId,
        ),
        db.prepare(
          `INSERT INTO alert_responsibility_periods
           (id, alert_id, contact_account_id, started_at, sequence)
           SELECT ?, e.alert_id, e.actor_account_id, e.occurred_at, e.server_sequence
           FROM alert_events e
           WHERE e.alert_id = ? AND e.actor_account_id = ?
             AND e.event_type = 'volunteered'
             AND NOT EXISTS (
               SELECT 1 FROM alert_responsibility_periods p
               WHERE p.alert_id = e.alert_id AND p.ended_at IS NULL
             )
             AND NOT EXISTS (
               SELECT 1 FROM alert_responsibility_periods p
               WHERE p.alert_id = e.alert_id AND p.sequence = e.server_sequence
             )`,
        ).bind(cryptoProvider.randomUUID(), input.alertId, input.authenticatedAccountId),
      ]);
      if (results.some((result) => !result.success)) return fail("storage_unavailable");
      if (results[0].meta.changes !== 1) {
        const prior = await db.prepare(
          `SELECT 1 AS present
           FROM alert_events e JOIN alerts a ON a.id = e.alert_id
           WHERE e.alert_id = ? AND e.actor_account_id = ?
             AND e.event_type = 'volunteered' AND a.status = 'active'`,
        ).bind(input.alertId, input.authenticatedAccountId).first<{ present: number }>();
        if (!prior) return fail("alert_not_found_or_closed");
      }
      return {
        ok: true,
        value: { recorded: true, responsibilityAssigned: results[1].meta.changes === 1 },
      };
    }

    const volunteered = await db.prepare(
      `SELECT server_sequence FROM alert_events
       WHERE alert_id = ? AND actor_account_id = ? AND event_type = 'volunteered'
       LIMIT 1`,
    ).bind(input.alertId, input.authenticatedAccountId).first<{ server_sequence: number }>();
    if (!volunteered) return fail("invalid_input");
    const alreadyWithdrew = await db.prepare(
      `SELECT 1 AS present FROM alert_events
       WHERE alert_id = ? AND actor_account_id = ? AND event_type = 'withdrew' LIMIT 1`,
    ).bind(input.alertId, input.authenticatedAccountId).first<{ present: number }>();
    if (alreadyWithdrew) return fail("invalid_input");

    const results = await db.batch([
      db.prepare(
        `INSERT INTO alert_events (id, alert_id, actor_account_id, event_type, occurred_at)
         SELECT ?, ?, ?, 'withdrew', ?
         WHERE EXISTS (SELECT 1 FROM alerts WHERE id = ? AND status = 'active')
           AND EXISTS (SELECT 1 FROM alert_events
             WHERE alert_id = ? AND actor_account_id = ? AND event_type = 'volunteered')
           AND NOT EXISTS (SELECT 1 FROM alert_events
             WHERE alert_id = ? AND actor_account_id = ? AND event_type = 'withdrew')`,
      ).bind(
        cryptoProvider.randomUUID(), input.alertId, input.authenticatedAccountId, now,
        input.alertId, input.alertId, input.authenticatedAccountId,
        input.alertId, input.authenticatedAccountId,
      ),
      db.prepare(
        `UPDATE alert_responsibility_periods
         SET ended_at = ?, end_reason = 'withdrawn'
         WHERE alert_id = ? AND contact_account_id = ? AND ended_at IS NULL`,
      ).bind(now, input.alertId, input.authenticatedAccountId),
      db.prepare(
        `INSERT INTO alert_responsibility_periods
         (id, alert_id, contact_account_id, started_at, sequence)
         SELECT ?, candidate.alert_id, candidate.actor_account_id, ?, candidate.server_sequence
         FROM alert_events candidate
         WHERE candidate.alert_id = ?
           AND candidate.event_type = 'volunteered'
           AND candidate.actor_account_id <> ?
           AND NOT EXISTS (
             SELECT 1 FROM alert_events w
             WHERE w.alert_id = candidate.alert_id
               AND w.actor_account_id = candidate.actor_account_id
               AND w.event_type = 'withdrew'
           )
           AND NOT EXISTS (
             SELECT 1 FROM alert_responsibility_periods p
             WHERE p.alert_id = candidate.alert_id AND p.sequence = candidate.server_sequence
           )
           AND EXISTS (
             SELECT 1 FROM alert_responsibility_periods ended
             WHERE ended.alert_id = candidate.alert_id
               AND ended.contact_account_id = ? AND ended.ended_at = ?
               AND ended.end_reason = 'withdrawn'
           )
           AND NOT EXISTS (
             SELECT 1 FROM alert_responsibility_periods current
             WHERE current.alert_id = candidate.alert_id AND current.ended_at IS NULL
           )
         ORDER BY candidate.server_sequence ASC
         LIMIT 1`,
      ).bind(
        cryptoProvider.randomUUID(), now, input.alertId,
        input.authenticatedAccountId, input.authenticatedAccountId, now,
      ),
    ]);
    if (results.some((result) => !result.success)) return fail("storage_unavailable");
    if (results[0].meta.changes !== 1) return fail("invalid_input");
    return {
      ok: true,
      value: { recorded: true, responsibilityAssigned: results[2].meta.changes === 1 },
    };
  } catch {
    return fail("storage_unavailable");
  }
}


export type SosEventType =
  | "triggered"
  | "acknowledged"
  | "volunteered"
  | "withdrew"
  | "closed_by_author";

export interface SosEventRecord {
  readonly id: string;
  readonly actorAccountId: string;
  readonly type: SosEventType;
  readonly occurredAt: string;
  readonly serverSequence: number | null;
}

/** Returns the event timeline only to the author or a snapshotted recipient. */
export async function listSosEventsForParticipant(
  db: SosDatabase,
  authenticatedAccountId: string,
  alertId: string,
): Promise<SosResult<readonly SosEventRecord[]>> {
  if (!validId(authenticatedAccountId) || !validId(alertId)) return fail("invalid_input");

  try {
    const access = await db.prepare(
      `SELECT 1 AS allowed FROM alerts a
       WHERE a.id = ? AND (
         a.author_account_id = ? OR EXISTS (
           SELECT 1 FROM alert_recipients r
           WHERE r.alert_id = a.id AND r.recipient_account_id = ?
         )
       ) LIMIT 1`,
    ).bind(alertId, authenticatedAccountId, authenticatedAccountId)
      .first<{ allowed: number }>();
    if (!access) return fail("alert_not_found_or_closed");

    const result = await db.prepare(
      `SELECT id, actor_account_id, event_type, occurred_at, server_sequence
       FROM alert_events
       WHERE alert_id = ?
       ORDER BY occurred_at ASC, COALESCE(server_sequence, 0) ASC, id ASC`,
    ).bind(alertId).all<{
      id: string;
      actor_account_id: string;
      event_type: SosEventType;
      occurred_at: number;
      server_sequence: number | null;
    }>();
    if (!result.success) return fail("storage_unavailable");

    return {
      ok: true,
      value: (result.results ?? []).map((event) => ({
        id: event.id,
        actorAccountId: event.actor_account_id,
        type: event.event_type,
        occurredAt: new Date(event.occurred_at).toISOString(),
        serverSequence: event.server_sequence,
      })),
    };
  } catch {
    return fail("storage_unavailable");
  }
}


export interface ClaimedSosReminder {
  readonly id: string;
  readonly alertId: string;
  readonly recipientAccountId: string;
  readonly reminderNumber: number;
  readonly attemptCount: number;
  readonly leaseToken: string;
  readonly leaseUntil: number;
}

/**
 * Atomically leases due reminder rows for one delivery worker.
 * It is infrastructure plumbing only: it does not itself send push messages.
 */
export async function claimDueSosReminders(
  db: SosDatabase,
  cryptoProvider: Crypto,
  input: { readonly now?: number; readonly batchSize?: number; readonly leaseMilliseconds?: number },
): Promise<SosResult<readonly ClaimedSosReminder[]>> {
  const now = input.now ?? Date.now();
  const batchSize = input.batchSize ?? 20;
  const leaseMilliseconds = input.leaseMilliseconds ?? 60_000;
  if (
    !Number.isSafeInteger(now) || now <= 0 ||
    !Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 50 ||
    !Number.isSafeInteger(leaseMilliseconds) || leaseMilliseconds < 10_000 || leaseMilliseconds > 300_000
  ) return fail("invalid_input");

  const leaseToken = cryptoProvider.randomUUID() + cryptoProvider.randomUUID();
  const leaseUntil = now + leaseMilliseconds;
  try {
    // Exhausted workers must not leave an expired lease stuck forever.
    const exhausted = await db.prepare(
      `UPDATE alert_reminder_outbox
       SET status = 'failed', processed_at = ?, lease_until = NULL, lease_token = NULL
       WHERE status = 'processing' AND lease_until <= ? AND attempt_count >= 5
         AND EXISTS (SELECT 1 FROM alerts a
           WHERE a.id = alert_reminder_outbox.alert_id AND a.status = 'active')`,
    ).bind(now, now).run();
    if (!exhausted.success) return fail("storage_unavailable");

    const result = await db.prepare(
      `UPDATE alert_reminder_outbox
       SET status = 'processing',
           attempt_count = attempt_count + 1,
           lease_until = ?,
           lease_token = ?
       WHERE id IN (
         SELECT r.id
         FROM alert_reminder_outbox r
         JOIN alerts a ON a.id = r.alert_id
         WHERE a.status = 'active'
           AND r.scheduled_at <= ?
           AND r.attempt_count < 5
           AND (
             r.status = 'pending'
             OR (r.status = 'processing' AND r.lease_until <= ?)
           )
         ORDER BY r.scheduled_at, r.id
         LIMIT ?
       )
       AND (
         status = 'pending'
         OR (status = 'processing' AND lease_until <= ?)
       )
       RETURNING id, alert_id, recipient_account_id, reminder_number, attempt_count`,
    ).bind(leaseUntil, leaseToken, now, now, batchSize, now)
      .all<{
        id: string;
        alert_id: string;
        recipient_account_id: string;
        reminder_number: number;
        attempt_count: number;
      }>();
    if (!result.success) return fail("storage_unavailable");

    // Le seuil choisi ne termine pas les rappels : chaque dernier rappel
    // connu programme le suivant, à cinq minutes minimum, tant que le SOS vit.
    const nextReminderStatements = (result.results ?? [])
      .filter((row) => row.reminder_number >= 1)
      .map((row) => {
        const nextNumber = row.reminder_number + 1;
        return db.prepare(
          `INSERT OR IGNORE INTO alert_reminder_outbox
           (id, alert_id, recipient_account_id, reminder_number, scheduled_at, created_at)
           SELECT ?, a.id, ?, ?, ?, ?
           FROM alerts a
           WHERE a.id = ? AND a.status = 'active'
             AND NOT EXISTS (
               SELECT 1 FROM alert_reminder_outbox existing
               WHERE existing.alert_id = a.id
                 AND existing.recipient_account_id = ?
                 AND existing.reminder_number = ?
             )`,
        ).bind(
          cryptoProvider.randomUUID(), row.recipient_account_id, nextNumber,
          now + 300_000, now, row.alert_id,
          row.recipient_account_id, nextNumber,
        );
      });
    if (nextReminderStatements.length > 0) {
      const scheduled = await db.batch(nextReminderStatements);
      if (scheduled.length !== nextReminderStatements.length || scheduled.some((item) => !item.success)) {
        return fail("storage_unavailable");
      }
    }

    return {
      ok: true,
      value: (result.results ?? []).map((row) => ({
        id: row.id,
        alertId: row.alert_id,
        recipientAccountId: row.recipient_account_id,
        reminderNumber: row.reminder_number,
        attemptCount: row.attempt_count,
        leaseToken,
        leaseUntil,
      })),
    };
  } catch {
    return fail("storage_unavailable");
  }
}

/** A delivery worker may complete only the exact lease it acquired. */
export async function completeSosReminderDelivery(
  db: SosDatabase,
  input: {
    readonly reminderId: string;
    readonly leaseToken: string;
    readonly outcome: "sent" | "retry";
    readonly now?: number;
  },
): Promise<SosResult<{ readonly updated: boolean; readonly terminal: boolean }>> {
  const now = input.now ?? Date.now();
  if (
    !validId(input.reminderId) ||
    typeof input.leaseToken !== "string" ||
    input.leaseToken.length < 16 || input.leaseToken.length > 256 ||
    (input.outcome !== "sent" && input.outcome !== "retry") ||
    !Number.isSafeInteger(now) || now <= 0
  ) return fail("invalid_input");

  try {
    const row = await db.prepare(
      `SELECT attempt_count, status FROM alert_reminder_outbox
       WHERE id = ? AND status = 'processing' AND lease_token = ?
         AND lease_until > ?`,
    ).bind(input.reminderId, input.leaseToken, now)
      .first<{ attempt_count: number; status: string }>();
    if (!row) return { ok: true, value: { updated: false, terminal: false } };

    if (input.outcome === "sent") {
      const result = await db.prepare(
        `UPDATE alert_reminder_outbox
         SET status = 'sent', processed_at = ?, lease_until = NULL, lease_token = NULL
         WHERE id = ? AND status = 'processing' AND lease_token = ? AND lease_until > ?`,
      ).bind(now, input.reminderId, input.leaseToken, now).run();
      if (!result.success) return fail("storage_unavailable");
      return { ok: true, value: { updated: result.meta.changes === 1, terminal: result.meta.changes === 1 } };
    }

    const terminal = row.attempt_count >= 5;
    const delay = Math.min(300_000, 15_000 * (2 ** Math.max(0, row.attempt_count - 1)));
    const result = await db.prepare(
      `UPDATE alert_reminder_outbox
       SET status = ?, scheduled_at = ?, processed_at = ?, lease_until = NULL, lease_token = NULL
       WHERE id = ? AND status = 'processing' AND lease_token = ? AND lease_until > ?`,
    ).bind(
      terminal ? "failed" : "pending",
      terminal ? now : now + delay,
      terminal ? now : null,
      input.reminderId,
      input.leaseToken,
      now,
    ).run();
    if (!result.success) return fail("storage_unavailable");
    return { ok: true, value: { updated: result.meta.changes === 1, terminal: terminal && result.meta.changes === 1 } };
  } catch {
    return fail("storage_unavailable");
  }
}


export interface SosPushEnvelope {
  /** Stable outbox identity; a sender may use it for deduplication if supported. */
  readonly idempotencyKey: string;
  readonly alertId: string;
  readonly recipientAccountId: string;
  readonly reminderNumber: number;
}

export interface SosPushSender {
  /**
   * Resolves true only when the push provider accepts the request.
   * This is not proof of device delivery, display, or recipient reading.
   */
  send(envelope: SosPushEnvelope): Promise<boolean>;
}

export interface SosReminderDispatchSummary {
  readonly claimed: number;
  readonly providerAccepted: number;
  readonly retryScheduled: number;
  readonly terminalFailures: number;
  readonly completionErrors: number;
}

/**
 * Runs one bounded, at-least-once reminder delivery batch.
 *
 * The injected sender is an infrastructure adapter, not an HTTP/client input.
 * A provider acceptance followed by a D1 outage can result in a retry after
 * lease expiry; downstream adapters should deduplicate by idempotencyKey when
 * their transport supports it. Web Push acceptance is never described as
 * device delivery or read confirmation.
 */
export async function dispatchDueSosReminders(
  db: SosDatabase,
  cryptoProvider: Crypto,
  sender: SosPushSender,
  input: {
    readonly now?: number;
    readonly batchSize?: number;
    readonly leaseMilliseconds?: number;
  } = {},
): Promise<SosResult<SosReminderDispatchSummary>> {
  const claimed = await claimDueSosReminders(db, cryptoProvider, input);
  if (!claimed.ok) return claimed;

  let providerAccepted = 0;
  let retryScheduled = 0;
  let terminalFailures = 0;
  let completionErrors = 0;

  for (const reminder of claimed.value) {
    let accepted = false;
    try {
      accepted = await sender.send({
        idempotencyKey: reminder.id,
        alertId: reminder.alertId,
        recipientAccountId: reminder.recipientAccountId,
        reminderNumber: reminder.reminderNumber,
      });
    } catch {
      accepted = false;
    }

    const completed = await completeSosReminderDelivery(db, {
      reminderId: reminder.id,
      leaseToken: reminder.leaseToken,
      outcome: accepted ? "sent" : "retry",
      now: input.now,
    });
    if (!completed.ok || !completed.value.updated) {
      completionErrors += 1;
      continue;
    }
    if (accepted) providerAccepted += 1;
    else if (completed.value.terminal) terminalFailures += 1;
    else retryScheduled += 1;
  }

  return {
    ok: true,
    value: {
      claimed: claimed.value.length,
      providerAccepted,
      retryScheduled,
      terminalFailures,
      completionErrors,
    },
  };
}


export interface SosSmsEscalationSummary {
  readonly evaluationsCreated: number;
  readonly evaluationsSuppressed: number;
  readonly smsTasksCreated: number;
}

/**
 * Evaluates each active alert once when its selected push-reminder threshold
 * is reached. D1 decides atomically whether a lead responder already exists:
 * queued SMS tasks are created for the immutable original recipient snapshot
 * only when no principal responder has been assigned.
 *
 * This function only persists work. It does not contact an SMS provider.
 */
export async function scheduleDueSosSmsEscalations(
  db: SosDatabase,
  cryptoProvider: Crypto,
  input: { readonly now?: number; readonly batchSize?: number } = {},
): Promise<SosResult<SosSmsEscalationSummary>> {
  const now = input.now ?? Date.now();
  const batchSize = input.batchSize ?? 20;
  if (
    !Number.isSafeInteger(now) || now <= 0 ||
    !Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 50
  ) return fail("invalid_input");

  try {
    const due = await db.prepare(
      `SELECT a.id, a.created_at, a.push_reminder_limit,
              a.created_at + (a.push_reminder_limit * 300000) AS threshold_at
       FROM alerts a
       WHERE a.status = 'active'
         AND a.created_at + (a.push_reminder_limit * 300000) <= ?
         AND NOT EXISTS (
           SELECT 1 FROM alert_sms_escalations e WHERE e.alert_id = a.id
         )
       ORDER BY threshold_at, a.id
       LIMIT ?`,
    ).bind(now, batchSize).all<{
      id: string;
      created_at: number;
      push_reminder_limit: number;
      threshold_at: number;
    }>();
    if (!due.success) return fail("storage_unavailable");

    let evaluationsCreated = 0;
    let evaluationsSuppressed = 0;
    let smsTasksCreated = 0;

    for (const alert of due.results ?? []) {
      const recipients = await db.prepare(
        `SELECT recipient_account_id
         FROM alert_recipients WHERE alert_id = ?
         ORDER BY recipient_account_id`,
      ).bind(alert.id).all<{ recipient_account_id: string }>();
      if (!recipients.success || !recipients.results?.length) return fail("storage_unavailable");

      const statements = [
        db.prepare(
          `INSERT OR IGNORE INTO alert_sms_escalations
           (alert_id, threshold_reached_at, evaluated_at, status)
           SELECT a.id, ?, ?, CASE WHEN EXISTS (
             SELECT 1 FROM alert_responsibility_periods p
             WHERE p.alert_id = a.id
           ) THEN 'suppressed' ELSE 'queued' END
           FROM alerts a
           WHERE a.id = ? AND a.status = 'active'
             AND a.created_at + (a.push_reminder_limit * 300000) = ?
             AND NOT EXISTS (
               SELECT 1 FROM alert_sms_escalations e WHERE e.alert_id = a.id
             )`,
        ).bind(alert.threshold_at, now, alert.id, alert.threshold_at),
        ...recipients.results.map((recipient) => db.prepare(
          `INSERT OR IGNORE INTO alert_sms_outbox
           (id, alert_id, recipient_account_id, status, scheduled_at, created_at)
           SELECT ?, e.alert_id, r.recipient_account_id, 'pending', e.threshold_reached_at, ?
           FROM alert_sms_escalations e
           JOIN alert_recipients r ON r.alert_id = e.alert_id
           WHERE e.alert_id = ? AND e.status = 'queued'
             AND r.recipient_account_id = ?`,
        ).bind(
          cryptoProvider.randomUUID(), now, alert.id, recipient.recipient_account_id,
        )),
      ];

      const results = await db.batch(statements);
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return fail("storage_unavailable");
      }
      evaluationsCreated += results[0].meta.changes === 1 ? 1 : 0;
      smsTasksCreated += results.slice(1).reduce((sum, result) => sum + result.meta.changes, 0);

      if (results[0].meta.changes === 1) {
        const evaluation = await db.prepare(
          "SELECT status FROM alert_sms_escalations WHERE alert_id = ?",
        ).bind(alert.id).first<{ status: "queued" | "suppressed" }>();
        if (evaluation?.status === "suppressed") evaluationsSuppressed += 1;
      }
    }

    return {
      ok: true,
      value: { evaluationsCreated, evaluationsSuppressed, smsTasksCreated },
    };
  } catch {
    return fail("storage_unavailable");
  }
}
