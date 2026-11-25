import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";
import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
import { createSosAlert, type SosCategory, type SosLevel } from "../../lib/alerts/sos-service.ts";

interface Env { DB: D1Database; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: HEADERS }); }

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "alert_service_unavailable" }, session.status);

  const parsed = await readJsonRequestBody(request, 8_192);
  if (!parsed.ok) return json({ error: parsed.reason === "too_large" ? "request_too_large" : "invalid_request" }, parsed.reason === "too_large" ? 413 : 400);
  if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) return json({ error: "invalid_alert" }, 400);

  const body = parsed.value as {
    category?: unknown; level?: unknown; customDescription?: unknown;
    pushReminderCount?: unknown; recipientAccountIds?: unknown;
  };
  if (typeof body.category !== "string" || typeof body.level !== "string" ||
      !Array.isArray(body.recipientAccountIds) ||
      !body.recipientAccountIds.every((id) => typeof id === "string")) {
    return json({ error: "invalid_alert" }, 400);
  }

  const result = await createSosAlert(env.DB, crypto, {
    authenticatedAccountId: session.value.accountId,
    recipientAccountIds: body.recipientAccountIds as string[],
    recipientLimit: 2,
    category: body.category as SosCategory,
    level: body.level as SosLevel,
    customDescription: typeof body.customDescription === "string" ? body.customDescription : null,
    pushReminderCount: typeof body.pushReminderCount === "number" ? body.pushReminderCount : Number.NaN,
  });

  if (!result.ok) {
    const status = result.error === "invalid_input" ? 400 :
      result.error === "account_not_eligible" ? 403 :
      result.error === "recipient_not_trusted" ? 403 :
      result.error === "recipient_limit_exceeded" ? 409 : 503;
    return json({ error: result.error }, status);
  }

  return json({
    created: true,
    alertId: result.value.alertId,
    createdAt: result.value.createdAt,
    recipientAccountIds: result.value.recipientAccountIds,
  }, 201);
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return json({ error: session.status === 401 ? "authentication_required" : "alert_service_unavailable" }, session.status);
  try {
    const rows = await env.DB.prepare(
      `SELECT a.id, a.category, a.level, a.custom_description, a.status,
              a.created_at, a.closed_at, a.closure_reason,
              CASE WHEN a.author_account_id = ? THEN 'author' ELSE 'recipient' END AS participant_role
       FROM alerts a
       WHERE a.author_account_id = ?
          OR EXISTS (SELECT 1 FROM alert_recipients r JOIN trusted_contacts t ON t.owner_account_id = a.author_account_id AND t.contact_account_id = r.recipient_account_id AND (t.status = 'active' OR (t.status = 'revoked' AND t.revocation_reason = 'owner_revoked')) AND t.created_at <= a.created_at AND t.invitation_id = (SELECT latest.invitation_id FROM trusted_contacts latest WHERE latest.owner_account_id = a.author_account_id AND latest.contact_account_id = t.contact_account_id ORDER BY latest.created_at DESC, latest.invitation_id DESC LIMIT 1) WHERE r.alert_id = a.id AND r.recipient_account_id = ?)
       ORDER BY a.created_at DESC, a.id DESC LIMIT 50`,
    ).bind(session.value.accountId, session.value.accountId, session.value.accountId).all<{
      id: string; category: string; level: string; custom_description: string | null;
      status: string; created_at: number; closed_at: number | null;
      closure_reason: string | null; participant_role: "author" | "recipient";
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
