import { validateAccountPassword } from "./auth-policy.ts";

export type SacLanguage = "fr" | "en" | "ar";

export interface RegistrationInput {
  readonly email: unknown;
  readonly phone: unknown;
  readonly password: unknown;
  readonly language: unknown;
}

export interface NormalizedRegistrationInput {
  readonly email: string;
  readonly phone: string;
  readonly password: string;
  readonly language: SacLanguage;
}

export type RegistrationValidation =
  | { readonly ok: true; readonly value: NormalizedRegistrationInput }
  | {
      readonly ok: false;
      readonly error:
        | "invalid_email"
        | "invalid_phone"
        | "password_required"
        | "password_too_short"
        | "invalid_language";
    };

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length === 0 || email.length > 254) return null;

  const separator = email.lastIndexOf("@");
  if (separator <= 0 || separator !== email.indexOf("@")) return null;
  const local = email.slice(0, separator);
  const domain = email.slice(separator + 1);

  if (
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    !/^[a-z0-9.!#$%&'*+/=?^`{|}~-]+$/.test(local)
  ) {
    return null;
  }

  if (domain.length > 253 || !domain.includes(".")) return null;
  const labels = domain.split(".");
  if (
    labels.some((label) =>
      label.length === 0 ||
      label.length > 63 ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
    )
  ) {
    return null;
  }

  return email;
}

/**
 * Le numéro doit déjà être international (+ indicatif pays).
 * Les séparateurs visuels courants sont retirés, jamais l'indicatif.
 */
function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const phone = value.trim().replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

/** Valide les données de formulaire sans créer de compte ni prouver une identité. */
export function validateRegistrationInput(input: RegistrationInput): RegistrationValidation {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "invalid_email" };

  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, error: "invalid_phone" };

  const password = validateAccountPassword(input.password);
  if (!password.ok) return password;

  if (input.language !== "fr" && input.language !== "en" && input.language !== "ar") {
    return { ok: false, error: "invalid_language" };
  }

  return {
    ok: true,
    value: {
      email,
      phone,
      password: input.password as string,
      language: input.language,
    },
  };
}
