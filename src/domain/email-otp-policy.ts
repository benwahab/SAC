/**
 * Politique métier validée pour les défis OTP e-mail SAC.
 * Ce module ne génère, ne persiste, n'envoie ni ne consomme encore de code.
 */
export const EMAIL_OTP_CODE_LENGTH = 6;
export const EMAIL_OTP_TTL_MS = 10 * 60 * 1000;
export const EMAIL_OTP_MAX_ATTEMPTS = 6;
export const EMAIL_OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export interface EmailOtpChallengeState {
  readonly createdAt: string;
  readonly failedAttempts: number;
  readonly consumedAt?: string | null;
  readonly invalidatedAt?: string | null;
}

export type EmailOtpChallengeDecision =
  | { readonly ok: true; readonly expiresAt: string; readonly attemptsRemaining: number }
  | {
      readonly ok: false;
      readonly error:
        | "invalid_challenge"
        | "challenge_consumed"
        | "challenge_invalidated"
        | "challenge_expired"
        | "challenge_attempts_exhausted";
    };

function parseUtc(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value ? timestamp : null;
}

/** Détermine si un défi peut encore être présenté à la vérification serveur. */
export function evaluateEmailOtpChallenge(
  challenge: EmailOtpChallengeState,
  now: string,
): EmailOtpChallengeDecision {
  const created = parseUtc(challenge.createdAt);
  const current = parseUtc(now);
  if (
    created === null ||
    current === null ||
    current < created ||
    !Number.isInteger(challenge.failedAttempts) ||
    challenge.failedAttempts < 0
  ) {
    return { ok: false, error: "invalid_challenge" };
  }

  if (challenge.consumedAt != null) {
    const consumed = parseUtc(challenge.consumedAt);
    if (consumed === null || consumed < created || consumed > current) {
      return { ok: false, error: "invalid_challenge" };
    }
    return { ok: false, error: "challenge_consumed" };
  }

  if (challenge.invalidatedAt != null) {
    const invalidated = parseUtc(challenge.invalidatedAt);
    if (invalidated === null || invalidated < created || invalidated > current) {
      return { ok: false, error: "invalid_challenge" };
    }
    return { ok: false, error: "challenge_invalidated" };
  }

  if (challenge.failedAttempts >= EMAIL_OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "challenge_attempts_exhausted" };
  }

  const expiresAt = created + EMAIL_OTP_TTL_MS;
  if (current >= expiresAt) {
    return { ok: false, error: "challenge_expired" };
  }

  return {
    ok: true,
    expiresAt: new Date(expiresAt).toISOString(),
    attemptsRemaining: EMAIL_OTP_MAX_ATTEMPTS - challenge.failedAttempts,
  };
}

/** Le renvoi est autorisé à partir de 60 secondes après le dernier envoi demandé. */
export function evaluateEmailOtpResend(lastSentAt: string, now: string):
  | { readonly ok: true }
  | { readonly ok: false; readonly error: "invalid_timestamps" | "resend_cooldown" } {
  const lastSent = parseUtc(lastSentAt);
  const current = parseUtc(now);
  if (lastSent === null || current === null || current < lastSent) {
    return { ok: false, error: "invalid_timestamps" };
  }
  if (current - lastSent < EMAIL_OTP_RESEND_COOLDOWN_MS) {
    return { ok: false, error: "resend_cooldown" };
  }
  return { ok: true };
}
