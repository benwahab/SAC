import assert from "node:assert/strict";
import test from "node:test";
import { startLogin } from "../src/services/device/login-flow.ts";

test("opens a password session directly on a new device", async () => {
  const urls: string[] = [];
  const result = await startLogin("user@example.test", "correct horse battery", async (input, init) => {
    urls.push(String(input));
    assert.equal(init?.credentials, "same-origin");
    assert.equal(init?.cache, "no-store");
    return new Response(JSON.stringify({
      authenticated: true,
      securityKeyConfigured: true,
      session: { id: "session-a", expiresAt: "2026-12-19T00:00:00.000Z" },
    }), { status: 201 });
  });

  assert.equal(result.kind, "session");
  assert.deepEqual(urls, ["/api/auth/password-session"]);
  if (result.kind === "session") assert.equal(result.session.session.id, "session-a");
});

test("falls back to WebAuthn only when the server explicitly requires the security key", async () => {
  const urls: string[] = [];
  let loginOptionsBody = "";
  const result = await startLogin("user@example.test", "correct horse battery", async (input, init) => {
    const url = String(input);
    urls.push(url);
    if (url === "/api/auth/password-session") {
      return new Response(JSON.stringify({ error: "security_key_required" }), { status: 409 });
    }
    loginOptionsBody = String(init?.body);
    return new Response(JSON.stringify({
      challengeId: "11111111-1111-4111-8111-111111111111",
      expiresAt: Date.now() + 60_000,
      publicKey: {
        challenge: "A".repeat(42) + "Q",
        rpId: "sac.example",
        timeout: 300_000,
        userVerification: "required",
        allowCredentials: [{ type: "public-key", id: "credential-a" }],
      },
    }), { status: 200 });
  });

  assert.equal(result.kind, "security_key");
  assert.deepEqual(urls, ["/api/auth/password-session", "/api/auth/login-options"]);
  assert.match(loginOptionsBody, /user@example\.test/);
  assert.match(loginOptionsBody, /correct horse battery/);
  if (result.kind === "security_key") assert.equal(result.ceremony.challengeId, "11111111-1111-4111-8111-111111111111");
});

test("does not invoke WebAuthn when the password is rejected", async () => {
  const urls: string[] = [];
  await assert.rejects(
    () => startLogin("user@example.test", "wrong password", async (input) => {
      urls.push(String(input));
      return new Response(JSON.stringify({ error: "invalid_credentials" }), { status: 401 });
    }),
    /invalid_credentials/,
  );
  assert.deepEqual(urls, ["/api/auth/password-session"]);
});
