import { dispatchDueSosReminders } from "../../functions/lib/alerts/sos-service.ts";
import { createSosWebPushSender, type WebPushEnvironment } from "../../functions/lib/notifications/web-push-delivery.ts";

interface Env extends WebPushEnvironment {
  DB: D1Database;
}

const RETENTION_BATCH_SIZE = 200;
const RETENTION_LEASE_MS = 120_000;

async function purgeExpiredNotificationHistory(db: D1Database): Promise<void> {
  const now = Date.now();
  const leaseToken = crypto.randomUUID();

  const lease = await db.prepare(`
    UPDATE notification_retention_control
    SET lease_until = ?, lease_token = ?, last_started_at = ?
    WHERE singleton_id = 1
      AND (lease_until IS NULL OR lease_until <= ?)
  `).bind(now + RETENTION_LEASE_MS, leaseToken, now, now).run();

  if (!lease.success) throw new Error("sac_notification_retention_lease_failed");
  if (lease.meta.changes !== 1) return;

  try {
    const due = await db.prepare(`
      SELECT id
      FROM notification_device_deliveries
      WHERE retention_expires_at <= ?
        AND status IN ('accepted','permanent_failure','unknown_exhausted','cancelled')
      ORDER BY retention_expires_at, id
      LIMIT ?
    `).bind(now, RETENTION_BATCH_SIZE).all<{ id: string }>();

    if (!due.success) throw new Error("sac_notification_retention_select_failed");
    const ids = (due.results ?? []).map((row) => row.id);

    let deletedAttempts = 0;
    let deletedDeliveries = 0;

    if (ids.length > 0) {
      const placeholders = ids.map(() => "?").join(",");
      const [attemptResult, deliveryResult] = await db.batch([
        db.prepare(`DELETE FROM notification_delivery_attempts WHERE delivery_id IN (${placeholders})`).bind(...ids),
        db.prepare(`
          DELETE FROM notification_device_deliveries
          WHERE id IN (${placeholders})
            AND retention_expires_at <= ?
            AND status IN ('accepted','permanent_failure','unknown_exhausted','cancelled')
            AND NOT EXISTS (
              SELECT 1 FROM notification_delivery_attempts a
              WHERE a.delivery_id = notification_device_deliveries.id
            )
        `).bind(...ids, now),
      ]);

      if (!attemptResult.success || !deliveryResult.success) {
        throw new Error("sac_notification_retention_delete_failed");
      }
      deletedAttempts = attemptResult.meta.changes;
      deletedDeliveries = deliveryResult.meta.changes;
    }

    const backlog = await db.prepare(`
      SELECT COUNT(*) AS overdue_rows, MIN(retention_expires_at) AS oldest_overdue_at
      FROM notification_device_deliveries
      WHERE retention_expires_at <= ?
        AND status IN ('accepted','permanent_failure','unknown_exhausted','cancelled')
    `).bind(now).first<{ overdue_rows: number; oldest_overdue_at: number | null }>();

    if (!backlog) throw new Error("sac_notification_retention_backlog_check_failed");

    const recorded = await db.prepare(`
      UPDATE notification_retention_control
      SET lease_until = NULL,
          lease_token = NULL,
          last_success_at = ?,
          deleted_deliveries_last_run = ?,
          deleted_attempts_last_run = ?,
          overdue_rows = ?,
          oldest_overdue_at = ?,
          consecutive_failures = 0,
          last_error_code = NULL
      WHERE singleton_id = 1 AND lease_token = ?
    `).bind(
      Date.now(),
      deletedDeliveries,
      deletedAttempts,
      backlog.overdue_rows,
      backlog.oldest_overdue_at,
      leaseToken,
    ).run();

    if (!recorded.success || recorded.meta.changes !== 1) {
      throw new Error("sac_notification_retention_control_update_failed");
    }
  } catch (error) {
    await db.prepare(`
      UPDATE notification_retention_control
      SET lease_until = NULL,
          lease_token = NULL,
          consecutive_failures = consecutive_failures + 1,
          last_error_code = 'unknown_error'
      WHERE singleton_id = 1 AND lease_token = ?
    `).bind(leaseToken).run().catch(() => undefined);
    throw error;
  }
}

export default {
  async scheduled(controller: ScheduledController, env: Env, context: ExecutionContext): Promise<void> {
    if (controller.cron === "0 * * * *") {
      context.waitUntil(purgeExpiredNotificationHistory(env.DB));
      return;
    }

    context.waitUntil((async () => {
      const result = await dispatchDueSosReminders(
        env.DB,
        crypto,
        createSosWebPushSender(env.DB, env),
        { batchSize: 25, leaseMilliseconds: 90_000 },
      );
      if (!result.ok) throw new Error("sac_sos_notification_dispatch_failed");
    })());
  },
};
