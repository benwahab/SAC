import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

const PORT = 8800;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const CONFIG = "tests/wrangler.d1-secondary-enrollment.toml";
const WRANGLER = "node_modules/wrangler/bin/wrangler.js";

type Seed = {
  accountId: string;
  rootDeviceId: string;
  newDeviceId: string;
  ceremonyId: string;
  challengeId: string;
  challengeDigest: string;
  transcriptHash: string;
  now: number;
  expiresAt: number;
};

type State = {
  ceremony: { status: string; approved_at: number | null } | null;
  challenge: { consumed_at: number | null } | null;
  devices: Array<{ id: string; role: string; status: string; auth_version: number; revoked_at: number | null }>;
  certificateCount: number;
  guardCount: number;
  auditCount: number;
  idempotencyCount: number;
};

function randomHex(): string {
  return createHash("sha256").update(randomBytes(32)).digest("hex");
}

function makeSeed(expiresIn = 60_000): Seed {
  const now = Date.now();
  return {
    accountId: randomUUID(),
    rootDeviceId: randomUUID(),
    newDeviceId: randomUUID(),
    ceremonyId: randomUUID(),
    challengeId: randomUUID(),
    challengeDigest: randomHex(),
    transcriptHash: randomHex(),
    now,
    expiresAt: now + expiresIn,
  };
}

async function runCommand(args: string[], timeoutMs = 90_000): Promise<string> {
  const child = spawn(process.execPath, [WRANGLER, ...args], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => { output += chunk.toString(); });
  child.stderr?.on("data", (chunk: Buffer) => { output += chunk.toString(); });
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const result = await Promise.race([
    once(child, "exit").then(([code]) => ({ code: code as number | null })),
    new Promise<{ timeout: true }>((resolve) => {
      timeoutHandle = setTimeout(() => resolve({ timeout: true }), timeoutMs);
    }),
  ]);
  if (timeoutHandle) clearTimeout(timeoutHandle);
  if ("timeout" in result) {
    child.kill("SIGTERM");
    throw new Error("Wrangler command timed out: " + args.join(" ") + "\n" + output);
  }
  if (result.code !== 0) {
    throw new Error("Wrangler command failed (" + result.code + "): " + args.join(" ") + "\n" + output);
  }
  return output;
}

async function post<T>(path: string, body: unknown): Promise<{ status: number; data: T }> {
  const response = await fetch(BASE_URL + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() as T };
}

async function seed(input: Seed): Promise<void> {
  const result = await post<{ seeded: boolean }>("/seed", input);
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.seeded, true);
}

async function approve(
  input: Seed,
  idempotencyKey = randomUUID(),
  overrides: Partial<Pick<Seed, "challengeDigest" | "transcriptHash">> & { now?: number } = {},
): Promise<{ status: number; data: { approved?: boolean; replayed?: boolean; reason?: string; error?: string } }> {
  return await post("/approve", {
    accountId: input.accountId,
    ceremonyId: input.ceremonyId,
    challengeId: input.challengeId,
    challengeDigest: overrides.challengeDigest ?? input.challengeDigest,
    rootDeviceId: input.rootDeviceId,
    newDeviceId: input.newDeviceId,
    transcriptHash: overrides.transcriptHash ?? input.transcriptHash,
    idempotencyKey,
    now: overrides.now ?? Date.now(),
  });
}

async function state(ceremonyId: string): Promise<State> {
  const response = await fetch(BASE_URL + "/state?ceremonyId=" + encodeURIComponent(ceremonyId));
  assert.equal(response.status, 200);
  return await response.json() as State;
}

function device(stateValue: State, role: string): State["devices"][number] | undefined {
  return stateValue.devices.find((item) => item.role === role);
}

test(
  "D1 secondary enrollment is atomic, idempotent and fails closed after root revocation",
  { timeout: 240_000 },
  async (t) => {
    const stateDir = mkdtempSync(join(tmpdir(), "sac-d1-secondary-"));
    t.after(() => rmSync(stateDir, { recursive: true, force: true }));

    const migrationOutput = await runCommand([
      "d1", "migrations", "apply", "sac-d1-secondary-enrollment-test",
      "--local", "--persist-to", stateDir, "--config", CONFIG,
    ]);
    assert.match(migrationOutput, /success|applied|No migrations/i);

    const child = spawn(
      process.execPath,
      [WRANGLER, "dev", "--local", "--persist-to", stateDir, "--config", CONFIG, "--port", String(PORT)],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr?.on("data", (chunk: Buffer) => { output += chunk.toString(); });

    t.after(async () => {
      if (child.exitCode === null && !child.killed) {
        child.kill("SIGTERM");
        await Promise.race([once(child, "exit"), delay(3_000)]);
      }
    });

    const deadline = Date.now() + 60_000;
    let ready = false;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error("Wrangler exited: " + output);
      try {
        const response = await fetch(BASE_URL + "/health");
        if (response.status === 200 && (await response.json() as { ok: boolean }).ok) {
          ready = true;
          break;
        }
      } catch { /* Worker is still starting. */ }
      await delay(300);
    }
    assert.equal(ready, true, "D1 Worker did not become ready:\n" + output);

    const first = makeSeed();
    await seed(first);
    const key = randomUUID();
    const approved = await approve(first, key);
    assert.equal(approved.status, 200, JSON.stringify(approved.data));
    assert.equal(approved.data.approved, true);
    assert.equal(approved.data.replayed, false);

    let current = await state(first.ceremonyId);
    assert.equal(current.ceremony?.status, "approved");
    assert.notEqual(current.challenge?.consumed_at, null);
    assert.equal(device(current, "root")?.status, "active");
    assert.equal(device(current, "secondary")?.status, "active");
    assert.equal(current.certificateCount, 1);
    assert.equal(current.guardCount, 1);
    assert.equal(current.auditCount, 1);
    assert.equal(current.idempotencyCount, 1);

    const replay = await approve(first, key);
    assert.equal(replay.status, 200);
    assert.equal(replay.data.replayed, true);
    current = await state(first.ceremonyId);
    assert.equal(current.certificateCount, 1);
    assert.equal(current.guardCount, 1);
    assert.equal(current.auditCount, 1);
    assert.equal(current.idempotencyCount, 1);

    const conflict = await approve(first, key, { transcriptHash: randomHex() });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.data.error, "idempotency_conflict");

    const concurrent = makeSeed();
    await seed(concurrent);
    const outcomes = await Promise.all(Array.from({ length: 8 }, () => approve(concurrent)));
    assert.equal(outcomes.filter((item) => item.status === 200 && item.data.approved).length, 1);
    assert.equal(outcomes.filter((item) => item.status === 409).length, 7);
    current = await state(concurrent.ceremonyId);
    assert.equal(current.certificateCount, 1);
    assert.equal(current.guardCount, 1);
    assert.equal(current.auditCount, 1);

    const sameKey = makeSeed();
    await seed(sameKey);
    const sharedKey = randomUUID();
    const sameKeyOutcomes = await Promise.all([approve(sameKey, sharedKey), approve(sameKey, sharedKey)]);
    assert.equal(sameKeyOutcomes.filter((item) => item.status === 200).length, 2);
    assert.equal(sameKeyOutcomes.filter((item) => item.data.replayed === false).length, 1);
    assert.equal(sameKeyOutcomes.filter((item) => item.data.replayed === true).length, 1);
    current = await state(sameKey.ceremonyId);
    assert.equal(current.certificateCount, 1);
    assert.equal(current.idempotencyCount, 1);

    const wrongDigest = makeSeed();
    await seed(wrongDigest);
    const wrong = await approve(wrongDigest, randomUUID(), { challengeDigest: "0".repeat(64) });
    assert.equal(wrong.status, 409);
    current = await state(wrongDigest.ceremonyId);
    assert.equal(current.ceremony?.status, "pending");
    assert.equal(current.challenge?.consumed_at, null);
    assert.equal(device(current, "secondary")?.status, "pending");
    assert.equal(current.certificateCount, 0);
    assert.equal(current.guardCount, 0);
    assert.equal(current.auditCount, 0);

    const wrongTranscript = makeSeed();
    await seed(wrongTranscript);
    const wrongHash = await approve(wrongTranscript, randomUUID(), { transcriptHash: randomHex() });
    assert.equal(wrongHash.status, 409);
    current = await state(wrongTranscript.ceremonyId);
    assert.equal(current.ceremony?.status, "pending");
    assert.equal(current.challenge?.consumed_at, null);
    assert.equal(device(current, "secondary")?.status, "pending");
    assert.equal(current.certificateCount, 0);
    assert.equal(current.guardCount, 0);
    assert.equal(current.auditCount, 0);

    const expired = makeSeed();
    await seed(expired);
    const expiredResult = await approve(expired, randomUUID(), { now: expired.expiresAt });
    assert.equal(expiredResult.status, 409);
    current = await state(expired.ceremonyId);
    assert.equal(current.ceremony?.status, "pending");
    assert.equal(current.challenge?.consumed_at, null);

    const secondPending = makeSeed();
    await seed(secondPending);
    const secondCeremony = {
      ...secondPending,
      newDeviceId: randomUUID(),
      ceremonyId: randomUUID(),
      challengeId: randomUUID(),
      challengeDigest: randomHex(),
      transcriptHash: randomHex(),
    };
    const duplicatePending = await post<{ error: string }>("/seed-ceremony", secondCeremony);
    assert.equal(duplicatePending.status, 409);

    const revoked = makeSeed();
    await seed(revoked);
    const revocation = await post<{ revoked: boolean }>("/revoke-root", {
      accountId: revoked.accountId,
      rootDeviceId: revoked.rootDeviceId,
      now: Date.now(),
    });
    assert.equal(revocation.status, 200);
    assert.equal(revocation.data.revoked, true);
    const afterRevocation = await approve(revoked, randomUUID());
    assert.equal(afterRevocation.status, 409);
    current = await state(revoked.ceremonyId);
    assert.equal(current.ceremony?.status, "rejected");
    assert.equal(device(current, "root")?.status, "revoked");
    assert.equal(device(current, "secondary")?.status, "pending");
    assert.equal(current.certificateCount, 0);

    const approvedThenRevoked = makeSeed();
    await seed(approvedThenRevoked);
    assert.equal((await approve(approvedThenRevoked)).status, 200);
    const postApprovalRevocation = await post<{ revoked: boolean }>("/revoke-root", {
      accountId: approvedThenRevoked.accountId,
      rootDeviceId: approvedThenRevoked.rootDeviceId,
      now: Date.now(),
    });
    assert.equal(postApprovalRevocation.status, 200);
    current = await state(approvedThenRevoked.ceremonyId);
    assert.equal(current.ceremony?.status, "approved");
    assert.equal(device(current, "root")?.status, "revoked");
    assert.equal(device(current, "secondary")?.status, "revoked");
    assert.equal(current.certificateCount, 1);

    const race = makeSeed();
    await seed(race);
    const [raceApproval, raceRevocation] = await Promise.all([
      approve(race, randomUUID()),
      post<{ revoked: boolean }>("/revoke-root", {
        accountId: race.accountId,
        rootDeviceId: race.rootDeviceId,
        now: Date.now(),
      }),
    ]);
    assert.equal(raceRevocation.status, 200);
    assert.ok(raceApproval.status === 200 || raceApproval.status === 409);
    current = await state(race.ceremonyId);
    assert.equal(device(current, "root")?.status, "revoked");
    assert.notEqual(device(current, "secondary")?.status, "active");
    if (current.ceremony?.status === "approved") {
      assert.equal(device(current, "secondary")?.status, "revoked");
      assert.equal(current.certificateCount, 1);
    } else {
      assert.equal(current.ceremony?.status, "rejected");
      assert.equal(current.certificateCount, 0);
    }
  },
);
