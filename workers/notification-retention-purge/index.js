const BATCH_SIZE = 200;
const LEASE_MS = 120_000;
const DAY_MS = 86_400_000;
const RETENTION_MS = 30 * DAY_MS;

async function runPurge(db) {
  const now = Date.now();
  const token = crypto.randomUUID();
  const claim = await db.prepare(`
    UPDATE notification_retention_control
    SET lease_until = ?, lease_token = ?, last_started_at = ?
    WHERE singleton_id = 1 AND (lease_until IS NULL OR lease_until <= ?)
  `).bind(now + LEASE_MS, token, now, now).run();

  if (!claim.success) throw new Error("retention_lease_claim_failed");
  if (claim.meta.changes !== 1) return { skipped: "lease_held" };

  try {
    const due = await db.prepare(`
      SELECT id FROM notification_device_deliveries
      WHERE retention_expires_at <= ?
        AND status IN ('accepted','permanent_failure','unknown_exhausted','cancelled')
      ORDER BY retention_expires_at, id LIMIT ?
    `).bind(now, BATCH_SIZE).all();

    if (!due.success) throw new Error("retention_due_query_failed");
    const ids = (due.results || []).map((row) => row.id);
    let deletedAttempts = 0;
    let deletedDeliveries = 0;

    if (ids.length) {
      const marks = ids.map(() => "?").join(",");
      const result = await db.batch([
        db.prepare(`DELETE FROM notification_delivery_attempts WHERE delivery_id IN (${marks})`).bind(...ids),
        db.prepare(`
          DELETE FROM notification_device_deliveries
          WHERE id IN (${marks}) AND retention_expires_at <= ?
            AND status IN ('accepted','permanent_failure','unknown_exhausted','cancelled')
            AND NOT EXISTS (
              SELECT 1 FROM notification_delivery_attempts a
              WHERE a.delivery_id = notification_device_deliveries.id
            )
        `).bind(...ids, now),
      ]);
      if (result.length !== 2 || result.some((item) => !item.success)) {
        throw new Error("retention_delete_batch_failed");
      }
      deletedAttempts = result[0].meta.changes;
      deletedDeliveries = result[1].meta.changes;
    }

    const backlog = await db.prepare(`
      SELECT COUNT(*) AS count, MIN(retention_expires_at) AS oldest
      FROM notification_device_deliveries
      WHERE retention_expires_at <= ?
        AND status IN ('accepted','permanent_failure','unknown_exhausted','cancelled')
    `).bind(now).first();
    if (!backlog) throw new Error("retention_backlog_query_failed");

    const success = await db.prepare(`
      UPDATE notification_retention_control
      SET lease_until = NULL, lease_token = NULL, last_success_at = ?,
          deleted_deliveries_last_run = ?, deleted_attempts_last_run = ?,
          overdue_rows = ?, oldest_overdue_at = ?,
          consecutive_failures = 0, last_error_code = NULL
      WHERE singleton_id = 1 AND lease_token = ?
    `).bind(Date.now(), deletedDeliveries, deletedAttempts, backlog.count, backlog.oldest, token).run();

    if (!success.success || success.meta.changes !== 1) {
      throw new Error("retention_control_success_update_failed");
    }
    if (backlog.oldest !== null && backlog.oldest <= now - DAY_MS) {
      console.error("SAC_RETENTION_OVERDUE_24H", { overdueRows: backlog.count, oldestOverdueAt: backlog.oldest });
    }
    return { deletedAttempts, deletedDeliveries, overdueRows: backlog.count };
  } catch (error) {
    await db.prepare(`
      UPDATE notification_retention_control
      SET lease_until = NULL, lease_token = NULL,
          consecutive_failures = consecutive_failures + 1,
          last_error_code = 'unknown_error'
      WHERE singleton_id = 1 AND lease_token = ?
    `).bind(token).run().catch(() => undefined);

    const health = await db.prepare(`
      SELECT consecutive_failures, last_success_at
      FROM notification_retention_control WHERE singleton_id = 1
    `).first().catch(() => null);
    if (health && health.consecutive_failures >= 2) {
      console.error("SAC_RETENTION_TWO_CONSECUTIVE_FAILURES", { consecutiveFailures: health.consecutive_failures });
    }
    if (!health?.last_success_at || Date.now() - health.last_success_at > 2 * 60 * 60 * 1000) {
      console.error("SAC_RETENTION_NO_SUCCESS_2H", { lastSuccessAt: health?.last_success_at ?? null });
    }
    console.error("SAC_RETENTION_RUN_FAILED");
    throw error;
  }
}

export default {
  async scheduled(_controller, env, context) {
    context.waitUntil(runPurge(env.DB));
  },
};
