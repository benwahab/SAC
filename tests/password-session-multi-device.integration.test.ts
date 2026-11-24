import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

const PORT = 8810;
const BASE = `http://127.0.0.1:${PORT}`;
const ORIGIN = BASE;
const CONFIG = "tests/wrangler.password-session-multi-device.toml";
const WRANGLER = "node_modules/wrangler/bin/wrangler.js";
const STATE = mkdtempSync(join(tmpdir(), "sac-password-multi-device-"));

async function command(args: string[]): Promise<string> {
  const child = spawn(process.execPath, [WRANGLER, ...args], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => { output += chunk.toString(); });
  child.stderr?.on("data", (chunk: Buffer) => { output += chunk.toString(); });
  const [code] = await once(child, "exit") as [number | null];
  if (code !== 0) throw new Error(`Wrangler failed: ${args.join(" ")}\n${output}`);
  return output;
}

async function post<T>(path: string, body: unknown, cookie?: string): Promise<{ status: number; data: T; cookies: string[] }> {
  const headers: Record<string, string> = { Origin: ORIGIN, "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(BASE + path, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await response.text();
  if (!response.ok) throw new Error(`POST ${path} -> ${response.status}: ${text.slice(0, 300)}`);
  return { status: response.status, data: JSON.parse(text) as T, cookies: response.headers.getSetCookie() };
}

async function get<T>(path: string): Promise<{ status: number; data: T }> {
  const response = await fetch(BASE + path);
  const text = await response.text();
  if (!response.ok) throw new Error(`GET ${path} -> ${response.status}: ${text.slice(0, 300)}`);
  return { status: response.status, data: JSON.parse(text) as T };
}

test("la connexion multi-appareils crée, réutilise et remplace les appareils dans D1 réel", { timeout: 180_000 }, async (t) => {
  t.after(() => rmSync(STATE, { recursive: true, force: true }));
  const applied = await command(["d1", "migrations", "apply", "sac-password-session-multi-device-test", "--local", "--persist-to", STATE, "--config", CONFIG]);
  assert.match(applied, /success|applied|No migrations/i);

  const child = spawn(process.execPath, [WRANGLER, "dev", "--local", "--persist-to", STATE, "--config", CONFIG, "--port", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => { output += chunk.toString(); });
  child.stderr?.on("data", (chunk: Buffer) => { output += chunk.toString(); });
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([once(child, "exit"), delay(3000)]);
    }
  });

  let ready = false;
  for (let index = 0; index < 200; index += 1) {
    try {
      const response = await fetch(BASE + "/health");
      if (response.ok) { ready = true; break; }
    } catch {}
    await delay(300);
  }
  assert.equal(ready, true, output);

  const seeded = await post<{ email: string; password: string; accountId: string; rootDeviceId: string }>("/seed", {});
  assert.equal(seeded.status, 201, JSON.stringify(seeded.data));

  const first = await post<{ authenticated: boolean; securityKeyConfigured: boolean }>(
    "/api/auth/password-session",
    { email: seeded.data.email, password: seeded.data.password },
  );
  assert.equal(first.status, 201, JSON.stringify(first.data));
  assert.equal(first.data.authenticated, true);
  assert.equal(first.data.securityKeyConfigured, true);
  const sessionCookie = first.cookies.find((cookie) => cookie.startsWith("__Host-sac_session="));
  const deviceCookie = first.cookies.find((cookie) => cookie.startsWith("__Host-sac_device="));
  assert.ok(sessionCookie);
  assert.ok(deviceCookie);

  const firstState = await get<{ devices: Array<{ id: string; status: string }>; sessions: unknown[] }>("/state");
  assert.equal(firstState.data.devices.length, 2);
  assert.equal(firstState.data.sessions.length, 1);

  const second = await post<{ authenticated: boolean }>(
    "/api/auth/password-session",
    { email: seeded.data.email, password: seeded.data.password },
    deviceCookie!.split(";")[0],
  );
  assert.equal(second.status, 201, JSON.stringify(second.data));
  const secondState = await get<{ devices: Array<{ id: string; status: string }>; sessions: unknown[] }>("/state");
  assert.equal(secondState.data.devices.length, 2);
  assert.equal(secondState.data.sessions.length, 2);

  const createdDeviceId = secondState.data.devices.find((device) => device.id !== seeded.data.rootDeviceId)?.id;
  assert.ok(createdDeviceId);
  const revoked = await post<{ revoked: boolean }>("/revoke", { deviceId: createdDeviceId });
  assert.equal(revoked.status, 200);

  const third = await post<{ authenticated: boolean }>(
    "/api/auth/password-session",
    { email: seeded.data.email, password: seeded.data.password },
    deviceCookie!.split(";")[0],
  );
  assert.equal(third.status, 201, JSON.stringify(third.data));
  const thirdState = await get<{ devices: Array<{ id: string; status: string }> }>("/state");
  assert.equal(thirdState.data.devices.length, 3);
});
