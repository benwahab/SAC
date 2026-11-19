import assert from "node:assert/strict";
import test from "node:test";
import { guardSameOriginJsonPost } from "../functions/lib/security/http-request-guard.ts";

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://sac.example/api/auth/register", {
    method: "POST",
    headers: {
      Origin: "https://sac.example",
      "Content-Type": "application/json",
      ...headers,
    },
    body: "{}",
  });
}

test("accepts same-origin JSON POST requests", () => {
  assert.equal(guardSameOriginJsonPost(request()), null);
});

test("rejects a missing Origin header", () => {
  const headers = new Headers(request().headers);
  headers.delete("Origin");
  assert.equal(guardSameOriginJsonPost(new Request("https://sac.example/api/auth/register", {
    method: "POST", headers, body: "{}",
  }))?.status, 403);
});

test("rejects cross-origin requests", () => {
  assert.equal(guardSameOriginJsonPost(request({ Origin: "https://attacker.example" }))?.status, 403);
});

test("rejects cross-site Fetch Metadata even if Origin is forged to match", () => {
  assert.equal(guardSameOriginJsonPost(request({ "Sec-Fetch-Site": "cross-site" }))?.status, 403);
});

test("rejects non-JSON and form-encoded bodies", () => {
  assert.equal(guardSameOriginJsonPost(request({ "Content-Type": "application/x-www-form-urlencoded" }))?.status, 415);
});

test("accepts JSON with UTF-8 charset", () => {
  assert.equal(guardSameOriginJsonPost(request({ "Content-Type": "application/json; charset=utf-8" })), null);
});

test("rejects unsupported methods", () => {
  const result = guardSameOriginJsonPost(new Request("https://sac.example/api/auth/register", { method: "GET" }));
  assert.equal(result?.status, 405);
});
