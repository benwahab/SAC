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

test("accepts a valid decimal Content-Length", async () => {
  const body = '{"ok":true}';
  const result = await readJsonRequestBody(
    request(body, { "Content-Length": String(new TextEncoder().encode(body).byteLength) }),
    32,
  );
  assert.deepEqual(result, { ok: true, value: { ok: true } });
});

test("rejects malformed Content-Length values", async () => {
  for (const value of ["", "-1", "1.5", "NaN", "1e3", "9007199254740992"]) {
    const result = await readJsonRequestBody(
      request("{}", { "Content-Length": value }),
      16,
    );
    assert.deepEqual(result, { ok: false, reason: "invalid_content_length" }, value);
  }
});

test("rejects a Content-Length smaller than the streamed body", async () => {
  const result = await readJsonRequestBody(request("{}", { "Content-Length": "1" }), 16);
  assert.deepEqual(result, { ok: false, reason: "invalid_content_length" });
});

test("rejects a Content-Length larger than the streamed body", async () => {
  const result = await readJsonRequestBody(request("{}", { "Content-Length": "3" }), 16);
  assert.deepEqual(result, { ok: false, reason: "invalid_content_length" });
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

test("keeps the too-large result when stream cancellation rejects", async () => {
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(32).fill(65));
    },
    cancel() {
      throw new Error("cancel_failed");
    },
  });
  const result = await readJsonRequestBody(request(stream), 8);
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
