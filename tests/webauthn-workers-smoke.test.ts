import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

const PORT = 8798;
const ORIGIN = "http://localhost:8798";
const RP_ID = "localhost";

function cborHead(major: number, value: number): Buffer {
  if (value < 24) return Buffer.from([(major << 5) | value]);
  if (value <= 0xff) return Buffer.from([(major << 5) | 24, value]);
  if (value <= 0xffff) {
    const out = Buffer.alloc(3);
    out[0] = (major << 5) | 25;
    out.writeUInt16BE(value, 1);
    return out;
  }
  const out = Buffer.alloc(5);
  out[0] = (major << 5) | 26;
  out.writeUInt32BE(value, 1);
  return out;
}

function cbor(value: unknown): Buffer {
  if (typeof value === "number") {
    if (Number.isInteger(value) && value >= 0) return cborHead(0, value);
    if (Number.isInteger(value) && value < 0) return cborHead(1, -1 - value);
    throw new Error("Unsupported CBOR number");
  }
  if (typeof value === "string") {
    const bytes = Buffer.from(value, "utf8");
    return Buffer.concat([cborHead(3, bytes.length), bytes]);
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    const bytes = Buffer.from(value);
    return Buffer.concat([cborHead(2, bytes.length), bytes]);
  }
  if (Array.isArray(value)) {
    return Buffer.concat([cborHead(4, value.length), ...value.map(cbor)]);
  }
  if (value && typeof value === "object") {
    const entries = Array.isArray((value as { entries?: unknown }).entries)
      ? (value as { entries: [unknown, unknown][] }).entries
      : Object.entries(value as Record<string, unknown>);
    return Buffer.concat([
      cborHead(5, entries.length),
      ...entries.flatMap(([key, item]) => [cbor(key), cbor(item)]),
    ]);
  }
  throw new Error("Unsupported CBOR value");
}

function b64url(value: Buffer | Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

function sha256(value: Buffer): Buffer {
  return createHash("sha256").update(value).digest();
}

type FixtureOptions = {
  be?: boolean;
  bs?: boolean;
  registrationOrigin?: string;
  registrationRpId?: string;
  registrationChallenge?: string;
  authenticationOrigin?: string;
  authenticationRpId?: string;
  authenticationChallenge?: string;
  registrationUv?: boolean;
  authenticationUv?: boolean;
  tamperAuthenticationSignature?: boolean;
};

function createFixture(options: FixtureOptions = {}) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  const x = Buffer.from(jwk.x!, "base64url");
  const y = Buffer.from(jwk.y!, "base64url");
  const credentialId = randomBytes(32);
  const aaguid = randomBytes(16);
  const registrationChallenge = options.registrationChallenge ?? b64url(randomBytes(32));
  const authenticationChallenge = options.authenticationChallenge ?? b64url(randomBytes(32));

  // COSE_Key: EC2 / ES256 / P-256 / x / y.
  const cosePublicKey = cbor({
    entries: [[1, 2], [3, -7], [-1, 1], [-2, x], [-3, y]],
  });

  // UP | UV | AT, with BE and BS varied for policy tests.
  const flags = 0x40
    | 0x01
    | (options.registrationUv === false ? 0 : 0x04)
    | (options.be ? 0x08 : 0)
    | (options.bs ? 0x10 : 0);
  const registrationAuthData = Buffer.concat([
    sha256(Buffer.from(options.registrationRpId ?? RP_ID)),
    Buffer.from([flags]),
    Buffer.alloc(4),
    aaguid,
    Buffer.from([credentialId.length >> 8, credentialId.length & 0xff]),
    credentialId,
    cosePublicKey,
  ]);
  const attestationObject = cbor({
    fmt: "none",
    attStmt: { entries: [] },
    authData: registrationAuthData,
  });
  const registrationClientData = Buffer.from(JSON.stringify({
    type: "webauthn.create",
    challenge: registrationChallenge,
    origin: options.registrationOrigin ?? ORIGIN,
    crossOrigin: false,
  }));

  const authenticationAuthData = Buffer.concat([
    sha256(Buffer.from(options.authenticationRpId ?? RP_ID)),
    Buffer.from([0x01 | (options.authenticationUv === false ? 0 : 0x04)]), // UP and optional UV
    Buffer.from([0, 0, 0, 1]),
  ]);
  const authenticationClientData = Buffer.from(JSON.stringify({
    type: "webauthn.get",
    challenge: authenticationChallenge,
    origin: options.authenticationOrigin ?? ORIGIN,
    crossOrigin: false,
  }));
  const signedBytes = Buffer.concat([authenticationAuthData, sha256(authenticationClientData)]);
  const signature = sign("sha256", signedBytes, { key: privateKey, dsaEncoding: "der" });
  if (options.tamperAuthenticationSignature) signature[signature.length - 1] ^= 1;

  return {
    registrationChallenge,
    authenticationChallenge,
    registration: {
      id: b64url(credentialId),
      rawId: b64url(credentialId),
      type: "public-key",
      response: {
        clientDataJSON: b64url(registrationClientData),
        attestationObject: b64url(attestationObject),
        transports: ["internal"],
      },
      clientExtensionResults: {},
      authenticatorAttachment: "platform",
    },
    authentication: {
      id: b64url(credentialId),
      rawId: b64url(credentialId),
      type: "public-key",
      response: {
        clientDataJSON: b64url(authenticationClientData),
        authenticatorData: b64url(authenticationAuthData),
        signature: b64url(signature),
        userHandle: null,
      },
      clientExtensionResults: {},
      authenticatorAttachment: "platform",
    },
  };
}

test(
  "SimpleWebAuthn verifies real ES256 registration and authentication fixtures inside Workers",
  { timeout: 90_000 },
  async (t) => {
    const child = spawn(
      process.execPath,
      [
        "node_modules/wrangler/bin/wrangler.js",
        "dev",
        "--local",
        "--config",
        "tests/wrangler.webauthn.toml",
        "--port",
        String(PORT),
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr?.on("data", (chunk: Buffer) => { output += chunk.toString(); });

    t.after(async () => {
      if (child.exitCode === null && !child.killed) {
        child.kill("SIGTERM");
        await Promise.race([once(child, "exit"), delay(3000)]);
      }
    });

    const deadline = Date.now() + 60_000;
    let ready = false;
    let lastError: unknown;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error("Wrangler exited: " + output);
      try {
        const response = await fetch("http://127.0.0.1:" + PORT + "/options");
        if (response.status === 200) {
          const result = await response.json() as {
            challengePresent: boolean; rpId: string; userVerification: string;
            residentKey: string; attachment: string; algorithms: number[];
          };
          assert.equal(result.challengePresent, true);
          assert.equal(result.rpId, RP_ID);
          assert.equal(result.userVerification, "required");
          assert.equal(result.residentKey, "discouraged");
          assert.equal(result.attachment, "platform");
          assert.deepEqual(result.algorithms, [-7]);
          ready = true;
          break;
        }
      } catch (error) { lastError = error; }
      await delay(300);
    }
    assert.equal(ready, true, "Worker did not become ready: " + String(lastError) + "\n" + output);

    const verify = async (fixture: ReturnType<typeof createFixture>, expectedChallenge = fixture.authenticationChallenge) =>
      fetch("http://127.0.0.1:" + PORT + "/verify-fixture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          registration: fixture.registration,
          registrationChallenge: fixture.registrationChallenge,
          authentication: fixture.authentication,
          authenticationChallenge: expectedChallenge,
        }),
      });

    const valid = createFixture();
    const validResponse = await verify(valid);
    assert.equal(validResponse.status, 200, output);
    assert.deepEqual(await validResponse.json(), {
      verified: true,
      credentialDeviceType: "singleDevice",
      credentialBackedUp: false,
      userVerified: true,
      acceptedBySacRootPolicy: true,
      authenticationVerified: true,
    });

    const multiDevice = createFixture({ be: true, bs: false });
    const multiResponse = await verify(multiDevice);
    assert.equal(multiResponse.status, 200);
    const multiResult = await multiResponse.json() as Record<string, unknown>;
    assert.equal(multiResult.credentialDeviceType, "multiDevice");
    assert.equal(multiResult.credentialBackedUp, false);
    assert.equal(multiResult.acceptedBySacRootPolicy, false);

    // BE=1 is refused even when BS=0: the credential is backup-eligible.
    const backupEligibleButNotBackedUp = createFixture({ be: true, bs: false });
    const eligibleResponse = await verify(backupEligibleButNotBackedUp);
    assert.equal(eligibleResponse.status, 200);
    const eligibleResult = await eligibleResponse.json() as Record<string, unknown>;
    assert.equal(eligibleResult.credentialDeviceType, "multiDevice");
    assert.equal(eligibleResult.credentialBackedUp, false);
    assert.equal(eligibleResult.acceptedBySacRootPolicy, false);

    const backedUp = createFixture({ be: true, bs: true });
    const backedResponse = await verify(backedUp);
    assert.equal(backedResponse.status, 200);
    const backedResult = await backedResponse.json() as Record<string, unknown>;
    assert.equal(backedResult.credentialDeviceType, "multiDevice");
    assert.equal(backedResult.credentialBackedUp, true);
    assert.equal(backedResult.acceptedBySacRootPolicy, false);

    const invalidBsOnly = createFixture({ be: false, bs: true });
    assert.equal((await verify(invalidBsOnly)).status, 400);

    const wrongRegistrationChallenge = createFixture({ registrationChallenge: b64url(randomBytes(32)) });
    assert.equal((await fetch("http://127.0.0.1:" + PORT + "/verify-fixture", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        registration: wrongRegistrationChallenge.registration,
        registrationChallenge: b64url(randomBytes(32)),
      }),
    })).status, 400);

    const missingRegistrationUv = createFixture({ registrationUv: false });
    assert.equal((await verify(missingRegistrationUv)).status, 400);

    const wrongOrigin = createFixture({ registrationOrigin: "https://attacker.example" });
    assert.equal((await verify(wrongOrigin)).status, 400);

    const wrongRpId = createFixture({ registrationRpId: "attacker.example" });
    assert.equal((await verify(wrongRpId)).status, 400);

    const wrongAuthChallenge = createFixture();
    assert.equal((await verify(wrongAuthChallenge, b64url(randomBytes(32)))).status, 400);

    const missingAuthenticationUv = createFixture({ authenticationUv: false });
    assert.equal((await verify(missingAuthenticationUv)).status, 400);

    const wrongAuthOrigin = createFixture({ authenticationOrigin: "https://attacker.example" });
    assert.equal((await verify(wrongAuthOrigin)).status, 400);

    const wrongAuthRpId = createFixture({ authenticationRpId: "attacker.example" });
    assert.equal((await verify(wrongAuthRpId)).status, 400);

    const badSignature = createFixture({ tamperAuthenticationSignature: true });
    assert.equal((await verify(badSignature)).status, 400);
  },
);
