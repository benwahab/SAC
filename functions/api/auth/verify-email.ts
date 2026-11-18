import { normalizeRegistrationEmail } from "../../../src/domain/registration-policy.ts";
import { verifyEmailOtpDigest } from "../../lib/security/email-otp-code.ts";

interface Env {
  DB: D1Database;
  EMAIL_OTP_HMAC_SECRET?: string;
}

const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB || !env.EMAIL_OTP_HMAC_SECRET || env.EMAIL_OTP_HMAC_SECRET.length < 32) {
    return json({ error: "verification_service_not_configured" }, 503);
  }

  let input: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 8_192) {
      return json({ error: "request_too_large" }, 413);
    }
    input = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  if (typeof input !== "object" || input === null) {
    return json({ error: "invalid_verification" }, 400);
  }

  const body = input as { email?: unknown; code?: unknown };
  const email = normalizeRegistrationEmail(body.email);
  if (!email || typeof body.code !== "string" || !/^\d{6}$/.test(body.code)) {
    return json({ error: "invalid_or_expired_code" }, 400);
  }

  type LatestChallenge = {
    account_id: string;
    identity_id: string;
    challenge_id: string | null;
    challenge_digest: string | null;
    account_status: string;
    verified_at: number | null;
  };

  let record: LatestChallenge | null;
  try {
    record = await env.DB.prepare(
      `SELECT a.id AS account_id,
              i.id AS identity_id,
              a.status AS account_status,
              i.verified_at,
              c.id AS challenge_id,
              c.digest AS challenge_digest
       FROM account_identities i
       JOIN accounts a ON a.id = i.account_id
       LEFT JOIN email_otp_challenges c
         ON c.id = (
           SELECT latest.id
           FROM email_otp_challenges latest
           WHERE latest.account_id = a.id
             AND latest.identity_id = i.id
           ORDER BY latest.created_at DESC, latest.id DESC
           LIMIT 1
         )
       WHERE i.channel = 'email' AND i.normalized_value = ?
       LIMIT 1`,
    ).bind(email).first<LatestChallenge>();
  } catch {
    return json({ error: "verification_unavailable" }, 503);
  }

  if (!record) return json({ error: "invalid_or_expired_code" }, 400);
  if (record.account_status === "active" && record.verified_at !== null) {
    return json({ error: "invalid_or_expired_code" }, 400);
  }
  if (record.account_status !== "pending_verification" || !record.challenge_id) {
    return json({ error: "invalid_or_expired_code" }, 400);
  }

  if (!record.challenge_digest) return json({ error: "invalid_or_expired_code" }, 400);

  let codeMatches: boolean;
  try {
    codeMatches = await verifyEmailOtpDigest(
      crypto,
      env.EMAIL_OTP_HMAC_SECRET,
      record.challenge_id,
      "account_email_verification",
      body.code,
      record.challenge_digest,
    );
  } catch {
    return json({ error: "verification_unavailable" }, 503);
  }

  const now = Date.now();
  try {
    const consumed = await env.DB.prepare(
      `UPDATE email_otp_challenges
       SET attempt_count = attempt_count + 1,
           consumed_at = CASE WHEN ? = 1 THEN ? ELSE NULL END,
           invalidated_at = CASE
             WHEN ? = 0 AND attempt_count + 1 >= max_attempts THEN ?
             ELSE NULL
           END
       WHERE id = ?
         AND account_id = ?
         AND identity_id = ?
         AND consumed_at IS NULL
         AND invalidated_at IS NULL
         AND expires_at > ?
         AND attempt_count < max_attempts
       RETURNING consumed_at, attempt_count`,
    ).bind(
      codeMatches ? 1 : 0,
      now,
      codeMatches ? 1 : 0,
      now,
      record.challenge_id,
      record.account_id,
      record.identity_id,
      now,
    ).first<{ consumed_at: number | null; attempt_count: number }>();

    if (consumed?.consumed_at === null || consumed === null) {
      return json({ error: "invalid_or_expired_code" }, 400);
    }

    const activated = await env.DB.prepare(
      `SELECT a.status AS status, i.verified_at AS verified_at
       FROM accounts a
       JOIN account_identities i ON i.account_id = a.id
       WHERE a.id = ? AND i.id = ? AND i.channel = 'email'`,
    ).bind(record.account_id, record.identity_id).first<{
      status: string;
      verified_at: number | null;
    }>();

    if (!activated || activated.status !== "active" || activated.verified_at !== now) {
      return json({ error: "verification_unavailable" }, 503);
    }

    // L'activation du compte est faite par le trigger D1 dans la même
    // instruction transactionnelle que la consommation du défi.
    return json({ verified: true, accountActivated: true });
  } catch {
    return json({ error: "verification_unavailable" }, 503);
  }
};
