import assert from "node:assert/strict";
import test from "node:test";
import {
  isReminderEligible,
  isTriggeredAlertStatus,
  transitionAlert,
  type TriggeredAlertRecord,
} from "../src/domain/alert-lifecycle.ts";

const createdAt = "2026-11-18T10:00:00.000Z";
const closedAt = "2026-11-18T10:05:00.000Z";

function makeAlert(overrides: Partial<TriggeredAlertRecord> = {}): TriggeredAlertRecord {
  return {
    alertId: "alert-a",
    authorAccountId: "author-a",
    status: "active",
    createdAt,
    closedAt: null,
    closureReason: null,
    recipientSnapshot: [
      { contactUserId: "contact-a", selectedAt: createdAt },
      { contactUserId: "contact-b", selectedAt: createdAt },
    ],
    ...overrides,
  };
}

test("seul l'auteur peut clôturer une alerte active", () => {
  const result = transitionAlert(makeAlert(), {
    type: "close",
    actorAccountId: "author-a",
    at: closedAt,
    reason: "completed",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.alert.status, "closed_by_author");
  assert.equal(result.alert.closedAt, closedAt);
  assert.equal(result.alert.closureReason, "completed");
});

test("un contact ne peut pas clôturer l'alerte de l'auteur", () => {
  const result = transitionAlert(makeAlert(), {
    type: "close",
    actorAccountId: "contact-a",
    at: closedAt,
    reason: "completed",
  });
  assert.deepEqual(result, { ok: false, error: "actor_not_author" });
});

test("annuler une alerte déjà déclenchée est une clôture avec motif cancelled", () => {
  const result = transitionAlert(makeAlert(), {
    type: "close",
    actorAccountId: "author-a",
    at: closedAt,
    reason: "cancelled",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.alert.status, "closed_by_author");
  assert.equal(result.alert.closureReason, "cancelled");
});

test("une alerte clôturée ne peut pas être clôturée une seconde fois", () => {
  const result = transitionAlert(makeAlert({
    status: "closed_by_author",
    closedAt,
    closureReason: "completed",
  }), {
    type: "close",
    actorAccountId: "author-a",
    at: "2026-11-18T10:06:00.000Z",
    reason: "cancelled",
  });
  assert.deepEqual(result, { ok: false, error: "alert_not_active" });
});

test("un horodatage invalide est refusé", () => {
  const result = transitionAlert(makeAlert(), {
    type: "close",
    actorAccountId: "author-a",
    at: "not-a-date",
    reason: "completed",
  });
  assert.deepEqual(result, { ok: false, error: "invalid_event_timestamp" });
});

test("une clôture antérieure au déclenchement est refusée", () => {
  const result = transitionAlert(makeAlert(), {
    type: "close",
    actorAccountId: "author-a",
    at: "2026-11-18T09:59:59.000Z",
    reason: "completed",
  });
  assert.deepEqual(result, { ok: false, error: "event_before_alert_creation" });
});

test("la transition est immuable et conserve exactement l'instantané initial", () => {
  const original = makeAlert();
  const before = structuredClone(original);
  const result = transitionAlert(original, {
    type: "close",
    actorAccountId: "author-a",
    at: closedAt,
    reason: "completed",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(original, before);
  if (!result.ok) return;
  assert.deepEqual(result.alert.recipientSnapshot, original.recipientSnapshot);
});

test("un rappel est éligible uniquement pour un destinataire initial d'une alerte active", () => {
  const alert = makeAlert();
  assert.equal(isReminderEligible(alert, "contact-a"), true);
  assert.equal(isReminderEligible(alert, "contact-new"), false);
  assert.equal(isReminderEligible({ ...alert, status: "closed_by_author" }, "contact-a"), false);
});

test("un accusé de réception ou une candidature ne change pas l'éligibilité aux rappels", () => {
  const alert = makeAlert();
  const acknowledged = { ...alert, acknowledgedBy: ["contact-a"] };
  const volunteered = { ...alert, primaryResponderId: "contact-a" };
  assert.equal(isReminderEligible(acknowledged, "contact-a"), true);
  assert.equal(isReminderEligible(volunteered, "contact-a"), true);
});

test("un instantané de destinataires dupliqué est rejeté", () => {
  const result = transitionAlert(makeAlert({
    recipientSnapshot: [
      { contactUserId: "contact-a", selectedAt: createdAt },
      { contactUserId: "contact-a", selectedAt: createdAt },
    ],
  }), {
    type: "close",
    actorAccountId: "author-a",
    at: closedAt,
    reason: "completed",
  });
  assert.deepEqual(result, { ok: false, error: "invalid_alert_record" });
});

test("un statut de SOS programmé annulé avant dispatch n'est pas un statut d'alerte déclenchée", () => {
  assert.equal(isTriggeredAlertStatus("cancelled_before_dispatch"), false);
  assert.equal(isTriggeredAlertStatus("active"), true);
  assert.equal(isTriggeredAlertStatus("closed_by_author"), true);
});
