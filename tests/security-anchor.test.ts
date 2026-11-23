import assert from "node:assert/strict";
import test from "node:test";
import {
  computeSecurityAnchorHash,
  isNextSecurityAnchorSequence,
  isSecurityAnchorHead,
  isSecurityProjectionSynchronized,
} from "../src/domain/security-anchor.ts";

const ZERO = "0".repeat(64);

test("l’ancre chaîne la séquence, le hash précédent et l’événement", async () => {
  const first = await computeSecurityAnchorHash(1, ZERO, "ROOT_REGISTERED");
  assert.equal(first, "ac2c5733bb1dec56ede11d8b784b28c30fe94f93c39090c4aeb6d18a675c69f2");
  const second = await computeSecurityAnchorHash(2, first, "SECONDARY_ACTIVATED");
  assert.equal(second, "6c8c617b865277572605fafb2b54d76b4cb7bc3d6452bf9a662ddf8df6605aa1");
});

test("les têtes d’ancre et de projection doivent être strictement synchronisées", () => {
  const head = { sequence: 3, hash: "a".repeat(64) };
  assert.equal(isSecurityAnchorHead(head), true);
  assert.equal(isSecurityAnchorHead({ sequence: 3, hash: "A".repeat(64) }), false);
  assert.equal(isSecurityAnchorHead({ sequence: -1, hash: "a".repeat(64) }), false);
  assert.equal(isSecurityProjectionSynchronized({ sequence: 3, hash: "a".repeat(64) }, head), true);
  assert.equal(isSecurityProjectionSynchronized({ sequence: 2, hash: "a".repeat(64) }, head), false);
  assert.equal(isSecurityProjectionSynchronized({ sequence: 3, hash: "b".repeat(64) }, head), false);
});

test("une nouvelle entrée doit avancer exactement d’une séquence", () => {
  const current = { sequence: 4, hash: "a".repeat(64) };
  assert.equal(isNextSecurityAnchorSequence(current, { sequence: 5, hash: "b".repeat(64) }), true);
  assert.equal(isNextSecurityAnchorSequence(current, { sequence: 6, hash: "b".repeat(64) }), false);
  assert.equal(isNextSecurityAnchorSequence(current, { sequence: 4, hash: "b".repeat(64) }), false);
});

test("une entrée invalide ne peut pas être hashée", async () => {
  await assert.rejects(computeSecurityAnchorHash(0, ZERO, "ROOT_REGISTERED"), /security_anchor_invalid_entry/);
  await assert.rejects(computeSecurityAnchorHash(1, "not-a-hash", "ROOT_REGISTERED"), /security_anchor_invalid_entry/);
});
