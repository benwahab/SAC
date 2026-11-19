import assert from "node:assert/strict";
import test from "node:test";
import {
  createRootWebAuthnCredential,
  decodeBase64Url,
  normalizeRootCreationOptions,
  type RootCredentialCreationOptionsJSON,
  type WebAuthnCreationPort,
} from "../src/services/device/webauthn.ts";

function b64url(bytes: number[]): string {
  return Buffer.from(bytes).toString("base64url");
}

function options(): RootCredentialCreationOptionsJSON {
  return {
    challenge: b64url(Array.from({ length: 32 }, (_, index) => index)),
    rp: { id: "sac.example", name: "SAC" },
    user: {
      id: b64url([1, 2, 3, 4, 5, 6, 7, 8]),
      name: "account-reference",
      displayName: "Compte SAC",
    },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
      residentKey: "discouraged",
    },
    attestation: "none",
    excludeCredentials: [{
      type: "public-key",
      id: b64url([9, 8, 7, 6]),
      transports: ["internal"],
    }],
  };
}

function fakeCredential(): Credential {
  const response = {
    clientDataJSON: Uint8Array.from([10, 11, 12]).buffer,
    attestationObject: Uint8Array.from([13, 14, 15, 16]).buffer,
    getTransports: () => ["internal"],
  };
  return {
    id: "credential-id",
    rawId: Uint8Array.from([1, 2, 3]).buffer,
    type: "public-key",
    response,
    getClientExtensionResults: () => ({}),
    authenticatorAttachment: "platform",
  } as unknown as Credential;
}

test("decodeBase64Url accepts canonical unpadded values and rejects malformed encodings", () => {
  assert.deepEqual([...decodeBase64Url("AQIDBA", "test")], [1, 2, 3, 4]);
  assert.deepEqual([...decodeBase64Url("-___", "test")], [251, 255, 255]);
  for (const value of ["", "AQID=", "AQ+/", "A", "AQI!"]) {
    assert.throws(() => decodeBase64Url(value, "test"));
  }
});

test("normalizes server options without overriding the selected resident-key policy", () => {
  const normalized = normalizeRootCreationOptions(options());
  assert.ok(normalized.challenge instanceof ArrayBuffer);
  assert.ok(normalized.user.id instanceof ArrayBuffer);
  assert.ok(normalized.excludeCredentials?.[0].id instanceof ArrayBuffer);
  assert.equal(normalized.authenticatorSelection?.authenticatorAttachment, "platform");
  assert.equal(normalized.authenticatorSelection?.userVerification, "required");
  assert.equal(normalized.authenticatorSelection?.residentKey, "discouraged");
});

test("rejects root options that do not require platform authentication and user verification", () => {
  const wrongAttachment = options();
  wrongAttachment.authenticatorSelection = {
    authenticatorAttachment: "cross-platform",
    userVerification: "required",
  };
  assert.throws(() => normalizeRootCreationOptions(wrongAttachment));

  const wrongVerification = options();
  wrongVerification.authenticatorSelection = {
    authenticatorAttachment: "platform",
    userVerification: "preferred",
  };
  assert.throws(() => normalizeRootCreationOptions(wrongVerification));

  const shortChallenge = options();
  shortChallenge.challenge = b64url([1, 2, 3]);
  assert.throws(() => normalizeRootCreationOptions(shortChallenge));
});

test("rejects non-SAC algorithms and attestation profiles", () => {
  const wrongAlgorithm = options();
  wrongAlgorithm.pubKeyCredParams = [{ type: "public-key", alg: -257 }];
  assert.throws(() => normalizeRootCreationOptions(wrongAlgorithm));

  const extraAlgorithm = options();
  extraAlgorithm.pubKeyCredParams = [
    { type: "public-key", alg: -7 },
    { type: "public-key", alg: -257 },
  ];
  assert.throws(() => normalizeRootCreationOptions(extraAlgorithm));

  const wrongAttestation = options();
  wrongAttestation.attestation = "direct";
  assert.throws(() => normalizeRootCreationOptions(wrongAttestation));
});

test("creates and serializes a platform credential while leaving verification to the server", async () => {
  let received: PublicKeyCredentialCreationOptions | undefined;
  const port: WebAuthnCreationPort = {
    isSecureContext: () => true,
    isSupported: () => true,
    create: async (value) => {
      received = value;
      return fakeCredential();
    },
  };

  const result = await createRootWebAuthnCredential(options(), port);
  assert.ok(received);
  assert.ok(received.challenge instanceof ArrayBuffer);
  assert.equal(received.authenticatorSelection?.userVerification, "required");
  assert.equal(result.id, "credential-id");
  assert.equal(result.rawId, "AQID");
  assert.equal(result.response.clientDataJSON, "CgsM");
  assert.equal(result.response.attestationObject, "DQ4PEA");
  assert.deepEqual(result.response.transports, ["internal"]);
  assert.equal(result.authenticatorAttachment, "platform");
});

test("reports user cancellation and rejects a malformed browser response", async () => {
  const cancelledByUser: WebAuthnCreationPort = {
    isSecureContext: () => true,
    isSupported: () => true,
    create: async () => { throw new DOMException("cancelled", "NotAllowedError"); },
  };
  await assert.rejects(
    createRootWebAuthnCredential(options(), cancelledByUser),
    /annulée ou refusée/,
  );

  const malformed: WebAuthnCreationPort = {
    isSecureContext: () => true,
    isSupported: () => true,
    create: async () => ({
      id: "credential-id",
      rawId: Uint8Array.from([1]).buffer,
      type: "public-key",
      response: { clientDataJSON: Uint8Array.from([2]).buffer },
    } as unknown as Credential),
  };
  await assert.rejects(
    createRootWebAuthnCredential(options(), malformed),
    /ne contient pas de preuve d'enregistrement/,
  );
});

test("fails closed when the browser is insecure, unsupported or returns no credential", async () => {
  const insecure: WebAuthnCreationPort = {
    isSecureContext: () => false,
    isSupported: () => true,
    create: async () => fakeCredential(),
  };
  await assert.rejects(createRootWebAuthnCredential(options(), insecure), /HTTPS/);

  const unsupported: WebAuthnCreationPort = {
    isSecureContext: () => true,
    isSupported: () => false,
    create: async () => fakeCredential(),
  };
  await assert.rejects(createRootWebAuthnCredential(options(), unsupported), /ne prend pas en charge/);

  const cancelled: WebAuthnCreationPort = {
    isSecureContext: () => true,
    isSupported: () => true,
    create: async () => null,
  };
  await assert.rejects(createRootWebAuthnCredential(options(), cancelled), /Aucune credential/);
});
