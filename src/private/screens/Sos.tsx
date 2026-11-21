import { useState, type FormEvent } from "react";
import type { Contact, ScreenProps } from "../types";
import { Card, Halo, Notice, Sheet, fieldClass, ghostBtn, primaryBtn } from "../ui";

const CATEGORIES = ["personal_danger", "accident", "home_intrusion", "medical_emergency", "lost_or_disoriented_person", "custom_alert"] as const;
const LEVELS = ["preventive", "urgent", "critical"] as const;

export default function Sos({ copy, go, setNotice, contacts, refresh }: ScreenProps & { contacts: Contact[]; refresh: () => Promise<void> }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [category, setCategory] = useState<string>("personal_danger");
  const [level, setLevel] = useState<string>("urgent");
  const [reminders, setReminders] = useState(2);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const ready = selected.length > 0 && (category !== "custom_alert" || description.trim().length > 0);

  async function send() {
    if (busy || !ready) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/alerts", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientAccountIds: selected, category, level, customDescription: category === "custom_alert" ? description.trim() : null, pushReminderCount: reminders }) });
      const payload = await response.json() as { created?: boolean; alertId?: string; error?: string };
      if (!response.ok || !payload.created) {
        const messages: Record<string, string> = { recipient_not_trusted: copy.sosErrNotTrusted, recipient_limit_exceeded: copy.sosErrLimit, account_not_eligible: copy.sosErrNotEligible, invalid_input: copy.sosErrInvalid };
        throw new Error(messages[payload.error ?? ""] ?? copy.sosErrGeneric);
      }
      await refresh();
      setNotice(copy.sosCreated);
      go(payload.alertId ? { name: "alert", id: payload.alertId } : { name: "history" });
    } catch (reason) { setError(reason instanceof Error ? reason.message : copy.errorGeneric); setConfirming(false); } finally { setBusy(false); }
  }
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy) return;
    if (level === "critical") void send(); else setConfirming(true);
  }

  return (
    <>
      <Halo title={copy.sosTitle} eyebrow={copy.privateSpace} tone="alert"><p className="mt-1 text-sm text-white/90">{copy.sosIntro}</p></Halo>
      <Sheet>
        {contacts.length === 0 ? (
          <Card className="text-center"><p className="font-bold">{copy.sosNeedContact}</p><button type="button" onClick={() => go({ name: "invite" })} className={"mt-3 " + primaryBtn}>{copy.sosAddContact}</button></Card>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Card><fieldset><legend className="mb-2 text-sm font-extrabold">{copy.sosRecipients}</legend>
              <div className="flex flex-col gap-2">{contacts.map((c) => (
                <label key={c.accountId} className="flex min-h-12 items-center gap-3 rounded-[14px] bg-sac-sand px-3 text-sm font-semibold"><input type="checkbox" className="size-5 accent-[#2E8B68]" checked={selected.includes(c.accountId)}
                  onChange={(e) => setSelected((cur) => e.target.checked ? [...cur, c.accountId].slice(0, 2) : cur.filter((id) => id !== c.accountId))} /><span className="truncate" dir="ltr">{c.email}</span></label>))}</div>
              <p className="mt-2 text-xs text-sac-muted">{copy.contactsLimit}</p></fieldset></Card>
            <Card><fieldset><legend className="mb-2 text-sm font-extrabold">{copy.sosType}</legend>
              <div className="flex flex-wrap gap-2">{CATEGORIES.map((c) => (
                <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={"min-h-12 rounded-full border px-4 text-sm font-bold " + (category === c ? "border-sac-primary bg-sac-primary text-white" : "border-[#E8DCD3] bg-white text-sac-ink")}>{copy[("cat_" + c) as keyof typeof copy]}</button>))}</div>
              {category === "custom_alert" && <label className="mt-3 block text-sm font-bold">{copy.sosDescribe}<textarea required maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} className={fieldClass + " mt-2 min-h-24 py-3 font-normal"} /></label>}</fieldset></Card>
            <Card><fieldset><legend className="mb-2 text-sm font-extrabold">{copy.sosLevel}</legend>
              <div className="grid grid-cols-3 gap-2">{LEVELS.map((l) => (
                <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)} className={"min-h-12 rounded-[14px] border text-sm font-extrabold " + (level === l ? (l === "critical" ? "border-sac-alert bg-sac-alert text-white" : "border-sac-primary bg-sac-primary text-white") : "border-[#E8DCD3] bg-white")}>{copy[("level_" + l) as keyof typeof copy]}</button>))}</div>
              {level === "critical" && <p className="mt-2 text-xs font-semibold text-sac-alert">{copy.sosCriticalNote}</p>}
              <label className="mt-4 block text-sm font-bold tnum">{copy.sosReminders.replace("{n}", String(reminders))}<input type="range" min="1" max="5" value={reminders} onChange={(e) => setReminders(Number(e.target.value))} className="mt-2 w-full accent-[#2E8B68]" /></label>
              <p className="mt-1 text-xs leading-5 text-sac-muted">{copy.sosRemindersNote}</p></fieldset></Card>
            {error && <Notice kind="error">{error}</Notice>}
            {confirming ? (
              <Card className="!border-2 !border-sac-alert"><p className="font-extrabold">{copy.sosConfirmTitle}</p><p className="mt-1 text-sm text-sac-muted">{copy.sosConfirmText}</p>
                <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setConfirming(false)} className={ghostBtn}>{copy.sosConfirmNo}</button>
                  <button type="button" disabled={busy} onClick={() => void send()} className="min-h-12 rounded-[14px] bg-sac-alert px-3 text-sm font-extrabold text-white disabled:opacity-50">{busy ? copy.sosButtonSending : copy.sosConfirmYes}</button></div></Card>
            ) : (
              <button type="submit" disabled={busy || !ready} aria-label={copy.sosTitle} className="mx-auto flex size-44 items-center justify-center rounded-full border-[6px] border-white bg-sac-alert text-4xl font-black tracking-wide text-white shadow-sos disabled:opacity-45 disabled:shadow-none">{busy ? <span className="text-base">{copy.sosButtonSending}</span> : copy.sosButton}</button>
            )}
          </form>
        )}
      </Sheet>
    </>
  );
}
