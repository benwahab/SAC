import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import {
  createRootRegistrationOptions,
  type RootRegistrationOptionsInput,
} from "../functions/lib/security/webauthn-root-options.ts";

const random = webcrypto as unknown as Crypto;

function input(overrides: Partial<RootRegistrationOptionsInput> = {}): RootRegistrationOptionsInput {
  return {
    rpId: "sac.example",
    rpName: "SAC",
    userHandle: Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]),
    userName: "opaque-account-reference",
    userDisplayName: "Compte SAC",
    residentKey: "discouraged",
    excludeCredentialIds: [Uint8Array.from([9, 8, 7, 6])],
    ...overrides,
  };
}

test("produces a fresh 32-byte challenge and the strict SAC root profile", () => {
  const first = createRootRegistrationOptions(input(), random);
  const second = createRootRegistrationOptions(input(), random);
  assert.match(first.challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first.challenge, second.challenge);
  assert.equal(first.rp.id, "sac.example");
  assert.equal(first.user.id, "AQIDBAUGBwg");
  assert.deepEqual(first.pubKeyCredParams, [{ type: "public-key", alg: -7 }]);
  assert.equal(first.authenticatorSelection.authenticatorAttachment, "platform");
  assert.equal(first.authenticatorSelection.userVerification, "required");
  assert.equal(first.authenticatorSelection.residentKey, "discouraged");
  assert.equal(first.authenticatorSelection.requireResidentKey, false);
  assert.equal(first.attestation, "none");
  assert.equal(first.timeout, 300_000);
  assert.deepEqual(first.excludeCredentials, [{
    type: "public-key",
    id: "CQgHBg",
  }]);
});

test("preserves the explicit resident-key configuration", () => {
  for (const residentKey of ["required", "preferred", "discouraged"] as const) {
    const options = createRootRegistrationOptions(input({ residentKey }), random);
    assert.equal(options.authenticatorSelection.residentKey, residentKey);
    assert.equal(options.authenticatorSelection.requireResidentKey, residentKey === "required");
  }
});

test("rejects invalid RP IDs, user handles and display fields", () => {
  for (const overrides of [
    { rpId: "https://sac.example" },
    { rpId: ".sac.example" },
    { rpId: "sac..example" },
    { rpId: "SAC.example" },
    { userHandle: new Uint8Array(0) },
    { userHandle: new Uint8Array(65) },
    { userName: " " },
    { userDisplayName: "" },
    { residentKey: "invalid" as never },
  ]) {
    assert.throws(() => createRootRegistrationOptions(input(overrides), random));
  }
});

test("rejects malformed or excessive excluded credential identifiers", () => {
  assert.throws(() => createRootRegistrationOptions(input({
    excludeCredentialIds: [new Uint8Array(0)],
  }), random));
  assert.throws(() => createRootRegistrationOptions(input({
    excludeCredentialIds: [new Uint8Array(1025)],
  }), random));
  assert.throws(() => createRootRegistrationOptions(input({
    excludeCredentialIds: Array.from({ length: 33 }, () => Uint8Array.of(1)),
  }), random));
});
