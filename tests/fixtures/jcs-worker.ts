import { canonicalizeStrictJson } from "../../src/services/crypto/strict-json.ts";

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

    return Response.json({
      canonical,
      sha256,
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
