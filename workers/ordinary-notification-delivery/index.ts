import {
  buildOrdinaryPushPayload,
  type OrdinaryNotification,
  type OrdinaryNotificationKind,
} from "../../src/domain/ordinary-notification.ts";
import { decryptPushSubscription } from "../../functions/lib/notifications/push-subscription-crypto.ts";
import {
  sendWebPush,
  type WebPushEnvironment,
  type WebPushResult,
} from "../../functions/lib/notifications/web-push-delivery.ts";

interface Env extends WebPushEnvironment {
  DB: D1Database;
}

interface OutboxRow {
  id: string;
  kind: OrdinaryNotificationKind;
  source_id: string;
  recipient_account_id: string;
  scheduled_at: number;
  status: string;
  attempt_count: number;
  next_attempt_at: number | null;
  lease_until: number | null;
  lease_token: string | null;
  deduplication_key: string;
  created_at: number;
  updated_at: number;
}

interface DeliveryRow {
  id: string;
  outbox_id: string;
  recipient_account_id: string;
  device_id: string;
  subscription_id: string;
  status: string;
  attempt_count: number;
  next_attempt_at: number | null;
}

interface StoredSubscription {
  id: string;
  endpointHash: string;
  ciphertext: string;
  iv: string;
  encryption_key_version: string;
}

const BATCH_SIZE = 25;
const OUTBOX_LEASE_MS = 90_000;
const DELIVERY_LEASE_MS = 60_000;
const RETRY_DELAY_MS = 60_000;

const encoder = new TextEncoder();

function outboxNotification(row: OutboxRow): OrdinaryNotification {
  return {
    notificationId: row.id,
    kind: row.kind,
    sourceId: row.source_id,
    recipientAccountId: row.recipient_account_id,
    scheduledAt: row.scheduled_at,
    status: row.status as OrdinaryNotification["status"],
    attemptCount: row.attempt_count,
    nextAttemptAt: row.next_attempt_at,
    leaseUntil: row.lease_until,
    leaseToken: row.lease_token,
    deduplicationKey: row.deduplication_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function cancelOutbox(db: D1Database, id: string, now: number, errorCode: string): Promise<void> {
  await db.prepare(
    `UPDATE ordinary_notification_outbox
     SET status = 'cancelled', processed_at = ?, updated_at = ?,
         lease_until = NULL, lease_token = NULL, error_code = ?
     WHERE id = ? AND status IN ('pending', 'processing')`,
  ).bind(now, now, errorCode, id).run().catch(() => undefined);
}

async function releaseExpiredOutboxLeases(db: D1Database, now: number): Promise<void> {
  await db.prepare(
    `UPDATE ordinary_notification_outbox
     SET status = 'permanent_failure', processed_at = ?, updated_at = ?,
         lease_until = NULL, lease_token = NULL, next_attempt_at = NULL,
         error_code = 'lease_expired'
     WHERE status = 'processing' AND lease_until <= ? AND attempt_count >= 2`,
  ).bind(now, now, now).run().catch(() => undefined);
  await db.prepare(
    `UPDATE ordinary_notification_outbox
     SET status = 'pending', lease_until = NULL, lease_token = NULL,
         next_attempt_at = ?, updated_at = ?, error_code = 'lease_expired'
     WHERE status = 'processing' AND lease_until <= ? AND attempt_count < 2`,
  ).bind(now, now, now).run().catch(() => undefined);
  await db.prepare(
    `UPDATE ordinary_notification_outbox
     SET status = 'permanent_failure', processed_at = ?, updated_at = ?,
         next_attempt_at = NULL, error_code = 'temporary_provider_failure'
     WHERE status = 'pending' AND attempt_count >= 2
       AND (next_attempt_at IS NULL OR next_attempt_at <= ?)`,
  ).bind(now, now, now).run().catch(() => undefined);
}

async function releaseExpiredDeliveryLeases(db: D1Database, now: number): Promise<void> {
  await db.prepare(
    `UPDATE ordinary_notification_deliveries
     SET status = 'permanent_failure', lease_until = NULL, lease_token = NULL,
         next_attempt_at = NULL, updated_at = ?, error_code = 'lease_expired'
     WHERE status = 'processing' AND lease_until <= ? AND attempt_count >= 2`,
  ).bind(now, now).run().catch(() => undefined);
  await db.prepare(
    `UPDATE ordinary_notification_deliveries
     SET status = 'pending', lease_until = NULL, lease_token = NULL,
         next_attempt_at = ?, updated_at = ?, error_code = 'lease_expired'
     WHERE status = 'processing' AND lease_until <= ? AND attempt_count < 2`,
  ).bind(now, now, now).run().catch(() => undefined);
  await db.prepare(
    `UPDATE ordinary_notification_attempts
     SET result = 'permanent_failure', finished_at = ?, error_code = 'lease_expired'
     WHERE result = 'processing' AND started_at <= ?`,
  ).bind(now, now - DELIVERY_LEASE_MS).run().catch(() => undefined);
}

async function revalidateReminderSource(db: D1Database, row: OutboxRow): Promise<boolean> {
  if (row.kind !== "reminder_due") return false;
  const source = await db.prepare(
    `SELECT o.status AS occurrence_status, r.status AS reminder_status
     FROM health_reminder_occurrences o
     JOIN health_reminders r ON r.id = o.reminder_id
     WHERE o.id = ? AND r.owner_account_id = ?
     LIMIT 1`,
  ).bind(row.source_id, row.recipient_account_id).first<{ occurrence_status: string; reminder_status: string }>();
  return source?.occurrence_status === "scheduled" && source.reminder_status === "active";
}

async function ensureDeliveries(db: D1Database, row: OutboxRow, now: number): Promise<readonly DeliveryRow[]> {
  const subscriptions = await db.prepare(
    `SELECT p.id, p.endpoint_hash AS endpointHash, p.encrypted_subscription AS ciphertext,
            p.iv, p.encryption_key_version
     FROM push_subscriptions p
     JOIN devices d ON d.id = p.device_id AND d.account_id = p.account_id AND d.status = 'active'
     JOIN accounts a ON a.id = p.account_id AND a.status = 'active'
     WHERE p.account_id = ? AND p.status = 'active'`,
  ).bind(row.recipient_account_id).all<StoredSubscription>();
  if (!subscriptions.success || !Array.isArray(subscriptions.results)) return [];
  if (subscriptions.results.length === 0) return [];

  const statements = subscriptions.results.map((subscription) => db.prepare(
    `INSERT OR IGNORE INTO ordinary_notification_deliveries
       (id, outbox_id, recipient_account_id, device_id, subscription_id, status,
        attempt_count, next_attempt_at, lease_until, lease_token, created_at, updated_at, error_code)
     SELECT ?, ?, ?, p.device_id, p.id, 'pending', 0, ?, NULL, NULL, ?, ?, NULL
     FROM push_subscriptions p
     WHERE p.id = ? AND p.account_id = ? AND p.status = 'active'`,
  ).bind(
    crypto.randomUUID(), row.id, row.recipient_account_id, now, now, now,
    subscription.id, row.recipient_account_id,
  ));
  const results = await db.batch(statements);
  if (results.some((result) => !result.success)) return [];

  const deliveries = await db.prepare(
    `SELECT id, outbox_id, recipient_account_id, device_id, subscription_id,
            status, attempt_count, next_attempt_at
     FROM ordinary_notification_deliveries
     WHERE outbox_id = ? AND recipient_account_id = ?
     ORDER BY created_at, id`,
  ).bind(row.id, row.recipient_account_id).all<DeliveryRow>();
  return deliveries.success && Array.isArray(deliveries.results) ? deliveries.results : [];
}

async function reserveDelivery(db: D1Database, delivery: DeliveryRow, now: number): Promise<DeliveryRow | null> {
  if (delivery.status !== "pending" || delivery.attempt_count >= 2) return null;
  if (delivery.next_attempt_at !== null && delivery.next_attempt_at > now) return null;
  const leaseToken = crypto.randomUUID();
  const result = await db.prepare(
    `UPDATE ordinary_notification_deliveries
     SET status = 'processing', attempt_count = attempt_count + 1,
         lease_until = ?, lease_token = ?, updated_at = ?
     WHERE id = ? AND status = 'pending' AND attempt_count < 2
       AND (next_attempt_at IS NULL OR next_attempt_at <= ?)`,
  ).bind(now + DELIVERY_LEASE_MS, leaseToken, now, delivery.id, now).run();
  if (!result.success || result.meta.changes !== 1) return null;
  return { ...delivery, status: "processing", attempt_count: delivery.attempt_count + 1 };
}

async function recordAttemptStart(db: D1Database, delivery: DeliveryRow, now: number): Promise<string | null> {
  const attemptId = crypto.randomUUID();
  try {
    const result = await db.prepare(
      `INSERT INTO ordinary_notification_attempts
         (id, delivery_id, attempt_number, reserved_at, started_at, finished_at,
          result, http_status, error_code, duration_ms)
       VALUES (?, ?, ?, ?, ?, NULL, 'processing', NULL, NULL, NULL)`,
    ).bind(attemptId, delivery.id, delivery.attempt_count, now, now).run();
    return result.success ? attemptId : null;
  } catch {
    return null;
  }
}

async function finishAttempt(
  db: D1Database,
  attemptId: string | null,
  result: "accepted" | "retry_wait" | "permanent_failure",
  errorCode: string | null,
  now: number,
): Promise<void> {
  if (!attemptId) return;
  await db.prepare(
    `UPDATE ordinary_notification_attempts
     SET result = ?, finished_at = ?, error_code = ?
     WHERE id = ? AND result = 'processing'`,
  ).bind(result, now, errorCode, attemptId).run().catch(() => undefined);
}

function deliveryResult(outcome: WebPushResult): "accepted" | "retry_wait" | "permanent_failure" {
  if (outcome === "accepted") return "accepted";
  if (outcome === "gone" || outcome === "blocked") return "permanent_failure";
  return "retry_wait";
}

function deliveryError(outcome: WebPushResult): string | null {
  if (outcome === "accepted") return null;
  if (outcome === "gone" || outcome === "blocked") return "invalid_subscription";
  return "temporary_provider_failure";
}

async function processDelivery(
  db: D1Database,
  env: Env,
  outbox: OutboxRow,
  delivery: DeliveryRow,
  now: number,
): Promise<"accepted" | "pending" | "permanent_failure" | "skipped"> {
  if (delivery.status === "accepted") return "accepted";
  if (delivery.status === "permanent_failure" || delivery.status === "cancelled") return "permanent_failure";
  if (delivery.status === "processing") return "pending";
  const reserved = await reserveDelivery(db, delivery, now);
  if (!reserved) return "pending";

  const attemptId = await recordAttemptStart(db, reserved, now);
  const subscriptionRow = await db.prepare(
    `SELECT id, endpoint_hash AS endpointHash, encrypted_subscription AS ciphertext,
            iv, encryption_key_version
     FROM push_subscriptions
     WHERE id = ? AND account_id = ? AND device_id = ? AND status = 'active'
     LIMIT 1`,
  ).bind(delivery.subscription_id, delivery.recipient_account_id, delivery.device_id).first<StoredSubscription>();
  if (!subscriptionRow || !env.PUSH_SUBSCRIPTION_ENCRYPTION_KEY) {
    await db.prepare(
      `UPDATE ordinary_notification_deliveries
       SET status = 'permanent_failure', lease_until = NULL, lease_token = NULL,
           updated_at = ?, error_code = 'configuration_error'
       WHERE id = ? AND status = 'processing'`,
    ).bind(now, delivery.id).run().catch(() => undefined);
    await finishAttempt(db, attemptId, "permanent_failure", "configuration_error", now);
    return "permanent_failure";
  }

  const subscription = await decryptPushSubscription({
    endpointHash: subscriptionRow.endpointHash,
    ciphertext: subscriptionRow.ciphertext,
    iv: subscriptionRow.iv,
  }, env.PUSH_SUBSCRIPTION_ENCRYPTION_KEY, crypto);
  if (!subscription) {
    await db.prepare(
      `UPDATE ordinary_notification_deliveries
       SET status = 'permanent_failure', lease_until = NULL, lease_token = NULL,
           updated_at = ?, error_code = 'invalid_subscription'
       WHERE id = ? AND status = 'processing'`,
    ).bind(now, delivery.id).run().catch(() => undefined);
    await finishAttempt(db, attemptId, "permanent_failure", "invalid_subscription", now);
    return "permanent_failure";
  }

  const payload = encoder.encode(JSON.stringify(buildOrdinaryPushPayload(outboxNotification(outbox))));
  const outcome = await sendWebPush(subscription, payload, env, { crypto, fetcher: fetch });
  const result = deliveryResult(outcome);
  const errorCode = deliveryError(outcome);

  if (result === "accepted") {
    await db.prepare(
      `UPDATE ordinary_notification_deliveries
       SET status = 'accepted', lease_until = NULL, lease_token = NULL,
           next_attempt_at = NULL, updated_at = ?, error_code = NULL
       WHERE id = ? AND status = 'processing'`,
    ).bind(now, delivery.id).run().catch(() => undefined);
    await finishAttempt(db, attemptId, "accepted", null, now);
    return "accepted";
  }

  if (result === "permanent_failure") {
    await db.prepare(
      `UPDATE ordinary_notification_deliveries
       SET status = 'permanent_failure', lease_until = NULL, lease_token = NULL,
           next_attempt_at = NULL, updated_at = ?, error_code = ?
       WHERE id = ? AND status = 'processing'`,
    ).bind(now, errorCode, delivery.id).run().catch(() => undefined);
    if (outcome === "gone" || outcome === "blocked") {
      await db.prepare("DELETE FROM push_subscriptions WHERE id = ? AND status = 'active'")
        .bind(delivery.subscription_id).run().catch(() => undefined);
    }
    await finishAttempt(db, attemptId, "permanent_failure", errorCode, now);
    return "permanent_failure";
  }

  const exhausted = reserved.attempt_count >= 2;
  await db.prepare(
    `UPDATE ordinary_notification_deliveries
     SET status = ?, lease_until = NULL, lease_token = NULL,
         next_attempt_at = ?, updated_at = ?, error_code = ?
     WHERE id = ? AND status = 'processing'`,
  ).bind(
    exhausted ? "permanent_failure" : "pending",
    exhausted ? null : now + RETRY_DELAY_MS,
    now, exhausted ? "temporary_provider_failure" : null, delivery.id,
  ).run().catch(() => undefined);
  await finishAttempt(db, attemptId, exhausted ? "permanent_failure" : "retry_wait", "temporary_provider_failure", now);
  return exhausted ? "permanent_failure" : "pending";
}

async function finalizeOutbox(
  db: D1Database,
  outbox: OutboxRow,
  outcomes: readonly ("accepted" | "pending" | "permanent_failure" | "skipped")[],
  now: number,
): Promise<void> {
  const accepted = outcomes.includes("accepted");
  const pending = outcomes.includes("pending") || outcomes.includes("skipped");
  if (pending) {
    await db.prepare(
      `UPDATE ordinary_notification_outbox
       SET status = 'pending', next_attempt_at = ?, updated_at = ?,
           lease_until = NULL, lease_token = NULL, error_code = 'temporary_provider_failure'
       WHERE id = ? AND status = 'processing'`,
    ).bind(now + RETRY_DELAY_MS, now, outbox.id).run().catch(() => undefined);
    return;
  }
  if (accepted) {
    await db.prepare(
      `UPDATE ordinary_notification_outbox
       SET status = 'accepted', processed_at = ?, updated_at = ?,
           lease_until = NULL, lease_token = NULL, error_code = NULL
       WHERE id = ? AND status = 'processing'`,
    ).bind(now, now, outbox.id).run().catch(() => undefined);
    await db.prepare(
      `UPDATE health_reminder_occurrences
       SET status = 'notified', notified_at = ?
       WHERE id = ? AND owner_account_id = ? AND status = 'scheduled'`,
    ).bind(now, outbox.source_id, outbox.recipient_account_id).run().catch(() => undefined);
    return;
  }
  await db.prepare(
    `UPDATE ordinary_notification_outbox
     SET status = 'permanent_failure', processed_at = ?, updated_at = ?,
         lease_until = NULL, lease_token = NULL, error_code = 'invalid_subscription'
     WHERE id = ? AND status = 'processing'`,
  ).bind(now, now, outbox.id).run().catch(() => undefined);
}

function pushConfigured(env: Env): boolean {
  return Boolean(env.PUSH_SUBSCRIPTION_ENCRYPTION_KEY && env.PUSH_VAPID_PUBLIC_KEY && env.PUSH_VAPID_PRIVATE_JWK && env.PUSH_VAPID_SUBJECT);
}

async function processOutbox(db: D1Database, env: Env, row: OutboxRow, now: number): Promise<void> {
  if (!pushConfigured(env)) return;
  if (!(await revalidateReminderSource(db, row))) {
    await cancelOutbox(db, row.id, now, "cancelled");
    return;
  }

  const leaseToken = crypto.randomUUID();
  const reserved = await db.prepare(
    `UPDATE ordinary_notification_outbox
     SET status = 'processing', attempt_count = attempt_count + 1,
         lease_until = ?, lease_token = ?, updated_at = ?
     WHERE id = ? AND status = 'pending' AND attempt_count < 2
       AND (next_attempt_at IS NULL OR next_attempt_at <= ?)`,
  ).bind(now + OUTBOX_LEASE_MS, leaseToken, now, row.id, now).run();
  if (!reserved.success || reserved.meta.changes !== 1) return;

  const deliveries = await ensureDeliveries(db, row, now);
  if (deliveries.length === 0) {
    await db.prepare(
      `UPDATE ordinary_notification_outbox
       SET status = 'permanent_failure', processed_at = ?, updated_at = ?,
           lease_until = NULL, lease_token = NULL, error_code = 'invalid_subscription'
       WHERE id = ? AND status = 'processing'`,
    ).bind(now, now, row.id).run().catch(() => undefined);
    return;
  }

  const outcomes: ("accepted" | "pending" | "permanent_failure" | "skipped")[] = [];
  for (const delivery of deliveries) {
    outcomes.push(await processDelivery(db, env, row, delivery, now));
  }
  await finalizeOutbox(db, row, outcomes, now);
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, context: ExecutionContext): Promise<void> {
    context.waitUntil((async () => {
      const now = Date.now();
      await releaseExpiredOutboxLeases(env.DB, now);
      await releaseExpiredDeliveryLeases(env.DB, now);
      const due = await env.DB.prepare(
        `SELECT id, kind, source_id, recipient_account_id, scheduled_at, status,
                attempt_count, next_attempt_at, lease_until, lease_token,
                deduplication_key, created_at, updated_at
         FROM ordinary_notification_outbox
         WHERE status = 'pending' AND scheduled_at <= ?
           AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
         ORDER BY scheduled_at, id
         LIMIT ?`,
      ).bind(now, now, BATCH_SIZE).all<OutboxRow>();
      if (!due.success || !Array.isArray(due.results)) throw new Error("sac_ordinary_notification_select_failed");
      for (const row of due.results) {
        await processOutbox(env.DB, env, row, now);
      }
    })());
  },
};
