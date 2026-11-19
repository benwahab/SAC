import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

const PORT = 8801;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const CONFIG = "tests/wrangler.contact-invitations.toml";
const WRANGLER = "node_modules/wrangler/bin/wrangler.js";

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

test(
  "trusted contact invitation service persists, accepts, lists and revokes relationships in isolated D1",
  { timeout: 180_000 },
  async (t) => {
    const migrationOutput = await runCommand([
      "d1", "migrations", "apply", "sac-contact-invitations-test",
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
    assert.equal(ready, true, "Contact invitation Worker did not become ready:\n" + output);

    const seeded = await post<{
      ownerId: string; ownerEmail: string; contactId: string; contactEmail: string;
      contact2Id: string; contact2Email: string; contact3Id: string; contact3Email: string;
    }>("/seed", {});
    assert.equal(seeded.status, 200);
    const { ownerId, contactId, contactEmail, contact2Id, contact2Email, contact3Id, contact3Email } = seeded.data;

    const now = Date.now();

    const failedDelivery = await post<{ error: string; invitationId: string }>("/create-and-send", {
      ownerId,
      destinationEmail: contact3Email,
      expiresAt: now + 24 * 60 * 60 * 1000,
      now,
      failDelivery: true,
    });
    assert.equal(failedDelivery.status, 400);
    assert.equal(failedDelivery.data.error, "delivery_failed");

    const cancelledStatus = await post<{ status: string }>("/invitation-status", {
      invitationId: failedDelivery.data.invitationId,
    });
    // The delivery endpoint intentionally does not return a raw token or
    // invitation metadata on failure; a later successful invite can be issued.
    assert.equal(cancelledStatus.status, 200);
    assert.equal(cancelledStatus.data.status, "revoked");

    const created = await post<{
      invitationId: string; token: string; destinationEmail: string; expiresAt: number;
    }>("/create", {
      ownerId,
      destinationEmail: contactEmail,
      expiresAt: now + 24 * 60 * 60 * 1000,
      now,
    });
    assert.equal(created.status, 200);
    assert.equal(created.data.destinationEmail, contactEmail);
    assert.match(created.data.token, /^[A-Za-z0-9_-]{43}$/);

    const invalid = await post<{ error: string }>("/accept", {
      contactId,
      invitationId: created.data.invitationId,
      token: "A".repeat(43),
      now: now + 1,
    });
    assert.equal(invalid.status, 409);

    const accepted = await post<{
      ownerAccountId: string; contactAccountId: string;
    }>("/accept", {
      contactId,
      invitationId: created.data.invitationId,
      token: created.data.token,
      now: now + 2,
    });
    assert.equal(accepted.status, 200);
    assert.deepEqual(accepted.data, { ownerAccountId: ownerId, contactAccountId: contactId });

    const replay = await post<{ error: string }>("/accept", {
      contactId,
      invitationId: created.data.invitationId,
      token: created.data.token,
      now: now + 3,
    });
    assert.equal(replay.status, 409);

    const ownerContacts = await post<{ contacts: Array<{ accountId: string; email: string }> }>(
      "/contacts", { ownerId },
    );
    assert.equal(ownerContacts.status, 200);
    assert.equal(ownerContacts.data.contacts.length, 1);
    assert.equal(ownerContacts.data.contacts[0].accountId, contactId);
    assert.equal(ownerContacts.data.contacts[0].email, contactEmail);

    const reverseContacts = await post<{ contacts: unknown[] }>("/contacts", { ownerId: contactId });
    assert.equal(reverseContacts.status, 200);
    assert.equal(reverseContacts.data.contacts.length, 0);

    // The free plan has two active trusted-contact slots. The limit is
    // checked inside the same D1 transaction that accepts the invitation.
    const secondNow = now + 10;
    const secondInvitation = await post<{ invitationId: string; token: string }>("/create", {
      ownerId,
      destinationEmail: contact2Email,
      expiresAt: now + 24 * 60 * 60 * 1000,
      now: secondNow,
    });
    assert.equal(secondInvitation.status, 200);
    const secondAccepted = await post<{ contactAccountId: string }>("/accept", {
      contactId: contact2Id,
      invitationId: secondInvitation.data.invitationId,
      token: secondInvitation.data.token,
      now: secondNow + 1,
    });
    assert.equal(secondAccepted.status, 200);
    assert.equal(secondAccepted.data.contactAccountId, contact2Id);

    const thirdNow = now + 20;
    const thirdInvitation = await post<{ invitationId: string; token: string }>("/create", {
      ownerId,
      destinationEmail: contact3Email,
      expiresAt: now + 24 * 60 * 60 * 1000,
      now: thirdNow,
    });
    assert.equal(thirdInvitation.status, 200);
    const overLimit = await post<{ error: string }>("/accept", {
      contactId: contact3Id,
      invitationId: thirdInvitation.data.invitationId,
      token: thirdInvitation.data.token,
      now: thirdNow + 1,
    });
    assert.equal(overLimit.status, 409);
    assert.equal(overLimit.data.error, "contact_limit_reached");

    const atLimit = await post<{ contacts: unknown[] }>("/contacts", { ownerId });
    assert.equal(atLimit.status, 200);
    assert.equal(atLimit.data.contacts.length, 2);

    const wrongOwnerRevoke = await post<{ error: string }>("/revoke", {
      ownerId: contactId,
      contactId: ownerId,
      now: now + 4,
    });
    assert.equal(wrongOwnerRevoke.status, 409);

    const revoked = await post<{ revoked: boolean }>("/revoke", {
      ownerId,
      contactId,
      now: now + 5,
    });
    assert.equal(revoked.status, 200);
    assert.equal(revoked.data.revoked, true);

    const afterRevoke = await post<{ contacts: unknown[] }>("/contacts", { ownerId });
    assert.equal(afterRevoke.status, 200);
    assert.equal(afterRevoke.data.contacts.length, 1);
    assert.equal((afterRevoke.data.contacts[0] as { accountId: string }).accountId, contact2Id);
  },
);
