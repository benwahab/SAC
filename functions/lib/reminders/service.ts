import {
  buildReminderOccurrences,
  type ReminderDefinition,
  type ReminderKind,
  type ReminderMedication,
  type ReminderOccurrence,
  type ReminderRecurrence,
} from "../../../src/domain/reminder-schedule.ts";
import { ordinaryNotificationDeduplicationKey } from "../../../src/domain/ordinary-notification.ts";
import { checkReminderQuota } from "./entitlements.ts";

export type ReminderError =
  | "invalid_request"
  | "reminder_not_found"
  | "occurrence_not_found"
  | "invalid_transition"
  | "quota_exceeded"
  | "quota_unavailable"
  | "reminder_storage_unavailable"
  | "notification_not_found";

export type ReminderResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ReminderError };

export interface ReminderDraft {
  readonly kind: ReminderKind;
  readonly title: string;
  readonly description: string | null;
  readonly recurrence: ReminderRecurrence;
  readonly medication: ReminderMedication | null;
}

export interface ReminderSummary {
  readonly id: string;
  readonly kind: ReminderKind;
  readonly title: string;
  readonly description: string | null;
  readonly status: string;
  readonly recurrence: ReminderRecurrence;
  readonly medication: ReminderMedication | null;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly scheduledCount: number;
  readonly nextScheduledAt: number | null;
}

export interface ReminderDetail extends ReminderSummary {
  readonly occurrences: readonly ReminderOccurrence[];
}

export interface ReminderNotification {
  readonly id: string;
  readonly kind: string;
  readonly sourceId: string;
  readonly scheduledAt: number;
  readonly status: string;
  readonly readAt: number | null;
}

const KINDS: readonly ReminderKind[] = ["medication", "appointment", "activity", "visit", "event", "other"];
const STATUSES = ["active", "paused", "cancelled", "completed"] as const;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length >= min && trimmed.length <= max ? trimmed : null;
}

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > max) return undefined;
  return value.trim() ? value : null;
}

function integer(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
}

function dateKey(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

function timeKey(value: unknown): string | null {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  return value;
}

function timeZone(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 1 || value.length > 64) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    return value;
  } catch {
    return null;
  }
}

function parseRecurrence(value: unknown): ReminderRecurrence | null {
  const body = record(value);
  if (!body) return null;
  const zone = timeZone(body.timeZone);
  const localTime = timeKey(body.localTime);
  if (!zone || !localTime) return null;

  if (body.type === "once") {
    const localDate = dateKey(body.localDate);
    return localDate ? { type: "once", localDate, localTime, timeZone: zone } : null;
  }

  const startDate = dateKey(body.startDate);
  const endDate = dateKey(body.endDate);
  if (!startDate || !endDate || endDate < startDate) return null;

  if (body.type === "daily") {
    return { type: "daily", startDate, endDate, localTime, timeZone: zone };
  }

  if (body.type === "weekly") {
    if (!Array.isArray(body.weekdays) || body.weekdays.length < 1 || body.weekdays.length > 7) return null;
    const weekdays: number[] = [];
    for (const item of body.weekdays) {
      const day = integer(item, 0, 6);
      if (day === null || weekdays.includes(day)) return null;
      weekdays.push(day);
    }
    return { type: "weekly", startDate, endDate, localTime, weekdays, timeZone: zone };
  }

  if (body.type === "monthly") {
    const dayOfMonth = integer(body.dayOfMonth, 1, 31);
    return dayOfMonth === null ? null : { type: "monthly", startDate, endDate, localTime, dayOfMonth, timeZone: zone };
  }

  return null;
}

export function parseReminderDraft(value: unknown): ReminderResult<ReminderDraft> {
  const body = record(value);
  if (!body) return { ok: false, error: "invalid_request" };
  const kind = typeof body.kind === "string" && (KINDS as readonly string[]).includes(body.kind)
    ? body.kind as ReminderKind
    : null;
  const title = text(body.title, 1, 200);
  const description = optionalText(body.description, 2000);
  const recurrence = parseRecurrence(body.recurrence);
  if (!kind || !title || description === undefined || !recurrence) return { ok: false, error: "invalid_request" };

  let medication: ReminderMedication | null = null;
  if (kind === "medication") {
    const item = record(body.medication);
    if (!item) return { ok: false, error: "invalid_request" };
    const name = text(item.name, 1, 200);
    const dosage = text(item.dosage, 1, 200);
    const instructions = optionalText(item.instructions, 1000);
    if (!name || !dosage || instructions === undefined) return { ok: false, error: "invalid_request" };
    medication = { name, dosage, instructions };
  } else if (body.medication !== undefined && body.medication !== null) {
    return { ok: false, error: "invalid_request" };
  }

  return { ok: true, value: { kind, title, description, recurrence, medication } };
}

function recurrenceFromRow(row: Record<string, unknown>): ReminderRecurrence | null {
  const zone = typeof row.timezone === "string" ? row.timezone : null;
  const localTime = typeof row.local_time === "string" ? row.local_time : null;
  if (!zone || !localTime) return null;
  if (row.recurrence_type === "once") {
    return typeof row.local_date === "string" ? { type: "once", localDate: row.local_date, localTime, timeZone: zone } : null;
  }
  if (typeof row.start_date !== "string" || typeof row.end_date !== "string") return null;
  if (row.recurrence_type === "daily") {
    return { type: "daily", startDate: row.start_date, endDate: row.end_date, localTime, timeZone: zone };
  }
  if (row.recurrence_type === "weekly") {
    try {
      const weekdays = JSON.parse(String(row.weekdays_json)) as unknown;
      if (!Array.isArray(weekdays) || !weekdays.every((item) => Number.isInteger(item))) return null;
      return { type: "weekly", startDate: row.start_date, endDate: row.end_date, localTime, weekdays: weekdays as number[], timeZone: zone };
    } catch {
      return null;
    }
  }
  if (row.recurrence_type === "monthly" && typeof row.day_of_month === "number") {
    return { type: "monthly", startDate: row.start_date, endDate: row.end_date, localTime, dayOfMonth: row.day_of_month, timeZone: zone };
  }
  return null;
}

function medicationFromRow(row: Record<string, unknown>): ReminderMedication | null {
  if (row.kind !== "medication") return null;
  if (typeof row.medication_name !== "string" || typeof row.medication_dosage !== "string") return null;
  return {
    name: row.medication_name,
    dosage: row.medication_dosage,
    instructions: typeof row.medication_instructions === "string" ? row.medication_instructions : null,
  };
}

function summaryFromRow(row: Record<string, unknown>): ReminderSummary | null {
  const recurrence = recurrenceFromRow(row);
  if (!recurrence || typeof row.id !== "string" || typeof row.kind !== "string" || typeof row.title !== "string" ||
      typeof row.status !== "string" || typeof row.created_at !== "number" || typeof row.updated_at !== "number") {
    return null;
  }
  return {
    id: row.id,
    kind: row.kind as ReminderKind,
    title: row.title,
    description: typeof row.description === "string" ? row.description : null,
    status: row.status,
    recurrence,
    medication: medicationFromRow(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    scheduledCount: typeof row.scheduled_count === "number" ? row.scheduled_count : 0,
    nextScheduledAt: typeof row.next_scheduled_at === "number" ? row.next_scheduled_at : null,
  };
}

function occurrenceFromRow(row: Record<string, unknown>): ReminderOccurrence | null {
  if (typeof row.id !== "string" || typeof row.reminder_id !== "string" || typeof row.owner_account_id !== "string" ||
      typeof row.scheduled_at !== "number" || typeof row.local_date !== "string" || typeof row.local_time !== "string" ||
      typeof row.timezone !== "string" || typeof row.status !== "string" || typeof row.deduplication_key !== "string") {
    return null;
  }
  return {
    occurrenceId: row.id,
    reminderId: row.reminder_id,
    ownerAccountId: row.owner_account_id,
    scheduledAt: row.scheduled_at,
    localDate: row.local_date,
    localTime: row.local_time,
    timeZone: row.timezone,
    status: row.status as ReminderOccurrence["status"],
    deduplicationKey: row.deduplication_key,
  };
}

const SUMMARY_SELECT = `SELECT r.id, r.kind, r.title, r.description, r.status, r.timezone,
  r.recurrence_type, r.local_date, r.local_time, r.start_date, r.end_date,
  r.weekdays_json, r.day_of_month, r.medication_name, r.medication_dosage,
  r.medication_instructions, r.created_at, r.updated_at,
  (SELECT COUNT(*) FROM health_reminder_occurrences o
   WHERE o.reminder_id = r.id AND o.status = 'scheduled') AS scheduled_count,
  (SELECT MIN(o.scheduled_at) FROM health_reminder_occurrences o
   WHERE o.reminder_id = r.id AND o.status = 'scheduled') AS next_scheduled_at
  FROM health_reminders r`;

export async function createReminder(
  db: D1Database,
  accountId: string,
  input: unknown,
  nowMs = Date.now(),
): Promise<ReminderResult<ReminderDetail>> {
  const draft = parseReminderDraft(input);
  if (!draft.ok) return draft;

  const reminderId = crypto.randomUUID();
  const definition: ReminderDefinition = {
    reminderId,
    ownerAccountId: accountId,
    kind: draft.value.kind,
    title: draft.value.title,
    description: draft.value.description,
    status: "active",
    recurrence: draft.value.recurrence,
    medication: draft.value.medication,
  };
  const generated = buildReminderOccurrences(definition);
  if (!generated.ok) return { ok: false, error: "invalid_request" };

  const quota = await checkReminderQuota(db, accountId, generated.occurrences.length);
  if (!quota.ok) return { ok: false, error: quota.error };

  const recurrence = draft.value.recurrence;
  const weekdaysJson = recurrence.type === "weekly" ? JSON.stringify(recurrence.weekdays) : null;
  const dayOfMonth = recurrence.type === "monthly" ? recurrence.dayOfMonth : null;
  const localDate = recurrence.type === "once" ? recurrence.localDate : null;
  const startDate = recurrence.type === "once" ? null : recurrence.startDate;
  const endDate = recurrence.type === "once" ? null : recurrence.endDate;

  const occurrencesJson = JSON.stringify(generated.occurrences.map((item) => ({
    id: item.occurrenceId,
    reminderId: item.reminderId,
    ownerAccountId: item.ownerAccountId,
    scheduledAt: item.scheduledAt,
    localDate: item.localDate,
    localTime: item.localTime,
    timeZone: item.timeZone,
    deduplicationKey: item.deduplicationKey,
  })));
  const notificationsJson = JSON.stringify(generated.occurrences.map((item) => ({
    id: crypto.randomUUID(),
    sourceId: item.occurrenceId,
    scheduledAt: item.scheduledAt,
    deduplicationKey: ordinaryNotificationDeduplicationKey({
      kind: "reminder_due",
      sourceId: item.occurrenceId,
      recipientAccountId: accountId,
      scheduledAt: item.scheduledAt,
    }),
  })));

  try {
    const results = await db.batch([
      db.prepare(
        `INSERT INTO health_reminders
           (id, owner_account_id, created_by_account_id, source, kind, title, description,
            timezone, recurrence_type, local_date, local_time, start_date, end_date,
            weekdays_json, day_of_month, medication_name, medication_dosage,
            medication_instructions, status, version, created_at, updated_at)
         VALUES (?, ?, ?, 'personal', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?)`,
      ).bind(
        reminderId, accountId, accountId, draft.value.kind, draft.value.title, draft.value.description,
        recurrence.timeZone, recurrence.type, localDate, recurrence.localTime, startDate, endDate,
        weekdaysJson, dayOfMonth, draft.value.medication?.name ?? null,
        draft.value.medication?.dosage ?? null, draft.value.medication?.instructions ?? null,
        nowMs, nowMs,
      ),
      db.prepare(
        `INSERT INTO health_reminder_occurrences
           (id, reminder_id, owner_account_id, scheduled_at, local_date, local_time,
            timezone, status, deduplication_key, created_at, notified_at, closed_at)
         SELECT json_extract(value, '$.id'), json_extract(value, '$.reminderId'),
                json_extract(value, '$.ownerAccountId'), json_extract(value, '$.scheduledAt'),
                json_extract(value, '$.localDate'), json_extract(value, '$.localTime'),
                json_extract(value, '$.timeZone'), 'scheduled',
                json_extract(value, '$.deduplicationKey'), ?, NULL, NULL
         FROM json_each(?)`,
      ).bind(nowMs, occurrencesJson),
      db.prepare(
        `INSERT INTO ordinary_notification_outbox
           (id, kind, source_id, recipient_account_id, scheduled_at, status,
            attempt_count, next_attempt_at, lease_until, lease_token,
            deduplication_key, created_at, updated_at, processed_at, error_code)
         SELECT json_extract(value, '$.id'), 'reminder_due', json_extract(value, '$.sourceId'),
                ?, json_extract(value, '$.scheduledAt'), 'pending', 0,
                json_extract(value, '$.scheduledAt'), NULL, NULL,
                json_extract(value, '$.deduplicationKey'), ?, ?, NULL, NULL
         FROM json_each(?)`,
      ).bind(accountId, nowMs, nowMs, notificationsJson),
      db.prepare(
        `INSERT INTO health_reminder_events
           (id, reminder_id, occurrence_id, actor_account_id, event_type, occurred_at, metadata_json)
         VALUES (?, ?, NULL, ?, 'created', ?, ?)`,
      ).bind(
        crypto.randomUUID(), reminderId, accountId, nowMs,
        JSON.stringify({ source: "personal", occurrenceCount: generated.occurrences.length }),
      ),
    ]);
    if (results.length !== 4 || results.some((result) => !result.success)) {
      return { ok: false, error: "reminder_storage_unavailable" };
    }
  } catch {
    return { ok: false, error: "reminder_storage_unavailable" };
  }

  return getReminder(db, accountId, reminderId);
}

export async function listReminders(db: D1Database, accountId: string): Promise<ReminderResult<readonly ReminderSummary[]>> {
  try {
    const rows = await db.prepare(
      `${SUMMARY_SELECT} WHERE r.owner_account_id = ? ORDER BY r.created_at DESC LIMIT 100`,
    ).bind(accountId).all<Record<string, unknown>>();
    if (!rows.success || !Array.isArray(rows.results)) return { ok: false, error: "reminder_storage_unavailable" };
    return { ok: true, value: rows.results.map(summaryFromRow).filter((item): item is ReminderSummary => item !== null) };
  } catch {
    return { ok: false, error: "reminder_storage_unavailable" };
  }
}

export async function getReminder(db: D1Database, accountId: string, reminderId: string): Promise<ReminderResult<ReminderDetail>> {
  try {
    const row = await db.prepare(
      `${SUMMARY_SELECT} WHERE r.id = ? AND r.owner_account_id = ? LIMIT 1`,
    ).bind(reminderId, accountId).first<Record<string, unknown>>();
    const summary = row ? summaryFromRow(row) : null;
    if (!summary) return { ok: false, error: "reminder_not_found" };

    const occurrenceRows = await db.prepare(
      `SELECT id, reminder_id, owner_account_id, scheduled_at, local_date, local_time,
              timezone, status, deduplication_key
       FROM health_reminder_occurrences
       WHERE reminder_id = ? AND owner_account_id = ?
       ORDER BY scheduled_at LIMIT 400`,
    ).bind(reminderId, accountId).all<Record<string, unknown>>();
    if (!occurrenceRows.success || !Array.isArray(occurrenceRows.results)) {
      return { ok: false, error: "reminder_storage_unavailable" };
    }
    const occurrences = occurrenceRows.results.map(occurrenceFromRow)
      .filter((item): item is ReminderOccurrence => item !== null);
    return { ok: true, value: { ...summary, occurrences } };
  } catch {
    return { ok: false, error: "reminder_storage_unavailable" };
  }
}

export async function updateReminder(
  db: D1Database,
  accountId: string,
  reminderId: string,
  input: unknown,
  nowMs = Date.now(),
): Promise<ReminderResult<ReminderDetail>> {
  const body = record(input);
  if (!body) return { ok: false, error: "invalid_request" };
  const action = body.action === "cancel" ? "cancel" : "update";
  const current = await getReminder(db, accountId, reminderId);
  if (!current.ok) return current;
  if (current.value.status === "cancelled" || current.value.status === "completed") {
    return { ok: false, error: "invalid_transition" };
  }

  let title = current.value.title;
  let description = current.value.description;
  let status = current.value.status;
  let eventType = "updated";
  if (action === "cancel") {
    status = "cancelled";
    eventType = "cancelled";
  } else {
    if (body.title !== undefined) {
      const next = text(body.title, 1, 200);
      if (!next) return { ok: false, error: "invalid_request" };
      title = next;
    }
    if (body.description !== undefined) {
      const next = optionalText(body.description, 2000);
      if (next === undefined) return { ok: false, error: "invalid_request" };
      description = next;
    }
    if (body.status !== undefined) {
      if (typeof body.status !== "string" || !(STATUSES as readonly string[]).includes(body.status)) {
        return { ok: false, error: "invalid_request" };
      }
      status = body.status;
      eventType = status === "paused" ? "paused" : status === "active" ? "resumed" : status;
    }
    if (title === current.value.title && description === current.value.description && status === current.value.status) {
      return { ok: false, error: "invalid_request" };
    }
  }

  try {
    const results = await db.batch([
      db.prepare(
        `UPDATE health_reminders
         SET title = ?, description = ?, status = ?, version = version + 1, updated_at = ?
         WHERE id = ? AND owner_account_id = ? AND status NOT IN ('cancelled', 'completed')`,
      ).bind(title, description, status, nowMs, reminderId, accountId),
      db.prepare(
        `INSERT INTO health_reminder_events
           (id, reminder_id, occurrence_id, actor_account_id, event_type, occurred_at, metadata_json)
         VALUES (?, ?, NULL, ?, ?, ?, NULL)`,
      ).bind(crypto.randomUUID(), reminderId, accountId, eventType, nowMs),
    ]);
    if (results.length !== 2 || results.some((result) => !result.success) || results[0].meta.changes !== 1) {
      return { ok: false, error: "invalid_transition" };
    }
  } catch {
    return { ok: false, error: "reminder_storage_unavailable" };
  }
  return getReminder(db, accountId, reminderId);
}

export async function closeOccurrence(
  db: D1Database,
  accountId: string,
  occurrenceId: string,
  input: unknown,
  nowMs = Date.now(),
): Promise<ReminderResult<ReminderOccurrence>> {
  const body = record(input);
  const status = body?.status;
  if (status !== "completed" && status !== "cancelled") return { ok: false, error: "invalid_request" };

  try {
    const row = await db.prepare(
      `SELECT o.id, o.reminder_id, o.owner_account_id, o.scheduled_at, o.local_date,
              o.local_time, o.timezone, o.status, o.deduplication_key
       FROM health_reminder_occurrences o
       JOIN health_reminders r ON r.id = o.reminder_id
       WHERE o.id = ? AND o.owner_account_id = ? AND r.owner_account_id = ?
       LIMIT 1`,
    ).bind(occurrenceId, accountId, accountId).first<Record<string, unknown>>();
    const occurrence = row ? occurrenceFromRow(row) : null;
    if (!occurrence) return { ok: false, error: "occurrence_not_found" };
    if (occurrence.status === "completed" || occurrence.status === "cancelled") {
      return occurrence.status === status
        ? { ok: true, value: occurrence }
        : { ok: false, error: "invalid_transition" };
    }

    const results = await db.batch([
      db.prepare(
        `UPDATE health_reminder_occurrences
         SET status = ?, closed_at = ?
         WHERE id = ? AND owner_account_id = ? AND status IN ('scheduled', 'notified')`,
      ).bind(status, nowMs, occurrenceId, accountId),
      db.prepare(
        `INSERT INTO health_reminder_events
           (id, reminder_id, occurrence_id, actor_account_id, event_type, occurred_at, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      ).bind(
        crypto.randomUUID(), occurrence.reminderId, occurrenceId, accountId,
        status === "completed" ? "occurrence_completed" : "occurrence_cancelled", nowMs,
      ),
    ]);
    if (results.length !== 2 || results.some((result) => !result.success) || results[0].meta.changes !== 1) {
      return { ok: false, error: "invalid_transition" };
    }
    return { ok: true, value: { ...occurrence, status } };
  } catch {
    return { ok: false, error: "reminder_storage_unavailable" };
  }
}

export async function listNotifications(
  db: D1Database,
  accountId: string,
  nowMs = Date.now(),
): Promise<ReminderResult<readonly ReminderNotification[]>> {
  try {
    const rows = await db.prepare(
      `SELECT o.id, o.kind, o.source_id, o.scheduled_at, o.status, r.read_at
       FROM ordinary_notification_outbox o
       LEFT JOIN ordinary_notification_reads r
         ON r.notification_id = o.id AND r.recipient_account_id = o.recipient_account_id
       WHERE o.recipient_account_id = ?
         AND o.scheduled_at <= ?
         AND o.status IN ('pending', 'processing', 'accepted', 'permanent_failure')
       ORDER BY o.scheduled_at DESC LIMIT 100`,
    ).bind(accountId, nowMs).all<Record<string, unknown>>();
    if (!rows.success || !Array.isArray(rows.results)) return { ok: false, error: "reminder_storage_unavailable" };
    return {
      ok: true,
      value: rows.results.flatMap((row) => {
        if (typeof row.id !== "string" || typeof row.kind !== "string" || typeof row.source_id !== "string" ||
            typeof row.scheduled_at !== "number" || typeof row.status !== "string") return [];
        return [{
          id: row.id,
          kind: row.kind,
          sourceId: row.source_id,
          scheduledAt: row.scheduled_at,
          status: row.status,
          readAt: typeof row.read_at === "number" ? row.read_at : null,
        }];
      }),
    };
  } catch {
    return { ok: false, error: "reminder_storage_unavailable" };
  }
}

export async function markNotificationRead(
  db: D1Database,
  accountId: string,
  notificationId: string,
  nowMs = Date.now(),
): Promise<ReminderResult<{ readonly read: true }>> {
  try {
    const row = await db.prepare(
      "SELECT id FROM ordinary_notification_outbox WHERE id = ? AND recipient_account_id = ? LIMIT 1",
    ).bind(notificationId, accountId).first<{ id: string }>();
    if (!row) return { ok: false, error: "notification_not_found" };
    const result = await db.prepare(
      `INSERT OR IGNORE INTO ordinary_notification_reads
         (notification_id, recipient_account_id, read_at, dismissed_at)
       VALUES (?, ?, ?, NULL)`,
    ).bind(notificationId, accountId, nowMs).run();
    if (!result.success) return { ok: false, error: "reminder_storage_unavailable" };
    return { ok: true, value: { read: true } };
  } catch {
    return { ok: false, error: "reminder_storage_unavailable" };
  }
}
