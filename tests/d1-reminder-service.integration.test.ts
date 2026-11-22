import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

const PORT = 8803;
const BASE = `http://127.0.0.1:${PORT}`;
const CONFIG = "tests/wrangler.reminder-service.toml";
const WRANGLER = "node_modules/wrangler/bin/wrangler.js";
const STATE = mkdtempSync(join(tmpdir(), "sac-d1-"));

async function command(args: string[]): Promise<string> {
  const child = spawn(process.execPath, [WRANGLER, ...args], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => output += chunk.toString());
  child.stderr?.on("data", (chunk: Buffer) => output += chunk.toString());
  const [code] = await once(child, "exit") as [number | null];
  if (code !== 0) throw new Error(`Wrangler failed: ${args.join(" ")}\n${output}`);
  return output;
}

async function post<T>(path: string, data: unknown): Promise<{ status: number; data: T }> {
  const response = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  return { status: response.status, data: await response.json() as T };
}

async function get<T>(path: string): Promise<{ status: number; data: T }> {
  const response = await fetch(BASE + path);
  return { status: response.status, data: await response.json() as T };
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
type Detail = {
  id: string;
  status: string;
  occurrences: Array<{ occurrenceId: string; scheduledAt: number; status: string }>;
};

test("reminder service persists, isolates, closes and dispatches ordinary notifications in isolated D1", { timeout: 180_000 }, async (t) => {
  const applied = await command(["d1", "migrations", "apply", "sac-reminder-service-test", "--local", "--persist-to", STATE, "--config", CONFIG]);
  assert.match(applied, /success|applied|No migrations/i);

  const child = spawn(process.execPath, [WRANGLER, "dev", "--local", "--persist-to", STATE, "--config", CONFIG, "--port", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => output += chunk.toString());
  child.stderr?.on("data", (chunk: Buffer) => output += chunk.toString());
  t.after(() => rmSync(STATE, { recursive: true, force: true }));
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([once(child, "exit"), delay(3_000)]);
    }
  });

  let ready = false;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      const response = await fetch(BASE + "/health");
      if (response.ok) { ready = true; break; }
    } catch {}
    await delay(300);
  }
  assert.equal(ready, true, output);

  const seeded = await post<{ owner: string; other: string; now: number }>("/seed", {});
  assert.equal(seeded.status, 200, JSON.stringify(seeded.data));
  const { owner, other, now } = seeded.data;
  const localDateInDays = (days: number) => new Date(now + days * 86_400_000).toISOString().slice(0, 10);
  const targetDate = localDateInDays(2);
  const weekStart = localDateInDays(3);
  const weekEnd = localDateInDays(12);

  const onceDraft = {
    kind: "appointment",
    title: "Consultation",
    description: "Apporter le carnet",
    recurrence: { type: "once", localDate: targetDate, localTime: "08:00", timeZone: "Africa/Niamey" },
    medication: null,
  };
  const created = await post<Result<Detail>>("/create", { accountId: owner, draft: onceDraft, now });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.ok, true);
  if (!created.data.ok) return;
  const reminder = created.data.value;
  assert.equal(reminder.occurrences.length, 1);
  assert.equal(reminder.occurrences[0].status, "scheduled");
  const scheduledAt = reminder.occurrences[0].scheduledAt;

  const ownerList = await get<Result<Array<{ id: string; title: string; scheduledCount: number }>>>(`/list?accountId=${owner}`);
  assert.equal(ownerList.status, 200);
  assert.equal(ownerList.data.ok, true);
  if (!ownerList.data.ok) return;
  assert.equal(ownerList.data.value.length, 1);
  assert.equal(ownerList.data.value[0].scheduledCount, 1);
  const otherList = await get<Result<unknown[]>>(`/list?accountId=${other}`);
  assert.equal(otherList.status, 200);
  assert.equal(otherList.data.ok, true);
  if (!otherList.data.ok) return;
  assert.equal(otherList.data.value.length, 0);

  const ownerDetail = await get<Result<Detail>>(`/get?accountId=${owner}&reminderId=${reminder.id}`);
  assert.equal(ownerDetail.status, 200);
  assert.equal(ownerDetail.data.ok, true);
  const otherDetail = await get<Result<unknown>>(`/get?accountId=${other}&reminderId=${reminder.id}`);
  assert.equal(otherDetail.status, 404);

  const dueNow = scheduledAt + 1;
  const ownerNotifications = await get<Result<Array<{ id: string; readAt: number | null }>>>(`/notifications?accountId=${owner}&now=${dueNow}`);
  assert.equal(ownerNotifications.status, 200);
  assert.equal(ownerNotifications.data.ok, true);
  if (!ownerNotifications.data.ok) return;
  assert.equal(ownerNotifications.data.value.length, 1);
  assert.equal(ownerNotifications.data.value[0].readAt, null);
  const otherNotifications = await get<Result<unknown[]>>(`/notifications?accountId=${other}&now=${dueNow}`);
  assert.equal(otherNotifications.status, 200);
  assert.equal(otherNotifications.data.ok, true);
  if (!otherNotifications.data.ok) return;
  assert.equal(otherNotifications.data.value.length, 0);

  const notificationId = ownerNotifications.data.value[0].id;
  const wrongReader = await post<Result<unknown>>("/read", { accountId: other, notificationId, now: dueNow });
  assert.notEqual(wrongReader.status, 200);
  const read = await post<Result<{ read: true }>>("/read", { accountId: owner, notificationId, now: dueNow });
  assert.equal(read.status, 200, JSON.stringify(read.data));
  assert.equal(read.data.ok, true);
  const readAgain = await post<Result<{ read: true }>>("/read", { accountId: owner, notificationId, now: dueNow + 1 });
  assert.equal(readAgain.status, 200);

  const dispatched = await post<{ ok: boolean }>("/dispatch", { now: dueNow });
  assert.equal(dispatched.status, 200);
  const outboxAfterDispatch = await get<{ ok: boolean; rows: Array<{ status: string; attempt_count: number }> }>(`/outbox?accountId=${owner}`);
  assert.equal(outboxAfterDispatch.status, 200);
  assert.equal(outboxAfterDispatch.data.rows.length, 1);
  assert.equal(outboxAfterDispatch.data.rows[0].status, "pending");
  assert.equal(outboxAfterDispatch.data.rows[0].attempt_count, 0);

  const closed = await post<Result<{ status: string }>>("/close", {
    accountId: owner,
    occurrenceId: reminder.occurrences[0].occurrenceId,
    status: "completed",
    now: dueNow + 2,
  });
  assert.equal(closed.status, 200, JSON.stringify(closed.data));
  assert.equal(closed.data.ok, true);
  if (!closed.data.ok) return;
  assert.equal(closed.data.value.status, "completed");
  const closeAgain = await post<Result<unknown>>("/close", {
    accountId: owner,
    occurrenceId: reminder.occurrences[0].occurrenceId,
    status: "cancelled",
    now: dueNow + 3,
  });
  assert.equal(closeAgain.status, 400);
  const outboxAfterClose = await get<{ ok: boolean; rows: Array<{ status: string }> }>(`/outbox?accountId=${owner}`);
  assert.equal(outboxAfterClose.status, 200);
  assert.equal(outboxAfterClose.data.rows[0].status, "cancelled");

  const weekly = await post<Result<Detail>>("/create", {
    accountId: owner,
    now: now + 1,
    draft: {
      kind: "activity",
      title: "Marche",
      description: null,
      recurrence: {
        type: "weekly",
        startDate: weekStart,
        endDate: weekEnd,
        localTime: "09:00",
        timeZone: "Africa/Niamey",
        weekdays: [1, 3],
      },
      medication: null,
    },
  });
  assert.equal(weekly.status, 201, JSON.stringify(weekly.data));
  assert.equal(weekly.data.ok, true);
  if (!weekly.data.ok) return;
  assert.ok(weekly.data.value.occurrences.length >= 2);

  const cancelled = await post<Result<Detail>>("/update", {
    accountId: owner,
    reminderId: weekly.data.value.id,
    action: "cancel",
    now: now + 2,
  });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.data));
  assert.equal(cancelled.data.ok, true);
  if (!cancelled.data.ok) return;
  assert.equal(cancelled.data.value.status, "cancelled");
  assert.ok(cancelled.data.value.occurrences.every((item) => item.status === "cancelled"));
  const outboxAfterCancel = await get<{ ok: boolean; rows: Array<{ status: string }> }>(`/outbox?accountId=${owner}`);
  assert.equal(outboxAfterCancel.status, 200);
  assert.ok(outboxAfterCancel.data.rows.every((row) => row.status === "cancelled"));

  const invalidMedication = await post<Result<unknown>>("/create", {
    accountId: owner,
    now: now + 3,
    draft: {
      kind: "medication",
      title: "Traitement",
      description: null,
      recurrence: { type: "once", localDate: targetDate, localTime: "08:00", timeZone: "Africa/Niamey" },
      medication: { name: "Médicament", dosage: "", instructions: null },
    },
  });
  assert.equal(invalidMedication.status, 400);
  assert.deepEqual(invalidMedication.data, { ok: false, error: "invalid_request" });
});
