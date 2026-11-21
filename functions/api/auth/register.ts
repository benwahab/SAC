import { guardSameOriginJsonPost } from "../../lib/security/http-request-guard.ts";
import { readJsonRequestBody } from "../../lib/security/json-request-body.ts";
import { validateRegistrationInput } from "../../../src/domain/registration-policy.ts";
import { sendAccountVerificationCode } from "../../lib/email/verification.ts";
import { digestEmailOtp, generateEmailOtpCode } from "../../lib/security/email-otp-code.ts";
import { hashAccountPassword } from "../../lib/security/password-hash.ts";

interface Env {
  DB: D1Database;
  EMAIL_OTP_HMAC_SECRET?: string;
  BREVO_API_KEY?: string;
  BREVO_FROM_EMAIL?: string;
  BREVO_FROM_NAME?: string;
}

const NO_STORE = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
const GENERIC_ACCEPTED = {
  accepted: true,
  message: "Si cette adresse est éligible, vous recevrez les instructions de vérification.",
  retryAfterSeconds: 60,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: NO_STORE });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const requestGuard = guardSameOriginJsonPost(request);
  if (requestGuard) return requestGuard;
  if (!env.DB) return json({ error: "service_unavailable" }, 503);
  if (
    !env.EMAIL_OTP_HMAC_SECRET ||
    env.EMAIL_OTP_HMAC_SECRET.length < 32 ||
    !env.BREVO_API_KEY ||
    !env.BREVO_FROM_EMAIL ||
    !env.BREVO_FROM_NAME
  ) {
    return json({ error: "verification_service_not_configured" }, 503);
  }

  const parsedBody = await readJsonRequestBody(request, 65_536);
  if (!parsedBody.ok) {
    return json({ error: parsedBody.reason === "too_large" ? "request_too_large" : "invalid_request" }, parsedBody.reason === "too_large" ? 413 : 400);
  }
  const input = parsedBody.value;

  if (typeof input !== "object" || input === null) {
    return json({ error: "invalid_registration" }, 400);
  }

  const body = input as Record<string, unknown>;
  const validation = validateRegistrationInput({
    email: body.email,
    phone: body.phone,
    password: body.password,
    language: body.language,
  });
  if (!validation.ok) return json({ error: validation.error }, 400);

  const { email, phone, password, language } = validation.value;

  // Le calcul du vérificateur est effectué avant de connaître le résultat
  // des contraintes d'unicité : aucune branche rapide ne révèle l'existence
  // d'une adresse ou d'un numéro déjà enregistré.
  const now = Date.now();
  const accountId = crypto.randomUUID();
  const emailIdentityId = crypto.randomUUID();
  const phoneIdentityId = crypto.randomUUID();
  const challengeId = crypto.randomUUID();
  const code = generateEmailOtpCode(crypto);
  const expiresAt = now + 10 * 60 * 1000;

  let passwordHash: string;
  let digest: string;
  try {
    passwordHash = await hashAccountPassword(crypto, password);
    digest = await digestEmailOtp(
      crypto,
      env.EMAIL_OTP_HMAC_SECRET,
      challengeId,
      "account_email_verification",
      code,
    );
  } catch (error) {
    console.error("register_hash_failed", error instanceof Error ? `${error.name}: ${error.message}` : "unknown");
    return json({ error: "registration_unavailable" }, 503);
  }

  try {
    const results = await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO accounts (id, status, preferred_language, password_hash, created_at, updated_at) VALUES (?, 'pending_verification', ?, ?, ?, ?)",
      ).bind(accountId, language, passwordHash, now, now),
      env.DB.prepare(
        "INSERT INTO account_identities (id, account_id, channel, normalized_value, verified_at, is_primary, created_at) VALUES (?, ?, 'email', ?, NULL, 1, ?)",
      ).bind(emailIdentityId, accountId, email, now),
      env.DB.prepare(
        "INSERT INTO account_identities (id, account_id, channel, normalized_value, verified_at, is_primary, created_at) VALUES (?, ?, 'phone', ?, NULL, 1, ?)",
      ).bind(phoneIdentityId, accountId, phone, now),
      env.DB.prepare(
        "INSERT INTO email_otp_challenges (id, account_id, identity_id, purpose, digest, attempt_count, max_attempts, created_at, expires_at, delivery_status) VALUES (?, ?, ?, 'account_email_verification', ?, 0, 6, ?, ?, 'pending')",
      ).bind(challengeId, accountId, emailIdentityId, digest, now, expiresAt),
    ]);

    if (results.some((result) => !result.success || result.meta.changes !== 1)) {
      console.error("register_batch_failed", JSON.stringify(results.map((result) => ({ success: result.success, changes: result.meta.changes }))));
      return json({ error: "registration_unavailable" }, 503);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("register_db_failed", error instanceof Error ? `${error.name}: ${message}` : "unknown");
    if (message.includes("UNIQUE constraint failed")) return json(GENERIC_ACCEPTED, 202);
    return json({ error: "registration_unavailable" }, 503);
  }

  // Le défi reste pending jusqu'à l'acceptation du fournisseur. Un échec
  // d'envoi ne crée donc jamais un code vérifiable qui n'a pas été livré.
  const delivery = await sendAccountVerificationCode(env, email, code, language);
  if (!delivery.ok) console.error("register_email_failed", delivery.reason);
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
    // En cas d'incident D1, le compte reste en attente et le défi non vérifiable.
  }

  return json(GENERIC_ACCEPTED, 202);
};
