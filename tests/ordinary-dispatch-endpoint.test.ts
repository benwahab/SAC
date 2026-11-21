import assert from "node:assert/strict";
import test from "node:test";
import { onRequestPost } from "../functions/api/internal/ordinary-notification-dispatch.ts";

function context(token: string | undefined, authorization?: string): Parameters<typeof onRequestPost>[0] {
  const headers = authorization ? { Authorization: authorization } : undefined;
  return {
    request: new Request("https://sac.example/api/internal/ordinary-notification-dispatch", {
      method: "POST",
      headers,
    }),
    env: { INTERNAL_DISPATCH_TOKEN: token },
    params: {},
    data: {},
    next: async () => new Response(),
    functionPath: "/api/internal/ordinary-notification-dispatch",
  } as Parameters<typeof onRequestPost>[0];
}

test("internal dispatch endpoint refuses to run without a configured token", async () => {
  const response = await onRequestPost(context(undefined, `Bearer ${"a".repeat(64)}`));
  assert.equal(response.status, 503);
});

test("internal dispatch endpoint refuses a short configured token", async () => {
  const response = await onRequestPost(context("short", `Bearer ${"a".repeat(64)}`));
  assert.equal(response.status, 503);
});

test("internal dispatch endpoint rejects a wrong bearer token", async () => {
  const response = await onRequestPost(context("a".repeat(64), `Bearer ${"b".repeat(64)}`));
  assert.equal(response.status, 401);
});

test("internal dispatch endpoint rejects a missing bearer token", async () => {
  const response = await onRequestPost(context("a".repeat(64)));
  assert.equal(response.status, 401);
});
