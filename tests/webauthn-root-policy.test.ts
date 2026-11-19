import assert from "node:assert/strict";
import test from "node:test";
import { evaluateWebAuthnRootCredentialPolicy } from "../src/domain/webauthn-root-policy.ts";

test("accepts only a single-device credential that is not backed up", () => {
  assert.deepEqual(
    evaluateWebAuthnRootCredentialPolicy({
      credentialDeviceType: "singleDevice",
      credentialBackedUp: false,
    }),
    { accepted: true },
  );
});

test("rejects a multi-device credential even when it is not currently backed up", () => {
  assert.deepEqual(
    evaluateWebAuthnRootCredentialPolicy({
      credentialDeviceType: "multiDevice",
      credentialBackedUp: false,
    }),
    { accepted: false, reason: "credential_not_single_device" },
  );
});

test("rejects a single-device credential reporting backed-up state", () => {
  assert.deepEqual(
    evaluateWebAuthnRootCredentialPolicy({
      credentialDeviceType: "singleDevice",
      credentialBackedUp: true,
    }),
    { accepted: false, reason: "credential_backed_up" },
  );
});

test("fails closed when the validator cannot classify the credential", () => {
  assert.deepEqual(
    evaluateWebAuthnRootCredentialPolicy({
      credentialDeviceType: "unknown",
      credentialBackedUp: false,
    }),
    { accepted: false, reason: "credential_not_single_device" },
  );
});
