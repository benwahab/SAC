import { useCallback, useEffect, useState } from "react";
import { BellRing, CalendarClock, Check, Plus, Trash2 } from "lucide-react";
import { localeFor, type PrivateCopy } from "../../i18n/translations";
import type { ScreenProps } from "../types";
import { formatDate } from "../types";
import { Card, Halo, Notice, Sheet, fieldClass, ghostBtn, primaryBtn } from "../ui";

type ReminderKind = "medication" | "appointment" | "activity" | "visit" | "event" | "other";
type RecurrenceType = "once" | "daily" | "weekly" | "monthly";

type Reminder = {
  id: string;
  kind: ReminderKind;
  title: string;
  description: string | null;
  status: string;
  recurrence: { type: RecurrenceType };
  medication: { name: string; dosage: string; instructions: string | null } | null;
  createdAt: number;
  updatedAt: number;
  scheduledCount: number;
  nextScheduledAt: number | null;
};

type Occurrence = {
  occurrenceId: string;
  reminderId: string;
  scheduledAt: number;
  localDate: string;
  localTime: string;
  timeZone: string;
  status: string;
};

type Notification = {
  id: string;
  kind: string;
  sourceId: string;
  scheduledAt: number;
  status: string;
  readAt: number | null;
};

const KINDS: ReminderKind[] = ["appointment", "medication", "activity", "visit", "event", "other"];

function kindLabel(copy: PrivateCopy, kind: ReminderKind): string {
  const keys: Record<ReminderKind, keyof PrivateCopy> = {
    medication: "reminderKindMedication",
    appointment: "reminderKindAppointment",
    activity: "reminderKindActivity",
    visit: "reminderKindVisit",
    event: "reminderKindEvent",
    other: "reminderKindOther",
  };
  return copy[keys[kind]];
}

function statusLabel(copy: PrivateCopy, status: string): string {
  if (status === "paused") return copy.reminderStatusPaused;
  if (status === "cancelled") return copy.reminderStatusCancelled;
  if (status === "completed") return copy.reminderStatusCompleted;
  return copy.reminderStatusActive;
}

function occurrenceStatusLabel(copy: PrivateCopy, status: string): string {
  if (status === "notified") return copy.occurrenceNotified;
  if (status === "completed") return copy.occurrenceCompleted;
  if (status === "cancelled") return copy.occurrenceCancelled;
  return copy.occurrenceScheduled;
}

function localDate(offsetDays = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function defaultTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Niamey"; } catch { return "Africa/Niamey"; }
}

export default function Reminders({ copy, language, go }: ScreenProps) {
  const locale = localeFor(language);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Occurrence[]>>({});

  const [kind, setKind] = useState<ReminderKind>("appointment");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [medicationName, setMedicationName] = useState("");
  const [medicationDosage, setMedicationDosage] = useState("");
  const [medicationInstructions, setMedicationInstructions] = useState("");
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("once");
  const [date, setDate] = useState(localDate());
  const [startDate, setStartDate] = useState(localDate());
  const [endDate, setEndDate] = useState(localDate(30));
  const [time, setTime] = useState("08:00");
  const [timeZone, setTimeZone] = useState(defaultTimeZone);
  const [weekdays, setWeekdays] = useState<number[]>([1]);
  const [dayOfMonth, setDayOfMonth] = useState(1);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reminderResponse, notificationResponse] = await Promise.all([
        fetch("/api/reminders", { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/notifications", { credentials: "same-origin", cache: "no-store" }),
      ]);
      const reminderPayload = await reminderResponse.json() as { reminders?: Reminder[] };
      if (!reminderResponse.ok || !Array.isArray(reminderPayload.reminders)) throw new Error(copy.remindersError);
      setReminders(reminderPayload.reminders);
      const notificationPayload = await notificationResponse.json() as { notifications?: Notification[] };
      setNotifications(notificationResponse.ok && Array.isArray(notificationPayload.notifications) ? notificationPayload.notifications : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.remindersError);
    } finally {
      setLoading(false);
    }
  }, [copy.remindersError]);

  useEffect(() => { void refresh(); }, [refresh]);

  function toggleWeekday(day: number) {
    setWeekdays((current) => current.includes(day)
      ? (current.length === 1 ? current : current.filter((item) => item !== day))
      : [...current, day].sort((a, b) => a - b));
  }

  async function createReminder() {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const recurrence = recurrenceType === "once"
        ? { type: "once", localDate: date, localTime: time, timeZone }
        : recurrenceType === "weekly"
          ? { type: "weekly", startDate, endDate, localTime: time, timeZone, weekdays }
          : recurrenceType === "monthly"
            ? { type: "monthly", startDate, endDate, localTime: time, timeZone, dayOfMonth }
            : { type: "daily", startDate, endDate, localTime: time, timeZone };
      const response = await fetch("/api/reminders", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          title,
          description: description.trim() || null,
          recurrence,
          medication: kind === "medication"
            ? { name: medicationName, dosage: medicationDosage, instructions: medicationInstructions.trim() || null }
            : null,
        }),
      });
      const payload = await response.json() as { error?: string };
      if (response.status === 409) throw new Error(payload.error === "quota_exceeded" ? copy.reminderQuotaError : copy.reminderActionError);
      if (!response.ok) throw new Error(response.status === 400 ? copy.reminderValidationError : copy.reminderActionError);
      setNotice(copy.reminderCreated);
      setTitle("");
      setDescription("");
      setMedicationName("");
      setMedicationDosage("");
      setMedicationInstructions("");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.reminderActionError);
    } finally {
      setBusy(false);
    }
  }

  async function cancelReminder(reminder: Reminder) {
    if (!window.confirm(copy.reminderCancelConfirm)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/reminders/${encodeURIComponent(reminder.id)}`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!response.ok) throw new Error(copy.reminderActionError);
      setNotice(copy.reminderCancelled);
      setExpanded(null);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.reminderActionError);
    } finally {
      setBusy(false);
    }
  }

  async function loadDetails(reminderId: string) {
    if (expanded === reminderId) { setExpanded(null); return; }
    setExpanded(reminderId);
    try {
      const response = await fetch(`/api/reminders/${encodeURIComponent(reminderId)}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = await response.json() as { reminder?: { occurrences?: Occurrence[] } };
      if (!response.ok || !Array.isArray(payload.reminder?.occurrences)) throw new Error(copy.remindersError);
      setDetails((current) => ({ ...current, [reminderId]: payload.reminder?.occurrences ?? [] }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.remindersError);
    }
  }

  async function closeOccurrence(occurrence: Occurrence, status: "completed" | "cancelled") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/reminders/occurrences/${encodeURIComponent(occurrence.occurrenceId)}/close`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(copy.reminderOccurrenceError);
      await loadDetails(occurrence.reminderId);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.reminderOccurrenceError);
    } finally {
      setBusy(false);
    }
  }

  async function markRead(notificationId: string) {
    try {
      await fetch(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, readAt: Date.now() } : item));
    } catch {
      setError(copy.notificationsError);
    }
  }

  const weekdayLabels = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(Date.UTC(2024, 0, 7 + index))));
  const unread = notifications.filter((item) => item.readAt === null);

  return (
    <>
      <Halo title={copy.remindersTitle} eyebrow={copy.privateSpace} onBack={() => go({ name: "home" })} backLabel={copy.back}>
        <p className="mt-2 max-w-sm text-sm font-medium text-white/90">{copy.remindersIntro}</p>
      </Halo>
      <Sheet>
        {error && <Notice kind="error">{error}</Notice>}
        {notice && <Notice kind="ok">{notice}</Notice>}

        <Card>
          <h2 className="flex items-center gap-2 font-extrabold"><BellRing size={18} />{copy.notificationsTitle}</h2>
          {unread.length === 0 ? <p className="mt-2 text-sm text-sac-muted">{copy.notificationsEmpty}</p> : (
            <ul className="mt-2 divide-y divide-[#F0EAE5]">
              {unread.slice(0, 5).map((notification) => (
                <li key={notification.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{notification.kind === "reminder_due" ? copy.notificationReminderDue : copy.notificationsTitle}</span>
                    <span className="block text-xs text-sac-muted tnum">{formatDate(notification.scheduledAt, language, locale)}</span>
                  </span>
                  <button type="button" onClick={() => void markRead(notification.id)} className="min-h-10 shrink-0 text-xs font-bold text-sac-ember">{copy.notificationsMarkRead}</button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 font-extrabold"><Plus size={18} />{copy.reminderNew}</h2>
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1 text-sm font-bold">{copy.reminderKind}
              <select className={fieldClass} value={kind} onChange={(event) => setKind(event.target.value as ReminderKind)}>
                {KINDS.map((item) => <option key={item} value={item}>{kindLabel(copy, item)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold">{copy.reminderTitleLabel}
              <input className={fieldClass} value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-bold">{copy.reminderDescriptionLabel}
              <textarea className={fieldClass + " min-h-24 py-3"} value={description} maxLength={2000} onChange={(event) => setDescription(event.target.value)} />
            </label>
            {kind === "medication" && (
              <>
                <label className="grid gap-1 text-sm font-bold">{copy.reminderMedicationName}
                  <input className={fieldClass} value={medicationName} maxLength={200} onChange={(event) => setMedicationName(event.target.value)} />
                </label>
                <label className="grid gap-1 text-sm font-bold">{copy.reminderMedicationDosage}
                  <input className={fieldClass} value={medicationDosage} maxLength={200} onChange={(event) => setMedicationDosage(event.target.value)} />
                </label>
                <label className="grid gap-1 text-sm font-bold">{copy.reminderMedicationInstructions}
                  <input className={fieldClass} value={medicationInstructions} maxLength={1000} onChange={(event) => setMedicationInstructions(event.target.value)} />
                </label>
              </>
            )}
            <label className="grid gap-1 text-sm font-bold">{copy.reminderRecurrence}
              <select className={fieldClass} value={recurrenceType} onChange={(event) => setRecurrenceType(event.target.value as RecurrenceType)}>
                <option value="once">{copy.reminderOnce}</option>
                <option value="daily">{copy.reminderDaily}</option>
                <option value="weekly">{copy.reminderWeekly}</option>
                <option value="monthly">{copy.reminderMonthly}</option>
              </select>
            </label>
            {recurrenceType === "once" ? (
              <label className="grid gap-1 text-sm font-bold">{copy.reminderDate}
                <input type="date" className={fieldClass} value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-sm font-bold">{copy.reminderStartDate}
                  <input type="date" className={fieldClass} value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </label>
                <label className="grid gap-1 text-sm font-bold">{copy.reminderEndDate}
                  <input type="date" className={fieldClass} value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </label>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-sm font-bold">{copy.reminderTime}
                <input type="time" className={fieldClass} value={time} onChange={(event) => setTime(event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm font-bold">{copy.reminderTimeZone}
                <input className={fieldClass} value={timeZone} maxLength={64} onChange={(event) => setTimeZone(event.target.value)} />
              </label>
            </div>
            {recurrenceType === "weekly" && (
              <fieldset className="grid gap-1 text-sm font-bold"><legend>{copy.reminderWeekdays}</legend>
                <div className="mt-1 grid grid-cols-7 gap-1">
                  {weekdayLabels.map((label, index) => (
                    <button key={label} type="button" aria-pressed={weekdays.includes(index)} onClick={() => toggleWeekday(index)}
                      className={"min-h-10 rounded-xl border text-xs font-bold " + (weekdays.includes(index) ? "border-sac-primary bg-sac-primary text-white" : "border-[#E8DCD3] bg-white")}>{label}</button>
                  ))}
                </div>
              </fieldset>
            )}
            {recurrenceType === "monthly" && (
              <label className="grid gap-1 text-sm font-bold">{copy.reminderDayOfMonth}
                <input type="number" min={1} max={31} className={fieldClass} value={dayOfMonth} onChange={(event) => setDayOfMonth(Number(event.target.value))} />
              </label>
            )}
            <button type="button" disabled={busy || !title.trim()} onClick={() => void createReminder()} className={primaryBtn}>
              {busy ? copy.reminderCreating : copy.reminderCreate}
            </button>
          </div>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 font-extrabold"><CalendarClock size={18} />{copy.remindersTitle}</h2>
          {loading ? <p className="mt-3 text-sm text-sac-muted">{copy.remindersLoading}</p> : reminders.length === 0 ? (
            <p className="mt-3 text-sm text-sac-muted">{copy.remindersEmpty}</p>
          ) : (
            <ul className="mt-2 divide-y divide-[#F0EAE5]">
              {reminders.map((reminder) => (
                <li key={reminder.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-extrabold">{reminder.title}</p>
                      <p className="text-xs text-sac-muted">{kindLabel(copy, reminder.kind)} · {statusLabel(copy, reminder.status)}</p>
                      <p className="mt-1 text-xs text-sac-muted tnum">
                        {reminder.nextScheduledAt ? `${copy.reminderNext}: ${formatDate(reminder.nextScheduledAt, language, locale)}` : copy.reminderNoNext}
                      </p>
                    </div>
                    <button type="button" onClick={() => void loadDetails(reminder.id)} className="min-h-10 shrink-0 text-xs font-bold text-sac-ember">
                      {expanded === reminder.id ? copy.reminderHideDetails : copy.reminderDetails}
                    </button>
                  </div>
                  {expanded === reminder.id && (
                    <div className="mt-3 rounded-2xl bg-sac-sand/60 p-3">
                      {(details[reminder.id] ?? []).length === 0 ? <p className="text-xs text-sac-muted">{copy.reminderNoOccurrences}</p> : (
                        <ul className="space-y-2">
                          {(details[reminder.id] ?? []).map((occurrence) => (
                            <li key={occurrence.occurrenceId} className="flex items-center justify-between gap-2 text-xs">
                              <span className="tnum">{formatDate(occurrence.scheduledAt, language, locale)}</span>
                              {occurrence.status === "scheduled" || occurrence.status === "notified" ? (
                                <span className="flex gap-1">
                                  <button type="button" disabled={busy} aria-label={copy.reminderComplete} onClick={() => void closeOccurrence(occurrence, "completed")} className="grid size-9 place-items-center rounded-full bg-sac-confirm/10 text-sac-confirm"><Check size={16} /></button>
                                  <button type="button" disabled={busy} aria-label={copy.reminderDismissOccurrence} onClick={() => void closeOccurrence(occurrence, "cancelled")} className="grid size-9 place-items-center rounded-full bg-sac-alert/10 text-sac-alert"><Trash2 size={16} /></button>
                                </span>
                              ) : <span className="text-sac-muted">{occurrenceStatusLabel(copy, occurrence.status)}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                      {reminder.status !== "cancelled" && reminder.status !== "completed" && (
                        <button type="button" disabled={busy} onClick={() => void cancelReminder(reminder)} className={ghostBtn + " mt-3 w-full"}>
                          <Trash2 size={15} />{copy.reminderCancel}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <p className="px-1 text-xs leading-5 text-sac-muted">{copy.remindersIntro}</p>
      </Sheet>
    </>
  );
}
