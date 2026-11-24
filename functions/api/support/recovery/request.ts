import { normalizeRegistrationEmail } from "../../../../src/domain/registration-policy.ts";
import { sendSupportTicketIntakeCode } from "../../../lib/email/support-intake.ts";
import { digestEmailOtp, generateEmailOtpCode } from "../../../lib/security/email-otp-code.ts";
import { guardSameOriginJsonPost } from "../../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../../lib/security/json-request-body.ts";

interface Env {
  DB: D1Database;
  EMAIL_OTP_HMAC_SECRET?: string;
  BREVO_API_KEY?: string;
  BREVO_FROM_EMAIL?: string;
  BREVO_FROM_NAME?: string;
}
const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
const ACCEPTED = { accepted: true, message: "Si cette adresse correspond à un compte actif, un code sera envoyé.", retryAfterSeconds: 60 };
function json(body: unknown, status = 202): Response { return new Response(JSON.stringify(body), { status, headers: HEADERS }); }

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const guard = guardSameOriginJsonPost(request);
  if (guard) return guard;
  if (!env.DB || !env.EMAIL_OTP_HMAC_SECRET || env.EMAIL_OTP_HMAC_SECRET.length < 32 ||
      !env.BREVO_API_KEY || !env.BREVO_FROM_EMAIL || !env.BREVO_FROM_NAME) return json({ error: "support_intake_unavailable" }, 503);
  const parsed = await readJsonRequestBody(request, 4096);
  if (!parsed.ok || typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) return json({ error: "invalid_request" }, 400);
  const email = normalizeRegistrationEmail((parsed.value as Record<string, unknown>).email);
  if (!email) return json({ error: "invalid_email" }, 400);
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip || ip.length > 64) return json(ACCEPTED);
  try {
    const account = await env.DB.prepare(
      `SELECT a.id, a.preferred_language AS language
       FROM accounts a JOIN account_identities i ON i.account_id = a.id
       WHERE a.status = 'active' AND i.channel = 'email' AND i.is_primary = 1
         AND i.verified_at IS NOT NULL AND i.normalized_value = ? LIMIT 1`,
    ).bind(email).first<{id:string;language:"fr"|"en"|"ar"}>();
    if (!account) return json(ACCEPTED);
    const now = Date.now();
    const challengeId = crypto.randomUUID();
    const code = generateEmailOtpCode(crypto);
    const digest = await digestEmailOtp(crypto, env.EMAIL_OTP_HMAC_SECRET, challengeId, "support_ticket_intake", code);
    const ipHash = await hmacHex(env.EMAIL_OTP_HMAC_SECRET, `SAC:support-intake-ip:v1:${ip}`);
    const inserted = await env.DB.prepare(
      `INSERT INTO support_ticket_intake_challenges
       (id, normalized_email, request_ip_hash, digest, attempt_count, max_attempts, delivery_status, created_at, expires_at)
       VALUES (?, ?, ?, ?, 0, 6, 'pending', ?, ?)`,
    ).bind(challengeId, email, ipHash, digest, now, now + 10 * 60 * 1000).run();
    if (!inserted.success || inserted.meta.changes !== 1) return json(ACCEPTED);
    const delivery = await sendSupportTicketIntakeCode(env, email, code, account.language);
    await env.DB.prepare(
      "UPDATE support_ticket_intake_challenges SET delivery_status = ? WHERE id = ? AND delivery_status = 'pending'",
    ).bind(delivery.ok ? "accepted" : "failed", challengeId).run();
    return json(ACCEPTED);
  } catch { return json(ACCEPTED); }
};
