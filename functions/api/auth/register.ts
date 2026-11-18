import { validateRegistrationInput } from "../../../src/domain/registration-policy.ts";
import { sendAccountVerificationCode } from "../../lib/email/resend.ts";
import { digestEmailOtp, generateEmailOtpCode } from "../../lib/security/email-otp-code.ts";
import { hashAccountPassword } from "../../lib/security/password-hash.ts";

interface Env {
  DB: D1Database;
  EMAIL_OTP_HMAC_SECRET?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
}

const NO_STORE = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" };
const GENERIC_ACCEPTED = {
  accepted: true,
  message: "Si cette adresse peut être utilisée, un code de vérification vient d'être envoyé.",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: NO_STORE });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) return json({ error: "service_unavailable" }, 503);
  if (
    !env.EMAIL_OTP_HMAC_SECRET ||
    env.EMAIL_OTP_HMAC_SECRET.length < 32 ||
    !env.RESEND_API_KEY ||
    !env.RESEND_FROM_EMAIL
  ) {
    return json({ error: "verification_service_not_configured" }, 503);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > 65_536) return json({ error: "request_too_large" }, 413);

  let input: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 65_536) {
      return json({ error: "request_too_large" }, 413);
    }
    input = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  if (typeof input !== "object" || input === null) {
    return json({ error: "invalid_registration" }, 400);
  }

  const validation = validateRegistrationInput(input as {
    email?: unknown;
    phone?: unknown;
    password?: unknown;
    language?: unknown;
  });
  if (!validation.ok) return json({ error: validation.error }, 400);

  const { email, phone, password, language } = validation.value;

  // Évite un calcul PBKDF2 coûteux pour une identité déjà enregistrée.
  // L'unicité est malgré tout réimposée par les contraintes SQL lors du batch.
  try {
    const existingIdentity = await env.DB.prepare(
      `SELECT 1 AS present
       FROM account_identities
       WHERE (channel = 'email' AND normalized_value = ?)
          OR (channel = 'phone' AND normalized_value = ?)
       LIMIT 1`,
    ).bind(email, phone).first<{ present: number }>();
    if (existingIdentity) return json(GENERIC_ACCEPTED, 202);
  } catch {
    return json({ error: "registration_unavailable" }, 503);
  }

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
  } catch {
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
        "INSERT INTO email_otp_challenges (id, account_id, identity_id, purpose, digest, attempt_count, max_attempts, created_at, expires_at) VALUES (?, ?, ?, 'account_email_verification', ?, 0, 6, ?, ?)",
      ).bind(challengeId, accountId, emailIdentityId, digest, now, expiresAt),
    ]);

    if (results.some((result) => !result.success || result.meta.changes !== 1)) {
      return json({ error: "registration_unavailable" }, 503);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE constraint failed")) return json(GENERIC_ACCEPTED, 202);
    return json({ error: "registration_unavailable" }, 503);
  }

  const delivery = await sendAccountVerificationCode(
    env,
    email,
    code,
    language,
  );

  if (!delivery.ok) {
    // Le compte reste en attente ; un renvoi ultérieur créera un nouveau défi
    // et invalidera atomiquement celui-ci après le délai minimal.
    return json({ error: "verification_email_unavailable", retryAfterSeconds: 60 }, 503);
  }

  return json({ ...GENERIC_ACCEPTED, retryAfterSeconds: 60 }, 202);
};
