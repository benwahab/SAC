type RateLimitDatabase = Pick<D1Database, "prepare">;

export type RateLimitAction =
  | "directory_search"
  | "proximity_invite"
  | "email_change_request"
  | "phone_change_request"
  | "password_change";

export type RateLimitResult = "ok" | "limited" | "unavailable";

export async function consumeRateLimit(
  db: RateLimitDatabase,
  accountId: string,
  action: RateLimitAction,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<RateLimitResult> {
  if (!accountId || !Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1000) {
    return "unavailable";
  }
  try {
    await db.prepare(
      `INSERT INTO account_action_rate_limits
       (account_id, action, window_started_at, action_count, updated_at)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(account_id, action) DO UPDATE SET
         action_count = CASE WHEN account_action_rate_limits.window_started_at <= ? THEN 1 ELSE account_action_rate_limits.action_count + 1 END,
         window_started_at = CASE WHEN account_action_rate_limits.window_started_at <= ? THEN excluded.window_started_at ELSE account_action_rate_limits.window_started_at END,
         updated_at = excluded.updated_at`,
    ).bind(accountId, action, now, now, now - windowMs, now - windowMs).run();

    const row = await db.prepare(
      "SELECT action_count FROM account_action_rate_limits WHERE account_id = ? AND action = ?",
    ).bind(accountId, action).first<{ action_count: number }>();
    if (!row || !Number.isSafeInteger(row.action_count)) return "unavailable";
    return row.action_count > limit ? "limited" : "ok";
  } catch {
    return "unavailable";
  }
}
