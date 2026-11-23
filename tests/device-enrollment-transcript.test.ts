import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  DEVICE_ENROLLMENT_CEREMONY_TTL_MS,
  buildDeviceEnrollmentTranscript,
  canonicalizeDeviceEnrollmentTranscript,
  computeDeviceEnrollmentKeyThumbprint,
  deriveDeviceEnrollmentSas,
  deviceEnrollmentAssertionChallenge,
  deviceEnrollmentSignaturePayload,
  hashDeviceEnrollmentTranscript,
  isDeviceEnrollmentTranscriptFresh,
  matchesDeviceEnrollmentRootThumbprint,
  parseDeviceEnrollmentTranscript,
  validateDeviceEnrollmentPublicKeys,
  type DeviceEnrollmentTranscript,
  type DeviceEnrollmentTranscriptInput,
} from "../src/domain/device-enrollment-transcript.ts";
import { SAS_WORDLIST_EN_V1 } from "../src/domain/device-enrollment-sas-wordlist.ts";

const IDENTITY_KEY = {
  kty: "EC" as const,
  crv: "P-256" as const,
  x: "NIlc9Qcp9HK_uID5f8-oQmBB3hWWmcaDBsfL3mXoN3k",
  y: "iDT1z39uVSdkrpfaPADvoPnMA3pAtpRJ-SgkSLlJ-Ec",
};
const AGREEMENT_KEY = {
  kty: "EC" as const,
  crv: "P-256" as const,
  x: "EmfIJ6qNBvALHzVRIHgXSFeaA8nYIh9-zcMuMEpjYE8",
  y: "rdP4tFHnjfoNPbC8DOdSYB_BJhz9IEWdxK4r84Dtm-o",
};
const INPUT: DeviceEnrollmentTranscriptInput = {
  accountId: "account-example-001",
  rootDeviceId: "root-device-example-001",
  rootKeyVersion: 1,
  rootIdentityKeyThumbprint: "A".repeat(43),
  ceremonyId: "A".repeat(22),
  challengeId: "AQEBAQEBAQEBAQEBAQEBAQ",
  challenge: "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI",
  newDeviceId: "AwMDAwMDAwMDAwMDAwMDAw",
  newDeviceNonce: "BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ",
  rootNonce: "BQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU",
  platform: "android",
  identityPublicKey: IDENTITY_KEY,
  agreementPublicKey: AGREEMENT_KEY,
  usages: ["device-authentication", "key-agreement"],
  issuedAt: 1795046400000,
  expiresAt: 1795046700000,
};
const CANONICAL = '{"accountId":"account-example-001","agreementPublicKey":{"crv":"P-256","kty":"EC","x":"EmfIJ6qNBvALHzVRIHgXSFeaA8nYIh9-zcMuMEpjYE8","y":"rdP4tFHnjfoNPbC8DOdSYB_BJhz9IEWdxK4r84Dtm-o"},"ceremonyId":"AAAAAAAAAAAAAAAAAAAAAA","challenge":"AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI","challengeId":"AQEBAQEBAQEBAQEBAQEBAQ","expiresAt":1795046700000,"identityPublicKey":{"crv":"P-256","kty":"EC","x":"NIlc9Qcp9HK_uID5f8-oQmBB3hWWmcaDBsfL3mXoN3k","y":"iDT1z39uVSdkrpfaPADvoPnMA3pAtpRJ-SgkSLlJ-Ec"},"issuedAt":1795046400000,"newDeviceId":"AwMDAwMDAwMDAwMDAwMDAw","newDeviceNonce":"BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ","platform":"android","protocol":"SAC-DEVICE-ENROLLMENT","rootDeviceId":"root-device-example-001","rootIdentityKeyThumbprint":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","rootKeyVersion":1,"rootNonce":"BQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU","usages":["device-authentication","key-agreement"],"version":1}';
const CANONICAL_SHA256 = "dc62c04005c989fd0f55b749477bc9311ee6875d9c91ce98aa87b470849739ec";

function transcript(): DeviceEnrollmentTranscript {
  return buildDeviceEnrollmentTranscript(INPUT);
}

function replaceTranscript(change: Partial<Record<keyof DeviceEnrollmentTranscript, unknown>>): string {
  return JSON.stringify({ ...transcript(), ...change });
}

test("le transcript construit est canonisé en RFC 8785 et hashé sur les octets UTF-8", async () => {
  const value = transcript();
  assert.equal(canonicalizeDeviceEnrollmentTranscript(value), CANONICAL);
  const digest = await hashDeviceEnrollmentTranscript(value);
  assert.equal(Buffer.from(digest).toString("hex"), CANONICAL_SHA256);
});

test("l’ordre des propriétés JSON n’influence pas les octets canoniques", () => {
  const value = transcript();
  const reordered = JSON.stringify({
    version: value.version,
    protocol: value.protocol,
    usages: value.usages,
    expiresAt: value.expiresAt,
    issuedAt: value.issuedAt,
    agreementPublicKey: value.agreementPublicKey,
    identityPublicKey: value.identityPublicKey,
    platform: value.platform,
    rootNonce: value.rootNonce,
    newDeviceNonce: value.newDeviceNonce,
    newDeviceId: value.newDeviceId,
    challenge: value.challenge,
    challengeId: value.challengeId,
    ceremonyId: value.ceremonyId,
    rootIdentityKeyThumbprint: value.rootIdentityKeyThumbprint,
    rootKeyVersion: value.rootKeyVersion,
    rootDeviceId: value.rootDeviceId,
    accountId: value.accountId,
  });
  assert.equal(canonicalizeDeviceEnrollmentTranscript(parseDeviceEnrollmentTranscript(reordered)), CANONICAL);
});

test("le parseur refuse les propriétés inconnues, les doublons et les valeurs interdites", () => {
  assert.throws(() => parseDeviceEnrollmentTranscript(JSON.stringify({ ...transcript(), extra: true })), /fields/);
  const duplicated = JSON.stringify(transcript()).replace('"platform":"android"', '"platform":"android","platform":"ios"');
  assert.throws(() => parseDeviceEnrollmentTranscript(duplicated), /duplicate_property/);
  assert.throws(() => parseDeviceEnrollmentTranscript(replaceTranscript({ rootNonce: null })), /rootNonce/);
  assert.throws(() => parseDeviceEnrollmentTranscript(replaceTranscript({ issuedAt: 1.5 })), /issuedAt/);
  assert.throws(() => parseDeviceEnrollmentTranscript(replaceTranscript({ ceremonyId: "A".repeat(21) })), /ceremonyId/);
  assert.throws(() => parseDeviceEnrollmentTranscript(replaceTranscript({ ceremonyId: "A".repeat(21) + "B" })), /ceremonyId/);
});

test("les identifiants, la version racine, les usages et les dates sont strictement validés", () => {
  assert.throws(() => buildDeviceEnrollmentTranscript({ ...INPUT, rootKeyVersion: 0 }), /rootKeyVersion/);
  assert.throws(() => buildDeviceEnrollmentTranscript({ ...INPUT, usages: ["key-agreement", "device-authentication"] }), /usages/);
  assert.throws(() => buildDeviceEnrollmentTranscript({ ...INPUT, issuedAt: INPUT.expiresAt }), /expiry/);
  assert.throws(() => buildDeviceEnrollmentTranscript({ ...INPUT, expiresAt: INPUT.issuedAt + DEVICE_ENROLLMENT_CEREMONY_TTL_MS + 1 }), /expiry_too_long/);
  assert.throws(() => buildDeviceEnrollmentTranscript({ ...INPUT, accountId: "" }), /accountId/);
});

test("les clés publiques doivent être des points P-256 distincts et valides", async () => {
  assert.equal(await validateDeviceEnrollmentPublicKeys(transcript()), true);
  assert.throws(() => buildDeviceEnrollmentTranscript({ ...INPUT, agreementPublicKey: IDENTITY_KEY }), /duplicate_public_key/);
  assert.throws(() => buildDeviceEnrollmentTranscript({
    ...INPUT,
    identityPublicKey: { ...IDENTITY_KEY, d: "secret" } as never,
  }), /identityPublicKey/);
  const invalidPoint = { kty: "EC", crv: "P-256", x: "A".repeat(43), y: "A".repeat(43) } as const;
  const invalidAgreement = buildDeviceEnrollmentTranscript({ ...INPUT, agreementPublicKey: invalidPoint });
  assert.equal(await validateDeviceEnrollmentPublicKeys(invalidAgreement), false);
  const invalidIdentity = buildDeviceEnrollmentTranscript({ ...INPUT, identityPublicKey: invalidPoint });
  assert.equal(await validateDeviceEnrollmentPublicKeys(invalidIdentity), false);
});

test("l’empreinte racine est calculée sur le JWK public minimal et lie le transcript", async () => {
  const thumbprint = await computeDeviceEnrollmentKeyThumbprint(IDENTITY_KEY);
  const bound = buildDeviceEnrollmentTranscript({ ...INPUT, rootIdentityKeyThumbprint: thumbprint });
  assert.equal(await matchesDeviceEnrollmentRootThumbprint(bound, IDENTITY_KEY), true);
  assert.equal(await matchesDeviceEnrollmentRootThumbprint(bound, AGREEMENT_KEY), false);
  assert.equal(await matchesDeviceEnrollmentRootThumbprint(transcript(), IDENTITY_KEY), false);
});

test("les messages signés sont séparés par domaine et les défis WebAuthn sont déterministes", async () => {
  const value = transcript();
  const rootPayload = deviceEnrollmentSignaturePayload(value, "root-approval");
  const newDevicePayload = deviceEnrollmentSignaturePayload(value, "new-device");
  assert.equal(new TextDecoder().decode(rootPayload.slice(0, 38)), "SAC-DEVICE-ENROLLMENT-ROOT-APPROVAL-V1");
  assert.equal(new TextDecoder().decode(newDevicePayload.slice(0, 35)), "SAC-DEVICE-ENROLLMENT-NEW-DEVICE-V1");
  assert.equal(rootPayload[38], 0);
  assert.equal(newDevicePayload[35], 0);
  assert.equal(new TextDecoder().decode(rootPayload.slice(39)), CANONICAL);
  const rootChallenge = await deviceEnrollmentAssertionChallenge(value, "root-approval");
  assert.equal(Buffer.from(rootChallenge).toString("hex"), "9511a2a23da0274cbf5fc6b3981384b567603091ccb02b2aa561116f389ca8c0");
  const newDeviceChallenge = await deviceEnrollmentAssertionChallenge(value, "new-device");
  assert.notDeepEqual(rootChallenge, newDeviceChallenge);
});

test("la liste SAS contient 2 048 mots uniques et correspond à l’empreinte versionnée", () => {
  assert.equal(SAS_WORDLIST_EN_V1.length, 2048);
  assert.equal(new Set(SAS_WORDLIST_EN_V1).size, 2048);
  assert.equal(
    createHash("sha256").update(SAS_WORDLIST_EN_V1.join("\n") + "\n").digest("hex"),
    "2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda",
  );
});

test("le SAS six mots est déterministe, versionné et dépend de la signature racine", async () => {
  const value = transcript();
  const signature = Uint8Array.from({ length: 64 }, (_, index) => index);
  assert.deepEqual(await deriveDeviceEnrollmentSas(value, signature), ["axis", "canal", "unknown", "cream", "cart", "salad"]);
  const otherSignature = new Uint8Array(signature);
  otherSignature[0] ^= 1;
  assert.notDeepEqual(await deriveDeviceEnrollmentSas(value, otherSignature), ["axis", "canal", "unknown", "cream", "cart", "salad"]);
  await assert.rejects(deriveDeviceEnrollmentSas(value, new Uint8Array()), /root_signature/);
});

test("la fraîcheur du transcript est contrôlée avec une tolérance d’horloge bornée", () => {
  const value = transcript();
  assert.equal(isDeviceEnrollmentTranscriptFresh(value, value.issuedAt), true);
  assert.equal(isDeviceEnrollmentTranscriptFresh(value, value.issuedAt - 30_001), false);
  assert.equal(isDeviceEnrollmentTranscriptFresh(value, value.expiresAt), false);
  assert.equal(isDeviceEnrollmentTranscriptFresh(value, value.issuedAt + DEVICE_ENROLLMENT_CEREMONY_TTL_MS + 1), false);
});
