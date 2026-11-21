import { normalizeRegistrationEmail, normalizeRegistrationPhone } from "../../../src/domain/registration-policy.ts";
import { validateAccountPassword } from "../../../src/domain/auth-policy.ts";
import { digestEmailOtp, generateEmailOtpCode, verifyEmailOtpDigest } from "../security/email-otp-code.ts";
import { hashAccountPassword, verifyAccountPassword } from "../security/password-hash.ts";
import { sendAccountVerificationCode, type SacEmailLanguage } from "../email/verification.ts";
import { consumeRateLimit } from "./rate-limit.ts";
import { logAccountEvent } from "./profile-service.ts";

type ContactChangeDatabase = Pick<D1Database, "prepare" | "batch">;

export interface ContactChangeEnvironment {
  readonly DB: D1Database;
  readonly EMAIL_OTP_HMAC_SECRET?: string;
  readonly BREVO_API_KEY?: string;
  readonly BREVO_FROM_EMAIL?: string;
  readonly BREVO_FROM_NAME?: string;
}

export type ContactChangeError =
  | "invalid_input"
  | "invalid_credentials"
  | "email_already_used"
  | "phone_already_used"
  | "unchanged"
  | "rate_limited"
  | "verification_service_not_configured"
  | "verification_email_unavailable"
  | "invalid_or_expired_code"
  | "too_many_attempts"
  | "storage_unavailable";

export type ContactChangeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ContactChangeError };

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 6;

function fail<T>(error: ContactChangeError): ContactChangeResult<T> {
  return { ok: false, error };
}

function validId(value: string): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= 128 && value.trim() === value;
}

function purposeFor(channel: "email" | "phone"): "account_email_change" | "account_phone_change" {
  return channel === "email" ? "account_email_change" : "account_phone_change";
}

async function verifyCurrentPassword(
  db: ContactChangeDatabase,
  accountId: string,
  password: unknown,
  cryptoProvider: Crypto,
): Promise<{ ok: true; passwordHash: string } | { ok: false }> {
  if (typeof password !== "string" || password.length === 0 || password.length > 1024) return { ok: false };
  const row = await db.prepare(
    "SELECT password_hash, status FROM accounts WHERE id = ? LIMIT 1",
  ).bind(accountId).first<{ password_hash: string; status: string }>();
  if (!row || row.status !== "active") return { ok: false };
  return await verifyAccountPassword(cryptoProvider, password, row.password_hash)
    ? { ok: true, passwordHash: row.password_hash }
    : { ok: false };
}

export async function requestContactChange(
  db: ContactChangeDatabase,
  cryptoProvider: Crypto,
  env: ContactChangeEnvironment,
  input: {
    readonly accountId: string;
    readonly channel: "email" | "phone";
    readonly newValue: unknown;
    readonly currentPassword: unknown;
    readonly language: SacEmailLanguage;
    readonly now?: number;
  },
): Promise<ContactChangeResult<{ challengeId: string; expiresAt: number; deliveryTarget: string }>> {
  const now = input.now ?? Date.now();
  if (!validId(input.accountId) || (input.channel !== "email" && input.channel !== "phone") ||
      !Number.isSafeInteger(now) || now <= 0) {
    return fail("invalid_input");
  }
  if (!env.EMAIL_OTP_HMAC_SECRET || env.EMAIL_OTP_HMAC_SECRET.length < 32 ||
      !env.BREVO_API_KEY || !env.BREVO_FROM_EMAIL || !env.BREVO_FROM_NAME) {
    return fail("verification_service_not_configured");
  }

  const rate = await consumeRateLimit(db, input.accountId, input.channel === "email" ? "email_change_request" : "phone_change_request", 5, 60 * 60 * 1000, now);
  if (rate === "limited") return fail("rate_limited");
  if (rate === "unavailable") return fail("storage_unavailable");

  const newValue = input.channel === "email"
    ? normalizeRegistrationEmail(input.newValue)
    : normalizeRegistrationPhone(input.newValue);
  if (!newValue) return fail("invalid_input");

  try {
    const credentials = await verifyCurrentPassword(db, input.accountId, input.currentPassword, cryptoProvider);
    if (!credentials.ok) return fail("invalid_credentials");

    const identity = await db.prepare(
      `SELECT id, normalized_value, verified_at
       FROM account_identities
       WHERE account_id = ? AND channel = ? AND is_primary = 1
       LIMIT 1`,
    ).bind(input.accountId, input.channel).first<{ id: string; normalized_value: string; verified_at: number | null }>();
    if (!identity) return fail("storage_unavailable");
    if (input.channel === "email" && identity.verified_at === null) return fail("storage_unavailable");
    if (identity.normalized_value === newValue) return fail("unchanged");

    const duplicate = await db.prepare(
      `SELECT 1 AS present FROM account_identities
       WHERE channel = ? AND normalized_value = ? AND account_id <> ? LIMIT 1`,
    ).bind(input.channel, newValue, input.accountId).first<{ present: number }>();
    if (duplicate?.present) {
      return fail(input.channel === "email" ? "email_already_used" : "phone_already_used");
    }

    let deliveryTarget = newValue;
    if (input.channel === "phone") {
      const email = await db.prepare(
        `SELECT normalized_value FROM account_identities
         WHERE account_id = ? AND channel = 'email' AND is_primary = 1 AND verified_at IS NOT NULL
         LIMIT 1`,
      ).bind(input.accountId).first<{ normalized_value: string }>();
      if (!email) return fail("storage_unavailable");
      deliveryTarget = email.normalized_value;
    }

    const challengeId = cryptoProvider.randomUUID();
    const code = generateEmailOtpCode(cryptoProvider);
    const purpose = purposeFor(input.channel);
    const digest = await digestEmailOtp(cryptoProvider, env.EMAIL_OTP_HMAC_SECRET, challengeId, purpose, code);
    const expiresAt = now + CHALLENGE_TTL_MS;

    const inserted = await db.prepare(
      `INSERT INTO account_contact_change_challenges
       (id, account_id, identity_id, channel, purpose, new_value, delivery_target, digest,
        attempt_count, max_attempts, delivery_status, created_at, expires_at, consumed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'pending', ?, ?, NULL)`,
    ).bind(
      challengeId,
      input.accountId,
      identity.id,
      input.channel,
      purpose,
      newValue,
      deliveryTarget,
      digest,
      MAX_ATTEMPTS,
      now,
      expiresAt,
    ).run();
    if (!inserted.success || inserted.meta.changes !== 1) return fail("storage_unavailable");

    const delivery = await sendAccountVerificationCode(env, deliveryTarget, code, input.language);
    await db.prepare(
      `UPDATE account_contact_change_challenges SET delivery_status = ?
       WHERE id = ? AND account_id = ? AND delivery_status = 'pending'`,
    ).bind(delivery.ok ? "accepted" : "failed", challengeId, input.accountId).run();

    if (!delivery.ok) return fail("verification_email_unavailable");
    await logAccountEvent(db, input.accountId, input.channel === "email" ? "email_change_requested" : "phone_change_requested", { challengeId }, now);
    return { ok: true, value: { challengeId, expiresAt, deliveryTarget } };
  } catch {
    return fail("storage_unavailable");
  }
}

export async function confirmContactChange(
  db: ContactChangeDatabase,
  cryptoProvider: Crypto,
  env: Pick<ContactChangeEnvironment, "EMAIL_OTP_HMAC_SECRET">,
  input: {
    readonly accountId: string;
    readonly currentSessionId: string;
    readonly challengeId: unknown;
    readonly code: unknown;
    readonly expectedChannel?: "email" | "phone";
    readonly now?: number;
  },
): Promise<ContactChangeResult<{ channel: "email" | "phone"; value: string }>> {
  const now = input.now ?? Date.now();
  if (!validId(input.accountId) || typeof input.challengeId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(input.challengeId) ||
      typeof input.code !== "string" || !/^\d{6}$/.test(input.code) ||
      !Number.isSafeInteger(now) || now <= 0) {
    return fail("invalid_input");
  }
  if (!env.EMAIL_OTP_HMAC_SECRET || env.EMAIL_OTP_HMAC_SECRET.length < 32) {
    return fail("verification_service_not_configured");
  }

  let channel: "email" | "phone" = "email";
  try {
    const challenge = await db.prepare(
      `SELECT id, identity_id, channel, purpose, new_value, digest, attempt_count, max_attempts,
              delivery_status, expires_at, consumed_at
       FROM account_contact_change_challenges
       WHERE id = ? AND account_id = ? LIMIT 1`,
    ).bind(input.challengeId, input.accountId).first<Record<string, unknown>>();
    if (!challenge || challenge.consumed_at !== null || challenge.delivery_status !== "accepted" ||
        typeof challenge.expires_at !== "number" || challenge.expires_at <= now) {
      return fail("invalid_or_expired_code");
    }
    const attempts = Number(challenge.attempt_count);
    const maxAttempts = Number(challenge.max_attempts);
    if (attempts >= maxAttempts) return fail("too_many_attempts");
    if (challenge.channel !== "email" && challenge.channel !== "phone") return fail("invalid_or_expired_code");
    if (input.expectedChannel && challenge.channel !== input.expectedChannel) return fail("invalid_or_expired_code");

    const valid = await verifyEmailOtpDigest(
      cryptoProvider,
      env.EMAIL_OTP_HMAC_SECRET,
      input.challengeId,
      challenge.purpose as "account_email_change" | "account_phone_change",
      input.code,
      String(challenge.digest),
    );
    if (!valid) {
      await db.prepare(
        `UPDATE account_contact_change_challenges
         SET attempt_count = attempt_count + 1
         WHERE id = ? AND account_id = ? AND consumed_at IS NULL AND attempt_count < max_attempts`,
      ).bind(input.challengeId, input.accountId).run();
      return fail(attempts + 1 >= maxAttempts ? "too_many_attempts" : "invalid_or_expired_code");
    }

    channel = challenge.channel;
    const newValue = String(challenge.new_value);
    const identityId = String(challenge.identity_id);
    const statements: D1PreparedStatement[] = [
      db.prepare(
        `UPDATE account_contact_change_challenges
         SET consumed_at = ?, attempt_count = attempt_count + 1
         WHERE id = ? AND account_id = ? AND consumed_at IS NULL AND expires_at > ? AND attempt_count < max_attempts`,
      ).bind(now, input.challengeId, input.accountId, now),
      db.prepare(
        `UPDATE account_identities
         SET normalized_value = ?, verified_at = ?
         WHERE id = ? AND account_id = ? AND channel = ? AND is_primary = 1`,
      ).bind(newValue, channel === "email" ? now : null, identityId, input.accountId, channel),
      db.prepare(
        "UPDATE accounts SET updated_at = ? WHERE id = ? AND status = 'active'",
      ).bind(now, input.accountId),
      db.prepare(
        "DELETE FROM account_contact_change_challenges WHERE account_id = ? AND consumed_at IS NULL",
      ).bind(input.accountId),
    ];
    if (channel === "email") {
      statements.push(
        db.prepare(
          `UPDATE device_sessions SET status = 'revoked', revoked_at = ?
           WHERE account_id = ? AND id <> ? AND status = 'active'`,
        ).bind(now, input.accountId, input.currentSessionId),
        db.prepare(
          "DELETE FROM email_otp_challenges WHERE account_id = ? AND consumed_at IS NULL",
        ).bind(input.accountId),
      );
    }

    const results = await db.batch(statements);
    if (results.length !== statements.length || results.some((result) => !result.success) ||
        results[0]?.meta.changes !== 1 || results[1]?.meta.changes !== 1 || results[2]?.meta.changes !== 1) {
      return fail("invalid_or_expired_code");
    }
    await logAccountEvent(db, input.accountId, channel === "email" ? "email_changed" : "phone_changed", {}, now);
    return { ok: true, value: { channel, value: newValue } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE constraint failed")) return fail(channel === "email" ? "email_already_used" : "phone_already_used");
    return fail("storage_unavailable");
  }
}

export async function changeAccountPassword(
  db: ContactChangeDatabase,
  cryptoProvider: Crypto,
  input: {
    readonly accountId: string;
    readonly currentSessionId: string;
    readonly currentPassword: unknown;
    readonly newPassword: unknown;
    readonly now?: number;
  },
): Promise<ContactChangeResult<{ changed: true }>> {
  const now = input.now ?? Date.now();
  if (!validId(input.accountId) || !Number.isSafeInteger(now) || now <= 0) return fail("invalid_input");
  const rate = await consumeRateLimit(db, input.accountId, "password_change", 10, 60 * 60 * 1000, now);
  if (rate === "limited") return fail("rate_limited");
  if (rate === "unavailable") return fail("storage_unavailable");

  const credentials = await verifyCurrentPassword(db, input.accountId, input.currentPassword, cryptoProvider);
  if (!credentials.ok) return fail("invalid_credentials");
  const validation = validateAccountPassword(input.newPassword);
  if (!validation.ok) return fail("invalid_input");

  try {
    const newHash = await hashAccountPassword(cryptoProvider, input.newPassword as string);
    const results = await db.batch([
      db.prepare(
        "UPDATE accounts SET password_hash = ?, updated_at = ? WHERE id = ? AND status = 'active'",
      ).bind(newHash, now, input.accountId),
      db.prepare(
        `UPDATE device_sessions SET status = 'revoked', revoked_at = ?
         WHERE account_id = ? AND id <> ? AND status = 'active'`,
      ).bind(now, input.accountId, input.currentSessionId),
    ]);
    if (results.length !== 2 || results.some((result) => !result.success) || results[0]?.meta.changes !== 1) {
      return fail("storage_unavailable");
    }
    await logAccountEvent(db, input.accountId, "password_changed", {}, now);
    return { ok: true, value: { changed: true } };
  } catch {
    return fail("storage_unavailable");
  }
}
