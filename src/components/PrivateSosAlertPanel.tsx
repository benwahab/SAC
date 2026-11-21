import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, Eye, HandHeart, ShieldCheck, UserRoundCheck, UserRoundX } from "lucide-react";
import SosLiveLocation from "./SosLiveLocation";
import { fillCopy, localeFor, type Language, type PrivateCopy } from "../i18n/translations";
import { formatDate } from "../private/types";
import { Card, LevelBadge, Notice, ghostBtn, primaryBtn } from "../private/ui";

type Props = { alertId: string; accountId: string; deviceId: string; participantRole: "author" | "recipient"; status: string; copy: PrivateCopy; language: Language; onUpdated: () => void };
type AlertDetail = { alertId: string; status: string; createdAt: string; closedAt: string | null; closureReason: string | null; category: string; level: string };
type SosEvent = { id: string; actor: "self" | "participant"; type: "triggered" | "acknowledged" | "volunteered" | "withdrew" | "closed_by_author"; occurredAt: string; serverSequence: number | null };
type ResponsibilityState = { assigned: boolean; isSelf: boolean };

export default function PrivateSosAlertPanel({ alertId, accountId, deviceId, participantRole, status, copy, language, onUpdated }: Props) {
  const [detail, setDetail] = useState<AlertDetail | null>(null);
  const [events, setEvents] = useState<SosEvent[]>([]);
  const [responsibility, setResponsibility] = useState<ResponsibilityState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [gpsSharingEnabled, setGpsSharingEnabled] = useState(false);
  const locale = localeFor(language);

  const load = useCallback(async () => {
    setLoading(true); setError(""); setResponsibility(null);
    try {
      const [detailResponse, eventsResponse] = await Promise.all([
        fetch(`/api/alerts/${encodeURIComponent(alertId)}`, { credentials: "same-origin", cache: "no-store" }),
        fetch(`/api/alerts/${encodeURIComponent(alertId)}/events`, { credentials: "same-origin", cache: "no-store" }),
      ]);
      const detailPayload = await detailResponse.json() as { alert?: AlertDetail };
      const eventsPayload = await eventsResponse.json() as { events?: SosEvent[]; responsibility?: ResponsibilityState };
      if (!detailResponse.ok || !detailPayload.alert) throw new Error(copy.trackDetailError);
      if (!eventsResponse.ok || !Array.isArray(eventsPayload.events) || !eventsPayload.responsibility ||
          typeof eventsPayload.responsibility.assigned !== "boolean" || typeof eventsPayload.responsibility.isSelf !== "boolean") throw new Error(copy.trackEventsError);
      setDetail(detailPayload.alert); setEvents(eventsPayload.events); setResponsibility(eventsPayload.responsibility);
    } catch (reason) { setError(reason instanceof Error ? reason.message : copy.trackLoadError); } finally { setLoading(false); }
  }, [alertId, copy]);

  useEffect(() => { void load(); }, [load]);

  async function respond(action: "acknowledge" | "volunteer" | "withdraw") {
    if (busy) return;
    const prompt = action === "acknowledge" ? copy.confirmAck : action === "volunteer" ? copy.confirmVolunteer : copy.confirmWithdraw;
    if (!window.confirm(prompt)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/alerts/${encodeURIComponent(alertId)}/respond`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const payload = await response.json() as { recorded?: boolean; responsibilityAssigned?: boolean; error?: string };
      if (!response.ok || !payload.recorded) {
        const messages: Record<string, string> = { invalid_input: copy.respErrInvalid, alert_not_found_or_closed: copy.respErrClosed };
        throw new Error(messages[payload.error ?? ""] ?? copy.respErrGeneric);
      }
      setNotice(action === "acknowledge" ? copy.noticeAck : action === "volunteer"
        ? (payload.responsibilityAssigned ? copy.noticeVolunteerMain : copy.noticeVolunteerOther)
        : (payload.responsibilityAssigned ? copy.noticeWithdrawTransfer : copy.noticeWithdrawNone));
      await load(); onUpdated();
    } catch (reason) { setError(reason instanceof Error ? reason.message : copy.errorGeneric); } finally { setBusy(false); }
  }

  async function close(reason: "completed" | "cancelled") {
    if (busy || !window.confirm(reason === "completed" ? copy.confirmCloseDone : copy.confirmCloseCancel)) return;
    setGpsSharingEnabled(false);
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/alerts/${encodeURIComponent(alertId)}/close`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
      const payload = await response.json() as { closed?: boolean; error?: string };
      if (!response.ok || !payload.closed) {
        const messages: Record<string, string> = { alert_not_found_or_closed: copy.closeErrClosed, invalid_input: copy.closeErrInvalid };
        throw new Error(messages[payload.error ?? ""] ?? copy.closeErrGeneric);
      }
      setNotice(reason === "completed" ? copy.noticeClosedDone : copy.noticeClosedCancel);
      await load(); onUpdated();
    } catch (value) { setError(value instanceof Error ? value.message : copy.errorGeneric); } finally { setBusy(false); }
  }

  const mine = (type: SosEvent["type"]) => events.some((e) => e.actor === "self" && e.type === type);
  const volunteered = mine("volunteered"), withdrew = mine("withdrew"), acknowledged = mine("acknowledged");
  const active = detail?.status === "active" && status === "active";
  const closureLabel = detail?.closureReason === "completed" ? copy.closureCompleted : copy.closureCancelled;

  return (
    <div className="flex flex-col gap-4" aria-label={copy.alertDetailsTitle}>
      {loading ? <p className="py-6 text-center text-sm text-sac-muted">{copy.trackLoading}</p> : detail && (<>
        <Card>
          <div className="flex items-center justify-between gap-2"><LevelBadge level={detail.level} label={String(copy[("level_" + detail.level) as keyof PrivateCopy] ?? detail.level)} /><span className="text-xs font-bold text-sac-muted tnum">{formatDate(detail.createdAt, language, locale)}</span></div>
          <p className="mt-3 text-xl font-extrabold">{String(copy[("cat_" + detail.category) as keyof PrivateCopy] ?? detail.category.replaceAll("_", " "))}</p>
          {active && responsibility && <p className="mt-3 rounded-[14px] bg-sac-primary/10 p-3 text-sm font-semibold">{responsibility.isSelf ? copy.respSelf : responsibility.assigned ? copy.respOther : copy.respNone}</p>}
          {detail.closedAt && <p className="mt-3 rounded-[14px] border border-sac-confirm/30 bg-sac-confirm/10 p-3 text-sm font-semibold">{fillCopy(copy.closedOn, { d: formatDate(detail.closedAt, language, locale) })} · {closureLabel}</p>}
        </Card>

        {active && (
          <Card>
            <h2 className="font-extrabold">{copy.gpsConsentTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-sac-muted">{participantRole === "author" ? copy.gpsConsentAuthor : copy.gpsConsentRecipient}</p>
            <button type="button" onClick={() => setGpsSharingEnabled((value) => !value)} className={"mt-3 " + (gpsSharingEnabled ? ghostBtn : primaryBtn)}>
              {participantRole === "author"
                ? (gpsSharingEnabled ? copy.gpsShareStop : copy.gpsShareStart)
                : (gpsSharingEnabled ? copy.gpsReceiveStop : copy.gpsReceiveStart)}
            </button>
            <p className="mt-2 text-xs leading-5 text-sac-muted">{copy.gpsConsentHint}</p>
          </Card>
        )}

        {active && gpsSharingEnabled && <SosLiveLocation alertId={alertId} accountId={accountId} deviceId={deviceId} participantRole={participantRole} copy={copy} language={language} />}

        {active && participantRole === "recipient" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium leading-6">{copy.receiveIntro}</p>
            {acknowledged
              ? <div className="flex items-center gap-3 rounded-2xl border-[1.5px] border-sac-confirm bg-white p-4"><Eye className="shrink-0 text-sac-confirm" size={26} /><div><p className="font-bold text-sac-confirm">{copy.ackDone}</p><p className="text-sm">{copy.ackDoneText}</p></div></div>
              : <button type="button" disabled={busy} onClick={() => void respond("acknowledge")} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[18px] border-2 border-sac-confirm bg-white px-4 text-lg font-extrabold text-sac-confirm disabled:opacity-50"><ShieldCheck size={22} />{copy.ackBtn}</button>}
            {!volunteered && !withdrew && <button type="button" disabled={busy} onClick={() => void respond("volunteer")} className={primaryBtn + " min-h-16 text-lg"}><HandHeart size={22} />{copy.volunteerBtn}</button>}
            {volunteered && !withdrew && <><p className="rounded-[14px] bg-sac-sand p-3 text-sm font-medium">{copy.volunteerRecorded}</p><button type="button" disabled={busy} onClick={() => void respond("withdraw")} className={ghostBtn + " !border-sac-alert/30 !text-sac-alert"}><UserRoundX size={16} />{copy.withdrawBtn}</button></>}
            {withdrew && <p className="text-sm text-sac-muted">{copy.withdrewText}</p>}
            {!volunteered && !withdrew && <p className="text-sm leading-6 text-sac-muted">{copy.volunteerHint}</p>}
            <p className="text-xs leading-5 text-sac-muted">{copy.respPrivate}</p>
          </div>)}

        {active && participantRole === "author" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-6 text-sac-muted">{copy.authorCloseHint}</p>
            <button type="button" disabled={busy} onClick={() => void close("completed")} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[18px] bg-sac-confirm px-4 text-base font-extrabold text-white disabled:opacity-50"><CheckCircle2 size={20} />{copy.closeDone}</button>
            <button type="button" disabled={busy} onClick={() => void close("cancelled")} className={ghostBtn + " min-h-14 !border-sac-alert/30 !text-sac-alert"}><UserRoundCheck size={18} />{copy.closeCancel}</button>
          </div>)}

        <Card>
          <h2 className="flex items-center gap-2 font-extrabold"><Clock3 size={16} />{copy.trackTimeline}</h2>
          {events.length === 0 ? <p className="mt-2 text-sm text-sac-muted">{copy.trackNoEvents}</p> : (
            <ol className="mt-3 flex flex-col gap-3 border-s-2 border-sac-primary/25 ps-4">{events.map((e) => (
              <li key={e.id} className="relative"><span className="absolute -start-[1.4rem] top-1 size-3 rounded-full bg-sac-primary" aria-hidden="true" />
                <p className="text-sm font-bold">{copy[("evt_" + e.type) as keyof PrivateCopy]}</p>
                <p className="text-xs text-sac-muted tnum">{e.actor === "self" ? copy.actorSelf : copy.actorOther} · {formatDate(e.occurredAt, language, locale)}</p></li>))}</ol>)}
        </Card>
      </>)}
      {notice && <Notice kind="ok">{notice}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
    </div>
  );
}
