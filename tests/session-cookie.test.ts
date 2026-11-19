import assert from "node:assert/strict";
import test from "node:test";
import {
  clearSessionCookie,
  createSessionCookie,
  readSessionCookie,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
} from "../functions/lib/security/session-cookie.ts";

const token = "A".repeat(43);

test("émet un cookie de session host-only, sécurisé et inaccessible au JavaScript", () => {
  const cookie = createSessionCookie(token);
  assert.equal(cookie, [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    `Max-Age=${SESSION_COOKIE_MAX_AGE_SECONDS}`,
    "Secure",
    "HttpOnly",
    "SameSite=Strict",
  ].join("; "));
  assert.doesNotMatch(cookie, /Domain=/i);
});

test("refuse les jetons invalides avant émission du cookie", () => {
  for (const value of ["", "x", "A".repeat(42) + "B", "A".repeat(44), null, 123]) {
    assert.throws(() => createSessionCookie(value as never), {
      name: "TypeError",
      message: "invalid_session_cookie_token",
    });
  }
});

test("lit le cookie SAC parmi d'autres cookies sans décoder ni altérer le jeton", () => {
  const request = new Request("https://sac.example/api/private", {
    headers: { Cookie: `theme=light; ${SESSION_COOKIE_NAME}=${token}; locale=fr` },
  });
  assert.equal(readSessionCookie(request), token);
});

test("refuse les cookies SAC dupliqués ou malformés", () => {
  const duplicate = new Request("https://sac.example/api/private", {
    headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}; ${SESSION_COOKIE_NAME}=${token}` },
  });
  const malformed = new Request("https://sac.example/api/private", {
    headers: { Cookie: `${SESSION_COOKIE_NAME}=${"A".repeat(42)}B` },
  });
  assert.equal(readSessionCookie(duplicate), null);
  assert.equal(readSessionCookie(malformed), null);
});

test("retourne null en absence du cookie SAC", () => {
  assert.equal(readSessionCookie(new Request("https://sac.example/api/private", {
    headers: { Cookie: "theme=light; locale=fr" },
  })), null);
  assert.equal(readSessionCookie(new Request("https://sac.example/api/private")), null);
});

test("efface le cookie avec les mêmes attributs de sécurité", () => {
  assert.equal(clearSessionCookie(), [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "Secure",
    "HttpOnly",
    "SameSite=Strict",
  ].join("; "));
});
