/**
 * Contrat pur d'autorisation des sessions liées à un appareil.
 *
 * Ne crée ni jeton, ni session, ni persistance. Le contrôleur Pages Functions
 * doit fournir les valeurs issues de la session authentifiée et de D1.
 */

export type SessionStatus = "active" | "revoked";

export interface DeviceSessionRecord {
  readonly sessionId: string;
  readonly accountId: string;
  readonly deviceId: string;
  readonly tokenHash: string;
  readonly status: SessionStatus;
  readonly authVersion: number;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
}

export interface SessionAuthorizationContext {
  readonly expectedAccountId: string;
  readonly expectedDeviceId: string;
  readonly currentDeviceAuthVersion: number;
  readonly deviceStatus: "pending_verification" | "active" | "revoked";
  readonly now: string;
}

export type SessionAuthorizationError =
  | "invalid_session_record"
  | "invalid_authorization_context"
  | "session_revoked"
  | "session_expired"
  | "account_mismatch"
  | "device_mismatch"
  | "device_not_active"
  | "session_version_mismatch";

export type SessionAuthorizationResult =
  | { readonly ok: true; readonly sessionId: string; readonly accountId: string; readonly deviceId: string }
  | { readonly ok: false; readonly error: SessionAuthorizationError };

function isUtc(value: string): boolean {
  if (!/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function validSession(session: DeviceSessionRecord): boolean {
  return Boolean(
    session.sessionId.trim() &&
    session.accountId.trim() &&
    session.deviceId.trim() &&
    /^[a-f0-9]{64}$/.test(session.tokenHash) &&
    (session.status === "active" || session.status === "revoked") &&
    Number.isSafeInteger(session.authVersion) &&
    session.authVersion >= 0 &&
    isUtc(session.createdAt) &&
    isUtc(session.expiresAt) &&
    Date.parse(session.expiresAt) > Date.parse(session.createdAt) &&
    (session.revokedAt === null ||
      (isUtc(session.revokedAt) &&
        Date.parse(session.revokedAt) >= Date.parse(session.createdAt)))
  ) && (session.status === "active" ? session.revokedAt === null : session.revokedAt !== null);
}

/**
 * Évalue une autorisation à partir de l'état courant de l'appareil.
 * L'appelant doit lire l'appareil et sa auth_version depuis D1 à chaque
 * requête protégée. Un jeton valide en signature/format ne suffit pas.
 */
export function authorizeDeviceSession(
  session: DeviceSessionRecord,
  context: SessionAuthorizationContext,
): SessionAuthorizationResult {
  if (!validSession(session)) return { ok: false, error: "invalid_session_record" };

  if (
    !context.expectedAccountId.trim() ||
    !context.expectedDeviceId.trim() ||
    !Number.isSafeInteger(context.currentDeviceAuthVersion) ||
    context.currentDeviceAuthVersion < 0 ||
    !isUtc(context.now)
  ) {
    return { ok: false, error: "invalid_authorization_context" };
  }

  if (session.status === "revoked") return { ok: false, error: "session_revoked" };
  if (Date.parse(context.now) >= Date.parse(session.expiresAt)) {
    return { ok: false, error: "session_expired" };
  }
  if (session.accountId !== context.expectedAccountId) {
    return { ok: false, error: "account_mismatch" };
  }
  if (session.deviceId !== context.expectedDeviceId) {
    return { ok: false, error: "device_mismatch" };
  }
  if (context.deviceStatus !== "active") {
    return { ok: false, error: "device_not_active" };
  }
  if (session.authVersion !== context.currentDeviceAuthVersion) {
    return { ok: false, error: "session_version_mismatch" };
  }

  return {
    ok: true,
    sessionId: session.sessionId,
    accountId: session.accountId,
    deviceId: session.deviceId,
  };
}
