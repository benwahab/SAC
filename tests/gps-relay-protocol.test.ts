import assert from "node:assert/strict";
import test from "node:test";
import { parseGpsWebSocketProtocols } from "../workers/gps-relay/websocket-protocol.ts";

const ticket = "a".repeat(43);

test("accepts exactly the public protocol and one opaque ticket protocol", () => {
  assert.deepEqual(
    parseGpsWebSocketProtocols(`sac-gps-v1, sac-gps-ticket.${ticket}`),
    { protocol: "sac-gps-v1", ticket },
  );
});

test("rejects missing, duplicate or additional protocols", () => {
  assert.equal(parseGpsWebSocketProtocols("sac-gps-ticket." + ticket), null);
  assert.equal(parseGpsWebSocketProtocols(`sac-gps-v1, sac-gps-ticket.${ticket}, extra`), null);
  assert.equal(parseGpsWebSocketProtocols(`sac-gps-v1, sac-gps-ticket.${ticket}, sac-gps-ticket.${ticket}`), null);
});

test("rejects malformed, empty or oversized tickets", () => {
  assert.equal(parseGpsWebSocketProtocols("sac-gps-v1, sac-gps-ticket."), null);
  assert.equal(parseGpsWebSocketProtocols("sac-gps-v1, sac-gps-ticket." + "a".repeat(129)), null);
  assert.equal(parseGpsWebSocketProtocols("sac-gps-v1, sac-gps-ticket." + "a".repeat(42) + "."), null);
});

test("rejects malformed protocol header values", () => {
  assert.equal(parseGpsWebSocketProtocols(null), null);
  assert.equal(parseGpsWebSocketProtocols(""), null);
  assert.equal(parseGpsWebSocketProtocols("sac-gps-v1,,sac-gps-ticket." + ticket), null);
});
