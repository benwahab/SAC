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

    return Response.json({ canonical, sha256 });
  },
};
