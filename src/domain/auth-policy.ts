/**
 * Règles pures d'authentification du compte SAC.
 * La persistance, le hachage des mots de passe, l'envoi OTP et les cookies
 * sécurisés appartiennent aux contrôleurs serveur et ne sont pas simulés ici.
 */

export const PASSWORD_MIN_CODE_POINTS = 12;
export const SESSION_IDLE_LIMIT_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_LIMIT_MS = 90 * 24 * 60 * 60 * 1000;

export type PasswordValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: "password_required" | "password_too_short" };

export function validateAccountPassword(password: unknown): PasswordValidation {
  if (typeof password !== "string" || password.length === 0) {
    return { ok: false, error: "password_required" };
  }
  if (Array.from(password).length < PASSWORD_MIN_CODE_POINTS) {
    return { ok: false, error: "password_too_short" };
  }
  return { ok: true };
}

export interface SessionAgeRecord {
  readonly createdAt: string;
  readonly lastActivityAt: string;
}

export type SessionAgeResult =
  | { readonly ok: true; readonly absoluteExpiresAt: string; readonly idleExpiresAt: string }
  | { readonly ok: false; readonly error: "invalid_session_dates" | "session_idle_expired" | "session_absolute_expired" };

function parseUtc(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value ? timestamp : null;
}

/**
 * Calcule l'échéance à enregistrer pour une session nouvellement créée ou
 * renouvelée : la première des deux limites (inactivité ou durée absolue).
 * Cette fonction ne prolonge jamais la limite absolue de 90 jours.
 */
export function getSessionExpiresAt(session: SessionAgeRecord): string | null {
  const created = parseUtc(session.createdAt);
  const lastActivity = parseUtc(session.lastActivityAt);
  if (created === null || lastActivity === null || lastActivity < created) return null;

  return new Date(Math.min(
    created + SESSION_ABSOLUTE_LIMIT_MS,
    lastActivity + SESSION_IDLE_LIMIT_MS,
  )).toISOString();
}

/** Vérifie les deux limites sans prolonger la durée absolue de 90 jours. */
export function evaluateSessionAge(session: SessionAgeRecord, now: string): SessionAgeResult {
  const created = parseUtc(session.createdAt);
  const lastActivity = parseUtc(session.lastActivityAt);
  const current = parseUtc(now);
  if (created === null || lastActivity === null || current === null || lastActivity < created || current < created || current < lastActivity) {
    return { ok: false, error: "invalid_session_dates" };
  }

  const absoluteExpiry = created + SESSION_ABSOLUTE_LIMIT_MS;
  const idleExpiry = lastActivity + SESSION_IDLE_LIMIT_MS;
  if (current >= absoluteExpiry) return { ok: false, error: "session_absolute_expired" };
  if (current >= idleExpiry) return { ok: false, error: "session_idle_expired" };

  return {
    ok: true,
    absoluteExpiresAt: new Date(absoluteExpiry).toISOString(),
    idleExpiresAt: new Date(idleExpiry).toISOString(),
  };
}
