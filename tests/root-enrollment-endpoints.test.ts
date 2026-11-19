import assert from "node:assert/strict";
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

test("logout is idempotent when no session cookie is present", async () => {
  const response = await logout({ request: post("logout"), env } as never);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { loggedOut: true });
  assert.match(response.headers.get("Set-Cookie") ?? "", /Max-Age=0/);
});
