import { canonicalizeStrictJson } from "../../src/services/crypto/strict-json.ts";
import {
  buildDeviceEnrollmentTranscript,
  canonicalizeDeviceEnrollmentTranscript,
  deriveDeviceEnrollmentSas,
  hashDeviceEnrollmentTranscript,
  validateDeviceEnrollmentPublicKeys,
} from "../../src/domain/device-enrollment-transcript.ts";

// This fixture is executed by Wrangler locally; it never deploys or binds remote resources.
const input = String.raw`{"numbers":[333333333.33333329,1E30,4.50,2e-3,0.000000000000000000000000001],"string":"\u20ac$\u000F\u000aA'\u0042\u0022\u005c\\\"\/","literals":[null,true,false]}`;

export default {
  async fetch(): Promise<Response> {
    const canonical = canonicalizeStrictJson(input, {
      maxBytes: 4096,
      maxDepth: 16,
    });
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(canonical),
    );
    const sha256 = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");


    const publicKey = await crypto.subtle.importKey(
      "jwk",
      {
        kty: "EC",
        crv: "P-256",
        x: "YP7UuiVanTHJYet0xjVtaMBJuJI7Yfps5mliLmDyn7Y",
        y: "eQP-EAi4vJmkGunpVii8ZPLxsgwtfp9Rd6PClNRGIpk",
        ext: true,
        key_ops: ["verify"],
      },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const fromHex = (hex: string): Uint8Array =>
      Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
    const rfcHighS = fromHex(
      "EFD48B2AACB6A8FD1140DD9CD45E81D69D2C877B56AAF991C34D0EA84EAF3716" +
      "F7CB1C942D657C41D436C7A1B6E29F65F3E900DBB9AFF4064DC4AB2F843ACDA8",
    );
    const rfcLowS = fromHex(
      "EFD48B2AACB6A8FD1140DD9CD45E81D69D2C877B56AAF991C34D0EA84EAF3716" +
      "0834E36AD29A83BF2BC9385E491D6099C8FDF9D1ED67AA7EA5F51F93782857A9",
    );
    const sample = new TextEncoder().encode("sample");
    const rfcHighSVerified = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" }, publicKey, rfcHighS, sample,
    );
    const rfcLowSVerified = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" }, publicKey, rfcLowS, sample,
    );
    const pair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"],
    );
    const generatedSignature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      pair.privateKey,
      new TextEncoder().encode("SAC worker ECDSA format check"),
    );
    const generatedSignatureVerified = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pair.publicKey,
      generatedSignature,
      new TextEncoder().encode("SAC worker ECDSA format check"),
    );
    const transcript = buildDeviceEnrollmentTranscript({
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
      identityPublicKey: {
        kty: "EC", crv: "P-256",
        x: "NIlc9Qcp9HK_uID5f8-oQmBB3hWWmcaDBsfL3mXoN3k",
        y: "iDT1z39uVSdkrpfaPADvoPnMA3pAtpRJ-SgkSLlJ-Ec",
      },
      agreementPublicKey: {
        kty: "EC", crv: "P-256",
        x: "EmfIJ6qNBvALHzVRIHgXSFeaA8nYIh9-zcMuMEpjYE8",
        y: "rdP4tFHnjfoNPbC8DOdSYB_BJhz9IEWdxK4r84Dtm-o",
      },
      usages: ["device-authentication", "key-agreement"],
      issuedAt: 1795046400000,
      expiresAt: 1795046700000,
    });
    const transcriptCanonical = canonicalizeDeviceEnrollmentTranscript(transcript);
    const transcriptSha256 = Array.from(await hashDeviceEnrollmentTranscript(transcript))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const transcriptKeysValid = await validateDeviceEnrollmentPublicKeys(transcript);
    const sas = await deriveDeviceEnrollmentSas(
      transcript,
      Uint8Array.from({ length: 64 }, (_, index) => index),
    );

    return Response.json({
      canonical,
      sha256,
      transcriptCanonical,
      transcriptSha256,
      transcriptKeysValid,
      sas,
      ecdsa: {
        rfcSignatureBytes: rfcHighS.byteLength,
        rfcHighSVerified,
        rfcLowSVerified,
        generatedSignatureBytes: generatedSignature.byteLength,
        generatedSignatureVerified,
      },
    });
  },
};
