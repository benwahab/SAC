import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import { onRequestPost as loginOptions } from "../functions/api/auth/login-options.ts";
import { hashAccountPassword } from "../functions/lib/security/password-hash.ts";

const origin = "https://sac.example";
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request(origin + "/api/auth/login-options", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("login options rejects cross-origin requests before touching D1", async () => {
  const env = { DB: { prepare() { throw new Error("D1 must not be accessed"); } }, WEBAUTHN_RP_ID: "sac.example", WEBAUTHN_ALLOWED_ORIGINS: JSON.stringify([origin]), EMAIL_OTP_HMAC_SECRET: "s".repeat(32) };
  const response = await loginOptions({ request: request({}, { Origin: "https://attacker.example" }), env } as never);
  assert.equal(response.status, 403);
});

test("login options directs a verified account without a root device to first-device enrollment", async () => {
  const password = "phrase de passe de test SAC 2026";
  const passwordHash = await hashAccountPassword(webcrypto as unknown as Crypto, password);
  const account = { id: "123e4567-e89b-42d3-a456-426614174000", status: "active", password_hash: passwordHash, device_id: null, device_status: null, credential_id: null };
  const db = {
    prepare(sql: string) {
      return {
        bind() {
          return {
            async run() { return { success: true, meta: { changes: 1 } }; },
            async first() {
              if (sql.includes("SELECT attempt_count")) return { attempt_count: 1 };
              if (sql.includes("SELECT a.id")) return account;
              throw new Error("Unexpected D1 query");
            },
          };
        },
      };
    },
  };
  const env = { DB: db, WEBAUTHN_RP_ID: "sac.example", WEBAUTHN_ALLOWED_ORIGINS: JSON.stringify([origin]), EMAIL_OTP_HMAC_SECRET: "s".repeat(32) };
  const response = await loginOptions({ request: request({ email: "root@example.test", password }), env } as never);
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "root_enrollment_required" });
});

test("login options does not disclose first-device state for an invalid password", async () => {
  const passwordHash = await hashAccountPassword(webcrypto as unknown as Crypto, "correct password for SAC");
  const account = { id: "123e4567-e89b-42d3-a456-426614174000", status: "active", password_hash: passwordHash, device_id: null, device_status: null, credential_id: null };
  const db = {
    prepare(sql: string) {
      return { bind() { return {
        async run() { return { success: true, meta: { changes: 1 } }; },
        async first() { return sql.includes("SELECT attempt_count") ? { attempt_count: 1 } : account; },
      }; } };
    },
  };
  const env = { DB: db, WEBAUTHN_RP_ID: "sac.example", WEBAUTHN_ALLOWED_ORIGINS: JSON.stringify([origin]), EMAIL_OTP_HMAC_SECRET: "s".repeat(32) };
  const response = await loginOptions({ request: request({ email: "root@example.test", password: "wrong password" }), env } as never);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "invalid_credentials" });
});
