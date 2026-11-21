import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet as listSessions } from "../functions/api/auth/sessions.ts";
import { onRequestPost as revokeSession } from "../functions/api/auth/revoke-session.ts";

const env = {
  DB: { prepare() { throw new Error("database_must_not_be_accessed"); } } as never,
};

test("session list requires an authenticated device session", async () => {
  const response = await listSessions({
    request: new Request("https://sac.example/api/auth/sessions"),
    env,
  } as never);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "authentication_required" });
});

test("session revocation rejects a cross-origin request before database access", async () => {
  const response = await revokeSession({
    request: new Request("https://sac.example/api/auth/revoke-session", {
      method: "POST",
      headers: {
        Origin: "https://attacker.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId: "123e4567-e89b-42d3-a456-426614174000" }),
    }),
    env,
  } as never);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "cross_origin_request" });
});

test("session revocation requires same-origin JSON and an authenticated session", async () => {
  const response = await revokeSession({
    request: new Request("https://sac.example/api/auth/revoke-session", {
      method: "POST",
      headers: {
        Origin: "https://sac.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId: "123e4567-e89b-42d3-a456-426614174000" }),
    }),
    env,
  } as never);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "authentication_required" });
});
