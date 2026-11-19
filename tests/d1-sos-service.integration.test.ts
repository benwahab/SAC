import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

const PORT = 8802;
const BASE = `http://127.0.0.1:${PORT}`;
const CONFIG = "tests/wrangler.sos-service.toml";
const WRANGLER = "node_modules/wrangler/bin/wrangler.js";

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
  const applied = await command(["d1", "migrations", "apply", "sac-sos-service-test", "--local", "--config", CONFIG]);
  assert.match(applied, /success|applied|No migrations/i);
  const child = spawn(process.execPath, [WRANGLER, "dev", "--local", "--config", CONFIG, "--port", String(PORT)], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout?.on("data", (x: Buffer) => output += x.toString());
  child.stderr?.on("data", (x: Buffer) => output += x.toString());
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
  const secondVolunteer = await post<{ responsibilityAssigned: boolean }>("/respond", { actor: contact2, alertId, action: "volunteer", now: now + 3 });
  assert.equal(secondVolunteer.status, 200);
  assert.equal(secondVolunteer.data.responsibilityAssigned, false);
  const withdraw = await post<{ responsibilityAssigned: boolean }>("/respond", { actor: contact, alertId, action: "withdraw", now: now + 4 });
  assert.equal(withdraw.status, 200);
  assert.equal(withdraw.data.responsibilityAssigned, true);
  const handoverCheck = await post<{ responsibilityAssigned: boolean }>("/respond", { actor: contact2, alertId, action: "volunteer", now: now + 5 });
  assert.equal(handoverCheck.status, 200);
  assert.equal(handoverCheck.data.responsibilityAssigned, true);

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

  const followup = await post<{ alertId: string }>("/create", {
    owner, recipients: [contact], reminders: 1, now: now + 500_000,
  });
  assert.equal(followup.status, 200);
  const initialFollowup = await post<{ claimed: number; providerAccepted: number; retryScheduled: number; terminalFailures: number; completionErrors: number }>("/dispatch", {
    now: now + 500_000,
  });
  assert.deepEqual(initialFollowup.data, { claimed: 1, providerAccepted: 1, retryScheduled: 0, terminalFailures: 0, completionErrors: 0 });
  const failedDelivery = await post<{ claimed: number; providerAccepted: number; retryScheduled: number; completionErrors: number }>("/dispatch", {
    now: now + 800_000, failRecipient: contact,
  });
  assert.equal(failedDelivery.status, 200);
  assert.deepEqual(failedDelivery.data, { claimed: 1, providerAccepted: 0, retryScheduled: 1, terminalFailures: 0, completionErrors: 0 });
  const smsEscalations = await Promise.all([
    post<{ evaluationsCreated: number; evaluationsSuppressed: number; smsTasksCreated: number }>("/sms-escalate", { now: now + 800_000 }),
    post<{ evaluationsCreated: number; evaluationsSuppressed: number; smsTasksCreated: number }>("/sms-escalate", { now: now + 800_000 }),
  ]);
  assert.deepEqual(smsEscalations.map(x => x.status), [200, 200]);
  assert.equal(smsEscalations.reduce((sum, x) => sum + x.data.evaluationsCreated, 0), 1);
  assert.equal(smsEscalations.reduce((sum, x) => sum + x.data.smsTasksCreated, 0), 1);
  const smsState = await post<{ evaluation: { status: string; threshold_reached_at: number }; rows: Array<{ recipient_account_id: string; status: string; scheduled_at: number }> }>("/sms-state", {
    alertId: followup.data.alertId,
  });
  assert.equal(smsState.status, 200);
  assert.equal(smsState.data.evaluation.status, "queued");
  assert.deepEqual(smsState.data.rows.map(x => x.recipient_account_id), [contact]);
  assert.equal(smsState.data.rows[0].status, "pending");
  assert.equal(smsState.data.rows[0].scheduled_at, now + 800_000);
  const successfulRetry = await post<{ claimed: number; providerAccepted: number; retryScheduled: number; completionErrors: number }>("/dispatch", {
    now: now + 815_000,
  });
  assert.equal(successfulRetry.status, 200);
  assert.deepEqual(successfulRetry.data, { claimed: 1, providerAccepted: 1, retryScheduled: 0, terminalFailures: 0, completionErrors: 0 });

  const exhaustionBase = now + 1_000_000;
  const exhaustionAlert = await post<{ alertId: string }>("/create", {
    owner, recipients: [contact], reminders: 1, now: exhaustionBase,
  });
  assert.equal(exhaustionAlert.status, 200);
  const initialExhaustion = await post<{ claimed: number; providerAccepted: number; terminalFailures: number }>("/dispatch", {
    now: exhaustionBase,
  });
  assert.deepEqual(initialExhaustion.data, { claimed: 1, providerAccepted: 1, retryScheduled: 0, terminalFailures: 0, completionErrors: 0 });
  const firstFailure = await post<{ claimed: number; retryScheduled: number; terminalFailures: number }>("/dispatch", {
    now: exhaustionBase + 300_000, throwRecipient: contact,
  });
  assert.equal(firstFailure.status, 200);
  assert.deepEqual(firstFailure.data, { claimed: 1, providerAccepted: 0, retryScheduled: 1, terminalFailures: 0, completionErrors: 0 });
  const secondFailure = await post<{ claimed: number; retryScheduled: number; terminalFailures: number }>("/dispatch", {
    now: exhaustionBase + 315_000, failRecipient: contact,
  });
  assert.deepEqual(secondFailure.data, { claimed: 1, providerAccepted: 0, retryScheduled: 1, terminalFailures: 0, completionErrors: 0 });
  const thirdFailure = await post<{ claimed: number; retryScheduled: number; terminalFailures: number }>("/dispatch", {
    now: exhaustionBase + 345_000, failRecipient: contact,
  });
  assert.deepEqual(thirdFailure.data, { claimed: 1, providerAccepted: 0, retryScheduled: 1, terminalFailures: 0, completionErrors: 0 });
  const fourthFailure = await post<{ claimed: number; retryScheduled: number; terminalFailures: number }>("/dispatch", {
    now: exhaustionBase + 405_000, failRecipient: contact,
  });
  assert.deepEqual(fourthFailure.data, { claimed: 1, providerAccepted: 0, retryScheduled: 1, terminalFailures: 0, completionErrors: 0 });
  const fifthFailure = await post<{ claimed: number; retryScheduled: number; terminalFailures: number }>("/dispatch", {
    now: exhaustionBase + 525_000, failRecipient: contact,
  });
  assert.deepEqual(fifthFailure.data, { claimed: 1, providerAccepted: 0, retryScheduled: 0, terminalFailures: 1, completionErrors: 0 });
  const noSixthAttempt = await post<unknown[]>("/claim", { now: exhaustionBase + 1_000_000 });
  assert.equal(noSixthAttempt.status, 200);
  assert.equal(noSixthAttempt.data.length, 0);

  const suppressedBase = now + 2_000_000;
  const suppressedAlert = await post<{ alertId: string }>("/create", {
    owner, recipients: [contact], reminders: 1, now: suppressedBase,
  });
  assert.equal(suppressedAlert.status, 200);
  const leadAssigned = await post<{ responsibilityAssigned: boolean }>("/respond", {
    actor: contact, alertId: suppressedAlert.data.alertId, action: "volunteer", now: suppressedBase + 1,
  });
  assert.equal(leadAssigned.status, 200);
  assert.equal(leadAssigned.data.responsibilityAssigned, true);
  const suppressedEscalation = await post<{ evaluationsCreated: number; evaluationsSuppressed: number; smsTasksCreated: number }>("/sms-escalate", {
    now: suppressedBase + 300_000,
  });
  assert.equal(suppressedEscalation.status, 200);
  assert.deepEqual(suppressedEscalation.data, { evaluationsCreated: 1, evaluationsSuppressed: 1, smsTasksCreated: 0 });
  const suppressedState = await post<{ evaluation: { status: string }; rows: unknown[] }>("/sms-state", {
    alertId: suppressedAlert.data.alertId,
  });
  assert.equal(suppressedState.data.evaluation.status, "suppressed");
  assert.equal(suppressedState.data.rows.length, 0);
});
