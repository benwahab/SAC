import assert from "node:assert/strict";
import test from "node:test";
import { parseGpsWebSocketProtocols } from "../workers/gps-relay/websocket-protocol.ts";

test("accepts exactly the public protocol and one opaque ticket protocol", () => {
  assert.deepEqual(
    parseGpsWebSocketProtocols("sac-gps-v1, sac-gps-ticket.eyJ0ZXN0IjoidGlja2V0In0.signature"),
    {
      protocol: "sac-gps-v1",
      ticket: "eyJ0ZXN0IjoidGlja2V0In0.signature",
    },
  );
});

test("rejects a missing public protocol", () => {
  assert.equal(parseGpsWebSocketProtocols("sac-gps-ticket.valid.signature"), null);
});

test("rejects missing or duplicate ticket protocols", () => {
  assert.equal(parseGpsWebSocketProtocols("sac-gps-v1"), null);
  assert.equal(parseGpsWebSocketProtocols("sac-gps-v1, sac-gps-ticket.a.b, sac-gps-ticket.c.d"), null);
});

test("rejects additional protocols instead of negotiating an unexpected one", () => {
  assert.equal(parseGpsWebSocketProtocols("sac-gps-v1, sac-gps-ticket.a.b, extra"), null);
});

test("rejects an empty or oversized ticket", () => {
  assert.equal(parseGpsWebSocketProtocols("sac-gps-v1, sac-gps-ticket."), null);
  assert.equal(parseGpsWebSocketProtocols("sac-gps-v1, sac-gps-ticket." + "a".repeat(4097)), null);
});

test("rejects malformed protocol header values", () => {
  assert.equal(parseGpsWebSocketProtocols(null), null);
  assert.equal(parseGpsWebSocketProtocols(""), null);
  assert.equal(parseGpsWebSocketProtocols("sac-gps-v1,,sac-gps-ticket.a.b"), null);
});
