import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { sendWebPush } from "../functions/lib/notifications/web-push-delivery.ts";
import { isAllowedPushEndpoint, isValidPushSubscriptionPublicKey } from "../functions/lib/notifications/push-endpoint-policy.ts";

const cryptoProvider = webcrypto as unknown as Crypto;
const encoder = new TextEncoder();

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function makeFixture() {
  const client = await cryptoProvider.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const clientPublic = new Uint8Array(await cryptoProvider.subtle.exportKey("raw", client.publicKey));
  const vapid = await cryptoProvider.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const privateJwk = await cryptoProvider.subtle.exportKey("jwk", vapid.privateKey);
  const publicJwk = await cryptoProvider.subtle.exportKey("jwk", vapid.publicKey);
  const publicRaw = new Uint8Array(await cryptoProvider.subtle.exportKey("raw", vapid.publicKey));
  return {
    client,
    vapidPublicKey: encodeBase64Url(publicRaw),
    vapidPrivateJwk: JSON.stringify(privateJwk),
    vapidPublicJwk: publicJwk,
    subscription: {
      endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint-token",
      keys: { p256dh: encodeBase64Url(clientPublic), auth: encodeBase64Url(cryptoProvider.getRandomValues(new Uint8Array(16))) },
    },
    env: {
      PUSH_VAPID_PUBLIC_KEY: encodeBase64Url(publicRaw),
      PUSH_VAPID_PRIVATE_JWK: JSON.stringify(privateJwk),
      PUSH_VAPID_SUBJECT: "mailto:benwahab111@gmail.com",
    },
  };
}

test("la politique commune valide les fournisseurs Push et les clés P-256 avant stockage", async () => {
  const fixture = await makeFixture();
  assert.equal(isAllowedPushEndpoint(fixture.subscription.endpoint)?.origin, "https://fcm.googleapis.com");
  assert.equal(isAllowedPushEndpoint("https://evil.example/push"), null);
  assert.equal(isAllowedPushEndpoint("https://fcm.googleapis.com:8443/push"), null);
  assert.equal(await isValidPushSubscriptionPublicKey(fixture.subscription.keys.p256dh, cryptoProvider), true);
  assert.equal(await isValidPushSubscriptionPublicKey("B".repeat(87), cryptoProvider), false);
});

test("Web Push construit un corps aes128gcm chiffré et un jeton VAPID signé", async () => {
  const fixture = await makeFixture();
  let captured: { url: string; init: RequestInit } | null = null;
  const result = await sendWebPush(
    fixture.subscription,
    encoder.encode(JSON.stringify({ version: 1, kind: "private_sos" })),
    fixture.env,
    {
      crypto: cryptoProvider,
      now: 1_800_000_000_000,
      fetcher: async (input, init) => {
        captured = { url: String(input), init: init ?? {} };
        return new Response(null, { status: 201 });
      },
    },
  );
  assert.equal(result, "accepted");
  assert.ok(captured);
  assert.equal(captured.url, fixture.subscription.endpoint);
  assert.equal(new Headers(captured.init.headers).get("Content-Encoding"), "aes128gcm");
  assert.equal(new Headers(captured.init.headers).get("TTL"), "60");
  const body = new Uint8Array(captured.init.body as ArrayBuffer);
  assert.equal(body.byteLength > 100, true);
  assert.equal(body[20], 65);
  assert.equal(new TextDecoder().decode(body).includes("private_sos"), false);

  const authorization = new Headers(captured.init.headers).get("Authorization");
  assert.ok(authorization?.startsWith("vapid t="));
  const token = authorization.slice("vapid t=".length).split(", k=")[0];
  const [header, claims, signature] = token.split(".");
  const decodedClaims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(claims.replace(/-/g, "+").replace(/_/g, "/") + "=="), c => c.charCodeAt(0)))) as { aud: string; exp: number; sub: string };
  assert.equal(decodedClaims.aud, "https://fcm.googleapis.com");
  assert.equal(decodedClaims.sub, "mailto:benwahab111@gmail.com");
  const signingInput = encoder.encode(header + "." + claims);
  const signatureBytes = Uint8Array.from(atob(signature.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - signature.length % 4) % 4)), c => c.charCodeAt(0));
  const publicKey = await cryptoProvider.subtle.importKey("jwk", fixture.vapidPublicJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  assert.equal(await cryptoProvider.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, signatureBytes, signingInput), true);
});

test("les endpoints hors liste autorisée sont bloqués sans requête réseau", async () => {
  const fixture = await makeFixture();
  let called = false;
  const result = await sendWebPush(
    { ...fixture.subscription, endpoint: "https://127.0.0.1/private" },
    encoder.encode("test"),
    fixture.env,
    { crypto: cryptoProvider, fetcher: async () => { called = true; return new Response(null, { status: 201 }); } },
  );
  assert.equal(result, "blocked");
  assert.equal(called, false);
});

test("une réponse 410 marque un abonnement comme expiré", async () => {
  const fixture = await makeFixture();
  const result = await sendWebPush(
    fixture.subscription,
    encoder.encode("test"),
    fixture.env,
    { crypto: cryptoProvider, fetcher: async () => new Response(null, { status: 410 }) },
  );
  assert.equal(result, "gone");
});

test("une paire VAPID incohérente échoue sans appel réseau", async () => {
  const fixture = await makeFixture();
  let called = false;
  const result = await sendWebPush(
    fixture.subscription,
    encoder.encode("test"),
    { ...fixture.env, PUSH_VAPID_PUBLIC_KEY: encodeBase64Url(cryptoProvider.getRandomValues(new Uint8Array(65))) },
    { crypto: cryptoProvider, fetcher: async () => { called = true; return new Response(null, { status: 201 }); } },
  );
  assert.equal(result, "retry");
  assert.equal(called, false);
});
