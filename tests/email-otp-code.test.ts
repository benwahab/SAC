import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import {
  digestEmailOtp,
  generateEmailOtpCode,
} from "../functions/lib/security/email-otp-code.ts";

const cryptoProvider = webcrypto as unknown as Crypto;
const secret = "sac-test-only-secret-with-at-least-32-characters";

function randomFrom(values: number[]): Pick<Crypto, "getRandomValues"> {
  let index = 0;
  return {
    getRandomValues<T extends ArrayBufferView | null>(array: T): T {
      if (!(array instanceof Uint32Array)) throw new Error("unexpected_random_array");
      if (index >= values.length) throw new Error("random_values_exhausted");
      array[0] = values[index++];
      return array as T;
    },
  };
}

test("génère exactement six chiffres et conserve les zéros initiaux", () => {
  assert.equal(generateEmailOtpCode(randomFrom([123])), "000123");
});

test("rejette la zone de modulo biaisée avant de générer le code", () => {
  assert.equal(generateEmailOtpCode(randomFrom([0xffffffff, 42])), "000042");
});

test("produit une empreinte HMAC-SHA-256 de 64 caractères hexadécimaux", async () => {
  const digest = await digestEmailOtp(
    cryptoProvider,
    secret,
    "challenge-123",
    "account_email_verification",
    "004219",
  );
  assert.match(digest, /^[a-f0-9]{64}$/);
});

test("lie l'empreinte au défi et au secret, pas seulement au code", async () => {
  const first = await digestEmailOtp(cryptoProvider, secret, "challenge-a", "account_email_verification", "004219");
  const otherChallenge = await digestEmailOtp(cryptoProvider, secret, "challenge-b", "account_email_verification", "004219");
  const otherSecret = await digestEmailOtp(cryptoProvider, secret + "-rotated", "challenge-a", "account_email_verification", "004219");
  assert.notEqual(first, otherChallenge);
  assert.notEqual(first, otherSecret);
});

test("refuse un secret trop court, un défi invalide et un code mal formé", async () => {
  await assert.rejects(
    digestEmailOtp(cryptoProvider, "short", "challenge-a", "account_email_verification", "004219"),
    /otp_secret_not_configured/,
  );
  await assert.rejects(
    digestEmailOtp(cryptoProvider, secret, "", "account_email_verification", "004219"),
    /invalid_challenge_id/,
  );
  await assert.rejects(
    digestEmailOtp(cryptoProvider, secret, "challenge-a", "account_email_verification", "4219"),
    /invalid_otp_code/,
  );
});
