import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

type SecurityEventCommand = {
  accountRef: string;
  operationId: string;
  expectedSequence: number;
  previousHash: string;
  eventType: "root-created" | "root-revoked" | "device-activated" | "device-revoked";
  objectRef: string;
  generation: number;
};

type CommitResult = {
  accountRef: string;
  sequence: number;
  eventHash: string;
  transactionRef: string;
  operationId: string;
};

class ContractError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

class ResponseLostError extends Error {}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * TEST-ONLY behavioral model.
 * It is not an Azure client, CCF emulator, cryptographic receipt verifier,
 * RBAC proof, or evidence of Azure transaction semantics.
 */
class FakeUdeLedger {
  private heads = new Map<string, { sequence: number; hash: string }>();
  private events = new Map<string, SecurityEventCommand & { sequence: number; eventHash: string }>();
  private operations = new Map<string, { commandDigest: string; result: CommitResult }>();

  async append(
    command: SecurityEventCommand,
    options: { failAt?: "after-event" | "after-head"; loseResponseAfterCommit?: boolean } = {},
  ): Promise<CommitResult> {
    this.validate(command);
    const operationKey = `${command.accountRef}:${command.operationId}`;
    const commandDigest = digest(command);
    const previousOperation = this.operations.get(operationKey);

    if (previousOperation) {
      if (previousOperation.commandDigest !== commandDigest) {
        throw new ContractError("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_COMMAND");
      }
      return structuredClone(previousOperation.result);
    }

    const currentHead = this.heads.get(command.accountRef) ?? { sequence: 0, hash: "GENESIS" };
    if (command.expectedSequence !== currentHead.sequence) {
      throw new ContractError("STALE_SEQUENCE");
    }
    if (command.previousHash !== currentHead.hash) {
      throw new ContractError("PREVIOUS_HASH_MISMATCH");
    }

    // Copy-on-write models one all-or-nothing UDE transaction.
    const nextHeads = new Map(this.heads);
    const nextEvents = new Map(this.events);
    const nextOperations = new Map(this.operations);

    const sequence = currentHead.sequence + 1;
    const eventHash = digest({ ...command, sequence, previousHash: currentHead.hash });
    const eventKey = `${command.accountRef}:${sequence}`;
    if (nextEvents.has(eventKey)) throw new ContractError("EVENT_KEY_ALREADY_EXISTS");

    nextEvents.set(eventKey, { ...command, sequence, eventHash });
    if (options.failAt === "after-event") throw new ContractError("INJECTED_FAILURE_AFTER_EVENT");

    nextHeads.set(command.accountRef, { sequence, hash: eventHash });
    if (options.failAt === "after-head") throw new ContractError("INJECTED_FAILURE_AFTER_HEAD");

    const result: CommitResult = {
      accountRef: command.accountRef,
      sequence,
      eventHash,
      // Opaque synthetic reference only; NOT an Azure transaction ID or receipt.
      transactionRef: `TEST-ONLY-${command.accountRef}-${sequence}`,
      operationId: command.operationId,
    };
    nextOperations.set(operationKey, { commandDigest, result });

    this.heads = nextHeads;
    this.events = nextEvents;
    this.operations = nextOperations;

    if (options.loseResponseAfterCommit) throw new ResponseLostError("RESPONSE_LOST_AFTER_COMMIT");
    return structuredClone(result);
  }

  readHead(accountRef: string) {
    return structuredClone(this.heads.get(accountRef) ?? { sequence: 0, hash: "GENESIS" });
  }

  readOperation(accountRef: string, operationId: string) {
    const item = this.operations.get(`${accountRef}:${operationId}`);
    return item ? structuredClone(item.result) : null;
  }

  readEvents(accountRef: string) {
    return [...this.events.values()]
      .filter((event) => event.accountRef === accountRef)
      .sort((a, b) => a.sequence - b.sequence)
      .map((event) => structuredClone(event));
  }

  private validate(command: SecurityEventCommand) {
    if (!/^[a-zA-Z0-9_-]{8,96}$/.test(command.accountRef)) throw new ContractError("INVALID_ACCOUNT_REF");
    if (!/^[a-zA-Z0-9_-]{16,96}$/.test(command.operationId)) throw new ContractError("INVALID_OPERATION_ID");
    if (!Number.isSafeInteger(command.expectedSequence) || command.expectedSequence < 0) {
      throw new ContractError("INVALID_EXPECTED_SEQUENCE");
    }
    if (!/^(GENESIS|[a-f0-9]{64})$/.test(command.previousHash)) throw new ContractError("INVALID_PREVIOUS_HASH_FORMAT");
    if (!["root-created", "root-revoked", "device-activated", "device-revoked"].includes(command.eventType)) {
      throw new ContractError("INVALID_EVENT_TYPE");
    }
    if (!/^[a-zA-Z0-9_-]{8,96}$/.test(command.objectRef)) throw new ContractError("INVALID_OBJECT_REF");
    if (!Number.isSafeInteger(command.generation) || command.generation < 1) {
      throw new ContractError("INVALID_GENERATION");
    }
  }
}

function command(overrides: Partial<SecurityEventCommand> = {}): SecurityEventCommand {
  return {
    accountRef: "acct_test_01",
    operationId: "operation_test_0001",
    expectedSequence: 0,
    previousHash: "GENESIS",
    eventType: "root-created",
    objectRef: "root_device_01",
    generation: 1,
    ...overrides,
  };
}

test("une seule commande concurrente peut avancer une même tête", async () => {
  const ledger = new FakeUdeLedger();
  const commands = [
    command({ operationId: "operation_test_0001" }),
    command({ operationId: "operation_test_0002", eventType: "device-activated", objectRef: "device_test_02" }),
  ];
  const results = await Promise.allSettled(commands.map((item) => ledger.append(item)));
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(results.filter((item) => item.status === "rejected").length, 1);
  assert.equal(ledger.readHead("acct_test_01").sequence, 1);
  assert.equal(ledger.readEvents("acct_test_01").length, 1);
});

test("une séquence périmée est rejetée sans mutation", async () => {
  const ledger = new FakeUdeLedger();
  await ledger.append(command());
  await assert.rejects(
    ledger.append(command({ operationId: "operation_test_0002" })),
    (error: unknown) => error instanceof ContractError && error.code === "STALE_SEQUENCE",
  );
  assert.equal(ledger.readHead("acct_test_01").sequence, 1);
  assert.equal(ledger.readEvents("acct_test_01").length, 1);
});

test("une empreinte précédente incorrecte est rejetée sans mutation", async () => {
  const ledger = new FakeUdeLedger();
  await assert.rejects(
    ledger.append(command({ previousHash: "a".repeat(64) })),
    (error: unknown) => error instanceof ContractError && error.code === "PREVIOUS_HASH_MISMATCH",
  );
  assert.equal(ledger.readHead("acct_test_01").sequence, 0);
  assert.equal(ledger.readEvents("acct_test_01").length, 0);
});

test("même clé idempotente et même commande retrouvent le résultat sans nouvel événement", async () => {
  const ledger = new FakeUdeLedger();
  const first = await ledger.append(command());
  const retry = await ledger.append(command());
  assert.deepEqual(retry, first);
  assert.equal(ledger.readEvents("acct_test_01").length, 1);
});

test("réutiliser une clé idempotente avec un contenu différent est refusé", async () => {
  const ledger = new FakeUdeLedger();
  await ledger.append(command());
  await assert.rejects(
    ledger.append(command({ objectRef: "different_device_02" })),
    (error: unknown) =>
      error instanceof ContractError && error.code === "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_COMMAND",
  );
  assert.equal(ledger.readEvents("acct_test_01").length, 1);
});

test("une erreur après écriture de l'événement annule toute la transaction modèle", async () => {
  for (const failAt of ["after-event", "after-head"] as const) {
    const ledger = new FakeUdeLedger();
    await assert.rejects(ledger.append(command(), { failAt }));
    assert.equal(ledger.readHead("acct_test_01").sequence, 0);
    assert.equal(ledger.readEvents("acct_test_01").length, 0);
    assert.equal(ledger.readOperation("acct_test_01", "operation_test_0001"), null);
  }
});

test("une réponse perdue après commit est récupérée par la même clé sans double append", async () => {
  const ledger = new FakeUdeLedger();
  await assert.rejects(
    ledger.append(command(), { loseResponseAfterCommit: true }),
    (error: unknown) => error instanceof ResponseLostError,
  );
  const committed = ledger.readOperation("acct_test_01", "operation_test_0001");
  const retry = await ledger.append(command());
  assert.deepEqual(retry, committed);
  assert.equal(ledger.readEvents("acct_test_01").length, 1);
});

test("une autre tête de compte n'est pas modifiée par une commande", async () => {
  const ledger = new FakeUdeLedger();
  await ledger.append(command({ accountRef: "acct_test_01" }));
  await ledger.append(command({
    accountRef: "acct_test_02",
    operationId: "operation_test_0002",
    objectRef: "root_device_02",
  }));
  assert.equal(ledger.readHead("acct_test_01").sequence, 1);
  assert.equal(ledger.readHead("acct_test_02").sequence, 1);
});

test("le modèle refuse les références et séquences mal formées", async () => {
  const ledger = new FakeUdeLedger();
  await assert.rejects(ledger.append(command({ accountRef: "email@example.com" })));
  await assert.rejects(ledger.append(command({ expectedSequence: -1 })));
  await assert.rejects(ledger.append(command({ generation: 0 })));
  assert.equal(ledger.readEvents("acct_test_01").length, 0);
});

class FakeUdeGateway {
  async request(path: string, method: string) {
    if (path === "/sac/security-events" && method === "POST") return { status: 200 };
    // Test-only allowlist: every unlisted native/admin route is denied.
    return { status: 403 };
  }
}

test("la politique locale n'autorise que la route métier déclarée", async () => {
  const gateway = new FakeUdeGateway();
  assert.equal((await gateway.request("/sac/security-events", "POST")).status, 200);
  assert.equal((await gateway.request("/app/transactions", "POST")).status, 403);
  assert.equal((await gateway.request("/app/users", "POST")).status, 403);
  assert.equal((await gateway.request("/app/ledger", "DELETE")).status, 403);
});
