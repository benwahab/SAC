import assert from "node:assert/strict";
import test from "node:test";
import { sendContactInvitationEmail } from "../functions/lib/email/contact-invitation.ts";

const baseEnv = {
  RESEND_API_KEY: "test-api-key",
  RESEND_FROM_EMAIL: "SAC <noreply@example.ne>",
  APP_BASE_URL: "https://sac.example.ne",
};

const invitation = {
  recipientEmail: " Person@Example.ne ",
  invitationId: "123e4567-e89b-42d3-a456-426614174000",
  token: "A".repeat(43),
  expiresAt: Date.now() + 60_000,
  language: "fr" as const,
};

test("trusted contact email sends a one-time HTTPS invitation link", async () => {
  let requestBody: Record<string, unknown> | undefined;
  const result = await sendContactInvitationEmail(baseEnv, invitation, async (input, init) => {
    assert.equal(String(input), "https://api.resend.com/emails");
    assert.equal(init?.method, "POST");
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({ id: "email-message-1" }, { status: 200 });
  });

  assert.deepEqual(result, { ok: true, messageId: "email-message-1" });
  assert.deepEqual(requestBody?.to, ["person@example.ne"]);
  assert.equal(requestBody?.from, baseEnv.RESEND_FROM_EMAIL);
  assert.match(String(requestBody?.html), /https:\/\/sac\.example\.ne\/invitation\/accept/);
  assert.match(String(requestBody?.html), /A{43}/);
});

test("missing provider configuration never attempts delivery", async () => {
  let called = false;
  const result = await sendContactInvitationEmail(
    { ...baseEnv, RESEND_API_KEY: undefined },
    invitation,
    async () => { called = true; return Response.json({ id: "unexpected" }); },
  );
  assert.deepEqual(result, { ok: false, reason: "provider_not_configured" });
  assert.equal(called, false);
});

test("non-HTTPS or path-bearing application base URL is rejected", async () => {
  let called = false;
  const result = await sendContactInvitationEmail(
    { ...baseEnv, APP_BASE_URL: "http://sac.example.ne/path" },
    invitation,
    async () => { called = true; return Response.json({ id: "unexpected" }); },
  );
  assert.deepEqual(result, { ok: false, reason: "invalid_invitation" });
  assert.equal(called, false);
});

test("invalid token and expired invitation are rejected before delivery", async () => {
  let called = false;
  const invalidToken = await sendContactInvitationEmail(
    baseEnv,
    { ...invitation, token: "short" },
    async () => { called = true; return Response.json({ id: "unexpected" }); },
  );
  assert.deepEqual(invalidToken, { ok: false, reason: "invalid_invitation" });

  const expired = await sendContactInvitationEmail(
    baseEnv,
    { ...invitation, expiresAt: Date.now() - 1 },
    async () => { called = true; return Response.json({ id: "unexpected" }); },
  );
  assert.deepEqual(expired, { ok: false, reason: "invalid_invitation" });
  assert.equal(called, false);
});

test("provider rejection and transport failure are reported without leaking details", async () => {
  const rejected = await sendContactInvitationEmail(
    baseEnv,
    invitation,
    async () => new Response("secret provider response", { status: 401 }),
  );
  assert.deepEqual(rejected, { ok: false, reason: "provider_rejected" });

  const unavailable = await sendContactInvitationEmail(
    baseEnv,
    invitation,
    async () => { throw new Error("secret transport detail"); },
  );
  assert.deepEqual(unavailable, { ok: false, reason: "provider_unavailable" });
});
