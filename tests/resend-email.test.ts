import assert from "node:assert/strict";
import test from "node:test";
import { sendAccountVerificationCode } from "../functions/lib/email/resend.ts";

test("l'envoi e-mail refuse explicitement une configuration absente", async () => {
  assert.deepEqual(
    await sendAccountVerificationCode({}, "person@example.com", "123456", "fr"),
    { ok: false, reason: "provider_not_configured" },
  );
});

test("une adresse invalide est rejetée avant tout appel fournisseur", async () => {
  assert.deepEqual(
    await sendAccountVerificationCode(
      { RESEND_API_KEY: "test-key", RESEND_FROM_EMAIL: "SAC <noreply@example.com>" },
      "adresse-invalide",
      "123456",
      "fr",
    ),
    { ok: false, reason: "invalid_recipient" },
  );
});

test("un code vide est rejeté avant tout appel fournisseur", async () => {
  assert.deepEqual(
    await sendAccountVerificationCode(
      { RESEND_API_KEY: "test-key", RESEND_FROM_EMAIL: "SAC <noreply@example.com>" },
      "person@example.com",
      "",
      "fr",
    ),
    { ok: false, reason: "invalid_code" },
  );
});


test("envoie le code à Resend et ne considère le résultat réussi qu'avec un identifiant", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify({ id: "resend-message-123" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const result = await sendAccountVerificationCode(
      { RESEND_API_KEY: "test-api-key", RESEND_FROM_EMAIL: "SAC <noreply@example.com>" },
      "person@example.com",
      "004219",
      "fr",
    );
    assert.deepEqual(result, { ok: true, messageId: "resend-message-123" });
    assert.equal(requestUrl, "https://api.resend.com/emails");
    assert.equal(requestInit?.method, "POST");
    const headers = new Headers(requestInit?.headers);
    assert.equal(headers.get("Authorization"), "Bearer test-api-key");
    const body = JSON.parse(String(requestInit?.body)) as {
      to: string[];
      html: string;
      subject: string;
    };
    assert.deepEqual(body.to, ["person@example.com"]);
    assert.match(body.html, /004219/);
    assert.match(body.subject, /SAC/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("un refus HTTP du fournisseur n'est jamais présenté comme un envoi réussi", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("rejected", { status: 429 })) as typeof fetch;
  try {
    assert.deepEqual(
      await sendAccountVerificationCode(
        { RESEND_API_KEY: "test-api-key", RESEND_FROM_EMAIL: "SAC <noreply@example.com>" },
        "person@example.com",
        "123456",
        "fr",
      ),
      { ok: false, reason: "provider_rejected" },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("une réponse 2xx sans identifiant fournisseur reste un résultat non confirmé", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("{}", { status: 200 })) as typeof fetch;
  try {
    assert.deepEqual(
      await sendAccountVerificationCode(
        { RESEND_API_KEY: "test-api-key", RESEND_FROM_EMAIL: "SAC <noreply@example.com>" },
        "person@example.com",
        "123456",
        "fr",
      ),
      { ok: false, reason: "provider_rejected" },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("un code OTP qui ne contient pas exactement six chiffres est rejeté avant l'appel fournisseur", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response(JSON.stringify({ id: "unexpected" }), { status: 200 });
  }) as typeof fetch;

  try {
    for (const code of ["12345", "1234567", "12a456", "１２３４５６", ""]) {
      assert.deepEqual(
        await sendAccountVerificationCode(
          { RESEND_API_KEY: "test-api-key", RESEND_FROM_EMAIL: "SAC <noreply@example.com>" },
          "person@example.com",
          code,
          "fr",
        ),
        { ok: false, reason: "invalid_code" },
      );
    }
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("une langue inconnue est rejetée sans appel fournisseur", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response(JSON.stringify({ id: "unexpected" }), { status: 200 });
  }) as typeof fetch;

  try {
    assert.deepEqual(
      await sendAccountVerificationCode(
        { RESEND_API_KEY: "test-api-key", RESEND_FROM_EMAIL: "SAC <noreply@example.com>" },
        "person@example.com",
        "004219",
        "de" as "fr",
      ),
      { ok: false, reason: "invalid_language" },
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
