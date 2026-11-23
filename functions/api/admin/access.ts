import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";

interface Env { DB: D1Database; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "admin_service_unavailable" }, session.status);

  try {
    const [role, missions] = await Promise.all([
      env.DB.prepare(
        "SELECT 1 AS allowed FROM account_roles WHERE account_id = ? AND role = 'super_admin' LIMIT 1",
      ).bind(session.value.accountId).first<{ allowed: number }>(),
      env.DB.prepare(
        "SELECT COUNT(*) AS count FROM admin_missions WHERE assigned_account_id = ? AND status = 'active'",
      ).bind(session.value.accountId).first<{ count: number }>(),
    ]);
    const superAdmin = Boolean(role?.allowed);
    const activeMissions = Number.isSafeInteger(missions?.count) ? missions!.count : 0;
    const canAccess = superAdmin || activeMissions > 0;
    return json({
      canAccess,
      role: superAdmin ? "super_admin" : activeMissions > 0 ? "delegate" : null,
      activeMissions,
    });
  } catch {
    return json({ error: "admin_service_unavailable" }, 503);
  }
};
