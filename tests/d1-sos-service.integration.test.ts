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
  const seeded = await post<{ owner: string; contact: string; outsider: string; stamp: number }>("/seed", {});
  assert.equal(seeded.status, 200, JSON.stringify(seeded.data));
  const { owner, contact, outsider, stamp } = seeded.data;
  const now = stamp + 10_000;

  const created = await post<{ alertId: string }>("/create", { owner, recipients: [contact], reminders: 2, now });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const alertId = created.data.alertId;

  const outsiderRead = await post<{ error: string }>("/read", { actor: outsider, alertId });
  assert.equal(outsiderRead.status, 404);
  const recipientRead = await post<{ isAuthor: boolean; alert: { recipientSnapshot: Array<{ contactUserId: string }> } }>("/read", { actor: contact, alertId });
  assert.equal(recipientRead.status, 200);
  assert.equal(recipientRead.data.isAuthor, false);
  assert.deepEqual(recipientRead.data.alert.recipientSnapshot.map(x => x.contactUserId), [contact]);

  const volunteer = await post<{ responsibilityAssigned: boolean }>("/respond", { actor: contact, alertId, action: "volunteer", now: now + 1 });
  assert.equal(volunteer.status, 200);
  assert.equal(volunteer.data.responsibilityAssigned, true);

  const events = await post<Array<{ type: string }>>("/events", { actor: contact, alertId });
  assert.equal(events.status, 200);
  assert.deepEqual(events.data.map(x => x.type), ["triggered", "volunteered"]);

  const dueEarly = await post<unknown[]>("/claim", { now: now + 299_999 });
  assert.equal(dueEarly.status, 200);
  assert.equal(dueEarly.data.length, 0);
  const parallelClaims = await Promise.all([
    post<Array<{ id: string; leaseToken: string; attemptCount: number }>>("/claim", { now: now + 300_000 }),
    post<Array<{ id: string; leaseToken: string; attemptCount: number }>>("/claim", { now: now + 300_000 }),
  ]);
  assert.deepEqual(parallelClaims.map(x => x.status), [200, 200]);
  assert.equal(parallelClaims.reduce((count, x) => count + x.data.length, 0), 1);
  const due = { status: 200, data: parallelClaims.flatMap(x => x.data) };
  assert.equal(due.data[0].attemptCount, 1);
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
  const closed = await post<{ closed: boolean }>("/close", { actor: owner, alertId, now: now + 400_000 });
  assert.equal(closed.status, 200);
  assert.equal(closed.data.closed, true);
  const postCloseClaim = await post<unknown[]>("/claim", { now: now + 900_000 });
  assert.equal(postCloseClaim.status, 200);
  assert.equal(postCloseClaim.data.length, 0);
  const closedEvents = await post<Array<{ type: string }>>("/events", { actor: owner, alertId });
  assert.equal(closedEvents.status, 200);
  assert.deepEqual(closedEvents.data.map(x => x.type), ["triggered", "volunteered", "closed_by_author"]);
});
