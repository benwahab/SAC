import { createRootRegistrationOptions, type RootRegistrationOptionsJSON } from "./webauthn-root-options.ts";

export interface RootEnrollmentCeremonyEnvironment {
  readonly DB: D1Database;
  readonly WEBAUTHN_RP_ID: string;
  readonly WEBAUTHN_RP_NAME: string;
}

export interface RootEnrollmentCeremonyResult {
  readonly ceremonyId: string;
  readonly expiresAt: number;
  readonly options: RootRegistrationOptionsJSON;
}

function uuidBytes(value: string): Uint8Array {
  const hex = value.replace(/-/g, "");
  if (!/^[a-f0-9]{32}$/i.test(hex)) throw new Error("account_identifier_invalid");
  return Uint8Array.from(hex.match(/.{2}/g)!, (part) => Number.parseInt(part, 16));
}

function decodeChallenge(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64 + "=".repeat((4 - base64.length % 4) % 4)), (character) => character.charCodeAt(0));
}

export async function createRootEnrollmentCeremony(
  env: RootEnrollmentCeremonyEnvironment,
  accountId: string,
  origin: string,
  now = Date.now(),
): Promise<RootEnrollmentCeremonyResult> {
  const ceremonyId = crypto.randomUUID();
  const challengeId = crypto.randomUUID();
  const options = createRootRegistrationOptions({
    rpId: env.WEBAUTHN_RP_ID,
    rpName: env.WEBAUTHN_RP_NAME,
    userHandle: uuidBytes(accountId),
    userName: "SAC-" + accountId.slice(0, 8),
    userDisplayName: "Compte SAC",
    residentKey: "discouraged",
  }, crypto);
  const challengeDigestBytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", Uint8Array.from(decodeChallenge(options.challenge)).buffer),
  );
  const challengeDigest = Array.from(challengeDigestBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const expiresAt = now + 5 * 60 * 1000;

  await env.DB.prepare(
    "UPDATE root_enrollment_ceremonies SET status = 'expired' WHERE account_id = ? AND status = 'pending' AND expires_at <= ?",
  ).bind(accountId, now).run();
  await env.DB.prepare(
    "UPDATE root_enrollment_ceremonies SET status = 'cancelled' WHERE account_id = ? AND status = 'pending' AND EXISTS (SELECT 1 FROM root_enrollment_challenges WHERE ceremony_id = root_enrollment_ceremonies.id AND consumed_at IS NULL)",
  ).bind(accountId).run();

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO root_enrollment_ceremonies (id, account_id, origin, status, created_at, expires_at, completed_at) VALUES (?, ?, ?, 'pending', ?, ?, NULL)",
    ).bind(ceremonyId, accountId, origin, now, expiresAt),
    env.DB.prepare(
      "INSERT INTO root_enrollment_challenges (id, ceremony_id, account_id, challenge_digest, created_at, expires_at, consumed_at, attempt_count) VALUES (?, ?, ?, ?, ?, ?, NULL, 0)",
    ).bind(challengeId, ceremonyId, accountId, challengeDigest, now, expiresAt),
  ]);

  return { ceremonyId, expiresAt, options };
}
