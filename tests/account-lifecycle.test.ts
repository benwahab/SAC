import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccountCloseExistingActivity,
  transitionAccountLifecycle,
  type AccountLifecycleRecord,
} from "../src/domain/account-lifecycle.ts";

const createdAt = "2026-11-18T08:00:00.000Z";
const requestedAt = "2026-11-18T09:00:00.000Z";
const finalizedAt = "2026-11-18T10:00:00.000Z";

function makeAccount(overrides: Partial<AccountLifecycleRecord> = {}): AccountLifecycleRecord {
  return {
    accountId: "account-a",
    status: "active",
    createdAt,
    deletionRequestedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

test("seul le propriétaire peut demander la suppression", () => {
  assert.deepEqual(transitionAccountLifecycle(makeAccount(), {
    type: "request_deletion", actorAccountId: "other", at: requestedAt,
  }), { ok: false, error: "actor_not_owner" });
});

test("la demande bloque les nouvelles activités mais permet de clôturer les activités existantes", () => {
  const result = transitionAccountLifecycle(makeAccount(), {
    type: "request_deletion", actorAccountId: "account-a", at: requestedAt,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.account.status, "deletion_pending");
  assert.equal(result.allowNewActivity, false);
  assert.equal(result.allowCloseExistingActivity, true);
});

test("une demande répétée ne réinitialise pas une suppression déjà en attente", () => {
  const pending = makeAccount({ status: "deletion_pending", deletionRequestedAt: requestedAt });
  assert.deepEqual(transitionAccountLifecycle(pending, {
    type: "request_deletion", actorAccountId: "account-a", at: finalizedAt,
  }), { ok: false, error: "account_not_active" });
});

test("le propriétaire peut annuler une demande avant sa finalisation", () => {
  const pending = makeAccount({ status: "deletion_pending", deletionRequestedAt: requestedAt });
  const result = transitionAccountLifecycle(pending, {
    type: "cancel_deletion", actorAccountId: "account-a", at: finalizedAt,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.account.status, "active");
  assert.equal(result.account.deletionRequestedAt, null);
  assert.equal(result.allowNewActivity, true);
});

test("un compte avec une alerte active ne peut pas être finalisé", () => {
  const pending = makeAccount({ status: "deletion_pending", deletionRequestedAt: requestedAt });
  assert.deepEqual(transitionAccountLifecycle(pending, {
    type: "finalize_deletion", actorAccountId: "system", at: finalizedAt,
    activity: { activeAlerts: 1, activeTrips: 0 },
  }), { ok: false, error: "active_alerts_remain" });
});

test("un compte avec un trajet actif ne peut pas être finalisé", () => {
  const pending = makeAccount({ status: "deletion_pending", deletionRequestedAt: requestedAt });
  assert.deepEqual(transitionAccountLifecycle(pending, {
    type: "finalize_deletion", actorAccountId: "system", at: finalizedAt,
    activity: { activeAlerts: 0, activeTrips: 1 },
  }), { ok: false, error: "active_trips_remain" });
});

test("seul le système peut exécuter la finalisation", () => {
  const pending = makeAccount({ status: "deletion_pending", deletionRequestedAt: requestedAt });
  assert.deepEqual(transitionAccountLifecycle(pending, {
    type: "finalize_deletion", actorAccountId: "account-a" as "system", at: finalizedAt,
    activity: { activeAlerts: 0, activeTrips: 0 },
  }), { ok: false, error: "invalid_command" });
});

test("la finalisation est permise uniquement sans alerte ni trajet actif", () => {
  const pending = makeAccount({ status: "deletion_pending", deletionRequestedAt: requestedAt });
  const result = transitionAccountLifecycle(pending, {
    type: "finalize_deletion", actorAccountId: "system", at: finalizedAt,
    activity: { activeAlerts: 0, activeTrips: 0 },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.account.status, "deleted");
  assert.equal(result.account.deletedAt, finalizedAt);
  assert.equal(result.allowNewActivity, false);
  assert.equal(result.allowCloseExistingActivity, false);
});

test("les comptes supprimés ne peuvent plus être réactivés par une demande", () => {
  const deleted = makeAccount({ status: "deleted", deletionRequestedAt: requestedAt, deletedAt: finalizedAt });
  assert.deepEqual(transitionAccountLifecycle(deleted, {
    type: "cancel_deletion", actorAccountId: "account-a", at: "2026-11-18T11:00:00.000Z",
  }), { ok: false, error: "deletion_not_pending" });
});

test("les compteurs d'activités invalides sont rejetés", () => {
  const pending = makeAccount({ status: "deletion_pending", deletionRequestedAt: requestedAt });
  assert.deepEqual(transitionAccountLifecycle(pending, {
    type: "finalize_deletion", actorAccountId: "system", at: finalizedAt,
    activity: { activeAlerts: -1, activeTrips: 0 },
  }), { ok: false, error: "invalid_activity_counts" });
});

test("la politique de clôture est permise pendant la demande mais pas après suppression", () => {
  assert.equal(canAccountCloseExistingActivity("active"), true);
  assert.equal(canAccountCloseExistingActivity("deletion_pending"), true);
  assert.equal(canAccountCloseExistingActivity("deleted"), false);
});

test("un compte supprimé est un état terminal logique", () => {
  const deleted = makeAccount({ status: "deleted", deletionRequestedAt: requestedAt, deletedAt: finalizedAt });
  assert.deepEqual(transitionAccountLifecycle(deleted, {
    type: "request_deletion", actorAccountId: "account-a", at: "2026-11-18T11:00:00.000Z",
  }), { ok: false, error: "account_not_active" });
});

test("les cinq états du compte sont reconnus sans ouvrir d'activité hors compte actif", () => {
  const pendingVerification = makeAccount({ status: "pending_verification" });
  const suspended = makeAccount({ status: "suspended" });

  const pendingResult = transitionAccountLifecycle(pendingVerification, {
    type: "request_deletion", actorAccountId: "account-a", at: requestedAt,
  });
  const suspendedResult = transitionAccountLifecycle(suspended, {
    type: "request_deletion", actorAccountId: "account-a", at: requestedAt,
  });

  assert.deepEqual(pendingResult, { ok: false, error: "account_not_active" });
  assert.deepEqual(suspendedResult, { ok: false, error: "account_not_active" });
  assert.equal(canAccountCloseExistingActivity("pending_verification"), false);
  assert.equal(canAccountCloseExistingActivity("suspended"), false);
});

test("un compte suspendu ne reçoit aucune autorisation générale de clôture", () => {
  const suspended = makeAccount({ status: "suspended" });
  const result = transitionAccountLifecycle(suspended, {
    type: "cancel_deletion", actorAccountId: "account-a", at: requestedAt,
  });
  assert.deepEqual(result, { ok: false, error: "deletion_not_pending" });
  assert.equal(canAccountCloseExistingActivity("suspended"), false);
});
