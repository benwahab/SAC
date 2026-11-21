export type AccountPlan = "free" | "premium" | "professional";

export interface ReminderPlanLimits {
  readonly activeReminders: number;
  readonly maxOccurrencesPerReminder: number;
}

export const REMINDER_PLAN_LIMITS: Record<AccountPlan, ReminderPlanLimits> = {
  free: { activeReminders: 20, maxOccurrencesPerReminder: 100 },
  premium: { activeReminders: 200, maxOccurrencesPerReminder: 366 },
  professional: { activeReminders: 500, maxOccurrencesPerReminder: 366 },
};

export type ReminderQuotaResult =
  | { readonly ok: true; readonly plan: AccountPlan; readonly limits: ReminderPlanLimits }
  | { readonly ok: false; readonly error: "quota_unavailable" | "quota_exceeded" };

export async function getAccountPlan(db: D1Database, accountId: string): Promise<AccountPlan> {
  try {
    const row = await db.prepare(
      "SELECT plan FROM account_entitlements WHERE account_id = ? LIMIT 1",
    ).bind(accountId).first<{ plan: string }>();
    return row?.plan === "premium" || row?.plan === "professional" ? row.plan : "free";
  } catch {
    return "free";
  }
}

export async function checkReminderQuota(
  db: D1Database,
  accountId: string,
  occurrenceCount: number,
): Promise<ReminderQuotaResult> {
  if (!Number.isSafeInteger(occurrenceCount) || occurrenceCount < 1) {
    return { ok: false, error: "quota_exceeded" };
  }
  try {
    const [plan, countRow] = await Promise.all([
      getAccountPlan(db, accountId),
      db.prepare(
        "SELECT COUNT(*) AS count FROM health_reminders WHERE owner_account_id = ? AND status = 'active'",
      ).bind(accountId).first<{ count: number }>(),
    ]);
    if (!countRow || !Number.isSafeInteger(countRow.count)) return { ok: false, error: "quota_unavailable" };
    const limits = REMINDER_PLAN_LIMITS[plan];
    if (countRow.count >= limits.activeReminders) return { ok: false, error: "quota_exceeded" };
    if (occurrenceCount > limits.maxOccurrencesPerReminder) return { ok: false, error: "quota_exceeded" };
    return { ok: true, plan, limits };
  } catch {
    return { ok: false, error: "quota_unavailable" };
  }
}
