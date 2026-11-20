import assert from "node:assert/strict";
import test from "node:test";
import { acceptsRootAssertionFlags } from "../src/domain/webauthn-assertion-policy.ts";

test("accepts an assertion with user presence and verification and no backup state", () => {
  assert.equal(acceptsRootAssertionFlags(0x05), true);
});

test("rejects assertions without user presence or user verification", () => {
  for (const flags of [0x00, 0x01, 0x04]) assert.equal(acceptsRootAssertionFlags(flags), false);
});

test("rejects backup-eligible, backed-up, extension and reserved assertion flags", () => {
  for (const bit of [0x08, 0x10, 0x80, 0x02, 0x20, 0x40]) {
    assert.equal(acceptsRootAssertionFlags(0x05 | bit), false, "rejected flag " + bit);
  }
});

test("rejects non-byte flag inputs", () => {
  for (const flags of [-1, 256, 1.5, Number.NaN]) assert.equal(acceptsRootAssertionFlags(flags), false);
});
