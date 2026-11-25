export type AccountPlan = {
  readonly plan: "free" | "premium";
  readonly maxTrustedContacts: 2 | 10;
  readonly periodEnd: number | null;
};

type PlanDatabase = Pick<D1Database, "prepare">;

/**
 * Premium is granted only by a server-verified payment integration.
 * A missing, pending, failed, cancelled or expired subscription is Free.
 */
export async function getAccountPlan(
  db: PlanDatabase,
  accountId: string,
  now = Date.now(),
): Promise<AccountPlan> {
  if (!accountId.trim() || !Number.isSafeInteger(now) || now < 0) {
    return { plan: "free", maxTrustedContacts: 2, periodEnd: null };
  }

  const row = await db.prepare(
    `SELECT status, current_period_start, current_period_end
     FROM account_subscriptions
     WHERE account_id = ?
     LIMIT 1`,
  ).bind(accountId).first<{
    status: string;
    current_period_start: number | null;
    current_period_end: number | null;
  }>();

  if (
    row?.status === "active" &&
    typeof row.current_period_start === "number" &&
    typeof row.current_period_end === "number" &&
    row.current_period_start <= now &&
    row.current_period_end > now
  ) {
    return { plan: "premium", maxTrustedContacts: 10, periodEnd: row.current_period_end };
  }

  return { plan: "free", maxTrustedContacts: 2, periodEnd: null };
}
