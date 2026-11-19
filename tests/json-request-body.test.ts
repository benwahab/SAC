import assert from "node:assert/strict";
import test from "node:test";
import { readJsonRequestBody } from "../functions/lib/security/json-request-body.ts";

function request(body: BodyInit, headers: Record<string, string> = {}): Request {
  return new Request("https://sac.example/api/test", {
    method: "POST",
    headers,
    body,
    // Node's Fetch implementation requires duplex for streamed request bodies.
    duplex: "half",
  } as RequestInit);
}

test("parses valid JSON within the byte limit", async () => {
  const result = await readJsonRequestBody(request('{"ok":true}'), 32);
  assert.deepEqual(result, { ok: true, value: { ok: true } });
});

test("rejects a declared body larger than the limit without reading it", async () => {
  const result = await readJsonRequestBody(request("{}", { "Content-Length": "100" }), 8);
  assert.deepEqual(result, { ok: false, reason: "too_large" });
});

test("enforces the byte limit while streaming even without Content-Length", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"payload":"'));
      controller.enqueue(new Uint8Array(64).fill(65));
      controller.close();
    },
  });
  const result = await readJsonRequestBody(request(stream), 16);
  assert.deepEqual(result, { ok: false, reason: "too_large" });
});

test("counts UTF-8 bytes rather than JavaScript characters", async () => {
  const result = await readJsonRequestBody(request(JSON.stringify({ value: "ééé" })), 10);
  assert.deepEqual(result, { ok: false, reason: "too_large" });
});

test("rejects malformed JSON", async () => {
  const result = await readJsonRequestBody(request("{"), 16);
  assert.deepEqual(result, { ok: false, reason: "invalid_json" });
});

test("rejects invalid UTF-8", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([0xc3, 0x28]));
      controller.close();
    },
  });
  const result = await readJsonRequestBody(request(stream), 8);
  assert.deepEqual(result, { ok: false, reason: "invalid_json" });
});

test("rejects an invalid configured limit", async () => {
  await assert.rejects(() => readJsonRequestBody(request("{}"), 0), RangeError);
});
