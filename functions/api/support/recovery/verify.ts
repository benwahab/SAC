import { verifyEmailOtpDigest } from "../../../lib/security/email-otp-code.ts";
import { guardSameOriginJsonPost } from "../../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../../lib/security/json-request-body.ts";

interface Env { DB: D1Database; EMAIL_OTP_HMAC_SECRET?: string; }
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: HEADERS }); }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function makeReference(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return "SAC-" + Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;
  if (!env.DB || !env.EMAIL_OTP_HMAC_SECRET || env.EMAIL_OTP_HMAC_SECRET.length < 32) return json({ error: "support_intake_unavailable" }, 503);
  const parsed = await readJsonRequestBody(request, 8192);
  if (!parsed.ok || !isObject(parsed.value)) return json({ error: "invalid_request" }, 400);
  const body = parsed.value;
  if (typeof body.challengeId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.challengeId) ||
      typeof body.code !== "string" || !/^\d{6}$/.test(body.code) ||
      typeof body.subject !== "string" || body.subject.trim().length < 3 || body.subject.trim().length > 160 ||
      typeof body.description !== "string" || body.description.trim().length < 5 || body.description.trim().length > 5000) return json({ error: "invalid_request" }, 400);
  const now = Date.now();
  try {
    const challenge = await env.DB.prepare(
      `SELECT id, normalized_email, digest, attempt_count, max_attempts, delivery_status, created_at, expires_at, consumed_at, invalidated_at
       FROM support_ticket_intake_challenges WHERE id = ? LIMIT 1`,
    ).bind(body.challengeId).first<{id:string;normalized_email:string;digest:string;attempt_count:number;max_attempts:number;delivery_status:string;created_at:number;expires_at:number;consumed_at:number|null;invalidated_at:number|null}>();
    if (!challenge || challenge.delivery_status !== "accepted" || challenge.expires_at <= now ||
        challenge.consumed_at !== null || challenge.invalidated_at !== null || challenge.attempt_count >= challenge.max_attempts) return json({ error: "invalid_or_expired_code" }, 400);
    const account = await env.DB.prepare(
      `SELECT a.id FROM accounts a JOIN account_identities i ON i.account_id = a.id
       WHERE a.status = 'active' AND i.channel = 'email' AND i.is_primary = 1
         AND i.verified_at IS NOT NULL AND i.normalized_value = ? LIMIT 1`,
    ).bind(challenge.normalized_email).first<{id:string}>();
    if (!account) return json({ error: "invalid_or_expired_code" }, 400);
    const matches = await verifyEmailOtpDigest(crypto, env.EMAIL_OTP_HMAC_SECRET, challenge.id, "support_ticket_intake", body.code, challenge.digest);
    if (!matches) {
      await env.DB.prepare(
        `UPDATE support_ticket_intake_challenges SET attempt_count = attempt_count + 1
         WHERE id = ? AND delivery_status = 'accepted' AND consumed_at IS NULL
           AND invalidated_at IS NULL AND expires_at > ? AND attempt_count = ? AND attempt_count < max_attempts`,
      ).bind(challenge.id, now, challenge.attempt_count).run();
      return json({ error: "invalid_or_expired_code" }, 400);
    }
    const ticketId = crypto.randomUUID();
    const reference = makeReference();
    const results = await env.DB.batch([
      env.DB.prepare(
        `UPDATE support_ticket_intake_challenges
         SET attempt_count = attempt_count + 1, consumed_at = ?, created_ticket_id = ?
         WHERE id = ? AND delivery_status = 'accepted' AND consumed_at IS NULL
           AND invalidated_at IS NULL AND expires_at > ? AND attempt_count = ? AND attempt_count < max_attempts`,
      ).bind(now, ticketId, challenge.id, now, challenge.attempt_count),
      env.DB.prepare(
        `INSERT INTO support_tickets
         (id, public_reference, requester_account_id, category, subject, description, priority, status, created_at, updated_at, version)
         SELECT ?, ?, ?, 'account_access', ?, ?, 'normal', 'new', ?, ?, 1
         WHERE EXISTS (SELECT 1 FROM support_ticket_intake_challenges WHERE id = ? AND created_ticket_id = ?)`,
      ).bind(ticketId, reference, account.id, body.subject.trim(), body.description.trim(), now, now, challenge.id, ticketId),
      env.DB.prepare(
        `INSERT INTO support_ticket_events (id, ticket_id, actor_account_id, event_type, new_value, occurred_at)
         SELECT ?, ?, ?, 'created', 'new', ?
         WHERE EXISTS (SELECT 1 FROM support_tickets WHERE id = ?)`,
      ).bind(crypto.randomUUID(), ticketId, account.id, now, ticketId),
    ]);
    if (results.some(result => !result.success) || results.some(result => result.meta.changes !== 1)) return json({ error: "support_intake_unavailable" }, 503);
    return json({ created: true, reference, status: "new", createdAt: now }, 201);
  } catch { return json({ error: "support_intake_unavailable" }, 503); }
};
