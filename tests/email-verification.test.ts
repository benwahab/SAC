import assert from "node:assert/strict";
import test from "node:test";
import { sendAccountVerificationCode } from "../functions/lib/email/verification.ts";

const env = { BREVO_API_KEY: "test-api-key", BREVO_FROM_EMAIL: "noreply@example.ne", BREVO_FROM_NAME: "SAC" };

test("l'envoi refuse une configuration fournisseur absente", async () => {
  assert.deepEqual(await sendAccountVerificationCode({}, "person@example.ne", "123456", "fr"), { ok: false, reason: "provider_not_configured" });
});

test("rejette les adresses et codes invalides sans appeler Brevo", async () => {
  let called = false;
  const fetcher = async () => { called = true; return Response.json({ messageId: "unexpected" }, { status: 201 }); };
  assert.deepEqual(await sendAccountVerificationCode(env, "invalid", "123456", "fr", fetcher), { ok: false, reason: "invalid_recipient" });
  assert.deepEqual(await sendAccountVerificationCode(env, "person@example.ne", "12x456", "fr", fetcher), { ok: false, reason: "invalid_code" });
  assert.equal(called, false);
});

test("envoie le code via l'API transactionnelle Brevo et exige un messageId", async () => {
  let url = "";
  let init: RequestInit | undefined;
  const result = await sendAccountVerificationCode(env, "Person@example.ne", "004219", "fr", async (input, options) => {
    url = String(input); init = options;
    return Response.json({ messageId: "brevo-message-123" }, { status: 201 });
  });
  assert.deepEqual(result, { ok: true, messageId: "brevo-message-123" });
  assert.equal(url, "https://api.brevo.com/v3/smtp/email");
  assert.equal(init?.method, "POST");
  const headers = new Headers(init?.headers);
  assert.equal(headers.get("api-key"), "test-api-key");
  const body = JSON.parse(String(init?.body));
  assert.deepEqual(body.sender, { email: env.BREVO_FROM_EMAIL, name: env.BREVO_FROM_NAME });
  assert.deepEqual(body.to, [{ email: "person@example.ne" }]);
  assert.match(body.htmlContent, /004219/);
  assert.match(body.subject, /SAC/);
});

test("refus HTTP et réponse 2xx sans messageId ne sont pas des succès", async () => {
  assert.deepEqual(await sendAccountVerificationCode(env, "person@example.ne", "123456", "fr", async () => new Response("no", { status: 401 })), { ok: false, reason: "provider_rejected" });
  assert.deepEqual(await sendAccountVerificationCode(env, "person@example.ne", "123456", "fr", async () => Response.json({}, { status: 201 })), { ok: false, reason: "provider_rejected" });
});

test("timeout et erreur transport sont bornés et non divulgués", async () => {
  assert.deepEqual(await sendAccountVerificationCode(env, "person@example.ne", "123456", "fr", async () => { throw new Error("private transport"); }), { ok: false, reason: "provider_unavailable" });
});

test("langue non prise en charge est rejetée", async () => {
  let called = false;
  const result = await sendAccountVerificationCode(env, "person@example.ne", "123456", "de" as "fr", async () => { called = true; return Response.json({ messageId: "x" }, { status: 201 }); });
  assert.deepEqual(result, { ok: false, reason: "invalid_language" });
  assert.equal(called, false);
});
