import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isGpsRelayReady } from "../workers/gps-relay/relay-readiness.ts";

test("GPS relay stays disabled unless the explicit E2EE readiness switch is true", () => {
  assert.equal(isGpsRelayReady(undefined), false);
  assert.equal(isGpsRelayReady(""), false);
  assert.equal(isGpsRelayReady("false"), false);
  assert.equal(isGpsRelayReady("TRUE"), false);
  assert.equal(isGpsRelayReady("true"), true);
});

test("GPS relay entrypoint actually enforces the readiness switch", () => {
  const source = readFileSync(new URL("../workers/gps-relay/index.ts", import.meta.url), "utf8");
  assert.match(source, /isGpsRelayReady\(env\.GPS_RELAY_E2EE_READY\)/);
  assert.match(source, /gps_relay_not_ready/);
});
