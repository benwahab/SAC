/**
 * Contrat métier pur du cycle de vie d'une alerte SAC déjà déclenchée.
 *
 * Ce module n'authentifie personne, ne persiste rien et ne planifie aucun push.
 * Le serveur doit revalider les autorisations et l'état dans l'écriture D1 finale.
 */

import type { AlertStatus, AlertRecipientSnapshot } from "./sac.ts";

export type TriggeredAlertStatus = "active" | "closed_by_author";
export type AlertClosureReason = "completed" | "cancelled";

export interface TriggeredAlertRecord {
  readonly alertId: string;
  readonly authorAccountId: string;
  readonly status: TriggeredAlertStatus;
  readonly createdAt: string;
  readonly closedAt: string | null;
  readonly closureReason: AlertClosureReason | null;
  readonly recipientSnapshot: readonly AlertRecipientSnapshot[];
}

export type AlertLifecycleEvent = {
  readonly type: "close";
  readonly actorAccountId: string;
  readonly at: string;
  readonly reason: AlertClosureReason;
};

export type AlertLifecycleError =
  | "invalid_alert_record"
  | "invalid_event"
  | "actor_not_author"
  | "alert_not_active"
  | "invalid_event_timestamp"
  | "event_before_alert_creation";

export type AlertLifecycleResult =
  | { readonly ok: true; readonly alert: TriggeredAlertRecord }
  | { readonly ok: false; readonly error: AlertLifecycleError };

function isCanonicalUtcTimestamp(value: string): boolean {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isValidRecipientSnapshot(snapshot: readonly AlertRecipientSnapshot[]): boolean {
  const seen = new Set<string>();
  for (const recipient of snapshot) {
    if (
      !recipient.contactUserId.trim() ||
      !isCanonicalUtcTimestamp(recipient.selectedAt) ||
      seen.has(recipient.contactUserId)
    ) return false;
    seen.add(recipient.contactUserId);
  }
  return true;
}

function isValidAlertRecord(alert: TriggeredAlertRecord): boolean {
  if (
    !alert.alertId.trim() ||
    !alert.authorAccountId.trim() ||
    !isCanonicalUtcTimestamp(alert.createdAt) ||
    !isValidRecipientSnapshot(alert.recipientSnapshot)
  ) return false;

  if (alert.status === "active") {
    return alert.closedAt === null && alert.closureReason === null;
  }

  if (alert.status === "closed_by_author") {
    return (
      alert.closedAt !== null &&
      isCanonicalUtcTimestamp(alert.closedAt) &&
      Date.parse(alert.closedAt) >= Date.parse(alert.createdAt) &&
      (alert.closureReason === "completed" || alert.closureReason === "cancelled")
    );
  }

  return false;
}

/**
 * Une alerte déclenchée ne peut être clôturée que par son auteur.
 * « Annuler l'alerte » après déclenchement est une clôture avec motif cancelled.
 * L'annulation avant dispatch d'un SOS programmé relève d'un autre contrat.
 */
export function transitionAlert(
  alert: TriggeredAlertRecord,
  event: AlertLifecycleEvent,
): AlertLifecycleResult {
  if (!isValidAlertRecord(alert)) {
    return { ok: false, error: "invalid_alert_record" };
  }

  if (
    !event ||
    event.type !== "close" ||
    typeof event.actorAccountId !== "string" ||
    typeof event.at !== "string" ||
    (event.reason !== "completed" && event.reason !== "cancelled")
  ) {
    return { ok: false, error: "invalid_event" };
  }

  if (event.actorAccountId !== alert.authorAccountId) {
    return { ok: false, error: "actor_not_author" };
  }

  if (!isCanonicalUtcTimestamp(event.at)) {
    return { ok: false, error: "invalid_event_timestamp" };
  }

  if (Date.parse(event.at) < Date.parse(alert.createdAt)) {
    return { ok: false, error: "event_before_alert_creation" };
  }

  if (alert.status !== "active") {
    return { ok: false, error: "alert_not_active" };
  }

  return {
    ok: true,
    alert: {
      ...alert,
      status: "closed_by_author",
      closedAt: event.at,
      closureReason: event.reason,
      recipientSnapshot: alert.recipientSnapshot,
    },
  };
}

/**
 * Éligibilité métier d'un rappel : seuls les destinataires figés sont éligibles,
 * et uniquement tant que l'alerte est active. L'ordonnancement toutes les 5 min,
 * l'idempotence et l'envoi restent des responsabilités serveur/outbox.
 */
export function isReminderEligible(
  alert: Pick<TriggeredAlertRecord, "status" | "recipientSnapshot">,
  recipientAccountId: string,
): boolean {
  if (alert.status !== "active" || !recipientAccountId.trim()) return false;
  return alert.recipientSnapshot.some(
    (recipient) => recipient.contactUserId === recipientAccountId,
  );
}

/** Vérifie qu'un statut métier existant appartient au contrat d'alerte déclenchée. */
export function isTriggeredAlertStatus(status: AlertStatus): status is TriggeredAlertStatus {
  return status === "active" || status === "closed_by_author";
}
