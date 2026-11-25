import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";
import { getAccountPlan } from "../../lib/billing/plan.ts";

interface Env { DB: D1Database; }
const HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) {
    return json(
      { error: session.status === 401 ? "authentication_required" : "subscription_unavailable" },
      session.status,
    );
  }

  try {
    const accountId = session.value.accountId;
    const [plan, count] = await Promise.all([
      getAccountPlan(env.DB, accountId),
      env.DB.prepare(
        `SELECT COUNT(*) AS count FROM (
           SELECT account_low_id AS contact_id FROM close_relations
           WHERE status = 'active' AND account_high_id = ?
           UNION
           SELECT account_high_id AS contact_id FROM close_relations
           WHERE status = 'active' AND account_low_id = ?
           UNION
           SELECT contact_account_id AS contact_id FROM trusted_contacts
           WHERE status = 'active' AND owner_account_id = ?
         )`,
      ).bind(accountId, accountId, accountId).first<{ count: number }>(),
    ]);

    return json({
      plan: plan.plan,
      maxTrustedContacts: plan.maxTrustedContacts,
      activeTrustedContacts: Number(count?.count ?? 0),
      periodEnd: plan.periodEnd,
      premiumMonthlyPriceXof: 5000,
      paymentProviderConfigured: false,
    });
  } catch {
    return json({ error: "subscription_unavailable" }, 503);
  }
};
