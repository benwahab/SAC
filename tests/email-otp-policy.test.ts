import assert from "node:assert/strict";
import test from "node:test";
import {
  EMAIL_OTP_MAX_ATTEMPTS,
  EMAIL_OTP_RESEND_COOLDOWN_MS,
  EMAIL_OTP_TTL_MS,
  evaluateEmailOtpChallenge,
  evaluateEmailOtpResend,
} from "../src/domain/email-otp-policy.ts";

const createdAt = "2026-11-18T12:00:00.000Z";

test("les paramètres OTP correspondent aux décisions validées", () => {
  assert.equal(EMAIL_OTP_TTL_MS, 10 * 60 * 1000);
  assert.equal(EMAIL_OTP_MAX_ATTEMPTS, 6);
  assert.equal(EMAIL_OTP_RESEND_COOLDOWN_MS, 60 * 1000);
});

test("un défi est valide pendant les dix premières minutes", () => {
  assert.deepEqual(evaluateEmailOtpChallenge({
    createdAt,
    failedAttempts: 0,
  }, "2026-11-18T12:09:59.999Z"), {
    ok: true,
    expiresAt: "2026-11-18T12:10:00.000Z",
    attemptsRemaining: 6,
  });
});

test("un défi expire exactement à dix minutes", () => {
  assert.deepEqual(evaluateEmailOtpChallenge({
    createdAt,
    failedAttempts: 0,
  }, "2026-11-18T12:10:00.000Z"), {
    ok: false,
    error: "challenge_expired",
  });
});

test("six échecs épuisent le défi", () => {
  assert.deepEqual(evaluateEmailOtpChallenge({
    createdAt,
    failedAttempts: 5,
  }, "2026-11-18T12:01:00.000Z"), {
    ok: true,
    expiresAt: "2026-11-18T12:10:00.000Z",
    attemptsRemaining: 1,
  });
  assert.deepEqual(evaluateEmailOtpChallenge({
    createdAt,
    failedAttempts: 6,
  }, "2026-11-18T12:01:00.000Z"), {
    ok: false,
    error: "challenge_attempts_exhausted",
  });
});

test("un défi consommé ou invalidé ne peut plus être utilisé", () => {
  assert.deepEqual(evaluateEmailOtpChallenge({
    createdAt,
    failedAttempts: 0,
    consumedAt: "2026-11-18T12:01:00.000Z",
  }, "2026-11-18T12:02:00.000Z"), {
    ok: false,
    error: "challenge_consumed",
  });
  assert.deepEqual(evaluateEmailOtpChallenge({
    createdAt,
    failedAttempts: 0,
    invalidatedAt: "2026-11-18T12:01:00.000Z",
  }, "2026-11-18T12:02:00.000Z"), {
    ok: false,
    error: "challenge_invalidated",
  });
});

test("dates incohérentes et compteurs invalides sont refusés", () => {
  assert.deepEqual(evaluateEmailOtpChallenge({
    createdAt,
    failedAttempts: -1,
  }, "2026-11-18T12:02:00.000Z"), {
    ok: false,
    error: "invalid_challenge",
  });
  assert.deepEqual(evaluateEmailOtpChallenge({
    createdAt,
    failedAttempts: 0,
  }, "2026-11-18T11:59:59.000Z"), {
    ok: false,
    error: "invalid_challenge",
  });
});

test("le renvoi est bloqué avant 60 secondes puis autorisé à 60 secondes", () => {
  assert.deepEqual(evaluateEmailOtpResend(
    createdAt,
    "2026-11-18T12:00:59.999Z",
  ), { ok: false, error: "resend_cooldown" });
  assert.deepEqual(evaluateEmailOtpResend(
    createdAt,
    "2026-11-18T12:01:00.000Z",
  ), { ok: true });
});

test("les horodatages de renvoi invalides sont refusés", () => {
  assert.deepEqual(evaluateEmailOtpResend(
    createdAt,
    "2026-11-18T11:59:59.000Z",
  ), { ok: false, error: "invalid_timestamps" });
});
