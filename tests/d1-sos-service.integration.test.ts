import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

const PORT = 8802;
const BASE = `http://127.0.0.1:${PORT}`;
const CONFIG = "tests/wrangler.sos-service.toml";
const WRANGLER = "node_modules/wrangler/bin/wrangler.js";
const STATE = mkdtempSync(join(tmpdir(), "sac-d1-"));

async function command(args: string[]): Promise<string> {
  const child = spawn(process.execPath, [WRANGLER, ...args], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout?.on("data", (x: Buffer) => output += x.toString());
  child.stderr?.on("data", (x: Buffer) => output += x.toString());
  const [code] = await once(child, "exit") as [number | null];
  if (code !== 0) throw new Error(`Wrangler failed: ${args.join(" ")}\n${output}`);
  return output;
}
async function post<T>(path: string, data: unknown): Promise<{ status: number; data: T }> {
  const response = await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  return { status: response.status, data: await response.json() as T };
}

test("SOS service persists alerts, enforces participants, processes reminders and closes safely in isolated D1", { timeout: 180_000 }, async (t) => {
  const applied = await command(["d1", "migrations", "apply", "sac-sos-service-test", "--local", "--persist-to", STATE, "--config", CONFIG]);
  assert.match(applied, /success|applied|No migrations/i);
  const child = spawn(process.execPath, [WRANGLER, "dev", "--local", "--persist-to", STATE, "--config", CONFIG, "--port", String(PORT)], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout?.on("data", (x: Buffer) => output += x.toString());
  child.stderr?.on("data", (x: Buffer) => output += x.toString());
  t.after(() => rmSync(STATE, { recursive: true, force: true }));
  t.after(async () => { if (child.exitCode === null) { child.kill("SIGTERM"); await Promise.race([once(child, "exit"), delay(3000)]); } });
  let ready = false;
  for (let i = 0; i < 200; i++) {
    try { const r = await fetch(BASE + "/health"); if (r.ok) { ready = true; break; } } catch {}
    await delay(300);
  }
  assert.equal(ready, true, output);
  const seeded = await post<{ owner: string; contact: string; contact2: string; outsider: string; stamp: number }>("/seed", {});
  assert.equal(seeded.status, 200, JSON.stringify(seeded.data));
  const { owner, contact, contact2, outsider, stamp } = seeded.data;
  const now = stamp + 10_000;

  const created = await post<{ alertId: string }>("/create", { owner, recipients: [contact, contact2], reminders: 2, now });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const alertId = created.data.alertId;

  const overLimit = await post<{ error: string }>("/create", {
    owner, recipients: [contact, contact2, outsider], reminders: 2, now: now + 1,
  });
  assert.equal(overLimit.status, 409);
  assert.equal(overLimit.data.error, "recipient_limit_exceeded");
  const noLeadYet = await post<{ assigned: boolean; isSelf: boolean }>("/responsibility", { actor: contact, alertId });
  assert.equal(noLeadYet.status, 200);
  assert.deepEqual(noLeadYet.data, { assigned: false, isSelf: false });
  const authorSeesNoLeadInitially = await post<{ assigned: boolean; isSelf: boolean }>("/responsibility", { actor: owner, alertId });
  assert.deepEqual(authorSeesNoLeadInitially.data, { assigned: false, isSelf: false });
  const outsiderCannotReadResponsibility = await post<{ error: string }>("/responsibility", { actor: outsider, alertId });
  assert.equal(outsiderCannotReadResponsibility.status, 404);
  const invalidZeroReminder = await post<{ error: string }>("/create", {
    owner, recipients: [contact], reminders: 0, now: now + 1,
  });
  const invalidSixReminders = await post<{ error: string }>("/create", {
    owner, recipients: [contact], reminders: 6, now: now + 2,
  });
  assert.equal(invalidZeroReminder.status, 409);
  assert.equal(invalidSixReminders.status, 409);

  const revokedAfterTrigger = await post<{ revoked: boolean }>("/revoke", { owner, contact: contact2, now: now + 1 });
  assert.equal(revokedAfterTrigger.status, 200);
  assert.equal(revokedAfterTrigger.data.revoked, true);
  const snapshottedAfterRevocation = await post<{ isAuthor: boolean }>("/read", { actor: contact2, alertId });
  assert.equal(snapshottedAfterRevocation.status, 200);
  assert.equal(snapshottedAfterRevocation.data.isAuthor, false);

  const revokedContactCannotJoinNewAlert = await post<{ error: string }>("/create", {
    owner, recipients: [contact2], reminders: 1, now: now + 2,
  });
  assert.equal(revokedContactCannotJoinNewAlert.status, 409);

  const outsiderRead = await post<{ error: string }>("/read", { actor: outsider, alertId });
  assert.equal(outsiderRead.status, 404);
  const recipientRead = await post<{ isAuthor: boolean; alert: { recipientSnapshot: Array<{ contactUserId: string }> } }>("/read", { actor: contact, alertId });
  assert.equal(recipientRead.status, 200);
  assert.equal(recipientRead.data.isAuthor, false);
  assert.deepEqual(recipientRead.data.alert.recipientSnapshot.map(x => x.contactUserId).sort(), [contact, contact2].sort());

  const acknowledgementAttempts = await Promise.all([
    post<{ recorded: boolean }>("/respond", { actor: contact, alertId, action: "acknowledge", now: now + 1 }),
    post<{ recorded: boolean }>("/respond", { actor: contact, alertId, action: "acknowledge", now: now + 1 }),
  ]);
  assert.deepEqual(acknowledgementAttempts.map(x => x.status), [200, 200]);
  assert.ok(acknowledgementAttempts.every(x => x.data.recorded));
  const volunteer = await post<{ responsibilityAssigned: boolean }>("/respond", { actor: contact, alertId, action: "volunteer", now: now + 2 });
  assert.equal(volunteer.status, 200);
  assert.equal(volunteer.data.responsibilityAssigned, true);
  const firstLeadView = await post<{ assigned: boolean; isSelf: boolean }>("/responsibility", { actor: contact, alertId });
  assert.deepEqual(firstLeadView.data, { assigned: true, isSelf: true });
  const authorLeadView = await post<{ assigned: boolean; isSelf: boolean }>("/responsibility", { actor: owner, alertId });
  assert.deepEqual(authorLeadView.data, { assigned: true, isSelf: false });
  const otherRecipientLeadView = await post<{ assigned: boolean; isSelf: boolean }>("/responsibility", { actor: contact2, alertId });
  assert.deepEqual(otherRecipientLeadView.data, { assigned: true, isSelf: false });
  const secondVolunteer = await post<{ responsibilityAssigned: boolean }>("/respond", { actor: contact2, alertId, action: "volunteer", now: now + 3 });
  assert.equal(secondVolunteer.status, 200);
  assert.equal(secondVolunteer.data.responsibilityAssigned, false);
  const withdraw = await post<{ responsibilityAssigned: boolean }>("/respond", { actor: contact, alertId, action: "withdraw", now: now + 4 });
  assert.equal(withdraw.status, 200);
  assert.equal(withdraw.data.responsibilityAssigned, true);
  const handoverCheck = await post<{ responsibilityAssigned: boolean }>("/respond", { actor: contact2, alertId, action: "volunteer", now: now + 5 });
  assert.equal(handoverCheck.status, 200);
  assert.equal(handoverCheck.data.responsibilityAssigned, true);
  const newLeadView = await post<{ assigned: boolean; isSelf: boolean }>("/responsibility", { actor: contact2, alertId });
  assert.deepEqual(newLeadView.data, { assigned: true, isSelf: true });
  const formerLeadView = await post<{ assigned: boolean; isSelf: boolean }>("/responsibility", { actor: contact, alertId });
  assert.deepEqual(formerLeadView.data, { assigned: true, isSelf: false });

  const events = await post<Array<{ type: string }>>("/events", { actor: contact2, alertId });
  assert.equal(events.status, 200);
  assert.deepEqual(events.data.map(x => x.type), ["triggered", "acknowledged", "volunteered", "volunteered", "withdrew"]);

  const initialPushes = await post<Array<{ id: string; leaseToken: string; reminderNumber: number }>>("/claim", { now });
  assert.equal(initialPushes.status, 200);
  assert.equal(initialPushes.data.length, 2);
  assert.ok(initialPushes.data.every(item => item.reminderNumber === 0));
  for (const initial of initialPushes.data) {
    const accepted = await post<{ updated: boolean }>("/complete", {
      reminderId: initial.id, leaseToken: initial.leaseToken, outcome: "sent", now: now + 1,
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.data.updated, true);
  }

  const dueEarly = await post<unknown[]>("/claim", { now: now + 299_999 });
  assert.equal(dueEarly.status, 200);
  assert.equal(dueEarly.data.length, 0);
  const parallelClaims = await Promise.all([
    post<Array<{ id: string; leaseToken: string; attemptCount: number }>>("/claim", { now: now + 300_000 }),
    post<Array<{ id: string; leaseToken: string; attemptCount: number }>>("/claim", { now: now + 300_000 }),
  ]);
  assert.deepEqual(parallelClaims.map(x => x.status), [200, 200]);
  assert.equal(parallelClaims.reduce((count, x) => count + x.data.length, 0), 2);
  const due = { status: 200, data: parallelClaims.flatMap(x => x.data) };
  assert.equal(due.data.length, 2);
  assert.ok(due.data.every(item => item.attemptCount === 1));
  assert.ok(due.data.every(item => item.reminderNumber === 1));
  const duplicateClaim = await post<unknown[]>("/claim", { now: now + 300_001 });
  assert.equal(duplicateClaim.status, 200);
  assert.equal(duplicateClaim.data.length, 0);
  const stale = await post<{ updated: boolean }>("/complete", { reminderId: due.data[0].id, leaseToken: "wrong-token-00000000", outcome: "sent", now: now + 300_001 });
  assert.equal(stale.status, 200);
  assert.equal(stale.data.updated, false);
  const retried = await post<{ updated: boolean; terminal: boolean }>("/complete", { reminderId: due.data[0].id, leaseToken: due.data[0].leaseToken, outcome: "retry", now: now + 300_002 });
  assert.equal(retried.status, 200);
  assert.equal(retried.data.updated, true);
  assert.equal(retried.data.terminal, false);
  const retryDue = await post<Array<{ id: string; leaseToken: string; attemptCount: number }>>("/claim", { now: now + 315_002 });
  assert.equal(retryDue.status, 200);
  assert.equal(retryDue.data.length, 1);
  assert.equal(retryDue.data[0].attemptCount, 2);
  const sent = await post<{ updated: boolean; terminal: boolean }>("/complete", {
    reminderId: retryDue.data[0].id, leaseToken: retryDue.data[0].leaseToken,
    outcome: "sent", now: now + 315_003,
  });
  assert.equal(sent.status, 200);
  assert.equal(sent.data.updated, true);
  assert.equal(sent.data.terminal, true);

  const closeWrong = await post<{ error: string }>("/close", { actor: contact, alertId, now: now + 400_000 });
  assert.equal(closeWrong.status, 409);
  const closeAttempts = await Promise.all([
    post<{ closed?: boolean; error?: string }>("/close", { actor: owner, alertId, now: now + 400_000 }),
    post<{ closed?: boolean; error?: string }>("/close", { actor: owner, alertId, now: now + 400_000 }),
  ]);
  assert.deepEqual(closeAttempts.map(x => x.status).sort(), [200, 200], JSON.stringify(closeAttempts.map(x => x.data)));
  assert.equal(closeAttempts.filter(x => x.data.closed === true).length, 2);
  const duplicateClose = await post<{ error: string }>("/close", { actor: owner, alertId, now: now + 400_001 });
  assert.equal(duplicateClose.status, 409);
  const postCloseClaim = await post<unknown[]>("/claim", { now: now + 900_000 });
  assert.equal(postCloseClaim.status, 200);
  assert.equal(postCloseClaim.data.length, 0);
  const closedEvents = await post<Array<{ type: string }>>("/events", { actor: owner, alertId });
  assert.equal(closedEvents.status, 200);
  assert.deepEqual(closedEvents.data.map(x => x.type), ["triggered", "acknowledged", "volunteered", "volunteered", "withdrew", "closed_by_author"]);
  const closedResponsibility = await post<{ assigned: boolean; isSelf: boolean }>("/responsibility", { actor: contact2, alertId });
  assert.deepEqual(closedResponsibility.data, { assigned: false, isSelf: false });

  const followup = await post<{ alertId: string }>("/create", {
    owner, recipients: [contact], reminders: 1, now: now + 500_000,
  });
  assert.equal(followup.status, 200);
  const initialFollowup = await post<Record<string, number>>("/dispatch", {
    now: now + 500_000,
  });
  assert.deepEqual(initialFollowup.data, { claimed: 1, providerAccepted: 1, retryScheduled: 0, terminalFailures: 0, completionErrors: 0, smsEvaluationsCreated: 0, smsEvaluationsSuppressed: 0, smsTasksCreated: 0 });
  const smsBeforeThreshold = await post<{ evaluationsCreated: number; evaluationsSuppressed: number; smsTasksCreated: number }>("/sms-escalate", {
    now: now + 799_999,
  });
  assert.deepEqual(smsBeforeThreshold.data, { evaluationsCreated: 0, evaluationsSuppressed: 0, smsTasksCreated: 0 });
  const failedDelivery = await post<Record<string, number>>("/dispatch", {
    now: now + 800_000, failRecipient: contact,
  });
  assert.equal(failedDelivery.status, 200);
  assert.deepEqual(failedDelivery.data, { claimed: 1, providerAccepted: 0, retryScheduled: 1, terminalFailures: 0, completionErrors: 0, smsEvaluationsCreated: 0, smsEvaluationsSuppressed: 0, smsTasksCreated: 0 });
  const smsWhileRetryPending = await post<{ evaluationsCreated: number; evaluationsSuppressed: number; smsTasksCreated: number }>("/sms-escalate", {
    now: now + 800_000,
  });
  assert.deepEqual(smsWhileRetryPending.data, { evaluationsCreated: 0, evaluationsSuppressed: 0, smsTasksCreated: 0 });
  const smsStateWhileRetryPending = await post<{ evaluation: null; rows: unknown[] }>("/sms-state", {
    alertId: followup.data.alertId,
  });
  assert.equal(smsStateWhileRetryPending.data.evaluation, null);
  assert.equal(smsStateWhileRetryPending.data.rows.length, 0);
  const successfulRetry = await post<Record<string, number>>("/dispatch", {
    now: now + 815_000,
  });
  assert.equal(successfulRetry.status, 200);
  assert.deepEqual(successfulRetry.data, { claimed: 1, providerAccepted: 1, retryScheduled: 0, terminalFailures: 0, completionErrors: 0, smsEvaluationsCreated: 1, smsEvaluationsSuppressed: 0, smsTasksCreated: 1 });
  const smsState = await post<{ evaluation: { status: string; threshold_reached_at: number }; rows: Array<{ recipient_account_id: string; status: string; scheduled_at: number }> }>("/sms-state", {
    alertId: followup.data.alertId,
  });
  assert.equal(smsState.data.evaluation.status, "queued");
  assert.deepEqual(smsState.data.rows.map(x => x.recipient_account_id), [contact]);
  assert.equal(smsState.data.rows[0].status, "pending");
  assert.equal(smsState.data.rows[0].scheduled_at, now + 800_000);
  const followupPushState = await post<{ rows: Array<{ reminder_number: number; status: string; scheduled_at: number }> }>("/push-state", {
    alertId: followup.data.alertId,
  });
  assert.deepEqual(followupPushState.data.rows.map(x => [x.reminder_number, x.status]), [
    [0, "sent"], [1, "sent"], [2, "pending"],
  ]);
  assert.equal(followupPushState.data.rows[2].scheduled_at, now + 1_100_000);
  const closeFollowup = await post<{ closed: boolean }>("/close", {
    actor: owner, alertId: followup.data.alertId, now: now + 820_000,
  });
  assert.equal(closeFollowup.status, 200);
  const smsStateAfterClose = await post<{ rows: Array<{ status: string }> }>("/sms-state", {
    alertId: followup.data.alertId,
  });
  assert.equal(smsStateAfterClose.data.rows[0].status, "cancelled");
  const followupPushAfterClose = await post<{ rows: Array<{ reminder_number: number; status: string }> }>("/push-state", {
    alertId: followup.data.alertId,
  });
  assert.equal(followupPushAfterClose.data.rows.find(x => x.reminder_number === 2)?.status, "cancelled");

  const exhaustionBase = now + 1_000_000;
  const exhaustionAlert = await post<{ alertId: string }>("/create", {
    owner, recipients: [contact], reminders: 1, now: exhaustionBase,
  });
  assert.equal(exhaustionAlert.status, 200);
  const initialExhaustion = await post<Record<string, number>>("/dispatch", {
    now: exhaustionBase,
  });
  assert.deepEqual(initialExhaustion.data, { claimed: 1, providerAccepted: 1, retryScheduled: 0, terminalFailures: 0, completionErrors: 0, smsEvaluationsCreated: 0, smsEvaluationsSuppressed: 0, smsTasksCreated: 0 });
  const firstFailure = await post<Record<string, number>>("/dispatch", {
    now: exhaustionBase + 300_000, throwRecipient: contact,
  });
  assert.equal(firstFailure.status, 200);
  assert.deepEqual(firstFailure.data, { claimed: 1, providerAccepted: 0, retryScheduled: 1, terminalFailures: 0, completionErrors: 0, smsEvaluationsCreated: 0, smsEvaluationsSuppressed: 0, smsTasksCreated: 0 });
  const secondFailure = await post<Record<string, number>>("/dispatch", {
    now: exhaustionBase + 315_000, failRecipient: contact,
  });
  assert.deepEqual(secondFailure.data, { claimed: 1, providerAccepted: 0, retryScheduled: 1, terminalFailures: 0, completionErrors: 0, smsEvaluationsCreated: 0, smsEvaluationsSuppressed: 0, smsTasksCreated: 0 });
  const thirdFailure = await post<Record<string, number>>("/dispatch", {
    now: exhaustionBase + 345_000, failRecipient: contact,
  });
  assert.deepEqual(thirdFailure.data, { claimed: 1, providerAccepted: 0, retryScheduled: 1, terminalFailures: 0, completionErrors: 0, smsEvaluationsCreated: 0, smsEvaluationsSuppressed: 0, smsTasksCreated: 0 });
  const fourthFailure = await post<Record<string, number>>("/dispatch", {
    now: exhaustionBase + 405_000, failRecipient: contact,
  });
  assert.deepEqual(fourthFailure.data, { claimed: 1, providerAccepted: 0, retryScheduled: 1, terminalFailures: 0, completionErrors: 0, smsEvaluationsCreated: 0, smsEvaluationsSuppressed: 0, smsTasksCreated: 0 });
  const fifthFailure = await post<Record<string, number>>("/dispatch", {
    now: exhaustionBase + 525_000, failRecipient: contact,
  });
  assert.deepEqual(fifthFailure.data, { claimed: 1, providerAccepted: 0, retryScheduled: 0, terminalFailures: 1, completionErrors: 0, smsEvaluationsCreated: 1, smsEvaluationsSuppressed: 0, smsTasksCreated: 1 });
  const reminderAfterThreshold = await post<Array<{ id: string; leaseToken: string; reminderNumber: number }>>("/claim", {
    now: exhaustionBase + 600_000,
  });
  assert.equal(reminderAfterThreshold.status, 200);
  assert.equal(reminderAfterThreshold.data.length, 1);
  assert.equal(reminderAfterThreshold.data[0].reminderNumber, 2);
  const laterPushSent = await post<{ updated: boolean }>("/complete", {
    reminderId: reminderAfterThreshold.data[0].id,
    leaseToken: reminderAfterThreshold.data[0].leaseToken,
    outcome: "sent",
    now: exhaustionBase + 600_001,
  });
  assert.equal(laterPushSent.data.updated, true);
  const continuingPushState = await post<{ rows: Array<{ reminder_number: number; status: string; scheduled_at: number }> }>("/push-state", {
    alertId: exhaustionAlert.data.alertId,
  });
  assert.deepEqual(continuingPushState.data.rows.map(x => [x.reminder_number, x.status]), [
    [0, "sent"], [1, "failed"], [2, "sent"], [3, "pending"],
  ]);
  assert.equal(continuingPushState.data.rows[3].scheduled_at, exhaustionBase + 900_000);
  const closeExhaustion = await post<{ closed: boolean }>("/close", {
    actor: owner, alertId: exhaustionAlert.data.alertId, now: exhaustionBase + 650_000,
  });
  assert.equal(closeExhaustion.status, 200);
  const smsExhaustionState = await post<{ rows: Array<{ status: string }> }>("/sms-state", {
    alertId: exhaustionAlert.data.alertId,
  });
  assert.equal(smsExhaustionState.data.rows[0].status, "cancelled");
  const closedPushState = await post<{ rows: Array<{ reminder_number: number; status: string }> }>("/push-state", {
    alertId: exhaustionAlert.data.alertId,
  });
  assert.equal(closedPushState.data.rows.find(x => x.reminder_number === 3)?.status, "cancelled");
  const noSixthAttempt = await post<unknown[]>("/claim", { now: exhaustionBase + 1_000_000 });
  assert.equal(noSixthAttempt.status, 200);
  assert.equal(noSixthAttempt.data.length, 0);

  const suppressedBase = now + 2_000_000;
  const suppressedAlert = await post<{ alertId: string }>("/create", {
    owner, recipients: [contact], reminders: 1, now: suppressedBase,
  });
  assert.equal(suppressedAlert.status, 200);
  const initialSuppressed = await post<Record<string, number>>("/dispatch", { now: suppressedBase });
  assert.deepEqual(initialSuppressed.data, { claimed: 1, providerAccepted: 1, retryScheduled: 0, terminalFailures: 0, completionErrors: 0, smsEvaluationsCreated: 0, smsEvaluationsSuppressed: 0, smsTasksCreated: 0 });
  const leadAssigned = await post<{ responsibilityAssigned: boolean }>("/respond", {
    actor: contact, alertId: suppressedAlert.data.alertId, action: "volunteer", now: suppressedBase + 1,
  });
  assert.equal(leadAssigned.status, 200);
  assert.equal(leadAssigned.data.responsibilityAssigned, true);
  const leadWithdrawn = await post<{ recorded: boolean; responsibilityAssigned: boolean }>("/respond", {
    actor: contact, alertId: suppressedAlert.data.alertId, action: "withdraw", now: suppressedBase + 2,
  });
  assert.equal(leadWithdrawn.status, 200);
  assert.equal(leadWithdrawn.data.recorded, true);
  const suppressedDue = await post<Array<{ id: string; leaseToken: string; reminderNumber: number }>>("/claim", {
    now: suppressedBase + 300_000,
  });
  assert.equal(suppressedDue.data.length, 1);
  assert.equal(suppressedDue.data[0].reminderNumber, 1);
  const suppressedPushAccepted = await post<{ updated: boolean }>("/complete", {
    reminderId: suppressedDue.data[0].id,
    leaseToken: suppressedDue.data[0].leaseToken,
    outcome: "sent",
    now: suppressedBase + 300_001,
  });
  assert.equal(suppressedPushAccepted.data.updated, true);
  const suppressedEvaluations = await Promise.all([
    post<{ evaluationsCreated: number; evaluationsSuppressed: number; smsTasksCreated: number }>("/sms-escalate", { now: suppressedBase + 300_001 }),
    post<{ evaluationsCreated: number; evaluationsSuppressed: number; smsTasksCreated: number }>("/sms-escalate", { now: suppressedBase + 300_001 }),
  ]);
  assert.deepEqual(suppressedEvaluations.map(x => x.status), [200, 200]);
  assert.equal(suppressedEvaluations.reduce((sum, x) => sum + x.data.evaluationsCreated, 0), 1);
  assert.equal(suppressedEvaluations.reduce((sum, x) => sum + x.data.evaluationsSuppressed, 0), 1);
  assert.equal(suppressedEvaluations.reduce((sum, x) => sum + x.data.smsTasksCreated, 0), 0);
  const suppressedState = await post<{ evaluation: { status: string }; rows: unknown[] }>("/sms-state", {
    alertId: suppressedAlert.data.alertId,
  });
  assert.equal(suppressedState.data.evaluation.status, "suppressed");
  assert.equal(suppressedState.data.rows.length, 0);

  // Un simple accusé de réception suffit à empêcher le SMS, même sans volontaire.
  const acknowledgedBase = now + 3_000_000;
  const acknowledgedAlert = await post<{ alertId: string }>("/create", {
    owner, recipients: [contact], reminders: 1, now: acknowledgedBase,
  });
  assert.equal(acknowledgedAlert.status, 200);
  const acknowledgedInitialPush = await post<Array<{ id: string; leaseToken: string; reminderNumber: number }>>("/claim", {
    now: acknowledgedBase,
  });
  assert.equal(acknowledgedInitialPush.data.length, 1);
  assert.equal(acknowledgedInitialPush.data[0].reminderNumber, 0);
  const acknowledgedInitialSent = await post<{ updated: boolean }>("/complete", {
    reminderId: acknowledgedInitialPush.data[0].id,
    leaseToken: acknowledgedInitialPush.data[0].leaseToken,
    outcome: "sent",
    now: acknowledgedBase + 1,
  });
  assert.equal(acknowledgedInitialSent.data.updated, true);

  const acknowledged = await post<{ recorded: boolean }>("/respond", {
    actor: contact, alertId: acknowledgedAlert.data.alertId,
    action: "acknowledge", now: acknowledgedBase + 2,
  });
  assert.equal(acknowledged.status, 200);
  assert.equal(acknowledged.data.recorded, true);

  const acknowledgedReminder = await post<Array<{ id: string; leaseToken: string; reminderNumber: number }>>("/claim", {
    now: acknowledgedBase + 300_000,
  });
  assert.equal(acknowledgedReminder.data.length, 1);
  assert.equal(acknowledgedReminder.data[0].reminderNumber, 1);
  const acknowledgedReminderSent = await post<{ updated: boolean }>("/complete", {
    reminderId: acknowledgedReminder.data[0].id,
    leaseToken: acknowledgedReminder.data[0].leaseToken,
    outcome: "sent",
    now: acknowledgedBase + 300_001,
  });
  assert.equal(acknowledgedReminderSent.data.updated, true);

  const acknowledgementSuppressesSms = await post<{
    evaluationsCreated: number; evaluationsSuppressed: number; smsTasksCreated: number;
  }>("/sms-escalate", { now: acknowledgedBase + 300_002 });
  assert.equal(acknowledgementSuppressesSms.status, 200);
  assert.deepEqual(acknowledgementSuppressesSms.data, {
    evaluationsCreated: 1, evaluationsSuppressed: 1, smsTasksCreated: 0,
  });
  const acknowledgedSmsState = await post<{ evaluation: { status: string }; rows: unknown[] }>("/sms-state", {
    alertId: acknowledgedAlert.data.alertId,
  });
  assert.equal(acknowledgedSmsState.data.evaluation.status, "suppressed");
  assert.equal(acknowledgedSmsState.data.rows.length, 0);
});
