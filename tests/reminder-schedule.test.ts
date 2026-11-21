import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReminderOccurrences,
  closeReminderOccurrence,
  isReminderOccurrenceDue,
  markReminderOccurrenceNotified,
  reminderOccurrenceNotificationKey,
  zonedDateTimeToUtc,
  type ReminderDefinition,
} from "../src/domain/reminder-schedule.ts";

const base: ReminderDefinition = {
  reminderId: "reminder-a",
  ownerAccountId: "account-a",
  kind: "appointment",
  title: "Consultation",
  description: null,
  status: "active",
  recurrence: { type: "once", localDate: "2026-11-21", localTime: "08:00", timeZone: "Africa/Niamey" },
  medication: null,
};

test("convertit une heure locale de Niamey en UTC", () => {
  assert.equal(zonedDateTimeToUtc("2026-11-21", "08:00", "Africa/Niamey"), Date.UTC(2026, 10, 21, 7, 0));
});

test("génère une occurrence unique", () => {
  const result = buildReminderOccurrences(base);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.occurrences.length, 1);
  assert.equal(result.occurrences[0].scheduledAt, Date.UTC(2026, 10, 21, 7, 0));
  assert.equal(result.occurrences[0].status, "scheduled");
});

test("génère plusieurs occurrences quotidiennes indépendantes", () => {
  const result = buildReminderOccurrences({
    ...base,
    kind: "medication",
    medication: { name: "Médicament A", dosage: "1 comprimé", instructions: null },
    recurrence: {
      type: "daily",
      startDate: "2026-11-21",
      endDate: "2026-11-23",
      localTime: "08:00",
      timeZone: "Africa/Niamey",
    },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.occurrences.length, 3);
  assert.deepEqual(result.occurrences.map((item) => item.localDate), ["2026-11-21", "2026-11-22", "2026-11-23"]);
  assert.equal(new Set(result.occurrences.map((item) => item.deduplicationKey)).size, 3);
});

test("génère uniquement les jours de semaine demandés", () => {
  const result = buildReminderOccurrences({
    ...base,
    recurrence: {
      type: "weekly",
      startDate: "2026-11-21",
      endDate: "2026-11-30",
      localTime: "08:00",
      weekdays: [1, 3],
      timeZone: "Africa/Niamey",
    },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.occurrences.map((item) => item.localDate), ["2026-11-23", "2026-11-25", "2026-11-30"]);
});

test("ignore les mois sans le jour demandé pour une récurrence mensuelle", () => {
  const result = buildReminderOccurrences({
    ...base,
    recurrence: {
      type: "monthly",
      startDate: "2026-01-31",
      endDate: "2026-04-30",
      localTime: "08:00",
      dayOfMonth: 31,
      timeZone: "Africa/Niamey",
    },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.occurrences.map((item) => item.localDate), ["2026-01-31", "2026-03-31"]);
});

test("ignore une heure locale inexistante lors du passage à l'heure d'été", () => {
  const result = buildReminderOccurrences({
    ...base,
    recurrence: {
      type: "daily",
      startDate: "2026-03-07",
      endDate: "2026-03-09",
      localTime: "02:30",
      timeZone: "America/New_York",
    },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.occurrences.map((item) => item.localDate), ["2026-03-07", "2026-03-09"]);
});

test("refuse un rappel inactif", () => {
  const result = buildReminderOccurrences({ ...base, status: "cancelled" });
  assert.deepEqual(result, { ok: false, error: "reminder_not_active" });
});

test("refuse un médicament sans nom ou dosage", () => {
  const result = buildReminderOccurrences({
    ...base,
    kind: "medication",
    medication: { name: "", dosage: "1 comprimé", instructions: null },
  });
  assert.deepEqual(result, { ok: false, error: "invalid_reminder" });
});

test("clôture une occurrence sans toucher aux suivantes", () => {
  const generated = buildReminderOccurrences({
    ...base,
    recurrence: {
      type: "daily",
      startDate: "2026-11-21",
      endDate: "2026-11-23",
      localTime: "08:00",
      timeZone: "Africa/Niamey",
    },
  });
  assert.equal(generated.ok, true);
  if (!generated.ok) return;
  const target = generated.occurrences[1];
  const closed = closeReminderOccurrence(generated.occurrences, target.occurrenceId, "completed");
  assert.equal(closed.ok, true);
  if (!closed.ok) return;
  assert.equal(closed.occurrences[0].status, "scheduled");
  assert.equal(closed.occurrences[1].status, "completed");
  assert.equal(closed.occurrences[2].status, "scheduled");
});

test("la clôture est idempotente mais refuse un second statut différent", () => {
  const generated = buildReminderOccurrences(base);
  assert.equal(generated.ok, true);
  if (!generated.ok) return;
  const id = generated.occurrences[0].occurrenceId;
  const first = closeReminderOccurrence(generated.occurrences, id, "completed");
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(closeReminderOccurrence(first.occurrences, id, "completed").ok, true);
  assert.deepEqual(closeReminderOccurrence(first.occurrences, id, "cancelled"), { ok: false, error: "occurrence_already_closed" });
});

test("marque une occurrence comme notifiée sans créer de relance", () => {
  const generated = buildReminderOccurrences(base);
  assert.equal(generated.ok, true);
  if (!generated.ok) return;
  const id = generated.occurrences[0].occurrenceId;
  const notified = markReminderOccurrenceNotified(generated.occurrences, id);
  assert.equal(notified.ok, true);
  if (!notified.ok) return;
  assert.equal(notified.occurrences[0].status, "notified");
  assert.equal(isReminderOccurrenceDue(notified.occurrences[0], Date.now()), false);
  assert.equal(reminderOccurrenceNotificationKey(notified.occurrences[0]), `ordinary:reminder_due:${notified.occurrences[0].deduplicationKey}`);
});

test("une occurrence future n'est pas due", () => {
  const generated = buildReminderOccurrences(base);
  assert.equal(generated.ok, true);
  if (!generated.ok) return;
  assert.equal(isReminderOccurrenceDue(generated.occurrences[0], Date.UTC(2026, 10, 21, 6, 59)), false);
  assert.equal(isReminderOccurrenceDue(generated.occurrences[0], Date.UTC(2026, 10, 21, 7, 0)), true);
});
