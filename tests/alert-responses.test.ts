import assert from "node:assert/strict";
import test from "node:test";
import {
  transitionAlertResponder,
  type AlertResponderState,
} from "../src/domain/alert-responses.ts";

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
