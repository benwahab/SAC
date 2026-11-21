import assert from "node:assert/strict";
import test from "node:test";
import { sendBrevoTransactionalEmail } from "../functions/lib/email/brevo.ts";

test("utilise le mode de redirection accepté par Cloudflare Workers", async () => {
  let redirectMode: RequestRedirect | undefined;
  const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    redirectMode = init?.redirect;
    return new Response(JSON.stringify({ messageId: "message-1" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const result = await sendBrevoTransactionalEmail(
    {
      BREVO_API_KEY: "test-key",
      BREVO_FROM_EMAIL: "sender@example.com",
      BREVO_FROM_NAME: "SAC",
    },
    {
      recipientEmail: "recipient@example.com",
      subject: "Sujet",
      htmlContent: "<p>Message</p>",
    },
    fetcher,
  );

  assert.equal(redirectMode, "manual");
  assert.deepEqual(result, { ok: true, messageId: "message-1" });
});
