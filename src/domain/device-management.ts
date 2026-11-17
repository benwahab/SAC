/**
 * Contrat métier isolé pour le cycle de vie d'un appareil SAC.
 *
 * Ce module ne persiste rien, n'authentifie personne et ne remplace jamais
 * les contrôles d'autorisation côté serveur. Il ne constitue pas une API.
 */

export type DevicePlatform = "web" | "android" | "ios";
export type DeviceStatus = "pending_verification" | "active" | "revoked";

export interface DeviceRecord {
  readonly deviceId: string;
  readonly accountId: string;
  readonly displayName: string;
  readonly platform: DevicePlatform;
  readonly status: DeviceStatus;
  readonly createdAt: string;
  readonly verifiedAt: string | null;
  readonly lastSeenAt: string | null;
  readonly revokedAt: string | null;
}

export type DeviceLifecycleEvent =
  | { readonly type: "approve"; readonly actorAccountId: string; readonly at: string }
  | { readonly type: "revoke"; readonly actorAccountId: string; readonly at: string };

export type DeviceTransitionError =
  | "invalid_device_record"
  | "invalid_event_type"
  | "account_mismatch"
  | "invalid_event_timestamp"
  | "event_before_device_creation"
  | "event_before_verification"
  | "device_not_pending"
  | "device_already_revoked";

export type DeviceTransitionResult =
  | { readonly ok: true; readonly device: DeviceRecord }
  | { readonly ok: false; readonly error: DeviceTransitionError };

function isCanonicalUtcTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isValidDeviceRecord(device: DeviceRecord): boolean {
  if (
    !device.deviceId.trim() ||
    !device.accountId.trim() ||
    !device.displayName.trim() ||
    !["web", "android", "ios"].includes(device.platform) ||
    !isCanonicalUtcTimestamp(device.createdAt)
  ) {
    return false;
  }

  if (device.lastSeenAt !== null) {
    if (!isCanonicalUtcTimestamp(device.lastSeenAt) || Date.parse(device.lastSeenAt) < Date.parse(device.createdAt)) {
      return false;
    }
  }

  if (device.status === "pending_verification") {
    return device.verifiedAt === null && device.revokedAt === null;
  }

  if (device.status === "active") {
    return (
      device.verifiedAt !== null &&
      isCanonicalUtcTimestamp(device.verifiedAt) &&
      Date.parse(device.verifiedAt) >= Date.parse(device.createdAt) &&
      device.revokedAt === null
    );
  }

  if (device.status === "revoked") {
    return (
      device.revokedAt !== null &&
      isCanonicalUtcTimestamp(device.revokedAt) &&
      Date.parse(device.revokedAt) >= Date.parse(device.createdAt) &&
      (device.lastSeenAt === null || Date.parse(device.lastSeenAt) <= Date.parse(device.revokedAt)) &&
      (device.verifiedAt === null || (
        isCanonicalUtcTimestamp(device.verifiedAt) &&
        Date.parse(device.verifiedAt) >= Date.parse(device.createdAt) &&
        Date.parse(device.verifiedAt) <= Date.parse(device.revokedAt)
      ))
    );
  }

  return false;
}

/**
 * Applique une transition pure et immuable au cycle de vie d'un appareil.
 * L'appelant serveur doit authentifier l'acteur et vérifier les signatures
 * cryptographiques avant d'appeler cette fonction.
 */
export function transitionDevice(
  device: DeviceRecord,
  event: DeviceLifecycleEvent,
): DeviceTransitionResult {
  if (!isValidDeviceRecord(device)) {
    return { ok: false, error: "invalid_device_record" };
  }

  if (!event || (event.type !== "approve" && event.type !== "revoke")) {
    return { ok: false, error: "invalid_event_type" };
  }

  if (event.actorAccountId !== device.accountId) {
    return { ok: false, error: "account_mismatch" };
  }

  if (!isCanonicalUtcTimestamp(event.at)) {
    return { ok: false, error: "invalid_event_timestamp" };
  }

  if (Date.parse(event.at) < Date.parse(device.createdAt)) {
    return { ok: false, error: "event_before_device_creation" };
  }

  if (device.status === "revoked") {
    return { ok: false, error: "device_already_revoked" };
  }

  if (event.type === "approve") {
    if (device.status !== "pending_verification") {
      return { ok: false, error: "device_not_pending" };
    }

    return {
      ok: true,
      device: { ...device, status: "active", verifiedAt: event.at },
    };
  }

  if (device.status === "active" && device.verifiedAt !== null && Date.parse(event.at) < Date.parse(device.verifiedAt)) {
    return { ok: false, error: "event_before_verification" };
  }

  return {
    ok: true,
    device: { ...device, status: "revoked", revokedAt: event.at },
  };
}

/**
 * Métadonnées d'appareil présentables dans une future réponse API.
 * Ne jamais y inclure de clé privée, jeton, OTP ou donnée GPS.
 */
export type DeviceSummary = Pick<
  DeviceRecord,
  "deviceId" | "displayName" | "platform" | "status" | "createdAt" | "verifiedAt" | "lastSeenAt" | "revokedAt"
>;