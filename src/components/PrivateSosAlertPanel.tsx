import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, HandHeart, RefreshCw, ShieldCheck, UserRoundCheck, UserRoundX } from "lucide-react";

type Props = {
  alertId: string;
  participantRole: "author" | "recipient";
  status: string;
  onUpdated: () => void;
};

type AlertDetail = {
  alertId: string;
  status: string;
  createdAt: string;
  closedAt: string | null;
  closureReason: string | null;
  category: string;
  level: string;
};

type SosEvent = {
  id: string;
  actor: "self" | "participant";
  type: "triggered" | "acknowledged" | "volunteered" | "withdrew" | "closed_by_author";
  occurredAt: string;
  serverSequence: number | null;
};

const eventLabels: Record<SosEvent["type"], string> = {
  triggered: "Alerte déclenchée",
  acknowledged: "Alerte vue par un proche",
  volunteered: "Un proche s’est porté volontaire",
  withdrew: "Un proche s’est retiré",
  closed_by_author: "Alerte clôturée par son auteur",
};

export default function PrivateSosAlertPanel({ alertId, participantRole, status, onUpdated }: Props) {
  const [detail, setDetail] = useState<AlertDetail | null>(null);
  const [events, setEvents] = useState<SosEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [detailResponse, eventsResponse] = await Promise.all([
        fetch(`/api/alerts/${encodeURIComponent(alertId)}`, { credentials: "same-origin", cache: "no-store" }),
        fetch(`/api/alerts/${encodeURIComponent(alertId)}/events`, { credentials: "same-origin", cache: "no-store" }),
      ]);
      const detailPayload = await detailResponse.json() as { alert?: AlertDetail; error?: string };
      const eventsPayload = await eventsResponse.json() as { events?: SosEvent[]; error?: string };
      if (!detailResponse.ok || !detailPayload.alert) throw new Error("Les détails de cette alerte ne sont pas accessibles.");
      if (!eventsResponse.ok || !Array.isArray(eventsPayload.events)) throw new Error("La chronologie de cette alerte est momentanément indisponible.");
      setDetail(detailPayload.alert);
      setEvents(eventsPayload.events);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de charger cette alerte.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [alertId]);

  async function respond(action: "acknowledge" | "volunteer" | "withdraw") {
    if (busy) return;
    const prompt = action === "acknowledge"
      ? "Confirmer que vous avez bien pris connaissance de cette alerte ?"
      : action === "volunteer"
        ? "Confirmer que vous vous portez volontaire pour prendre en charge cette alerte ?"
        : "Confirmer votre retrait de la prise en charge ?";
    if (!window.confirm(prompt)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/alerts/${encodeURIComponent(alertId)}/respond`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json() as { recorded?: boolean; responsibilityAssigned?: boolean; error?: string };
      if (!response.ok || !payload.recorded) {
        const messages: Record<string, string> = {
          invalid_input: "Cette action n’est plus possible pour cette alerte.",
          alert_not_found_or_closed: "Cette alerte est clôturée ou n’est plus accessible.",
        };
        throw new Error(messages[payload.error ?? ""] ?? "Votre réponse n’a pas pu être enregistrée.");
      }
      setNotice(action === "acknowledge"
        ? "Votre accusé de réception est enregistré."
        : action === "volunteer"
          ? payload.responsibilityAssigned
            ? "Vous êtes le responsable principal de cette alerte."
            : "Votre volontariat est enregistré. Un autre proche est actuellement responsable."
          : payload.responsibilityAssigned
            ? "Votre retrait est enregistré. La responsabilité a été transférée à un autre volontaire."
            : "Votre retrait est enregistré. Aucun autre volontaire n’a encore pris la responsabilité.");
      await load();
      onUpdated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Service momentanément indisponible.");
    } finally { setBusy(false); }
  }

  async function close(reason: "completed" | "cancelled") {
    if (busy) return;
    const prompt = reason === "completed"
      ? "Confirmer que la situation est terminée et clôturer cette alerte ?"
      : "Confirmer l’annulation et clôturer cette alerte ?";
    if (!window.confirm(prompt)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/alerts/${encodeURIComponent(alertId)}/close`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const payload = await response.json() as { closed?: boolean; error?: string };
      if (!response.ok || !payload.closed) {
        const messages: Record<string, string> = {
          alert_not_found_or_closed: "Cette alerte est déjà clôturée ou n’est plus accessible.",
          invalid_input: "La clôture n’a pas pu être validée.",
        };
        throw new Error(messages[payload.error ?? ""] ?? "La clôture de l’alerte a échoué.");
      }
      setNotice(reason === "completed" ? "Alerte clôturée comme terminée." : "Alerte clôturée comme annulée.");
      await load();
      onUpdated();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "Service momentanément indisponible.");
    } finally { setBusy(false); }
  }

  const volunteered = events.some((event) => event.actor === "self" && event.type === "volunteered");
  const withdrew = events.some((event) => event.actor === "self" && event.type === "withdrew");
  const acknowledged = events.some((event) => event.actor === "self" && event.type === "acknowledged");
  const active = detail?.status === "active" && status === "active";

  return (
    <section className="mt-3 rounded-2xl border border-sac-primary-strong/15 bg-white/70 p-4" aria-label="Détail et actions de l’alerte">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-extrabold">Suivi de l’alerte</h3>
        <button type="button" onClick={() => void load()} disabled={loading || busy} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-white bg-white px-3 text-xs font-bold disabled:opacity-50"><RefreshCw size={13}/>Actualiser</button>
      </div>
      {loading ? <p className="py-5 text-sm text-sac-muted">Chargement du suivi…</p> : detail && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-white/80 p-3"><p className="text-sac-muted">Niveau</p><p className="mt-1 font-extrabold">{detail.level === "critical" ? "Critique" : detail.level === "urgent" ? "Urgent" : "Préventif"}</p></div>
            <div className="rounded-xl bg-white/80 p-3"><p className="text-sac-muted">Créée le</p><p className="mt-1 font-extrabold">{new Date(detail.createdAt).toLocaleString()}</p></div>
          </div>
          {detail.closedAt && <p className="mt-3 rounded-xl bg-sac-confirm/10 p-3 text-sm text-sac-ink">Clôturée le {new Date(detail.closedAt).toLocaleString()} · {detail.closureReason === "completed" ? "Situation terminée" : "Annulée"}</p>}
          <div className="mt-4">
            <h4 className="flex items-center gap-2 text-sm font-extrabold"><Clock3 size={15}/>Chronologie</h4>
            {events.length === 0 ? <p className="mt-2 text-xs text-sac-muted">Aucun événement disponible.</p> : <ol className="mt-2 space-y-2">{events.map((event) => <li key={event.id} className="flex items-start gap-2 rounded-lg bg-white/75 p-2.5 text-xs"><span className="mt-0.5 text-sac-confirm"><CheckCircle2 size={14}/></span><span className="min-w-0 flex-1"><strong>{eventLabels[event.type]}</strong><span className="block text-sac-muted">{event.actor === "self" ? "Vous" : "Un participant"} · {new Date(event.occurredAt).toLocaleString()}</span></span></li>)}</ol>}
          </div>
          {active && participantRole === "recipient" && (
            <div className="mt-4 space-y-2 border-t border-sac-primary-strong/10 pt-4">
              <p className="text-xs leading-5 text-sac-muted">Votre réponse est privée et ne clôture pas l’alerte. Seul son auteur peut la clôturer.</p>
              {!acknowledged && <button type="button" disabled={busy} onClick={() => void respond("acknowledge")} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-sac-primary-strong/20 bg-white px-3 text-sm font-bold disabled:opacity-50"><ShieldCheck size={16}/>J’ai pris connaissance</button>}
              {!volunteered && !withdrew && <button type="button" disabled={busy} onClick={() => void respond("volunteer")} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sac-primary-strong px-3 text-sm font-extrabold text-white disabled:opacity-50"><HandHeart size={17}/>Je me porte volontaire</button>}
              {volunteered && !withdrew && <button type="button" disabled={busy} onClick={() => void respond("withdraw")} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-sac-alert/20 bg-sac-alert/5 px-3 text-sm font-bold text-sac-alert disabled:opacity-50"><UserRoundX size={16}/>Me retirer de la prise en charge</button>}
              {volunteered && !withdrew && <p className="text-xs text-sac-muted">Votre volontariat est enregistré. L’attribution de la responsabilité principale suit l’ordre confirmé par le serveur.</p>}
              {withdrew && <p className="text-xs text-sac-muted">Votre retrait est enregistré. Vous ne pouvez pas reprendre cette même candidature.</p>}
            </div>
          )}
          {active && participantRole === "author" && (
            <div className="mt-4 space-y-2 border-t border-sac-primary-strong/10 pt-4">
              <p className="text-xs leading-5 text-sac-muted">Clôturez uniquement lorsque la situation est terminée ou si l’alerte a été déclenchée par erreur.</p>
              <button type="button" disabled={busy} onClick={() => void close("completed")} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sac-confirm px-3 text-sm font-extrabold text-white disabled:opacity-50"><CheckCircle2 size={16}/>Situation terminée</button>
              <button type="button" disabled={busy} onClick={() => void close("cancelled")} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-sac-alert/20 bg-sac-alert/5 px-3 text-sm font-bold text-sac-alert disabled:opacity-50"><UserRoundCheck size={16}/>Annuler cette alerte</button>
            </div>
          )}
        </>
      )}
      {notice && <p role="status" className="mt-3 rounded-xl bg-sac-confirm/10 p-3 text-sm">{notice}</p>}
      {error && <p role="alert" className="mt-3 rounded-xl bg-sac-alert/5 p-3 text-sm text-sac-alert">{error}</p>}
    </section>
  );
}
