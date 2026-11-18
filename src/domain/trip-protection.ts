/**
 * Contrat métier pur de Protection des trajets.
 *
 * Les délais et durées sont fournis explicitement par la configuration du trajet :
 * aucun délai de grâce ni cadence de rappel n'est inventé ici.
 * Ce module ne lit ni ne stocke de coordonnées GPS et ne planifie aucun rappel.
 */
import type { AlertRecipientSnapshot, LocationShareDuration } from "./sac.ts";

export type TripProtectionMode = "arrival_check" | "accompaniment" | "full_protection";
export type TripStatus = "active" | "closed_by_author";
export type TripArrivalStatus = "not_applicable" | "pending" | "confirmed" | "unconfirmed";

export interface TripProtectionRecord {
  readonly tripId: string;
  readonly authorAccountId: string;
  readonly mode: TripProtectionMode;
  readonly status: TripStatus;
  readonly createdAt: string;
  readonly expectedArrivalAt: string | null;
  readonly gracePeriodMinutes: number | null;
  readonly arrivalStatus: TripArrivalStatus;
  readonly locationSharing: {
    readonly enabled: boolean;
    readonly duration: LocationShareDuration;
  } | null;
  readonly recipientSnapshot: readonly AlertRecipientSnapshot[];
  readonly events: readonly TripProtectionEvent[];
}

export type TripProtectionEvent =
  | { readonly type: "arrival_confirmed"; readonly actorAccountId: string; readonly at: string; readonly late: boolean }
  | { readonly type: "arrival_marked_unconfirmed"; readonly actorAccountId: "system"; readonly at: string }
  | { readonly type: "closed"; readonly actorAccountId: string; readonly at: string; readonly reason: "completed" | "cancelled" };

export type TripProtectionCommand =
  | { readonly type: "confirm_arrival"; readonly actorAccountId: string; readonly at: string }
  | { readonly type: "mark_arrival_unconfirmed"; readonly actorAccountId: "system"; readonly at: string }
  | { readonly type: "close"; readonly actorAccountId: string; readonly at: string; readonly reason: "completed" | "cancelled" };

export type TripProtectionError =
  | "invalid_trip"
  | "invalid_command"
  | "actor_not_author"
  | "trip_not_active"
  | "arrival_not_applicable"
  | "arrival_already_confirmed"
  | "arrival_already_unconfirmed"
  | "grace_period_not_elapsed"
  | "invalid_timestamp"
  | "event_before_trip_creation";

export type TripProtectionResult =
  | { readonly ok: true; readonly trip: TripProtectionRecord }
  | { readonly ok: false; readonly error: TripProtectionError };

function isUtc(value: string): boolean {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function validSnapshot(snapshot: readonly AlertRecipientSnapshot[]): boolean {
  const ids = new Set<string>();
  return snapshot.every((recipient) => {
    if (!recipient.contactUserId.trim() || !isUtc(recipient.selectedAt) || ids.has(recipient.contactUserId)) return false;
    ids.add(recipient.contactUserId);
    return true;
  });
}

function isValidTrip(trip: TripProtectionRecord): boolean {
  if (!trip.tripId.trim() || !trip.authorAccountId.trim() || !isUtc(trip.createdAt) || !validSnapshot(trip.recipientSnapshot)) return false;
  const hasArrival = trip.mode !== "accompaniment";
  if (hasArrival) {
    if (!trip.expectedArrivalAt || !isUtc(trip.expectedArrivalAt) || Date.parse(trip.expectedArrivalAt) < Date.parse(trip.createdAt)) return false;
    if (!Number.isSafeInteger(trip.gracePeriodMinutes) || (trip.gracePeriodMinutes ?? -1) < 0) return false;
    if (!["pending", "confirmed", "unconfirmed"].includes(trip.arrivalStatus)) return false;
  } else if (
    trip.expectedArrivalAt !== null ||
    trip.gracePeriodMinutes !== null ||
    trip.arrivalStatus !== "not_applicable"
  ) return false;

  if (trip.mode === "arrival_check") {
    if (trip.locationSharing !== null) return false;
  } else {
    if (!trip.locationSharing?.enabled || !trip.locationSharing.duration) return false;
  }

  if (trip.status !== "active" && trip.status !== "closed_by_author") return false;
  for (const event of trip.events) {
    if (!isUtc(event.at) || Date.parse(event.at) < Date.parse(trip.createdAt)) return false;
  }
  return true;
}

export function transitionTripProtection(
  trip: TripProtectionRecord,
  command: TripProtectionCommand,
): TripProtectionResult {
  if (!isValidTrip(trip)) return { ok: false, error: "invalid_trip" };
  if (!command || typeof command !== "object" || typeof command.actorAccountId !== "string" || typeof command.at !== "string") {
    return { ok: false, error: "invalid_command" };
  }
  if (!isUtc(command.at)) return { ok: false, error: "invalid_timestamp" };
  if (Date.parse(command.at) < Date.parse(trip.createdAt)) return { ok: false, error: "event_before_trip_creation" };
  if (trip.status !== "active") return { ok: false, error: "trip_not_active" };

  if (command.type === "close") {
    if (command.actorAccountId !== trip.authorAccountId) return { ok: false, error: "actor_not_author" };
    const event: TripProtectionEvent = {
      type: "closed",
      actorAccountId: command.actorAccountId,
      at: command.at,
      reason: command.reason,
    };
    return {
      ok: true,
      trip: { ...trip, status: "closed_by_author", events: [...trip.events, event] },
    };
  }

  if (command.type === "confirm_arrival") {
    if (command.actorAccountId !== trip.authorAccountId) return { ok: false, error: "actor_not_author" };
    if (trip.arrivalStatus === "not_applicable") return { ok: false, error: "arrival_not_applicable" };
    if (trip.arrivalStatus === "confirmed") return { ok: false, error: "arrival_already_confirmed" };
    const late = Date.parse(command.at) > Date.parse(trip.expectedArrivalAt!) + trip.gracePeriodMinutes! * 60_000;
    const event: TripProtectionEvent = { type: "arrival_confirmed", actorAccountId: command.actorAccountId, at: command.at, late };
    return {
      ok: true,
      trip: { ...trip, arrivalStatus: "confirmed", events: [...trip.events, event] },
    };
  }

  if (command.type === "mark_arrival_unconfirmed") {
    if (command.actorAccountId !== "system") return { ok: false, error: "invalid_command" };
    if (trip.arrivalStatus === "not_applicable") return { ok: false, error: "arrival_not_applicable" };
    if (trip.arrivalStatus === "confirmed") return { ok: false, error: "arrival_already_confirmed" };
    if (trip.arrivalStatus === "unconfirmed") return { ok: false, error: "arrival_already_unconfirmed" };
    const deadline = Date.parse(trip.expectedArrivalAt!) + trip.gracePeriodMinutes! * 60_000;
    if (Date.parse(command.at) < deadline) return { ok: false, error: "grace_period_not_elapsed" };
    const event: TripProtectionEvent = { type: "arrival_marked_unconfirmed", actorAccountId: "system", at: command.at };
    return {
      ok: true,
      trip: { ...trip, arrivalStatus: "unconfirmed", events: [...trip.events, event] },
    };
  }

  return { ok: false, error: "invalid_command" };
}
