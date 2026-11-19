import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";

interface Env { DB: D1Database; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: HEADERS }); }

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "alert_service_unavailable" }, session.status);
  try {
    const rows = await env.DB.prepare(
      `SELECT a.id, a.author_account_id, a.category, a.level, a.custom_description,
              a.status, a.created_at, a.closed_at, a.closure_reason,
              CASE WHEN a.author_account_id = ? THEN 'author' ELSE 'recipient' END AS participant_role
       FROM alerts a
       WHERE a.author_account_id = ?
          OR EXISTS (SELECT 1 FROM alert_recipients r WHERE r.alert_id = a.id AND r.recipient_account_id = ?)
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT 50`,
    ).bind(session.value.accountId, session.value.accountId, session.value.accountId).all<{
      id: string; author_account_id: string; category: string; level: string;
      custom_description: string | null; status: string; created_at: number;
      closed_at: number | null; closure_reason: string | null; participant_role: "author" | "recipient";
    }>();
    if (!rows.success) return json({ error: "alert_service_unavailable" }, 503);
    return json({ alerts: (rows.results ?? []).map((row) => ({
      id: row.id, category: row.category, level: row.level,
      description: row.custom_description, status: row.status,
      createdAt: row.created_at, closedAt: row.closed_at,
      closureReason: row.closure_reason, participantRole: row.participant_role,
    })) });
  } catch { return json({ error: "alert_service_unavailable" }, 503); }
};
