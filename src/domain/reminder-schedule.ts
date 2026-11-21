/**
 * Contrat métier pur des rappels ordinaires.
 *
 * Ce module ne connaît ni le SOS, ni le GPS, ni les SMS. Il ne planifie aucune
 * escalade et ne clôture jamais une occurrence voisine. Les horodatages produits
 * sont en millisecondes Unix UTC ; les heures locales et le fuseau IANA restent
 * conservés pour l'affichage et l'idempotence.
 */

export type ReminderKind = "medication" | "appointment" | "activity" | "visit" | "event" | "other";
export type ReminderStatus = "active" | "paused" | "cancelled" | "completed";
export type ReminderOccurrenceStatus = "scheduled" | "notified" | "cancelled" | "completed";

export type ReminderRecurrence =
  | { readonly type: "once"; readonly localDate: string; readonly localTime: string; readonly timeZone: string }
  | { readonly type: "daily"; readonly startDate: string; readonly endDate: string; readonly localTime: string; readonly timeZone: string }
  | { readonly type: "weekly"; readonly startDate: string; readonly endDate: string; readonly localTime: string; readonly weekdays: readonly number[]; readonly timeZone: string }
  | { readonly type: "monthly"; readonly startDate: string; readonly endDate: string; readonly localTime: string; readonly dayOfMonth: number; readonly timeZone: string };

export interface ReminderMedication {
  readonly name: string;
  readonly dosage: string;
  readonly instructions: string | null;
}

export interface ReminderDefinition {
  readonly reminderId: string;
  readonly ownerAccountId: string;
  readonly kind: ReminderKind;
  readonly title: string;
  readonly description: string | null;
  readonly status: ReminderStatus;
  readonly recurrence: ReminderRecurrence;
  readonly medication: ReminderMedication | null;
}

export interface ReminderOccurrence {
  readonly occurrenceId: string;
  readonly reminderId: string;
  readonly ownerAccountId: string;
  readonly scheduledAt: number;
  readonly localDate: string;
  readonly localTime: string;
  readonly timeZone: string;
  readonly status: ReminderOccurrenceStatus;
  readonly deduplicationKey: string;
}

export type ReminderScheduleError =
  | "invalid_reminder"
  | "invalid_recurrence"
  | "invalid_time_zone"
  | "invalid_local_date"
  | "invalid_local_time"
  | "invalid_range"
  | "range_too_long"
  | "too_many_occurrences"
  | "no_occurrences"
  | "reminder_not_active"
  | "occurrence_not_found"
  | "occurrence_already_closed"
  | "occurrence_already_notified"
  | "invalid_transition";

export type ReminderScheduleResult =
  | { readonly ok: true; readonly occurrences: readonly ReminderOccurrence[] }
  | { readonly ok: false; readonly error: ReminderScheduleError };

export type ReminderOccurrenceResult =
  | { readonly ok: true; readonly occurrences: readonly ReminderOccurrence[] }
  | { readonly ok: false; readonly error: ReminderScheduleError };

const MAX_RANGE_DAYS = 366;
const MAX_OCCURRENCES = 366;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;
const REMINDER_KINDS: readonly ReminderKind[] = ["medication", "appointment", "activity", "visit", "event", "other"];

interface DateParts { readonly year: number; readonly month: number; readonly day: number }
interface TimeParts { readonly hour: number; readonly minute: number }

function parseDateKey(value: string): DateParts | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isSafeInteger(year) || month < 1 || month > 12 || day < 1) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return { year, month, day };
}

function parseTimeKey(value: string): TimeParts | null {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isSafeInteger(hour) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function dateKey(parts: DateParts): string {
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function dateFromUtcMs(value: number): DateParts {
  const date = new Date(value);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isTimeZone(value: string): boolean {
  if (value.length < 1 || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convertit une date et une heure locales d'un fuseau IANA en instant UTC.
 * Les heures inexistantes lors d'un passage à l'heure d'été sont refusées.
 */
export function zonedDateTimeToUtc(localDate: string, localTime: string, timeZone: string): number | null {
  const date = parseDateKey(localDate);
  const time = parseTimeKey(localTime);
  if (!date || !time || !isTimeZone(timeZone)) return null;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const partsAt = (timestamp: number): DateParts & TimeParts & { second: number } | null => {
    const values: Record<string, number> = {};
    for (const part of formatter.formatToParts(timestamp)) {
      if (part.type !== "literal") values[part.type] = Number(part.value);
    }
    if (![values.year, values.month, values.day, values.hour, values.minute, values.second].every(Number.isFinite)) return null;
    return {
      year: values.year, month: values.month, day: values.day,
      hour: values.hour, minute: values.minute, second: values.second,
    };
  };

  const targetAsUtc = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, 0, 0);
  let timestamp = targetAsUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = partsAt(timestamp);
    if (!parts) return null;
    const representedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const correction = targetAsUtc - representedAsUtc;
    if (correction === 0) break;
    timestamp += correction;
  }

  const finalParts = partsAt(timestamp);
  if (!finalParts || finalParts.year !== date.year || finalParts.month !== date.month ||
      finalParts.day !== date.day || finalParts.hour !== time.hour || finalParts.minute !== time.minute) {
    return null;
  }
  return timestamp;
}

function validRecurrenceShape(recurrence: ReminderRecurrence): ReminderScheduleError | null {
  if (!isTimeZone(recurrence.timeZone)) return "invalid_time_zone";
  if (recurrence.type === "once") {
    if (!parseDateKey(recurrence.localDate)) return "invalid_local_date";
    if (!parseTimeKey(recurrence.localTime)) return "invalid_local_time";
    return null;
  }
  if (!parseDateKey(recurrence.startDate) || !parseDateKey(recurrence.endDate)) return "invalid_local_date";
  if (!parseTimeKey(recurrence.localTime)) return "invalid_local_time";
  const start = parseDateKey(recurrence.startDate);
  const end = parseDateKey(recurrence.endDate);
  if (!start || !end || end.year * 372 + end.month * 31 + end.day < start.year * 372 + start.month * 31 + start.day) {
    return "invalid_range";
  }
  if (recurrence.type === "weekly") {
    if (!Array.isArray(recurrence.weekdays) || recurrence.weekdays.length === 0) return "invalid_recurrence";
    const unique = new Set<number>();
    for (const weekday of recurrence.weekdays) {
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || unique.has(weekday)) return "invalid_recurrence";
      unique.add(weekday);
    }
  }
  if (recurrence.type === "monthly" && (!Number.isInteger(recurrence.dayOfMonth) || recurrence.dayOfMonth < 1 || recurrence.dayOfMonth > 31)) {
    return "invalid_recurrence";
  }
  return null;
}

function validateReminder(reminder: ReminderDefinition): ReminderScheduleError | null {
  if (!reminder.reminderId.trim() || !reminder.ownerAccountId.trim()) return "invalid_reminder";
  if (!REMINDER_KINDS.includes(reminder.kind)) return "invalid_reminder";
  const title = reminder.title.trim();
  if (title.length < 1 || title.length > 200) return "invalid_reminder";
  if (reminder.description !== null && reminder.description.length > 2000) return "invalid_reminder";
  if (reminder.kind === "medication") {
    if (!reminder.medication || reminder.medication.name.trim().length < 1 || reminder.medication.name.length > 200 ||
        reminder.medication.dosage.trim().length < 1 || reminder.medication.dosage.length > 200 ||
        (reminder.medication.instructions !== null && reminder.medication.instructions.length > 1000)) {
      return "invalid_reminder";
    }
  } else if (reminder.medication !== null) {
    return "invalid_reminder";
  }
  return validRecurrenceShape(reminder.recurrence);
}

function occurrence(
  reminder: ReminderDefinition,
  localDate: string,
  localTime: string,
  timeZone: string,
  scheduledAt: number,
): ReminderOccurrence {
  return {
    occurrenceId: `${reminder.reminderId}:${scheduledAt}`,
    reminderId: reminder.reminderId,
    ownerAccountId: reminder.ownerAccountId,
    scheduledAt,
    localDate,
    localTime,
    timeZone,
    status: "scheduled",
    deduplicationKey: `${reminder.reminderId}:${scheduledAt}`,
  };
}

/**
 * Génère toutes les occurrences d'un rappel actif. Chaque occurrence est
 * indépendante et dédupliquée par (rappel, instant UTC).
 */
export function buildReminderOccurrences(reminder: ReminderDefinition): ReminderScheduleResult {
  const invalid = validateReminder(reminder);
  if (invalid) return { ok: false, error: invalid };
  if (reminder.status !== "active") return { ok: false, error: "reminder_not_active" };

  const recurrence = reminder.recurrence;
  if (recurrence.type === "once") {
    const scheduledAt = zonedDateTimeToUtc(recurrence.localDate, recurrence.localTime, recurrence.timeZone);
    if (scheduledAt === null) return { ok: false, error: "invalid_local_time" };
    return { ok: true, occurrences: [occurrence(reminder, recurrence.localDate, recurrence.localTime, recurrence.timeZone, scheduledAt)] };
  }

  const start = parseDateKey(recurrence.startDate);
  const end = parseDateKey(recurrence.endDate);
  if (!start || !end) return { ok: false, error: "invalid_local_date" };
  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);
  if (endUtc < startUtc) return { ok: false, error: "invalid_range" };
  if ((endUtc - startUtc) / 86_400_000 > MAX_RANGE_DAYS) return { ok: false, error: "range_too_long" };

  const dates: string[] = [];
  if (recurrence.type === "daily" || recurrence.type === "weekly") {
    const weekdays = recurrence.type === "weekly" ? new Set(recurrence.weekdays) : null;
    for (let cursor = startUtc; cursor <= endUtc; cursor += 86_400_000) {
      const parts = dateFromUtcMs(cursor);
      if (weekdays && !weekdays.has(new Date(cursor).getUTCDay())) continue;
      dates.push(dateKey(parts));
    }
  } else {
    let year = start.year;
    let month = start.month;
    while (year * 12 + month <= end.year * 12 + end.month) {
      if (recurrence.dayOfMonth <= daysInMonth(year, month)) {
        const candidate = dateKey({ year, month, day: recurrence.dayOfMonth });
        const candidateUtc = Date.UTC(year, month - 1, recurrence.dayOfMonth);
        if (candidateUtc >= startUtc && candidateUtc <= endUtc) dates.push(candidate);
      }
      month += 1;
      if (month === 13) { month = 1; year += 1; }
    }
  }

  if (dates.length === 0) return { ok: false, error: "no_occurrences" };
  if (dates.length > MAX_OCCURRENCES) return { ok: false, error: "too_many_occurrences" };

  const seen = new Set<number>();
  const occurrences: ReminderOccurrence[] = [];
  for (const localDate of dates) {
    const scheduledAt = zonedDateTimeToUtc(localDate, recurrence.localTime, recurrence.timeZone);
    // Une heure locale inexistante (passage à l'heure d'été) est ignorée.
    if (scheduledAt === null || seen.has(scheduledAt)) continue;
    seen.add(scheduledAt);
    occurrences.push(occurrence(reminder, localDate, recurrence.localTime, recurrence.timeZone, scheduledAt));
  }
  if (occurrences.length === 0) return { ok: false, error: "no_occurrences" };
  return { ok: true, occurrences };
}

export function closeReminderOccurrence(
  occurrences: readonly ReminderOccurrence[],
  occurrenceId: string,
  status: "completed" | "cancelled",
): ReminderOccurrenceResult {
  const target = occurrences.find((item) => item.occurrenceId === occurrenceId);
  if (!target) return { ok: false, error: "occurrence_not_found" };
  if (target.status === "completed" || target.status === "cancelled") {
    return target.status === status
      ? { ok: true, occurrences }
      : { ok: false, error: "occurrence_already_closed" };
  }
  return {
    ok: true,
    occurrences: occurrences.map((item) => item.occurrenceId === occurrenceId ? { ...item, status } : item),
  };
}

export function markReminderOccurrenceNotified(
  occurrences: readonly ReminderOccurrence[],
  occurrenceId: string,
): ReminderOccurrenceResult {
  const target = occurrences.find((item) => item.occurrenceId === occurrenceId);
  if (!target) return { ok: false, error: "occurrence_not_found" };
  if (target.status === "notified") return { ok: true, occurrences };
  if (target.status !== "scheduled") return { ok: false, error: "invalid_transition" };
  return {
    ok: true,
    occurrences: occurrences.map((item) => item.occurrenceId === occurrenceId ? { ...item, status: "notified" } : item),
  };
}

export function isReminderOccurrenceDue(occurrence: ReminderOccurrence, nowMs: number): boolean {
  return occurrence.status === "scheduled" && Number.isFinite(nowMs) && occurrence.scheduledAt <= nowMs;
}

export function reminderOccurrenceNotificationKey(occurrence: ReminderOccurrence): string {
  return `ordinary:reminder_due:${occurrence.deduplicationKey}`;
}
