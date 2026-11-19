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

test("rejects the inconsistent BE=0/BS=1 state", () => {
  assert.deepEqual(
    evaluateWebAuthnRootCredentialPolicy({
      credentialDeviceType: "singleDevice",
      credentialBackedUp: true,
    }),
    { accepted: false, reason: "backup_state_inconsistent" },
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

test("fails closed for null, arrays and malformed validator output", () => {
  for (const input of [null, undefined, [], "singleDevice", 1, {}]) {
    assert.deepEqual(
      evaluateWebAuthnRootCredentialPolicy(input),
      { accepted: false, reason: "credential_not_single_device" },
    );
  }
});

test("fails closed when backup state is not a boolean", () => {
  for (const credentialBackedUp of [undefined, null, 0, "false"]) {
    assert.deepEqual(
      evaluateWebAuthnRootCredentialPolicy({
        credentialDeviceType: "singleDevice",
        credentialBackedUp,
      }),
      { accepted: false, reason: "backup_state_inconsistent" },
    );
  }
});
