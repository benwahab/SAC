type BillingDatabase = Pick<D1Database, "prepare" | "batch">;

export type VerifiedPremiumPayment = {
  readonly accountId: string;
  readonly provider: string;
  readonly providerEventId: string;
  readonly eventType: string;
  readonly providerSubscriptionRef: string;
  readonly payloadDigest: string;
  readonly amountXof: number;
  readonly periodStart: number;
  readonly periodEnd: number;
  readonly now?: number;
};

export type PremiumActivationResult =
  | { readonly ok: true; readonly activated: true; readonly duplicate: false }
  | { readonly ok: true; readonly activated: false; readonly duplicate: true }
  | { readonly ok: false; readonly error: "invalid_payment" | "storage_unavailable" };

/**
 * Internal billing primitive. Call only after a provider adapter has verified
 * the webhook signature, final payment state, merchant, reference, amount and currency.
 * It is deliberately not exposed as a browser-facing endpoint.
 */
export async function activatePremiumFromVerifiedPayment(
  db: BillingDatabase,
  input: VerifiedPremiumPayment,
): Promise<PremiumActivationResult> {
  const now = input.now ?? Date.now();
  if (
    !input.accountId.trim() ||
    !/^[a-z0-9_-]{1,40}$/.test(input.provider) ||
    !input.providerEventId.trim() || input.providerEventId.length > 200 ||
    !input.eventType.trim() || input.eventType.length > 100 ||
    !input.providerSubscriptionRef.trim() || input.providerSubscriptionRef.length > 200 ||
    !/^[a-f0-9]{64}$/.test(input.payloadDigest) ||
    input.amountXof !== 5000 ||
    !Number.isSafeInteger(input.periodStart) ||
    !Number.isSafeInteger(input.periodEnd) ||
    input.periodStart < 0 || input.periodEnd <= input.periodStart ||
    !Number.isSafeInteger(now) || now < 0
  ) return { ok: false, error: "invalid_payment" };

  try {
    const results = await db.batch([
      db.prepare(
        `INSERT OR IGNORE INTO billing_provider_events
         (provider, provider_event_id, event_type, received_at, processed_at, payload_digest)
         VALUES (?, ?, ?, ?, NULL, ?)`,
      ).bind(input.provider, input.providerEventId, input.eventType, now, input.payloadDigest),
      db.prepare(
        `INSERT INTO account_subscriptions
         (id, account_id, plan_key, status, provider, provider_subscription_ref,
          amount_xof, billing_interval, current_period_start, current_period_end,
          created_at, updated_at)
         SELECT ?, ?, 'premium', 'active', ?, ?, 5000, 'month', ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM billing_provider_events
           WHERE provider = ? AND provider_event_id = ? AND processed_at IS NULL
         )
         ON CONFLICT(account_id) DO UPDATE SET
           status = 'active',
           provider = excluded.provider,
           provider_subscription_ref = excluded.provider_subscription_ref,
           amount_xof = 5000,
           billing_interval = 'month',
           current_period_start = excluded.current_period_start,
           current_period_end = excluded.current_period_end,
           updated_at = excluded.updated_at
         WHERE account_subscriptions.current_period_end IS NULL
            OR excluded.current_period_end >= account_subscriptions.current_period_end`,
      ).bind(
        crypto.randomUUID(), input.accountId, input.provider, input.providerSubscriptionRef,
        input.periodStart, input.periodEnd, now, now, input.provider, input.providerEventId,
      ),
      db.prepare(
        `UPDATE billing_provider_events
         SET processed_at = ?
         WHERE provider = ? AND provider_event_id = ? AND processed_at IS NULL
           AND EXISTS (
             SELECT 1 FROM account_subscriptions
             WHERE account_id = ? AND status = 'active' AND current_period_end >= ?
           )`,
      ).bind(now, input.provider, input.providerEventId, input.accountId, input.periodEnd),
    ]);

    if (results.length !== 3 || results.some((result) => !result.success)) {
      return { ok: false, error: "storage_unavailable" };
    }
    if (results[1].meta.changes === 1 && results[2].meta.changes === 1) {
      return { ok: true, activated: true, duplicate: false };
    }
    const event = await db.prepare(
      `SELECT processed_at, payload_digest FROM billing_provider_events
       WHERE provider = ? AND provider_event_id = ? LIMIT 1`,
    ).bind(input.provider, input.providerEventId).first<{ processed_at: number | null; payload_digest: string }>();
    if (event && event.payload_digest !== input.payloadDigest) {
      return { ok: false, error: "invalid_payment" };
    }
    if (event?.processed_at !== null && event?.processed_at !== undefined) {
      return { ok: true, activated: false, duplicate: true };
    }
    return { ok: false, error: "storage_unavailable" };
  } catch {
    return { ok: false, error: "storage_unavailable" };
  }
}
