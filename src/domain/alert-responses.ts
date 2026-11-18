/**
 * Contrat métier pur des réponses et de la responsabilité d'une alerte SAC.
 *
 * L'ordre des candidatures est fourni par une séquence monotone attribuée côté
 * serveur dans la transaction d'acceptation. Un horodatage client ne décide jamais.
 * Ce module ne persiste rien et ne garantit pas l'atomicité D1.
 */

import type { TriggeredAlertRecord } from "./alert-lifecycle.ts";

export interface AlertResponderRecord {
  readonly contactAccountId: string;
  readonly acknowledgedAt: string | null;
  readonly volunteeredAt: string | null;
  readonly volunteeredSequence: number | null;
  readonly withdrawnAt: string | null;
}

export type ResponsibilityEndReason = "withdrawn" | "alert_closed";

export interface AlertResponsibilityPeriod {
  readonly contactAccountId: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly endReason: ResponsibilityEndReason | null;
  readonly sequence: number;
}

export interface AlertResponderState {
  readonly alert: TriggeredAlertRecord;
  readonly responders: readonly AlertResponderRecord[];
  readonly responsibilityHistory: readonly AlertResponsibilityPeriod[];
}

export type AlertResponderEvent =
  | { readonly type: "acknowledge"; readonly actorAccountId: string; readonly at: string }
  | { readonly type: "volunteer"; readonly actorAccountId: string; readonly at: string; readonly serverSequence: number }
  | { readonly type: "withdraw"; readonly actorAccountId: string; readonly at: string };

export type AlertResponderError =
  | "invalid_state"
  | "invalid_event"
  | "alert_not_active"
  | "actor_not_recipient"
  | "author_cannot_respond_as_contact"
  | "invalid_event_timestamp"
  | "event_before_alert_creation"
  | "event_before_volunteer"
  | "already_withdrawn"
  | "not_volunteered"
  | "invalid_server_sequence"
  | "duplicate_server_sequence";

export type AlertResponderResult =
  | { readonly ok: true; readonly state: AlertResponderState }
  | { readonly ok: false; readonly error: AlertResponderError };

function isUtc(value: string): boolean {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

function isValidState(state: AlertResponderState): boolean {
  if (!state.alert.alertId.trim() || !Array.isArray(state.responders) || !Array.isArray(state.responsibilityHistory)) return false;
  const recipients = new Set(state.alert.recipientSnapshot.map((item) => item.contactUserId));
  const responderIds = new Set<string>();
  const sequences = new Set<number>();

  for (const responder of state.responders) {
    if (!responder.contactAccountId.trim() || !recipients.has(responder.contactAccountId) || responderIds.has(responder.contactAccountId)) return false;
    responderIds.add(responder.contactAccountId);
    if (responder.acknowledgedAt !== null && (
      !isUtc(responder.acknowledgedAt) ||
      Date.parse(responder.acknowledgedAt) < Date.parse(state.alert.createdAt)
    )) return false;
    if (responder.volunteeredAt === null) {
      if (responder.volunteeredSequence !== null || responder.withdrawnAt !== null) return false;
    } else {
      if (
        !isUtc(responder.volunteeredAt) ||
        Date.parse(responder.volunteeredAt) < Date.parse(state.alert.createdAt) ||
        !Number.isSafeInteger(responder.volunteeredSequence) ||
        (responder.volunteeredSequence ?? 0) <= 0
      ) return false;
      if (sequences.has(responder.volunteeredSequence!)) return false;
      sequences.add(responder.volunteeredSequence!);
      if (responder.withdrawnAt !== null && (!isUtc(responder.withdrawnAt) || Date.parse(responder.withdrawnAt) < Date.parse(responder.volunteeredAt))) return false;
    }
  }

  let openPeriods = 0;
  const periodSequences = new Set<number>();
  for (const period of state.responsibilityHistory) {
    if (
      !responderIds.has(period.contactAccountId) ||
      !isUtc(period.startedAt) ||
      !Number.isSafeInteger(period.sequence) ||
      period.sequence <= 0 ||
      periodSequences.has(period.sequence)
    ) return false;
    periodSequences.add(period.sequence);
    if (period.endedAt === null) {
      openPeriods += 1;
      if (period.endReason !== null) return false;
      const currentResponder = state.responders.find((item) => item.contactAccountId === period.contactAccountId);
      if (
        !currentResponder ||
        currentResponder.volunteeredAt === null ||
        currentResponder.withdrawnAt !== null ||
        Date.parse(period.startedAt) < Date.parse(currentResponder.volunteeredAt)
      ) return false;
    } else if (
      !isUtc(period.endedAt) ||
      Date.parse(period.endedAt) < Date.parse(period.startedAt) ||
      (period.endReason !== "withdrawn" && period.endReason !== "alert_closed")
    ) return false;
  }
  return openPeriods <= 1;
}

function emptyResponder(contactAccountId: string): AlertResponderRecord {
  return {
    contactAccountId,
    acknowledgedAt: null,
    volunteeredAt: null,
    volunteeredSequence: null,
    withdrawnAt: null,
  };
}

export function transitionAlertResponder(
  state: AlertResponderState,
  event: AlertResponderEvent,
): AlertResponderResult {
  if (!isValidState(state)) return { ok: false, error: "invalid_state" };
  if (
    !event ||
    !["acknowledge", "volunteer", "withdraw"].includes(event.type) ||
    typeof event.actorAccountId !== "string" ||
    typeof event.at !== "string"
  ) return { ok: false, error: "invalid_event" };
  if (state.alert.status !== "active") return { ok: false, error: "alert_not_active" };
  if (event.actorAccountId === state.alert.authorAccountId) return { ok: false, error: "author_cannot_respond_as_contact" };
  if (!state.alert.recipientSnapshot.some((item) => item.contactUserId === event.actorAccountId)) {
    return { ok: false, error: "actor_not_recipient" };
  }
  if (!isUtc(event.at)) return { ok: false, error: "invalid_event_timestamp" };
  if (Date.parse(event.at) < Date.parse(state.alert.createdAt)) return { ok: false, error: "event_before_alert_creation" };

  const existing = state.responders.find((item) => item.contactAccountId === event.actorAccountId);
  const current = existing ?? emptyResponder(event.actorAccountId);

  if (event.type === "acknowledge") {
    if (current.acknowledgedAt !== null) return { ok: true, state };
    const next: AlertResponderRecord = { ...current, acknowledgedAt: event.at };
    return {
      ok: true,
      state: {
        ...state,
        responders: existing
          ? state.responders.map((item) => item.contactAccountId === event.actorAccountId ? next : item)
          : [...state.responders, next],
      },
    };
  }

  if (event.type === "volunteer") {
    if (current.withdrawnAt !== null) return { ok: false, error: "already_withdrawn" };
    if (current.volunteeredAt !== null) return { ok: true, state };
    if (!Number.isSafeInteger(event.serverSequence) || event.serverSequence <= 0) {
      return { ok: false, error: "invalid_server_sequence" };
    }
    if (state.responders.some((item) => item.volunteeredSequence === event.serverSequence)) {
      return { ok: false, error: "duplicate_server_sequence" };
    }
    const next: AlertResponderRecord = {
      ...current,
      volunteeredAt: event.at,
      volunteeredSequence: event.serverSequence,
    };
    const responders = existing
      ? state.responders.map((item) => item.contactAccountId === event.actorAccountId ? next : item)
      : [...state.responders, next];
    const hasPrimary = state.responsibilityHistory.some((period) => period.endedAt === null);
    const responsibilityHistory = hasPrimary
      ? state.responsibilityHistory
      : [...state.responsibilityHistory, {
          contactAccountId: event.actorAccountId,
          startedAt: event.at,
          endedAt: null,
          endReason: null,
          sequence: event.serverSequence,
        }];
    return { ok: true, state: { ...state, responders, responsibilityHistory } };
  }

  if (current.volunteeredAt === null || current.withdrawnAt !== null) {
    return { ok: false, error: "not_volunteered" };
  }
  if (Date.parse(event.at) < Date.parse(current.volunteeredAt)) {
    return { ok: false, error: "event_before_volunteer" };
  }

  const responders = existing
    ? state.responders.map((item) => item.contactAccountId === event.actorAccountId ? { ...item, withdrawnAt: event.at } : item)
    : state.responders;
  const activePeriod = state.responsibilityHistory.find(
    (period) => period.contactAccountId === event.actorAccountId && period.endedAt === null,
  );

  if (!activePeriod) return { ok: true, state: { ...state, responders } };

  const closedHistory = state.responsibilityHistory.map((period) =>
    period === activePeriod ? { ...period, endedAt: event.at, endReason: "withdrawn" as const } : period,
  );
  const nextVolunteer = responders
    .filter((item) => item.volunteeredAt !== null && item.withdrawnAt === null)
    .filter((item) => !closedHistory.some((period) => period.contactAccountId === item.contactAccountId && period.endedAt === null))
    .sort((a, b) => (a.volunteeredSequence ?? 0) - (b.volunteeredSequence ?? 0))[0];

  const responsibilityHistory = nextVolunteer
    ? [...closedHistory, {
        contactAccountId: nextVolunteer.contactAccountId,
        startedAt: event.at,
        endedAt: null,
        endReason: null,
        sequence: nextVolunteer.volunteeredSequence!,
      }]
    : closedHistory;

  return { ok: true, state: { ...state, responders, responsibilityHistory } };
}
