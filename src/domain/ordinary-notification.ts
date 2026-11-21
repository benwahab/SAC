/**
 * Contrat métier pur des notifications ordinaires.
 *
 * Ces notifications sont strictement séparées du SOS : aucun GPS, aucun SMS,
 * aucune escalade, aucune relance utilisateur. Les nouvelles tentatives sont
 * uniquement des reprises techniques de la même notification, avec une clé de
 * déduplication stable.
 */

export type OrdinaryNotificationKind =
  | "reminder_due"
  | "family_event_created"
  | "family_event_updated"
  | "family_event_cancelled"
  | "clinic_reminder_due";

export type OrdinaryNotificationStatus = "pending" | "processing" | "accepted" | "permanent_failure" | "cancelled";
export type OrdinaryPushKind = "ordinary_reminder" | "family_event" | "clinic_reminder";
export type WebPushOutcome = "accepted" | "gone" | "retry";

export interface OrdinaryNotification {
  readonly notificationId: string;
  readonly kind: OrdinaryNotificationKind;
  readonly sourceId: string;
  readonly recipientAccountId: string;
  readonly scheduledAt: number;
  readonly status: OrdinaryNotificationStatus;
  readonly attemptCount: number;
  readonly nextAttemptAt: number | null;
  readonly leaseUntil: number | null;
  readonly leaseToken: string | null;
  readonly deduplicationKey: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export type OrdinaryNotificationCommand =
  | { readonly type: "reserve"; readonly leaseToken: string; readonly leaseMs: number }
  | { readonly type: "accepted" }
  | { readonly type: "retry"; readonly retryAt: number }
  | { readonly type: "permanent_failure" }
  | { readonly type: "cancel" };

export type OrdinaryNotificationError =
  | "invalid_notification"
  | "invalid_transition"
  | "attempts_exhausted"
  | "lease_required"
  | "sos_payload_rejected";

export type OrdinaryNotificationResult =
  | { readonly ok: true; readonly notification: OrdinaryNotification }
  | { readonly ok: false; readonly error: OrdinaryNotificationError };

export interface OrdinaryPushPayload {
  readonly version: 1;
  readonly kind: OrdinaryPushKind;
  readonly notificationId: string;
  readonly targetPath: string;
}

export const ORDINARY_NOTIFICATION_MAX_ATTEMPTS = 2;
export const ORDINARY_NOTIFICATION_RETRY_DELAY_MS = 60_000;
export const ORDINARY_NOTIFICATION_ESCALATES = false as const;
export const ORDINARY_NOTIFICATION_USES_GPS = false as const;
export const ORDINARY_NOTIFICATION_USES_SMS = false as const;

const KINDS: readonly OrdinaryNotificationKind[] = [
  "reminder_due",
  "family_event_created",
  "family_event_updated",
  "family_event_cancelled",
  "clinic_reminder_due",
];

function isKind(value: unknown): value is OrdinaryNotificationKind {
  return typeof value === "string" && (KINDS as readonly string[]).includes(value);
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function ordinaryNotificationDeduplicationKey(input: {
  readonly kind: OrdinaryNotificationKind;
  readonly sourceId: string;
  readonly recipientAccountId: string;
  readonly scheduledAt: number;
}): string {
  return `ordinary:${input.kind}:${input.sourceId}:${input.recipientAccountId}:${input.scheduledAt}`;
}

export function createOrdinaryNotification(input: {
  readonly notificationId: string;
  readonly kind: OrdinaryNotificationKind;
  readonly sourceId: string;
  readonly recipientAccountId: string;
  readonly scheduledAt: number;
  readonly nowMs: number;
}): OrdinaryNotificationResult {
  if (!isNonEmpty(input.notificationId) || !isKind(input.kind) || !isNonEmpty(input.sourceId) ||
      !isNonEmpty(input.recipientAccountId) || !Number.isSafeInteger(input.scheduledAt) || input.scheduledAt <= 0 ||
      !Number.isSafeInteger(input.nowMs) || input.nowMs <= 0) {
    return { ok: false, error: "invalid_notification" };
  }
  return {
    ok: true,
    notification: {
      notificationId: input.notificationId,
      kind: input.kind,
      sourceId: input.sourceId,
      recipientAccountId: input.recipientAccountId,
      scheduledAt: input.scheduledAt,
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: input.scheduledAt,
      leaseUntil: null,
      leaseToken: null,
      deduplicationKey: ordinaryNotificationDeduplicationKey(input),
      createdAt: input.nowMs,
      updatedAt: input.nowMs,
    },
  };
}

export function transitionOrdinaryNotification(
  notification: OrdinaryNotification,
  command: OrdinaryNotificationCommand,
  nowMs: number,
): OrdinaryNotificationResult {
  if (!Number.isSafeInteger(nowMs) || nowMs <= 0) return { ok: false, error: "invalid_transition" };
  if (notification.status === "accepted" || notification.status === "permanent_failure" || notification.status === "cancelled") {
    return { ok: false, error: "invalid_transition" };
  }

  if (command.type === "cancel") {
    return {
      ok: true,
      notification: {
        ...notification,
        status: "cancelled",
        leaseUntil: null,
        leaseToken: null,
        updatedAt: nowMs,
      },
    };
  }

  if (command.type === "reserve") {
    if (notification.status !== "pending") return { ok: false, error: "invalid_transition" };
    if (!isNonEmpty(command.leaseToken) || command.leaseToken.length < 16 || !Number.isSafeInteger(command.leaseMs) || command.leaseMs <= 0) {
      return { ok: false, error: "lease_required" };
    }
    if (notification.attemptCount >= ORDINARY_NOTIFICATION_MAX_ATTEMPTS) return { ok: false, error: "attempts_exhausted" };
    return {
      ok: true,
      notification: {
        ...notification,
        status: "processing",
        attemptCount: notification.attemptCount + 1,
        leaseUntil: nowMs + command.leaseMs,
        leaseToken: command.leaseToken,
        updatedAt: nowMs,
      },
    };
  }

  if (notification.status !== "processing") return { ok: false, error: "invalid_transition" };

  if (command.type === "accepted") {
    return {
      ok: true,
      notification: {
        ...notification,
        status: "accepted",
        leaseUntil: null,
        leaseToken: null,
        nextAttemptAt: null,
        updatedAt: nowMs,
      },
    };
  }

  if (command.type === "permanent_failure") {
    return {
      ok: true,
      notification: {
        ...notification,
        status: "permanent_failure",
        leaseUntil: null,
        leaseToken: null,
        nextAttemptAt: null,
        updatedAt: nowMs,
      },
    };
  }

  if (!Number.isSafeInteger(command.retryAt) || command.retryAt <= nowMs) return { ok: false, error: "invalid_transition" };
  if (notification.attemptCount >= ORDINARY_NOTIFICATION_MAX_ATTEMPTS) {
    return {
      ok: true,
      notification: {
        ...notification,
        status: "permanent_failure",
        leaseUntil: null,
        leaseToken: null,
        nextAttemptAt: null,
        updatedAt: nowMs,
      },
    };
  }
  return {
    ok: true,
    notification: {
      ...notification,
      status: "pending",
      leaseUntil: null,
      leaseToken: null,
      nextAttemptAt: command.retryAt,
      updatedAt: nowMs,
    },
  };
}

export function applyWebPushOutcome(
  notification: OrdinaryNotification,
  outcome: WebPushOutcome,
  nowMs: number,
): OrdinaryNotificationResult {
  if (outcome === "accepted") return transitionOrdinaryNotification(notification, { type: "accepted" }, nowMs);
  if (outcome === "gone") return transitionOrdinaryNotification(notification, { type: "permanent_failure" }, nowMs);
  return transitionOrdinaryNotification(
    notification,
    { type: "retry", retryAt: nowMs + ORDINARY_NOTIFICATION_RETRY_DELAY_MS },
    nowMs,
  );
}

function pushKind(kind: OrdinaryNotificationKind): OrdinaryPushKind {
  switch (kind) {
    case "reminder_due": return "ordinary_reminder";
    case "clinic_reminder_due": return "clinic_reminder";
    case "family_event_created":
    case "family_event_updated":
    case "family_event_cancelled":
      return "family_event";
  }
}

function targetPath(kind: OrdinaryNotificationKind): string {
  switch (kind) {
    case "reminder_due": return "/espace-prive#/rappels";
    case "clinic_reminder_due": return "/espace-prive#/sante";
    case "family_event_created":
    case "family_event_updated":
    case "family_event_cancelled":
      return "/espace-prive#/groupes";
  }
}

export function buildOrdinaryPushPayload(notification: OrdinaryNotification): OrdinaryPushPayload {
  return {
    version: 1,
    kind: pushKind(notification.kind),
    notificationId: notification.notificationId,
    targetPath: targetPath(notification.kind),
  };
}

/**
 * Refuse explicitement tout payload SOS ou tout champ d'escalade/GPS/SMS.
 * Le service worker doit utiliser ce garde avant d'afficher une notification.
 */
export function isOrdinaryPushPayload(value: unknown): value is OrdinaryPushPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.version !== 1) return false;
  if (record.kind === "private_sos" || record.kind === "sos") return false;
  if (!["ordinary_reminder", "family_event", "clinic_reminder"].includes(String(record.kind))) return false;
  if (!isNonEmpty(record.notificationId) || !isNonEmpty(record.targetPath)) return false;
  if (!record.targetPath.startsWith("/espace-prive#/") || record.targetPath.includes("sos")) return false;
  if ("gps" in record || "location" in record || "sms" in record || "escalation" in record || "requireInteraction" in record) return false;
  return true;
}
