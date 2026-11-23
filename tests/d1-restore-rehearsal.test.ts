import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync, unlinkSync } from "node:fs";
import { once } from "node:events";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

const PORT = 8801;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const CONFIG = "tests/wrangler.d1-restore-rehearsal.toml";
const WRANGLER = "node_modules/wrangler/bin/wrangler.js";

type Projection = {
  sequence: number;
  root_status: string;
  secondary_status: string;
  event_hash: string;
};

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

async function get<T>(path: string): Promise<{ status: number; data: T }> {
  const response = await fetch(BASE_URL + path);
  return { status: response.status, data: await response.json() as T };
}

async function startWorker(stateDir: string): Promise<ChildProcess> {
  const child = spawn(
    process.execPath,
    [WRANGLER, "dev", "--local", "--persist-to", stateDir, "--config", CONFIG, "--port", String(PORT)],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => { output += chunk.toString(); });
  child.stderr?.on("data", (chunk: Buffer) => { output += chunk.toString(); });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("Wrangler exited: " + output);
    try {
      const response = await fetch(BASE_URL + "/health");
      if (response.status === 200 && (await response.json() as { ok: boolean }).ok) return child;
    } catch { /* Worker is still starting. */ }
    await delay(300);
  }
  child.kill("SIGTERM");
  throw new Error("D1 Worker did not become ready:\n" + output);
}

async function stopWorker(child: ChildProcess): Promise<void> {
  if (child.exitCode === null && !child.killed) {
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), delay(5_000)]);
  }
  await delay(300);
}

function findDatabaseFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...findDatabaseFiles(path));
    } else if (/\.sqlite(?:-wal|-shm)?$/.test(entry)) {
      files.push(path);
    }
  }
  return files;
}

function snapshotDatabase(files: string[], backupDir: string): void {
  mkdirSync(backupDir, { recursive: true });
  for (const file of files) copyFileSync(file, join(backupDir, basename(file)));
}

function restoreDatabase(files: string[], backupDir: string): void {
  for (const file of files) rmSync(file, { force: true });
  for (const file of readdirSync(backupDir)) {
    const destination = files.find((candidate) => basename(candidate) === file);
    if (!destination) continue;
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(backupDir, file), destination);
  }
}

test(
  "a real local D1 restore is detected by an external head and fails closed until reconciled",
  { timeout: 240_000 },
  async (t) => {
    const stateDir = mkdtempSync(join(tmpdir(), "sac-d1-restore-state-"));
    const backupDir = mkdtempSync(join(tmpdir(), "sac-d1-restore-backup-"));
    t.after(() => {
      rmSync(stateDir, { recursive: true, force: true });
      rmSync(backupDir, { recursive: true, force: true });
    });

    const migrationOutput = await runCommand([
      "d1", "migrations", "apply", "sac-d1-restore-rehearsal-test",
      "--local", "--persist-to", stateDir, "--config", CONFIG,
    ]);
    assert.match(migrationOutput, /success|applied|No migrations/i);

    let worker = await startWorker(stateDir);
    t.after(async () => { await stopWorker(worker); });

    const root = await post<Projection>("/append", { event: "ROOT_REGISTERED" });
    assert.equal(root.status, 200, JSON.stringify(root.data));
    assert.equal(root.data.sequence, 1);
    const secondary = await post<Projection>("/append", { event: "SECONDARY_ACTIVATED" });
    assert.equal(secondary.status, 200, JSON.stringify(secondary.data));
    assert.equal(secondary.data.sequence, 2);
    assert.equal(secondary.data.root_status, "active");
    assert.equal(secondary.data.secondary_status, "active");
    assert.equal((await get<{ ready: boolean }>(`/ready?sequence=2&hash=${secondary.data.event_hash}`)).status, 200);

    await stopWorker(worker);
    const databaseFiles = findDatabaseFiles(stateDir);
    assert.ok(databaseFiles.length >= 1, "No local D1 SQLite file found under " + stateDir);
    snapshotDatabase(databaseFiles, backupDir);

    worker = await startWorker(stateDir);
    const revoked = await post<Projection>("/append", { event: "ROOT_REVOKED" });
    assert.equal(revoked.status, 200, JSON.stringify(revoked.data));
    assert.equal(revoked.data.sequence, 3);
    assert.equal(revoked.data.root_status, "revoked");
    assert.equal(revoked.data.secondary_status, "revoked");
    assert.equal((await get<{ ready: boolean }>(`/ready?sequence=3&hash=${revoked.data.event_hash}`)).status, 200);

    await stopWorker(worker);
    restoreDatabase(findDatabaseFiles(stateDir), backupDir);
    worker = await startWorker(stateDir);

    const rolledBack = await get<Projection>("/state");
    assert.equal(rolledBack.status, 200);
    assert.equal(rolledBack.data.sequence, 2);
    assert.equal(rolledBack.data.root_status, "active");
    assert.equal(rolledBack.data.secondary_status, "active");

    const staleHead = await get<{ ready: boolean }>(`/ready?sequence=3&hash=${revoked.data.event_hash}`);
    assert.equal(staleHead.status, 503);
    assert.equal(staleHead.data.ready, false);

    const reconciled = await post<Projection>("/append", { event: "ROOT_REVOKED" });
    assert.equal(reconciled.status, 200, JSON.stringify(reconciled.data));
    assert.equal(reconciled.data.sequence, 3);
    assert.equal(reconciled.data.root_status, "revoked");
    assert.equal(reconciled.data.secondary_status, "revoked");
    assert.equal((await get<{ ready: boolean }>(`/ready?sequence=3&hash=${reconciled.data.event_hash}`)).status, 200);
  },
);
