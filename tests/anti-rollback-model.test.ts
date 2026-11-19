import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

type SecurityEvent =
  | { type: "ROOT_REGISTERED"; rootDeviceId: string; generation: number }
  | { type: "ROOT_REVOKED"; rootDeviceId: string; generation: number }
  | { type: "DEVICE_ACTIVATED"; deviceId: string }
  | { type: "DEVICE_REVOKED"; deviceId: string }
  | { type: "CHALLENGE_CONSUMED"; challengeIdDigest: string };

type LedgerEntry = {
  sequence: number;
  commandId: string;
  previousHash: string;
  event: SecurityEvent;
  hash: string;
};

const GENESIS = "0".repeat(64);
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const encodeEvent = (event: SecurityEvent) => JSON.stringify(event);

class IndependentAnchorModel {
  private entries: LedgerEntry[] = [];
  private commands = new Map<string, string>();
  available = true;

  head(): { sequence: number; hash: string } {
    const last = this.entries.at(-1);
    return { sequence: last?.sequence ?? 0, hash: last?.hash ?? GENESIS };
  }

  append(expectedSequence: number, commandId: string, event: SecurityEvent): LedgerEntry {
    if (!this.available) throw new Error("anchor_unavailable");
    const encoded = encodeEvent(event);
    const prior = this.commands.get(commandId);
    if (prior) {
      if (prior !== encoded) throw new Error("idempotency_conflict");
      const existing = this.entries.find((entry) => entry.commandId === commandId);
      if (!existing) throw new Error("anchor_integrity_error");
      return structuredClone(existing);
    }
    const head = this.head();
    if (head.sequence !== expectedSequence) throw new Error("anchor_sequence_conflict");
    const sequence = head.sequence + 1;
    const hash = sha256(sequence + "\n" + head.hash + "\n" + encoded);
    const entry: LedgerEntry = {
      sequence,
      commandId,
      previousHash: head.hash,
      event: structuredClone(event),
      hash,
    };
    this.entries.push(entry);
    this.commands.set(commandId, encoded);
    return structuredClone(entry);
  }

  readEntries(): LedgerEntry[] {
    if (!this.available) throw new Error("anchor_unavailable");
    return structuredClone(this.entries);
  }

  verify(): boolean {
    if (!this.available) return false;
    let previousHash = GENESIS;
    for (let index = 0; index < this.entries.length; index += 1) {
      const entry = this.entries[index];
      const expectedSequence = index + 1;
      const expectedHash = sha256(
        expectedSequence + "\n" + previousHash + "\n" + encodeEvent(entry.event),
      );
      if (entry.sequence !== expectedSequence
        || entry.previousHash !== previousHash
        || entry.hash !== expectedHash) return false;
      previousHash = entry.hash;
    }
    return true;
  }

  hashAt(sequence: number): string | null {
    if (sequence === 0) return GENESIS;
    return this.entries[sequence - 1]?.hash ?? null;
  }

  corruptLastEntryForTest(): void {
    const last = this.entries.at(-1);
    if (last) last.event = { type: "DEVICE_REVOKED", deviceId: "tampered" };
  }
}

type ProjectionSnapshot = {
  sequence: number;
  hash: string;
  root: { deviceId: string; generation: number; status: "active" | "revoked" } | null;
  devices: Record<string, "active" | "revoked">;
  consumedChallengeDigests: string[];
};

class D1ProjectionModel {
  state: ProjectionSnapshot = {
    sequence: 0,
    hash: GENESIS,
    root: null,
    devices: {},
    consumedChallengeDigests: [],
  };

  snapshot(): ProjectionSnapshot {
    return structuredClone(this.state);
  }

  restore(snapshot: ProjectionSnapshot): void {
    this.state = structuredClone(snapshot);
  }

  apply(entry: LedgerEntry): void {
    if (entry.sequence !== this.state.sequence + 1
      || entry.previousHash !== this.state.hash) throw new Error("projection_sequence_conflict");

    switch (entry.event.type) {
      case "ROOT_REGISTERED":
        this.state.root = {
          deviceId: entry.event.rootDeviceId,
          generation: entry.event.generation,
          status: "active",
        };
        this.state.devices[entry.event.rootDeviceId] = "active";
        break;
      case "ROOT_REVOKED":
        if (this.state.root?.deviceId !== entry.event.rootDeviceId
          || this.state.root.generation !== entry.event.generation) {
          throw new Error("root_generation_mismatch");
        }
        this.state.root.status = "revoked";
        this.state.devices[entry.event.rootDeviceId] = "revoked";
        break;
      case "DEVICE_ACTIVATED":
        this.state.devices[entry.event.deviceId] = "active";
        break;
      case "DEVICE_REVOKED":
        this.state.devices[entry.event.deviceId] = "revoked";
        break;
      case "CHALLENGE_CONSUMED":
        if (!this.state.consumedChallengeDigests.includes(entry.event.challengeIdDigest)) {
          this.state.consumedChallengeDigests.push(entry.event.challengeIdDigest);
        }
        break;
    }

    this.state.sequence = entry.sequence;
    this.state.hash = entry.hash;
  }
}

function isSynchronized(anchor: IndependentAnchorModel, d1: D1ProjectionModel): boolean {
  if (!anchor.verify()) return false;
  const head = anchor.head();
  return d1.state.sequence === head.sequence && d1.state.hash === head.hash;
}

function reconcile(anchor: IndependentAnchorModel, d1: D1ProjectionModel): boolean {
  if (!anchor.verify()) return false;
  const entries = anchor.readEntries();
  if (d1.state.sequence > entries.length) return false;
  if (anchor.hashAt(d1.state.sequence) !== d1.state.hash) return false;

  for (const entry of entries.slice(d1.state.sequence)) {
    try {
      d1.apply(entry);
    } catch {
      return false;
    }
  }
  return isSynchronized(anchor, d1);
}

function appendThenProject(
  anchor: IndependentAnchorModel,
  d1: D1ProjectionModel,
  commandId: string,
  event: SecurityEvent,
  failAfterAnchor = false,
): void {
  const head = anchor.head();
  const entry = anchor.append(head.sequence, commandId, event);
  if (failAfterAnchor) throw new Error("simulated_d1_unavailable_after_anchor_commit");
  d1.apply(entry);
}

test("D1 rollback before root revocation is detected and revocation is replayed", () => {
  const anchor = new IndependentAnchorModel();
  const d1 = new D1ProjectionModel();
  appendThenProject(anchor, d1, "root-create-1", {
    type: "ROOT_REGISTERED", rootDeviceId: "root-A", generation: 1,
  });
  const beforeRevocation = d1.snapshot();

  appendThenProject(anchor, d1, "root-revoke-1", {
    type: "ROOT_REVOKED", rootDeviceId: "root-A", generation: 1,
  });
  assert.equal(d1.state.root?.status, "revoked");
  assert.equal(isSynchronized(anchor, d1), true);

  d1.restore(beforeRevocation);
  assert.equal(isSynchronized(anchor, d1), false);
  assert.equal(reconcile(anchor, d1), true);
  assert.equal(d1.state.root?.status, "revoked");
  assert.equal(isSynchronized(anchor, d1), true);
});

test("anchor-first partial commit fails closed until D1 projection is reconciled", () => {
  const anchor = new IndependentAnchorModel();
  const d1 = new D1ProjectionModel();

  assert.throws(() => appendThenProject(
    anchor,
    d1,
    "device-revoke-1",
    { type: "DEVICE_REVOKED", deviceId: "device-B" },
    true,
  ), /simulated_d1_unavailable_after_anchor_commit/);

  assert.equal(isSynchronized(anchor, d1), false);
  assert.equal(reconcile(anchor, d1), true);
  assert.equal(d1.state.devices["device-B"], "revoked");
});

test("restoring D1 before challenge consumption cannot make the challenge reusable", () => {
  const anchor = new IndependentAnchorModel();
  const d1 = new D1ProjectionModel();
  const beforeConsume = d1.snapshot();
  const digest = sha256("opaque-challenge-id");

  appendThenProject(anchor, d1, "consume-challenge-1", {
    type: "CHALLENGE_CONSUMED", challengeIdDigest: digest,
  });
  assert.equal(d1.state.consumedChallengeDigests.includes(digest), true);

  d1.restore(beforeConsume);
  assert.equal(isSynchronized(anchor, d1), false);
  assert.equal(reconcile(anchor, d1), true);
  assert.equal(d1.state.consumedChallengeDigests.includes(digest), true);
});

test("idempotent command replay does not append a second security event", () => {
  const anchor = new IndependentAnchorModel();
  const d1 = new D1ProjectionModel();
  const event: SecurityEvent = { type: "DEVICE_REVOKED", deviceId: "device-C" };

  appendThenProject(anchor, d1, "revoke-device-C", event);
  const firstHead = anchor.head();
  const duplicate = anchor.append(0, "revoke-device-C", event);

  assert.equal(duplicate.sequence, 1);
  assert.deepEqual(anchor.head(), firstHead);
  assert.equal(isSynchronized(anchor, d1), true);
  assert.throws(() => anchor.append(1, "revoke-device-C", {
    type: "DEVICE_REVOKED", deviceId: "different-device",
  }), /idempotency_conflict/);
});

test("tampered anchor history is rejected and cannot reconcile D1", () => {
  const anchor = new IndependentAnchorModel();
  const d1 = new D1ProjectionModel();
  appendThenProject(anchor, d1, "activate-device-D", {
    type: "DEVICE_ACTIVATED", deviceId: "device-D",
  });
  anchor.corruptLastEntryForTest();

  assert.equal(anchor.verify(), false);
  assert.equal(isSynchronized(anchor, d1), false);
  assert.equal(reconcile(anchor, d1), false);
});

test("anchor outage fails closed for security-sensitive authorization", () => {
  const anchor = new IndependentAnchorModel();
  const d1 = new D1ProjectionModel();
  appendThenProject(anchor, d1, "activate-device-E", {
    type: "DEVICE_ACTIVATED", deviceId: "device-E",
  });
  anchor.available = false;

  assert.equal(isSynchronized(anchor, d1), false);
  assert.equal(reconcile(anchor, d1), false);
});

test("a D1 projection ahead of the authoritative anchor is not auto-reconciled", () => {
  const authoritativeAnchor = new IndependentAnchorModel();
  const projectedD1 = new D1ProjectionModel();
  const newerAnchor = new IndependentAnchorModel();
  const newerD1 = new D1ProjectionModel();

  appendThenProject(authoritativeAnchor, projectedD1, "event-1", {
    type: "DEVICE_ACTIVATED", deviceId: "device-F",
  });
  appendThenProject(newerAnchor, newerD1, "event-1", {
    type: "DEVICE_ACTIVATED", deviceId: "device-F",
  });
  appendThenProject(newerAnchor, newerD1, "event-2", {
    type: "DEVICE_REVOKED", deviceId: "device-F",
  });

  // Simulate a projection copied from a later timeline while the independent
  // anchor only knows the earlier head. The model must not guess or roll back.
  projectedD1.restore(newerD1.snapshot());
  assert.equal(isSynchronized(authoritativeAnchor, projectedD1), false);
  assert.equal(reconcile(authoritativeAnchor, projectedD1), false);
});
