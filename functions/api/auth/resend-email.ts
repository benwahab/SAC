import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
import { normalizeRegistrationEmail } from "../../../src/domain/registration-policy.ts";
import { sendAccountVerificationCode } from "../../lib/email/verification.ts";
import { digestEmailOtp, generateEmailOtpCode } from "../../lib/security/email-otp-code.ts";

interface Env {
  DB: D1Database;
  EMAIL_OTP_HMAC_SECRET?: string;
  BREVO_API_KEY?: string;
  BREVO_FROM_EMAIL?: string;
  BREVO_FROM_NAME?: string;
}

const HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
const ACCEPTED = {
  accepted: true,
  message: "Si un compte en attente correspond à cette adresse, la demande sera traitée.",
  retryAfterSeconds: 60,
};

function json(body: unknown, status = 202): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const requestGuard = guardSameOriginJsonPost(request);
  if (requestGuard) return requestGuard;
  if (
    !env.DB ||
    !env.EMAIL_OTP_HMAC_SECRET ||
    env.EMAIL_OTP_HMAC_SECRET.length < 32 ||
    !env.BREVO_API_KEY ||
    !env.BREVO_FROM_EMAIL ||
    !env.BREVO_FROM_NAME
  ) {
    return json({ error: "verification_service_not_configured" }, 503);
  }

  const parsedBody = await readJsonRequestBody(request, 8_192);
  if (!parsedBody.ok) {
    return json({ error: parsedBody.reason === "too_large" ? "request_too_large" : "invalid_request" }, parsedBody.reason === "too_large" ? 413 : 400);
  }
  const input = parsedBody.value;

  if (typeof input !== "object" || input === null) {
    return json({ error: "invalid_request" }, 400);
  }

  const email = normalizeRegistrationEmail((input as { email?: unknown }).email);
  if (!email) return json({ error: "invalid_email" }, 400);

  type PendingIdentity = {
    account_id: string;
    identity_id: string;
    language: "fr" | "en" | "ar";
  };

  let record: PendingIdentity | null;
  try {
    record = await env.DB.prepare(
      `SELECT a.id AS account_id,
              i.id AS identity_id,
              a.preferred_language AS language
       FROM accounts a
       JOIN account_identities i ON i.account_id = a.id
       WHERE a.status = 'pending_verification'
         AND i.channel = 'email'
         AND i.is_primary = 1
         AND i.verified_at IS NULL
         AND i.normalized_value = ?
       LIMIT 1`,
    ).bind(email).first<PendingIdentity>();
  } catch {
    return json({ error: "verification_unavailable" }, 503);
  }

  if (!record) return json(ACCEPTED);

  const now = Date.now();
  const challengeId = crypto.randomUUID();
  const code = generateEmailOtpCode(crypto);
  const expiresAt = now + 10 * 60 * 1000;

  let digest: string;
  try {
    digest = await digestEmailOtp(
      crypto,
      env.EMAIL_OTP_HMAC_SECRET,
      challengeId,
      "account_email_verification",
      code,
    );
  } catch {
    return json({ error: "verification_unavailable" }, 503);
  }

  try {
    const inserted = await env.DB.prepare(
      `INSERT INTO email_otp_challenges
       (id, account_id, identity_id, purpose, digest, attempt_count, max_attempts, created_at, expires_at, delivery_status)
       VALUES (?, ?, ?, 'account_email_verification', ?, 0, 6, ?, ?, 'pending')`,
    ).bind(
      challengeId,
      record.account_id,
      record.identity_id,
      digest,
      now,
      expiresAt,
    ).run();

    if (!inserted.success || inserted.meta.changes !== 1) return json(ACCEPTED);
  } catch {
    // Le trigger D1 refuse les renvois avant 60 secondes et conserve le défi
    // précédent : aucune invalidation partielle n'est possible.
    return json(ACCEPTED);
  }

  const delivery = await sendAccountVerificationCode(env, email, code, record.language);
  const deliveryStatus = delivery.ok ? "accepted" : "failed";

  try {
    await env.DB.prepare(
      `UPDATE email_otp_challenges
       SET delivery_status = ?
       WHERE id = ?
         AND delivery_status = 'pending'
         AND expires_at > ?
         AND EXISTS (
           SELECT 1
           FROM accounts a
           JOIN account_identities i ON i.account_id = a.id
           WHERE a.id = email_otp_challenges.account_id
             AND a.status = 'pending_verification'
             AND i.id = email_otp_challenges.identity_id
             AND i.channel = 'email'
             AND i.is_primary = 1
             AND i.verified_at IS NULL
         )`,
    ).bind(deliveryStatus, challengeId, Date.now()).run();
  } catch {
    // En cas d'incident D1, le défi reste pending et ne peut pas être vérifié.
    // Le défi livré précédemment n'a pas été invalidé.
  }

  return json(ACCEPTED);
};
