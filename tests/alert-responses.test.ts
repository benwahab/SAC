import assert from "node:assert/strict";
import test from "node:test";
import {
  closeAlertResponderState,
  transitionAlertResponder,
  type AlertResponderState,
} from "../src/domain/alert-responses.ts";
import { transitionAlert } from "../src/domain/alert-lifecycle.ts";

const createdAt = "2026-11-18T10:00:00.000Z";
const t1 = "2026-11-18T10:01:00.000Z";
const t2 = "2026-11-18T10:02:00.000Z";
const t3 = "2026-11-18T10:03:00.000Z";

function makeState(overrides: Partial<AlertResponderState> = {}): AlertResponderState {
  return {
    alert: {
      alertId: "alert-a",
      authorAccountId: "author-a",
      status: "active",
      createdAt,
      closedAt: null,
      closureReason: null,
      recipientSnapshot: [
        { contactUserId: "contact-a", selectedAt: createdAt },
        { contactUserId: "contact-b", selectedAt: createdAt },
        { contactUserId: "contact-c", selectedAt: createdAt },
      ],
    },
    responders: [],
    responsibilityHistory: [],
    ...overrides,
  };
}

test("un destinataire peut accuser réception sans devenir responsable", () => {
  const result = transitionAlertResponder(makeState(), {
    type: "acknowledge", actorAccountId: "contact-a", at: t1,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.responders[0].acknowledgedAt, t1);
  assert.equal(result.state.responders[0].volunteeredAt, null);
  assert.equal(result.state.responsibilityHistory.length, 0);
});

test("un accusé de réception répété est idempotent", () => {
  const first = transitionAlertResponder(makeState(), {
    type: "acknowledge", actorAccountId: "contact-a", at: t1,
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = transitionAlertResponder(first.state, {
    type: "acknowledge", actorAccountId: "contact-a", at: t2,
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.state.responders[0].acknowledgedAt, t1);
});

test("le premier volontaire accepté devient responsable principal", () => {
  const result = transitionAlertResponder(makeState(), {
    type: "volunteer", actorAccountId: "contact-a", at: t1, serverSequence: 1,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.responsibilityHistory.length, 1);
  assert.equal(result.state.responsibilityHistory[0].contactAccountId, "contact-a");
  assert.equal(result.state.responsibilityHistory[0].endedAt, null);
});

test("un second volontaire est enregistré sans remplacer le responsable principal", () => {
  const first = transitionAlertResponder(makeState(), {
    type: "volunteer", actorAccountId: "contact-a", at: t1, serverSequence: 1,
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = transitionAlertResponder(first.state, {
    type: "volunteer", actorAccountId: "contact-b", at: t2, serverSequence: 2,
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.state.responsibilityHistory.filter((period) => period.endedAt === null).length, 1);
  assert.equal(second.state.responsibilityHistory[0].contactAccountId, "contact-a");
});

test("le retrait du responsable transfère au volontaire suivant dans l'ordre serveur", () => {
  let state = makeState();
  for (const [actorAccountId, at, serverSequence] of [
    ["contact-a", t1, 1],
    ["contact-b", t2, 2],
    ["contact-c", t3, 3],
  ] as const) {
    const result = transitionAlertResponder(state, {
      type: "volunteer", actorAccountId, at, serverSequence,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    state = result.state;
  }
  const withdrawn = transitionAlertResponder(state, {
    type: "withdraw", actorAccountId: "contact-a", at: "2026-11-18T10:04:00.000Z",
  });
  assert.equal(withdrawn.ok, true);
  if (!withdrawn.ok) return;
  const open = withdrawn.state.responsibilityHistory.filter((period) => period.endedAt === null);
  assert.equal(open.length, 1);
  assert.equal(open[0].contactAccountId, "contact-b");
  assert.equal(withdrawn.state.responsibilityHistory[0].endReason, "withdrawn");
});

test("sans autre volontaire, le retrait laisse l'alerte sans responsable", () => {
  const first = transitionAlertResponder(makeState(), {
    type: "volunteer", actorAccountId: "contact-a", at: t1, serverSequence: 1,
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const result = transitionAlertResponder(first.state, {
    type: "withdraw", actorAccountId: "contact-a", at: t2,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.responsibilityHistory.filter((period) => period.endedAt === null).length, 0);
});

test("un non-destinataire ne peut pas répondre ou se porter volontaire", () => {
  const result = transitionAlertResponder(makeState(), {
    type: "volunteer", actorAccountId: "stranger", at: t1, serverSequence: 1,
  });
  assert.deepEqual(result, { ok: false, error: "actor_not_recipient" });
});

test("l'auteur ne peut pas répondre comme contact à sa propre alerte", () => {
  const result = transitionAlertResponder(makeState(), {
    type: "acknowledge", actorAccountId: "author-a", at: t1,
  });
  assert.deepEqual(result, { ok: false, error: "author_cannot_respond_as_contact" });
});

test("une candidature volontaire utilise une séquence serveur positive et unique", () => {
  const invalid = transitionAlertResponder(makeState(), {
    type: "volunteer", actorAccountId: "contact-a", at: t1, serverSequence: 0,
  });
  assert.deepEqual(invalid, { ok: false, error: "invalid_server_sequence" });
  const first = transitionAlertResponder(makeState(), {
    type: "volunteer", actorAccountId: "contact-a", at: t1, serverSequence: 1,
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const duplicate = transitionAlertResponder(first.state, {
    type: "volunteer", actorAccountId: "contact-b", at: t2, serverSequence: 1,
  });
  assert.deepEqual(duplicate, { ok: false, error: "duplicate_server_sequence" });
});

test("un contact qui s'est retiré ne peut pas reprendre la même candidature", () => {
  const first = transitionAlertResponder(makeState(), {
    type: "volunteer", actorAccountId: "contact-a", at: t1, serverSequence: 1,
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const withdrawn = transitionAlertResponder(first.state, {
    type: "withdraw", actorAccountId: "contact-a", at: t2,
  });
  assert.equal(withdrawn.ok, true);
  if (!withdrawn.ok) return;
  const again = transitionAlertResponder(withdrawn.state, {
    type: "volunteer", actorAccountId: "contact-a", at: t3, serverSequence: 2,
  });
  assert.deepEqual(again, { ok: false, error: "already_withdrawn" });
});

test("un retrait antérieur à la candidature est refusé", () => {
  const first = transitionAlertResponder(makeState(), {
    type: "volunteer", actorAccountId: "contact-a", at: t2, serverSequence: 1,
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const result = transitionAlertResponder(first.state, {
    type: "withdraw", actorAccountId: "contact-a", at: t1,
  });
  assert.deepEqual(result, { ok: false, error: "event_before_volunteer" });
});

test("une alerte clôturée ne reçoit plus de réponses", () => {
  const state = makeState({
    alert: {
      alertId: "alert-a",
      authorAccountId: "author-a",
      status: "closed_by_author",
      createdAt,
      closedAt: t1,
      closureReason: "completed",
      recipientSnapshot: [
        { contactUserId: "contact-a", selectedAt: createdAt },
        { contactUserId: "contact-b", selectedAt: createdAt },
        { contactUserId: "contact-c", selectedAt: createdAt },
      ],
    },
  });
  const result = transitionAlertResponder(state, {
    type: "acknowledge", actorAccountId: "contact-a", at: t2,
  });
  assert.deepEqual(result, { ok: false, error: "alert_not_active" });
});


test("la clôture de l'alerte ferme aussi la période du responsable principal", () => {
  const volunteered = transitionAlertResponder(makeState(), {
    type: "volunteer", actorAccountId: "contact-a", at: t1, serverSequence: 1,
  });
  assert.equal(volunteered.ok, true);
  if (!volunteered.ok) return;

  const alertClosure = transitionAlert(volunteered.state.alert, {
    type: "close", actorAccountId: "author-a", at: t2, reason: "completed",
  });
  assert.equal(alertClosure.ok, true);
  if (!alertClosure.ok) return;

  const closed = closeAlertResponderState(volunteered.state, alertClosure.alert);
  assert.equal(closed.ok, true);
  if (!closed.ok) return;
  assert.equal(closed.state.alert.status, "closed_by_author");
  assert.equal(closed.state.responsibilityHistory.length, 1);
  assert.equal(closed.state.responsibilityHistory[0].endedAt, t2);
  assert.equal(closed.state.responsibilityHistory[0].endReason, "alert_closed");
  assert.equal(closed.state.responsibilityHistory.filter((period) => period.endedAt === null).length, 0);
});

test("la clôture fonctionne aussi lorsqu'aucun responsable principal n'est attribué", () => {
  const state = makeState();
  const alertClosure = transitionAlert(state.alert, {
    type: "close", actorAccountId: "author-a", at: t1, reason: "cancelled",
  });
  assert.equal(alertClosure.ok, true);
  if (!alertClosure.ok) return;
  const closed = closeAlertResponderState(state, alertClosure.alert);
  assert.equal(closed.ok, true);
  if (!closed.ok) return;
  assert.equal(closed.state.responsibilityHistory.length, 0);
  assert.equal(closed.state.alert.closedAt, t1);
});

test("une clôture ne peut pas être appliquée à une autre alerte ou à un autre instantané", () => {
  const state = makeState();
  const differentAlert = transitionAlert({
    ...state.alert,
    recipientSnapshot: [{ contactUserId: "contact-x", selectedAt: createdAt }],
  }, {
    type: "close", actorAccountId: "author-a", at: t1, reason: "completed",
  });
  assert.equal(differentAlert.ok, true);
  if (!differentAlert.ok) return;
  assert.deepEqual(closeAlertResponderState(state, differentAlert.alert), {
    ok: false, error: "closure_alert_mismatch",
  });
});

test("la clôture ne peut pas précéder le début de la responsabilité", () => {
  const volunteered = transitionAlertResponder(makeState(), {
    type: "volunteer", actorAccountId: "contact-a", at: t3, serverSequence: 1,
  });
  assert.equal(volunteered.ok, true);
  if (!volunteered.ok) return;
  const alertClosure = transitionAlert(volunteered.state.alert, {
    type: "close", actorAccountId: "author-a", at: t2, reason: "completed",
  });
  assert.equal(alertClosure.ok, true);
  if (!alertClosure.ok) return;
  assert.deepEqual(closeAlertResponderState(volunteered.state, alertClosure.alert), {
    ok: false, error: "closure_before_responsibility_start",
  });
});

test("un état clôturé ne peut conserver une période de responsabilité ouverte", () => {
  const state = makeState({
    alert: {
      ...makeState().alert,
      status: "closed_by_author",
      closedAt: t2,
      closureReason: "completed",
    },
    responders: [{
      contactAccountId: "contact-a",
      acknowledgedAt: null,
      volunteeredAt: t1,
      volunteeredSequence: 1,
      withdrawnAt: null,
    }],
    responsibilityHistory: [{
      contactAccountId: "contact-a",
      startedAt: t1,
      endedAt: null,
      endReason: null,
      sequence: 1,
    }],
  });
  assert.deepEqual(transitionAlertResponder(state, {
    type: "acknowledge", actorAccountId: "contact-a", at: t3,
  }), { ok: false, error: "invalid_state" });
});
