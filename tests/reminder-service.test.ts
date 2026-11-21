import assert from "node:assert/strict";
import test from "node:test";
import { parseReminderDraft } from "../functions/lib/reminders/service.ts";
import { REMINDER_PLAN_LIMITS } from "../functions/lib/reminders/entitlements.ts";

const once = {
  kind: "appointment",
  title: "Consultation",
  description: null,
  recurrence: { type: "once", localDate: "2026-11-21", localTime: "08:00", timeZone: "Africa/Niamey" },
  medication: null,
};

test("accepte un rappel unique valide", () => {
  const parsed = parseReminderDraft(once);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.title, "Consultation");
  assert.equal(parsed.value.recurrence.type, "once");
});

test("accepte un rappel médicamenteux complet", () => {
  const parsed = parseReminderDraft({
    ...once,
    kind: "medication",
    medication: { name: "Médicament A", dosage: "1 comprimé", instructions: "Après le repas" },
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.medication?.name, "Médicament A");
});

test("refuse un médicament sans nom ou dosage", () => {
  assert.deepEqual(parseReminderDraft({
    ...once,
    kind: "medication",
    medication: { name: "", dosage: "1 comprimé", instructions: null },
  }), { ok: false, error: "invalid_request" });
});

test("refuse des champs médicaux sur un rappel non médicamenteux", () => {
  assert.deepEqual(parseReminderDraft({
    ...once,
    medication: { name: "Médicament A", dosage: "1 comprimé", instructions: null },
  }), { ok: false, error: "invalid_request" });
});

test("refuse un fuseau horaire inconnu", () => {
  assert.deepEqual(parseReminderDraft({
    ...once,
    recurrence: { type: "once", localDate: "2026-11-21", localTime: "08:00", timeZone: "Mars/Olympus" },
  }), { ok: false, error: "invalid_request" });
});

test("refuse une date ou une heure invalide", () => {
  assert.deepEqual(parseReminderDraft({
    ...once,
    recurrence: { type: "once", localDate: "2026-02-30", localTime: "08:00", timeZone: "Africa/Niamey" },
  }), { ok: false, error: "invalid_request" });
  assert.deepEqual(parseReminderDraft({
    ...once,
    recurrence: { type: "once", localDate: "2026-11-21", localTime: "24:00", timeZone: "Africa/Niamey" },
  }), { ok: false, error: "invalid_request" });
});

test("refuse des jours de semaine dupliqués ou hors plage", () => {
  const base = {
    ...once,
    recurrence: {
      type: "weekly",
      startDate: "2026-11-21",
      endDate: "2026-11-30",
      localTime: "08:00",
      timeZone: "Africa/Niamey",
      weekdays: [1, 1],
    },
  };
  assert.deepEqual(parseReminderDraft(base), { ok: false, error: "invalid_request" });
  assert.deepEqual(parseReminderDraft({
    ...base,
    recurrence: { ...base.recurrence, weekdays: [7] },
  }), { ok: false, error: "invalid_request" });
});

test("refuse une fin antérieure au début", () => {
  assert.deepEqual(parseReminderDraft({
    ...once,
    recurrence: { type: "daily", startDate: "2026-11-30", endDate: "2026-11-21", localTime: "08:00", timeZone: "Africa/Niamey" },
  }), { ok: false, error: "invalid_request" });
});

test("les limites d'offre restent explicites et bornées", () => {
  assert.equal(REMINDER_PLAN_LIMITS.free.activeReminders, 20);
  assert.equal(REMINDER_PLAN_LIMITS.premium.activeReminders, 200);
  assert.equal(REMINDER_PLAN_LIMITS.professional.activeReminders, 500);
  assert.ok(REMINDER_PLAN_LIMITS.free.maxOccurrencesPerReminder <= 366);
});
