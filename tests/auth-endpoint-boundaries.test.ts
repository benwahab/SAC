import assert from "node:assert/strict";
import test from "node:test";
import { onRequestPost as register } from "../functions/api/auth/register.ts";
import { onRequestPost as verifyEmail } from "../functions/api/auth/verify-email.ts";
import { onRequestPost as resendEmail } from "../functions/api/auth/resend-email.ts";

const env = {
  DB: {
    prepare() {
      throw new Error("database_must_not_be_accessed_for_invalid_input");
    },
  } as never,
  EMAIL_OTP_HMAC_SECRET: "x".repeat(32),
  BREVO_API_KEY: "test-only",
  BREVO_FROM_EMAIL: "noreply@sac.example",
  BREVO_FROM_NAME: "SAC",
};

function jsonRequest(path: string, body: string): Request {
  return new Request(`https://sac.example/api/auth/${path}`, {
    method: "POST",
    headers: {
      Origin: "https://sac.example",
      "Content-Type": "application/json; charset=utf-8",
    },
    body,
  });
}

async function invoke(
  handler: (context: never) => Promise<Response>,
  request: Request,
): Promise<Response> {
  return handler({ request, env } as never);
}

test("verify-email rejects malformed identity and OTP before database access", async () => {
  for (const body of [
    JSON.stringify({ email: "not-an-email", code: "123456" }),
    JSON.stringify({ email: "person@example.com", code: "１２３４５６" }),
    JSON.stringify({ email: "person@example.com", code: "12345x" }),
    JSON.stringify({ email: "person@example.com", code: "1234567" }),
  ]) {
    const response = await invoke(verifyEmail as never, jsonRequest("verify-email", body));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "invalid_or_expired_code" });
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
});

test("verify-email selects only the current, delivered, unconsumed OTP challenge", async () => {
  let selection = "";
  const selectionEnv = {
    ...env,
    DB: {
      prepare(sql: string) {
        selection = sql;
        return {
          bind() {
            return { async first() { return null; } };
          },
        };
      },
    } as never,
  };
  const request = jsonRequest("verify-email", JSON.stringify({
    email: "person@example.com",
    code: "123456",
  }));
  const response = await (verifyEmail as never)({ request, env: selectionEnv } as never);
  assert.equal(response.status, 400);
  assert.match(selection, /latest\.purpose = 'account_email_verification'/);
  assert.match(selection, /latest\.delivery_status = 'accepted'/);
  assert.match(selection, /i\.is_primary = 1/);
  assert.match(selection, /latest\.invalidated_at IS NULL/);
  assert.match(selection, /latest\.consumed_at IS NULL/);
});

test("verify-email rejects oversized payloads before database access", async () => {
  const body = JSON.stringify({
    email: "person@example.com",
    code: "123456",
    padding: "x".repeat(9_000),
  });
  const response = await invoke(verifyEmail as never, jsonRequest("verify-email", body));
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "request_too_large" });
});

test("register rejects invalid email, phone, password and language before database access", async () => {
  const valid = {
    email: "person@example.com",
    phone: "+22790000000",
    password: "une phrase de passe assez longue",
    language: "fr",
  };
  const invalidInputs = [
    { ...valid, email: "invalid" },
    { ...valid, phone: "90000000" },
    { ...valid, password: "court" },
    { ...valid, language: "toString" },
  ];

  for (const input of invalidInputs) {
    const response = await invoke(register as never, jsonRequest("register", JSON.stringify(input)));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
});

test("register rejects malformed JSON before database access", async () => {
  const response = await invoke(register as never, jsonRequest("register", "{"));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_request" });
});

test("all public authentication endpoints reject cross-origin requests before database access", async () => {
  const handlers = [
    ["register", register],
    ["verify-email", verifyEmail],
    ["resend-email", resendEmail],
  ] as const;

  for (const [path, handler] of handlers) {
    const request = new Request(`https://sac.example/api/auth/${path}`, {
      method: "POST",
      headers: {
        Origin: "https://attacker.example",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const response = await invoke(handler as never, request);
    assert.equal(response.status, 403, path);
    assert.equal(response.headers.get("Cache-Control"), "no-store", path);
  }
});

test("resend-email rejects malformed email before database access", async () => {
  const response = await invoke(
    resendEmail as never,
    jsonRequest("resend-email", JSON.stringify({ email: "not-an-email" })),
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_email" });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});


test("all public authentication endpoints reject missing Origin before database access", async () => {
  const handlers = [
    ["register", register],
    ["verify-email", verifyEmail],
    ["resend-email", resendEmail],
  ] as const;

  for (const [path, handler] of handlers) {
    const request = new Request(`https://sac.example/api/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const response = await invoke(handler as never, request);
    assert.equal(response.status, 403, path);
    assert.equal(response.headers.get("Cache-Control"), "no-store", path);
  }
});

test("all public authentication endpoints reject non-JSON content types before database access", async () => {
  const handlers = [
    ["register", register],
    ["verify-email", verifyEmail],
    ["resend-email", resendEmail],
  ] as const;

  for (const [path, handler] of handlers) {
    const request = new Request(`https://sac.example/api/auth/${path}`, {
      method: "POST",
      headers: {
        Origin: "https://sac.example",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "email=person%40example.com",
    });
    const response = await invoke(handler as never, request);
    assert.equal(response.status, 415, path);
    assert.equal(response.headers.get("Cache-Control"), "no-store", path);
  }
});

test("all public authentication endpoints reject methods other than POST", async () => {
  const handlers = [
    ["register", register],
    ["verify-email", verifyEmail],
    ["resend-email", resendEmail],
  ] as const;

  for (const [path, handler] of handlers) {
    const request = new Request(`https://sac.example/api/auth/${path}`, {
      method: "GET",
      headers: {
        Origin: "https://sac.example",
        "Content-Type": "application/json",
      },
    });
    const response = await invoke(handler as never, request);
    assert.equal(response.status, 405, path);
    assert.equal(response.headers.get("Cache-Control"), "no-store", path);
  }
});


test("register returns the same generic response when database uniqueness rejects an existing identity", async () => {
  const duplicateEnv = {
    ...env,
    DB: {
      prepare() {
        return { bind() { return {}; } };
      },
      async batch() {
        throw new Error("UNIQUE constraint failed: account_identities.channel, account_identities.normalized_value");
      },
    } as never,
  };
  const request = jsonRequest("register", JSON.stringify({
    email: "person@example.com",
    phone: "+22790000000",
    password: "une phrase de passe assez longue",
    language: "fr",
  }));
  const response = await (register as never)({ request, env: duplicateEnv } as never);
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    accepted: true,
    message: "Si cette adresse est éligible, vous recevrez les instructions de vérification.",
    retryAfterSeconds: 60,
  });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});
