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
    { ok: false, reason: "invalid_recipient" },
  );
});
