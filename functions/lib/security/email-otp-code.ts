/**
 * Génération et empreinte HMAC des codes OTP e-mail.
 *
 * À appeler exclusivement côté serveur Cloudflare Workers. Le code brut ne
 * doit être persisté ni journalisé. L'empreinte doit être calculée avec un
 * secret aléatoire conservé hors D1 (secret Cloudflare).
 */
const EMAIL_OTP_CODE_LENGTH = 6;

const OTP_SPACE = 1_000_000;
const UINT32_RANGE = 0x1_0000_0000;
const ACCEPTED_UINT32_LIMIT = Math.floor(UINT32_RANGE / OTP_SPACE) * OTP_SPACE;

/** Génère uniformément un code décimal de six chiffres, zéros initiaux inclus. */
export function generateEmailOtpCode(random: Pick<Crypto, "getRandomValues">): string {
  const value = new Uint32Array(1);
  do {
    random.getRandomValues(value);
  } while (value[0] >= ACCEPTED_UINT32_LIMIT);

  return String(value[0] % OTP_SPACE).padStart(EMAIL_OTP_CODE_LENGTH, "0");
}

/**
 * Produit une empreinte HMAC-SHA-256 liée au défi et à son usage.
 * Un hash simple non secret serait insuffisant pour un code à seulement
 * un million de possibilités. Le secret doit être distinct de la base D1.
 */
export async function digestEmailOtp(
  cryptoProvider: Pick<Crypto, "subtle">,
  secret: string,
  challengeId: string,
  purpose: "account_email_verification",
  code: string,
): Promise<string> {
  if (!secret || secret.length < 32) throw new Error("otp_secret_not_configured");
  if (!challengeId || challengeId.length > 128) throw new Error("invalid_challenge_id");
  if (!new RegExp(`^\\d{${EMAIL_OTP_CODE_LENGTH}}$`).test(code)) {
    throw new Error("invalid_otp_code");
  }

  const key = await cryptoProvider.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const message = new TextEncoder().encode(
    `SAC:email-otp:v1:${purpose}:${challengeId}:${code}`,
  );
  const signature = await cryptoProvider.subtle.sign("HMAC", key, message);
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
