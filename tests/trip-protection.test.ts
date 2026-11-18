import assert from "node:assert/strict";
import test from "node:test";
import {
  transitionTripProtection,
  type TripProtectionRecord,
} from "../src/domain/trip-protection.ts";

const createdAt = "2026-11-18T08:00:00.000Z";
const eta = "2026-11-18T09:00:00.000Z";
const afterGrace = "2026-11-18T09:15:00.000Z";

function makeTrip(overrides: Partial<TripProtectionRecord> = {}): TripProtectionRecord {
  return {
    tripId: "trip-a",
    authorAccountId: "author-a",
    mode: "arrival_check",
    status: "active",
    createdAt,
    expectedArrivalAt: eta,
    gracePeriodMinutes: 10,
    arrivalStatus: "pending",
    locationSharing: null,
    recipientSnapshot: [{ contactUserId: "contact-a", selectedAt: createdAt }],
    events: [],
    ...overrides,
  };
}

test("le mode vérification d'arrivée ne nécessite aucun partage de position", () => {
  assert.equal(transitionTripProtection(makeTrip(), {
    type: "confirm_arrival", actorAccountId: "author-a", at: "2026-11-18T08:50:00.000Z",
  }).ok, true);
});

test("le mode accompagnement exige le partage et n'a pas d'état d'arrivée", () => {
  const trip = makeTrip({
    mode: "accompaniment",
    expectedArrivalAt: null,
    gracePeriodMinutes: null,
    arrivalStatus: "not_applicable",
    locationSharing: { enabled: true, duration: "30_minutes" },
  });
  assert.equal(transitionTripProtection(trip, {
    type: "confirm_arrival", actorAccountId: "author-a", at: eta,
  }).ok, false);
});

test("le mode protection complète combine partage et confirmation d'arrivée", () => {
  const trip = makeTrip({
    mode: "full_protection",
    locationSharing: { enabled: true, duration: "until_closure" },
  });
  assert.equal(transitionTripProtection(trip, {
    type: "confirm_arrival", actorAccountId: "author-a", at: "2026-11-18T08:55:00.000Z",
  }).ok, true);
});

test("une échéance avant la fin du délai de grâce ne déclenche rien", () => {
  const result = transitionTripProtection(makeTrip(), {
    type: "mark_arrival_unconfirmed", actorAccountId: "system", at: "2026-11-18T09:09:59.999Z",
  });
  assert.deepEqual(result, { ok: false, error: "grace_period_not_elapsed" });
});

test("l'absence de confirmation devient seulement arrivée non confirmée", () => {
  const result = transitionTripProtection(makeTrip(), {
    type: "mark_arrival_unconfirmed", actorAccountId: "system", at: afterGrace,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.trip.arrivalStatus, "unconfirmed");
  assert.equal(result.trip.status, "active");
  assert.equal(result.trip.events[0].type, "arrival_marked_unconfirmed");
});

test("une confirmation tardive reste possible et est explicitement marquée", () => {
  const marked = transitionTripProtection(makeTrip(), {
    type: "mark_arrival_unconfirmed", actorAccountId: "system", at: afterGrace,
  });
  assert.equal(marked.ok, true);
  if (!marked.ok) return;
  const confirmed = transitionTripProtection(marked.trip, {
    type: "confirm_arrival", actorAccountId: "author-a", at: "2026-11-18T09:20:00.000Z",
  });
  assert.equal(confirmed.ok, true);
  if (!confirmed.ok) return;
  assert.equal(confirmed.trip.arrivalStatus, "confirmed");
  assert.equal(confirmed.trip.events[1].type, "arrival_confirmed");
  if (confirmed.trip.events[1].type === "arrival_confirmed") assert.equal(confirmed.trip.events[1].late, true);
});

test("seul l'auteur peut confirmer l'arrivée", () => {
  const result = transitionTripProtection(makeTrip(), {
    type: "confirm_arrival", actorAccountId: "contact-a", at: eta,
  });
  assert.deepEqual(result, { ok: false, error: "actor_not_author" });
});

test("une confirmation avant le délai empêche le marquage tardif", () => {
  const confirmed = transitionTripProtection(makeTrip(), {
    type: "confirm_arrival", actorAccountId: "author-a", at: "2026-11-18T08:55:00.000Z",
  });
  assert.equal(confirmed.ok, true);
  if (!confirmed.ok) return;
  const marked = transitionTripProtection(confirmed.trip, {
    type: "mark_arrival_unconfirmed", actorAccountId: "system", at: afterGrace,
  });
  assert.deepEqual(marked, { ok: false, error: "arrival_already_confirmed" });
});

test("seul l'auteur peut clôturer le trajet", () => {
  const result = transitionTripProtection(makeTrip(), {
    type: "close", actorAccountId: "contact-a", at: afterGrace, reason: "completed",
  });
  assert.deepEqual(result, { ok: false, error: "actor_not_author" });
});

test("la clôture par l'auteur conserve les événements et bloque les transitions suivantes", () => {
  const closed = transitionTripProtection(makeTrip(), {
    type: "close", actorAccountId: "author-a", at: afterGrace, reason: "cancelled",
  });
  assert.equal(closed.ok, true);
  if (!closed.ok) return;
  assert.equal(closed.trip.status, "closed_by_author");
  assert.equal(closed.trip.events[0].type, "closed");
  assert.deepEqual(transitionTripProtection(closed.trip, {
    type: "confirm_arrival", actorAccountId: "author-a", at: "2026-11-18T09:30:00.000Z",
  }), { ok: false, error: "trip_not_active" });
});

test("un délai de grâce négatif est rejeté", () => {
  const result = transitionTripProtection(makeTrip({ gracePeriodMinutes: -1 }), {
    type: "confirm_arrival", actorAccountId: "author-a", at: eta,
  });
  assert.deepEqual(result, { ok: false, error: "invalid_trip" });
});

test("le délai de grâce reste paramétré et n'est pas fixé globalement par le contrat", () => {
  const custom = makeTrip({ gracePeriodMinutes: 25 });
  const before = transitionTripProtection(custom, {
    type: "mark_arrival_unconfirmed", actorAccountId: "system", at: "2026-11-18T09:24:59.999Z",
  });
  const after = transitionTripProtection(custom, {
    type: "mark_arrival_unconfirmed", actorAccountId: "system", at: "2026-11-18T09:25:00.000Z",
  });
  assert.deepEqual(before, { ok: false, error: "grace_period_not_elapsed" });
  assert.equal(after.ok, true);
});


test("un mode inconnu est rejeté même si les autres champs semblent cohérents", () => {
  const result = transitionTripProtection(makeTrip({ mode: "unexpected" as TripProtectionRecord["mode"] }), {
    type: "confirm_arrival", actorAccountId: "author-a", at: eta,
  });
  assert.deepEqual(result, { ok: false, error: "invalid_trip" });
});

test("un mode accompagnement ne peut pas être activé sans partage de position", () => {
  const result = transitionTripProtection(makeTrip({
    mode: "accompaniment",
    expectedArrivalAt: null,
    gracePeriodMinutes: null,
    arrivalStatus: "not_applicable",
    locationSharing: { enabled: false, duration: "30_minutes" },
  }), {
    type: "close", actorAccountId: "author-a", at: eta, reason: "cancelled",
  });
  assert.deepEqual(result, { ok: false, error: "invalid_trip" });
});

test("un historique d'événements incohérent est refusé", () => {
  const result = transitionTripProtection(makeTrip({
    events: [{ type: "arrival_confirmed", actorAccountId: "author-a", at: eta, late: false }],
  }), {
    type: "close", actorAccountId: "author-a", at: afterGrace, reason: "completed",
  });
  assert.deepEqual(result, { ok: false, error: "invalid_trip" });
});
