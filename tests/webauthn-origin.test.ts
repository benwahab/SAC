import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedWebAuthnOrigin } from "../functions/lib/security/webauthn-origin.ts";

const allowlist = ["https://sac.example", "https://app.sac.example"];

test("accepts only exact configured HTTPS origins under the configured RP ID", () => {
  assert.equal(isAllowedWebAuthnOrigin("https://sac.example", "sac.example", allowlist), true);
  assert.equal(isAllowedWebAuthnOrigin("https://app.sac.example", "sac.example", allowlist), true);
});

test("rejects unlisted origins even when they share the RP ID", () => {
  assert.equal(isAllowedWebAuthnOrigin("https://admin.sac.example", "sac.example", allowlist), false);
});

test("rejects lookalike hosts, HTTP and non-origin URLs", () => {
  for (const origin of [
    "https://sac.example.evil.test",
    "https://evilsac.example",
    "http://sac.example",
    "https://sac.example/path",
    "https://user@sac.example",
    "https://sac.example?next=evil",
    "not-a-url",
  ]) {
    assert.equal(isAllowedWebAuthnOrigin(origin, "sac.example", allowlist), false);
  }
});

test("rejects missing, malformed or unrelated RP configuration", () => {
  assert.equal(isAllowedWebAuthnOrigin("https://sac.example", "evil.test", allowlist), false);
  assert.equal(isAllowedWebAuthnOrigin("https://sac.example", "", allowlist), false);
  assert.equal(isAllowedWebAuthnOrigin("https://sac.example", "sac.example", []), false);
  assert.equal(isAllowedWebAuthnOrigin(null, "sac.example", allowlist), false);
});
