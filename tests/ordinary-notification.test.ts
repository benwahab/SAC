import assert from "node:assert/strict";
import test from "node:test";
import {
  applyWebPushOutcome,
  buildOrdinaryPushPayload,
  createOrdinaryNotification,
  isOrdinaryPushPayload,
  isOrdinaryNotificationKindImplemented,
  ordinaryNotificationDeduplicationKey,
  transitionOrdinaryNotification,
  type OrdinaryNotification,
} from "../src/domain/ordinary-notification.ts";

function makeNotification(): OrdinaryNotification {
  const created = createOrdinaryNotification({
    notificationId: "notification-a",
    kind: "reminder_due",
    sourceId: "occurrence-a",
    recipientAccountId: "account-a",
    scheduledAt: 1_000,
    nowMs: 900,
  });
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error("fixture invalide");
  return created.notification;
}

test("seuls les types ordinaires dont la source est implémentée sont distribués", () => {
  assert.equal(isOrdinaryNotificationKindImplemented("reminder_due"), true);
  assert.equal(isOrdinaryNotificationKindImplemented("family_event_created"), false);
  assert.equal(isOrdinaryNotificationKindImplemented("family_event_updated"), false);
  assert.equal(isOrdinaryNotificationKindImplemented("family_event_cancelled"), false);
  assert.equal(isOrdinaryNotificationKindImplemented("clinic_reminder_due"), false);
});

test("la clé de déduplication est stable et propre au destinataire", () => {
  const key = ordinaryNotificationDeduplicationKey({
    kind: "reminder_due",
    sourceId: "occurrence-a",
    recipientAccountId: "account-a",
    scheduledAt: 1_000,
  });
  assert.equal(key, "ordinary:reminder_due:occurrence-a:account-a:1000");
  assert.notEqual(key, ordinaryNotificationDeduplicationKey({
    kind: "reminder_due",
    sourceId: "occurrence-a",
    recipientAccountId: "account-b",
    scheduledAt: 1_000,
  }));
});

test("une notification ordinaire démarre en attente", () => {
  const notification = makeNotification();
  assert.equal(notification.status, "pending");
  assert.equal(notification.attemptCount, 0);
  assert.equal(notification.leaseToken, null);
  assert.equal(notification.nextAttemptAt, 1_000);
});

test("réserve puis accepte une notification", () => {
  const reserved = transitionOrdinaryNotification(makeNotification(), {
    type: "reserve",
    leaseToken: "lease-token-123456",
    leaseMs: 30_000,
  }, 1_000);
  assert.equal(reserved.ok, true);
  if (!reserved.ok) return;
  assert.equal(reserved.notification.status, "processing");
  assert.equal(reserved.notification.attemptCount, 1);
  assert.equal(reserved.notification.leaseUntil, 31_000);

  const accepted = transitionOrdinaryNotification(reserved.notification, { type: "accepted" }, 1_100);
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  assert.equal(accepted.notification.status, "accepted");
  assert.equal(accepted.notification.leaseToken, null);
  assert.deepEqual(transitionOrdinaryNotification(accepted.notification, { type: "cancel" }, 1_200), { ok: false, error: "invalid_transition" });
});

test("une reprise technique reste la même notification et s'arrête après deux tentatives", () => {
  const reserved = transitionOrdinaryNotification(makeNotification(), {
    type: "reserve",
    leaseToken: "lease-token-123456",
    leaseMs: 30_000,
  }, 1_000);
  assert.equal(reserved.ok, true);
  if (!reserved.ok) return;
  const retried = transitionOrdinaryNotification(reserved.notification, { type: "retry", retryAt: 61_000 }, 1_000);
  assert.equal(retried.ok, true);
  if (!retried.ok) return;
  assert.equal(retried.notification.status, "pending");
  assert.equal(retried.notification.attemptCount, 1);
  assert.equal(retried.notification.nextAttemptAt, 61_000);
  assert.equal(retried.notification.deduplicationKey, reserved.notification.deduplicationKey);

  const second = transitionOrdinaryNotification(retried.notification, {
    type: "reserve",
    leaseToken: "lease-token-abcdef",
    leaseMs: 30_000,
  }, 61_000);
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.notification.attemptCount, 2);
  const exhausted = transitionOrdinaryNotification(second.notification, { type: "retry", retryAt: 121_000 }, 61_000);
  assert.equal(exhausted.ok, true);
  if (!exhausted.ok) return;
  assert.equal(exhausted.notification.status, "permanent_failure");
  assert.equal(exhausted.notification.nextAttemptAt, null);
});

test("un échec définitif et une annulation sont terminaux", () => {
  const reserved = transitionOrdinaryNotification(makeNotification(), {
    type: "reserve",
    leaseToken: "lease-token-123456",
    leaseMs: 30_000,
  }, 1_000);
  assert.equal(reserved.ok, true);
  if (!reserved.ok) return;
  const failed = transitionOrdinaryNotification(reserved.notification, { type: "permanent_failure" }, 1_100);
  assert.equal(failed.ok, true);
  if (!failed.ok) return;
  assert.equal(failed.notification.status, "permanent_failure");
  assert.deepEqual(transitionOrdinaryNotification(failed.notification, { type: "accepted" }, 1_200), { ok: false, error: "invalid_transition" });

  const cancelled = transitionOrdinaryNotification(makeNotification(), { type: "cancel" }, 1_100);
  assert.equal(cancelled.ok, true);
  if (!cancelled.ok) return;
  assert.equal(cancelled.notification.status, "cancelled");
});

test("le payload ordinaire ne contient ni GPS, ni SMS, ni escalade", () => {
  const payload = buildOrdinaryPushPayload(makeNotification());
  assert.deepEqual(payload, {
    version: 1,
    kind: "ordinary_reminder",
    notificationId: "notification-a",
    targetPath: "/espace-prive#/rappels",
  });
  assert.equal("gps" in payload, false);
  assert.equal("sms" in payload, false);
  assert.equal("escalation" in payload, false);
  assert.equal(isOrdinaryPushPayload(payload), true);
});

test("un payload SOS est explicitement refusé", () => {
  assert.equal(isOrdinaryPushPayload({ version: 1, kind: "private_sos" }), false);
  assert.equal(isOrdinaryPushPayload({ version: 1, kind: "ordinary_reminder", notificationId: "n", targetPath: "/sos" }), false);
  assert.equal(isOrdinaryPushPayload({ version: 1, kind: "ordinary_reminder", notificationId: "n", targetPath: "/autre#/rappels" }), false);
  assert.equal(isOrdinaryPushPayload({ version: 1, kind: "ordinary_reminder", notificationId: "n", targetPath: "/espace-prive#/rappels", gps: true }), false);
});

test("applique les résultats Web Push sans créer de relance utilisateur", () => {
  const reserved = transitionOrdinaryNotification(makeNotification(), {
    type: "reserve",
    leaseToken: "lease-token-123456",
    leaseMs: 30_000,
  }, 1_000);
  assert.equal(reserved.ok, true);
  if (!reserved.ok) return;
  const retry = applyWebPushOutcome(reserved.notification, "retry", 1_100);
  assert.equal(retry.ok, true);
  if (!retry.ok) return;
  assert.equal(retry.notification.status, "pending");
  assert.equal(retry.notification.nextAttemptAt, 61_100);
  assert.equal(retry.notification.attemptCount, 1);

  const gone = applyWebPushOutcome(reserved.notification, "gone", 1_100);
  assert.equal(gone.ok, true);
  if (!gone.ok) return;
  assert.equal(gone.notification.status, "permanent_failure");
});
