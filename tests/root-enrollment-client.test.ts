import assert from "node:assert/strict";
import test from "node:test";
import {
  completeRootEnrollment,
  requestRootEnrollment,
  type RootEnrollmentCeremony,
} from "../src/services/device/root-enrollment.ts";
import type { WebAuthnCreationPort } from "../src/services/device/webauthn.ts";

const options = {
  challenge: "A".repeat(42) + "Q",
  rp: { id: "sac.example", name: "SAC" },
  user: { id: "AQIDBA", name: "SAC-account", displayName: "Compte SAC" },
  pubKeyCredParams: [{ type: "public-key" as const, alg: -7 as const }],
  timeout: 300_000,
  authenticatorSelection: {
    authenticatorAttachment: "platform" as const,
    residentKey: "discouraged" as const,
    requireResidentKey: false,
    userVerification: "required" as const,
  },
  attestation: "none" as const,
};
const ceremony: RootEnrollmentCeremony = {
  ceremonyId: "11111111-1111-4111-8111-111111111111",
  expiresAt: Date.now() + 60_000,
  options,
};

test("requests server-generated options without persisting a password in browser state", async () => {
  let requestBody = "";
  let requestInit: RequestInit | undefined;
  const result = await requestRootEnrollment("root@example.test", "correct horse battery", async (_url, init) => {
    requestInit = init;
    requestBody = String(init?.body);
    return new Response(JSON.stringify(ceremony), { status: 200 });
  });
  assert.equal(result.ceremonyId, ceremony.ceremonyId);
  assert.equal(requestInit?.credentials, "same-origin");
  assert.equal(requestInit?.cache, "no-store");
  assert.match(requestBody, /root@example\.test/);
  assert.match(requestBody, /correct horse battery/);
});

test("creates the platform credential from a user gesture then completes the server ceremony", async () => {
  let posted = "";
  const fakeResponse = {
    clientDataJSON: Uint8Array.of(1, 2, 3).buffer,
    attestationObject: Uint8Array.of(4, 5, 6).buffer,
    getTransports: () => ["internal"],
  };
  const credential = {
    type: "public-key",
    id: "AQID",
    rawId: Uint8Array.of(1, 2, 3).buffer,
    response: fakeResponse,
    authenticatorAttachment: "platform",
    getClientExtensionResults: () => ({}),
  } as unknown as Credential;
  const port: WebAuthnCreationPort = {
    isSecureContext: () => true,
    isSupported: () => true,
    create: async () => credential,
  };
  const result = await completeRootEnrollment(ceremony, async (_url, init) => {
    posted = String(init?.body);
    return new Response(JSON.stringify({
      enrolled: true,
      device: { id: "device-a", status: "active", credentialType: "singleDevice", backedUp: false },
      session: { id: "session-a", expiresAt: "2026-12-19T00:00:00.000Z" },
    }), { status: 201 });
  }, port);
  assert.equal(result.enrolled, true);
  assert.match(posted, /11111111-1111-4111-8111-111111111111/);
  assert.match(posted, /attestationObject/);
});

test("refuses an expired ceremony before invoking the authenticator", async () => {
  let called = false;
  const port: WebAuthnCreationPort = {
    isSecureContext: () => true,
    isSupported: () => true,
    create: async () => { called = true; return null; },
  };
  await assert.rejects(() => completeRootEnrollment({ ...ceremony, expiresAt: Date.now() - 1 }, fetch, port));
  assert.equal(called, false);
});
