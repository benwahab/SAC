import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

const PORT = 8799;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const CONFIG = "tests/wrangler.d1-atomicity.toml";
const WRANGLER = "node_modules/wrangler/bin/wrangler.js";

type Seed = {
  ceremonyId: string;
  challengeId: string;
  challengeDigest: string;
  issuedAt: number;
  expiresAt: number;
};

function makeSeed(options: { expired?: boolean } = {}): Seed {
  const now = Date.now();
  return {
    ceremonyId: randomUUID(),
    challengeId: randomUUID(),
    // Only the digest is sent to D1; the raw random challenge is discarded.
    challengeDigest: createHash("sha256").update(randomBytes(32)).digest("hex"),
    issuedAt: now - 1_000,
    expiresAt: options.expired ? now - 1 : now + 60_000,
  };
}

async function runCommand(args: string[], timeoutMs = 90_000): Promise<string> {
  const child = spawn(process.execPath, [WRANGLER, ...args], {
    stdio: ["ignore", "pipe", "pipe"],
  });
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

async function state(ceremonyId: string): Promise<{
  ceremony: { status: string; approved_at: number | null } | null;
  challenge: { consumed_at: number | null } | null;
  commitCount: number;
}> {
  const response = await fetch(BASE_URL + "/state?ceremonyId=" + encodeURIComponent(ceremonyId));
  assert.equal(response.status, 200);
  return await response.json() as {
    ceremony: { status: string; approved_at: number | null } | null;
    challenge: { consumed_at: number | null } | null;
    commitCount: number;
  };
}

test(
  "D1 atomically consumes one enrollment challenge and rejects concurrent replays",
  { timeout: 180_000 },
  async (t) => {
    const migrationOutput = await runCommand([
      "d1", "migrations", "apply", "sac-d1-enrollment-atomicity-test",
      "--local", "--config", CONFIG,
    ]);
    assert.match(migrationOutput, /success|applied|No migrations/i);

    const child = spawn(
      process.execPath,
      [WRANGLER, "dev", "--local", "--config", CONFIG, "--port", String(PORT)],
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
        if (response.status === 200) {
          const result = await response.json() as { ok: boolean };
          if (result.ok) { ready = true; break; }
        }
      } catch { /* Worker is still starting. */ }
      await delay(300);
    }
    assert.equal(ready, true, "D1 Worker did not become ready:\n" + output);

    const approval = (input: Seed) => post<{ approved: boolean; reason?: string }>("/approve", {
      ...input,
      now: Date.now(),
    });

    // Eight simultaneous attempts against the exact same challenge: one winner.
    const concurrent = makeSeed();
    await seed(concurrent);
    const outcomes = await Promise.all(Array.from({ length: 8 }, () => approval(concurrent)));
    assert.equal(outcomes.filter((item) => item.status === 200 && item.data.approved).length, 1);
    assert.equal(outcomes.filter((item) => item.status === 409 && !item.data.approved).length, 7);

    const approvedState = await state(concurrent.ceremonyId);
    assert.equal(approvedState.ceremony?.status, "approved");
    assert.notEqual(approvedState.challenge?.consumed_at, null);
    assert.equal(approvedState.commitCount, 1);

    // A later replay cannot create a second approval or commit receipt.
    const replay = await approval(concurrent);
    assert.equal(replay.status, 409);
    const replayState = await state(concurrent.ceremonyId);
    assert.equal(replayState.commitCount, 1);

    // A wrong digest must leave both the challenge and ceremony untouched.
    const wrongDigest = makeSeed();
    await seed(wrongDigest);
    const wrong = await post<{ approved: boolean }>("/approve", {
      ...wrongDigest,
      challengeDigest: "0".repeat(64),
      now: Date.now(),
    });
    assert.equal(wrong.status, 409);
    const wrongState = await state(wrongDigest.ceremonyId);
    assert.equal(wrongState.ceremony?.status, "pending");
    assert.equal(wrongState.challenge?.consumed_at, null);
    assert.equal(wrongState.commitCount, 0);

    // Expired challenges are not consumed, even if their digest matches.
    const expired = makeSeed({ expired: true });
    await seed(expired);
    const expiredResult = await approval(expired);
    assert.equal(expiredResult.status, 409);
    const expiredState = await state(expired.ceremonyId);
    assert.equal(expiredState.ceremony?.status, "pending");
    assert.equal(expiredState.challenge?.consumed_at, null);

    // A failure after the first write proves D1 batch rollback in this runtime.
    const rollback = makeSeed();
    await seed(rollback);
    const probe = await post<{
      batchRejected: boolean;
      challengeConsumptionRolledBack: boolean;
      ceremonyStillPending: boolean;
    }>("/rollback-probe", { ...rollback, now: Date.now() });
    assert.equal(probe.status, 200);
    assert.equal(probe.data.batchRejected, true);
    assert.equal(probe.data.challengeConsumptionRolledBack, true);
    assert.equal(probe.data.ceremonyStillPending, true);
    const rollbackState = await state(rollback.ceremonyId);
    assert.equal(rollbackState.challenge?.consumed_at, null);
    assert.equal(rollbackState.ceremony?.status, "pending");
    assert.equal(rollbackState.commitCount, 0);
  },
);
