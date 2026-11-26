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

test("GPS relay checks its Durable Object binding before parsing or consuming one-time tickets", () => {
  const source = readFileSync(new URL("../workers/gps-relay/index.ts", import.meta.url), "utf8");
  const bindingGuard = source.indexOf('if (!env.GPS_ROOMS)');
  const ticketConsumption = source.indexOf("const ticketHash = await hashTicket");
  assert.ok(bindingGuard >= 0, "GPS_ROOMS binding guard must exist");
  assert.ok(ticketConsumption >= 0, "one-time ticket consumption must exist");
  assert.ok(bindingGuard < ticketConsumption, "missing binding must fail before consuming a ticket");
});
