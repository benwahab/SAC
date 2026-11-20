import assert from "node:assert/strict";
import test from "node:test";
import { isGpsRelayReady } from "../workers/gps-relay/relay-readiness.ts";

test("GPS relay stays disabled unless the explicit E2EE readiness switch is true", () => {
  assert.equal(isGpsRelayReady(undefined), false);
  assert.equal(isGpsRelayReady(""), false);
  assert.equal(isGpsRelayReady("false"), false);
  assert.equal(isGpsRelayReady("TRUE"), false);
  assert.equal(isGpsRelayReady("true"), true);
});
