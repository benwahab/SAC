import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateSessionAge,
  getSessionExpiresAt,
  PASSWORD_MIN_CODE_POINTS,
  SESSION_ABSOLUTE_LIMIT_MS,
  SESSION_IDLE_LIMIT_MS,
  validateAccountPassword,
} from "../src/domain/auth-policy.ts";

const createdAt = "2026-01-01T00:00:00.000Z";

test("mot de passe minimum de 12 caractères", () => {
  assert.equal(PASSWORD_MIN_CODE_POINTS, 12);
  assert.deepEqual(validateAccountPassword("12345678901"), { ok: false, error: "password_too_short" });
  assert.deepEqual(validateAccountPassword("123456789012"), { ok: true });
});

test("espaces et caractères Unicode sont acceptés sans règle artificielle de composition", () => {
  assert.deepEqual(validateAccountPassword("mot de passe🙂"), { ok: true });
  assert.deepEqual(validateAccountPassword("            "), { ok: true });
});

test("mot de passe absent refusé", () => {
  assert.deepEqual(validateAccountPassword(""), { ok: false, error: "password_required" });
  assert.deepEqual(validateAccountPassword(null), { ok: false, error: "password_required" });
});

test("limites de session fixées à 30 jours d'inactivité et 90 jours absolus", () => {
  assert.equal(SESSION_IDLE_LIMIT_MS, 30 * 24 * 60 * 60 * 1000);
  assert.equal(SESSION_ABSOLUTE_LIMIT_MS, 90 * 24 * 60 * 60 * 1000);
});

test("session valide avant les deux échéances", () => {
  const result = evaluateSessionAge({
    createdAt,
    lastActivityAt: "2026-01-20T00:00:00.000Z",
  }, "2026-02-10T00:00:00.000Z");
  assert.equal(result.ok, true);
});

test("expiration après 30 jours consécutifs sans activité", () => {
  assert.deepEqual(evaluateSessionAge({
    createdAt,
    lastActivityAt: "2026-01-01T00:00:00.000Z",
  }, "2026-01-31T00:00:00.000Z"), { ok: false, error: "session_idle_expired" });
});

test("expiration absolue après 90 jours même avec une activité récente", () => {
  assert.deepEqual(evaluateSessionAge({
    createdAt,
    lastActivityAt: "2026-03-30T23:59:00.000Z",
  }, "2026-04-01T00:00:00.000Z"), { ok: false, error: "session_absolute_expired" });
});

test("dates invalides ou incohérentes refusées", () => {
  assert.deepEqual(evaluateSessionAge({
    createdAt,
    lastActivityAt: "2025-12-31T23:59:59.000Z",
  }, "2026-01-02T00:00:00.000Z"), { ok: false, error: "invalid_session_dates" });
});

test("les phrases de passe longues ne sont ni tronquées ni plafonnées artificiellement", () => {
  const longPassphrase = "A".repeat(256);
  assert.deepEqual(validateAccountPassword(longPassphrase), { ok: true });
});

test("le minimum est compté en points de code Unicode", () => {
  assert.deepEqual(validateAccountPassword("🙂".repeat(11)), { ok: false, error: "password_too_short" });
  assert.deepEqual(validateAccountPassword("🙂".repeat(12)), { ok: true });
});

test("les dates UTC impossibles et les formats ambigus sont rejetés", () => {
  for (const invalidDate of [
    "2026-02-30T00:00:00.000Z",
    "2026-01-01T00:00:00Z",
    "2026-01-01T01:00:00+01:00",
    "not-a-date",
  ]) {
    assert.deepEqual(evaluateSessionAge({
      createdAt,
      lastActivityAt: "2026-01-10T00:00:00.000Z",
    }, invalidDate), { ok: false, error: "invalid_session_dates" });
  }
});

test("une activité ne peut pas être antérieure à la création ni postérieure à maintenant", () => {
  assert.deepEqual(evaluateSessionAge({
    createdAt,
    lastActivityAt: "2025-12-31T23:59:59.000Z",
  }, "2026-01-10T00:00:00.000Z"), { ok: false, error: "invalid_session_dates" });

  assert.deepEqual(evaluateSessionAge({
    createdAt,
    lastActivityAt: "2026-01-11T00:00:00.000Z",
  }, "2026-01-10T00:00:00.000Z"), { ok: false, error: "invalid_session_dates" });
});


test("calcule l'expiration de session comme la première des deux limites", () => {
  assert.equal(getSessionExpiresAt({
    createdAt,
    lastActivityAt: "2026-01-20T00:00:00.000Z",
  }), "2026-02-19T00:00:00.000Z");
});

test("la limite absolue de 90 jours prime sur une activité récente", () => {
  assert.equal(getSessionExpiresAt({
    createdAt,
    lastActivityAt: "2026-03-30T23:59:00.000Z",
  }), "2026-04-01T00:00:00.000Z");
});

test("une activité antérieure à la création ne produit aucune expiration", () => {
  assert.equal(getSessionExpiresAt({
    createdAt,
    lastActivityAt: "2025-12-31T23:59:59.000Z",
  }), null);
});

test("les dates malformées ne produisent aucune expiration", () => {
  assert.equal(getSessionExpiresAt({
    createdAt: "not-a-date",
    lastActivityAt: "2026-01-02T00:00:00.000Z",
  }), null);
});
