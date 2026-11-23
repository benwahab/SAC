import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRestoreGate, type SecurityAnchorAuthority } from "../src/domain/device-enrollment-restore-gate.ts";
import { computeSecurityAnchorHash, type SecurityAnchorHead } from "../src/domain/security-anchor.ts";

const ZERO = "0".repeat(64);

async function head(sequence: number, previous: string, event: string): Promise<SecurityAnchorHead> {
  return { sequence, hash: await computeSecurityAnchorHash(sequence, previous, event) };
}

function authority(value: SecurityAnchorHead | Error): SecurityAnchorAuthority {
  return {
    async readHead() {
      if (value instanceof Error) throw value;
      return value;
    },
  };
}

test("la gate accepte uniquement une projection exactement synchronisée", async () => {
  const first = await head(1, ZERO, "ROOT_REGISTERED");
  const second = await head(2, first.hash, "SECONDARY_ACTIVATED");
  const decision = await evaluateRestoreGate(authority(second), second);
  assert.deepEqual(decision, { ready: true, head: second });
});

test("une projection en retard est refusée sans réconciliation automatique", async () => {
  const first = await head(1, ZERO, "ROOT_REGISTERED");
  const second = await head(2, first.hash, "SECONDARY_ACTIVATED");
  assert.deepEqual(await evaluateRestoreGate(authority(second), first), {
    ready: false,
    reason: "projection_stale",
  });
});

test("une projection en avance est refusée, jamais alignée par devinette", async () => {
  const first = await head(1, ZERO, "ROOT_REGISTERED");
  const second = await head(2, first.hash, "SECONDARY_ACTIVATED");
  assert.deepEqual(await evaluateRestoreGate(authority(first), second), {
    ready: false,
    reason: "projection_ahead",
  });
});

test("une même séquence avec un hash différent est refusée", async () => {
  const first = await head(1, ZERO, "ROOT_REGISTERED");
  const other = await head(1, ZERO, "ROOT_REVOKED");
  assert.deepEqual(await evaluateRestoreGate(authority(first), other), {
    ready: false,
    reason: "head_mismatch",
  });
});

test("une autorité indisponible ou invalide ferme la gate", async () => {
  const first = await head(1, ZERO, "ROOT_REGISTERED");
  assert.deepEqual(await evaluateRestoreGate(authority(new Error("offline")), first), {
    ready: false,
    reason: "anchor_unavailable",
  });
  assert.deepEqual(await evaluateRestoreGate(authority({ sequence: 1, hash: "bad" } as SecurityAnchorHead), first), {
    ready: false,
    reason: "anchor_invalid",
  });
});

test("une projection invalide ferme la gate avant même de lire l’ancre", async () => {
  let reads = 0;
  const authorityValue: SecurityAnchorAuthority = {
    async readHead() {
      reads += 1;
      return await head(1, ZERO, "ROOT_REGISTERED");
    },
  };
  assert.deepEqual(await evaluateRestoreGate(authorityValue, { sequence: -1, hash: ZERO }), {
    ready: false,
    reason: "projection_invalid",
  });
  assert.equal(reads, 0);
});
