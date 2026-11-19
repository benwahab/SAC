import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createSessionToken } from "../functions/lib/security/session-token.ts";
import { SESSION_COOKIE_NAME } from "../functions/lib/security/session-cookie.ts";
import test from "node:test";
import { onRequestPost as rootOptions } from "../functions/api/auth/root-enrollment-options.ts";
import { onRequestPost as completeRoot } from "../functions/api/auth/complete-root-enrollment.ts";
import { onRequestGet as currentSession } from "../functions/api/auth/session.ts";
import { onRequestPost as logout } from "../functions/api/auth/logout.ts";

const env = {
  DB: { prepare() { throw new Error("database_must_not_be_accessed"); } } as never,
  WEBAUTHN_RP_ID: "sac.example",
  WEBAUTHN_RP_NAME: "SAC",
  WEBAUTHN_ALLOWED_ORIGINS: '["https://sac.example"]',
  EMAIL_OTP_HMAC_SECRET: "x".repeat(32),
};

function post(path: string, body = "{}") {
  return new Request("https://sac.example/api/auth/" + path, {
    method: "POST",
    headers: { Origin: "https://sac.example", "Content-Type": "application/json" },
    body,
  });
}

test("root options rejects missing and untrusted origins before database access", async () => {
  const missing = new Request("https://sac.example/api/auth/root-enrollment-options", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  });
  const untrusted = new Request("https://sac.example/api/auth/root-enrollment-options", {
    method: "POST",
    headers: { Origin: "https://evil.sac.example", "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal((await rootOptions({ request: missing, env } as never)).status, 403);
  assert.equal((await rootOptions({ request: untrusted, env } as never)).status, 403);
});

test("root options rejects malformed input before database access", async () => {
  const response = await rootOptions({ request: post("root-enrollment-options", "{"), env } as never);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_request" });
});

test("root completion rejects malformed ceremony input before database access", async () => {
  const response = await completeRoot({ request: post("complete-root-enrollment", JSON.stringify({
    ceremonyId: "not-a-uuid", credential: {},
  })), env } as never);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_enrollment" });
});

test("session endpoint refuses missing cookies without touching D1", async () => {
  const response = await currentSession({
    request: new Request("https://sac.example/api/auth/session"), env,
  } as never);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { authenticated: false });
});

test("session endpoint respects persisted suspended account and revoked device states", async () => {
  const token = await createSessionToken(webcrypto as unknown as Crypto);
  const now = Date.now();
  const baseRow = {
    session_id: "session-a",
    account_id: "account-a",
    device_id: "device-a",
    token_hash: token.tokenHash,
    session_status: "active",
    session_auth_version: 1,
    created_at: now - 1000,
    last_activity_at: now - 1000,
    expires_at: now + 100000,
    revoked_at: null,
    account_status: "suspended",
    device_status: "active",
    current_device_auth_version: 1,
  };
  let updateCalled = false;
  const fakeEnv = {
    DB: {
      prepare() {
        return {
          bind() {
            return {
              async first() { return baseRow; },
              async run() { updateCalled = true; return { success: true, meta: { changes: 1 } }; },
            };
          },
        };
      },
    } as never,
  };
  const request = new Request("https://sac.example/api/auth/session", {
    headers: { Cookie: SESSION_COOKIE_NAME + "=" + token.token },
  });
  const response = await currentSession({ request, env: fakeEnv } as never);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { authenticated: false });
  assert.equal(updateCalled, false);

  baseRow.account_status = "active";
  baseRow.device_status = "revoked";
  const revokedDeviceResponse = await currentSession({ request, env: fakeEnv } as never);
  assert.equal(revokedDeviceResponse.status, 401);
  assert.equal(updateCalled, false);
});

test("logout is idempotent when no session cookie is present", async () => {
  const response = await logout({ request: post("logout"), env } as never);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { loggedOut: true });
  assert.match(response.headers.get("Set-Cookie") ?? "", /Max-Age=0/);
});
