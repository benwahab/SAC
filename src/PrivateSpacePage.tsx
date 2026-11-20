import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, LogOut, MailPlus, RefreshCw, ShieldCheck, UserRoundMinus, UsersRound } from "lucide-react";
import { getDeviceSession, logoutDeviceSession } from "./services/device/root-enrollment";
import PrivateSosAlertPanel from "./components/PrivateSosAlertPanel";
import PushNotificationSettings from "./components/PushNotificationSettings";

type Contact = { accountId: string; email: string; createdAt: number };
type SosAlert = { id: string; category: string; level: string; description: string | null; status: string; createdAt: number; closedAt: number | null; closureReason: string | null; participantRole: "author" | "recipient" };
type Props = { onLogout: () => void };

export default function PrivateSpacePage({ onLogout }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sessionIdentity, setSessionIdentity] = useState<{ accountId: string; deviceId: string } | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [alerts, setAlerts] = useState<SosAlert[]>([]);
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [category, setCategory] = useState("personal_danger");
  const [level, setLevel] = useState("urgent");
  const [reminderCount, setReminderCount] = useState(2);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = await getDeviceSession();
      if (!session.authenticated || !session.accountId || !session.deviceId) {
        onLogout();
        return;
      }
      setSessionIdentity({ accountId: session.accountId, deviceId: session.deviceId });
      const response = await fetch("/api/contacts", { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json() as { contacts?: Contact[]; error?: string };
      if (!response.ok || !Array.isArray(payload.contacts)) {
        if (response.status === 401) onLogout();
        throw new Error("Impossible de charger les proches pour le moment.");
      }
      setContacts(payload.contacts);
      setSelectedRecipients((current) => current.filter((id) => payload.contacts!.some((contact) => contact.accountId === id)));
      const alertsResponse = await fetch("/api/alerts", { credentials: "same-origin", cache: "no-store" });
      const alertsPayload = await alertsResponse.json() as { alerts?: SosAlert[] };
      if (alertsResponse.ok && Array.isArray(alertsPayload.alerts)) setAlerts(alertsPayload.alerts);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Service momentanément indisponible.");
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => { void loadContacts(); }, [loadContacts]);

  async function triggerSos(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || selectedRecipients.length === 0) return;
    if (!window.confirm("Confirmer le déclenchement de cette alerte privée auprès des proches sélectionnés ?")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/alerts", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientAccountIds: selectedRecipients, category, level,
          customDescription: category === "custom_alert" ? description.trim() : null,
          pushReminderCount: reminderCount }), cache: "no-store",
      });
      const payload = await response.json() as { created?: boolean; error?: string };
      if (!response.ok || !payload.created) {
        const messages: Record<string,string> = {
          recipient_not_trusted: "Un proche sélectionné ne fait plus partie de votre cercle.",
          recipient_limit_exceeded: "La limite de proches autorisée est dépassée.",
          account_not_eligible: "Votre compte ne peut pas déclencher une alerte.",
          invalid_input: "Vérifiez les informations de l’alerte et les destinataires.",
        };
        throw new Error(messages[payload.error ?? ""] ?? "L’alerte n’a pas pu être créée.");
      }
      setMessage("Alerte enregistrée. Cela ne confirme pas encore l’envoi ni la réception des notifications.");
      setDescription("");
      const refreshed = await fetch("/api/alerts", { credentials: "same-origin", cache: "no-store" });
      const refreshedPayload = await refreshed.json() as { alerts?: SosAlert[] };
      if (refreshed.ok && Array.isArray(refreshedPayload.alerts)) setAlerts(refreshedPayload.alerts);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Service momentanément indisponible.");
    } finally { setBusy(false); }
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/contacts/invitations", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationEmail: email.trim() }), cache: "no-store",
      });
      const payload = await response.json() as { invitationSent?: boolean; error?: string };
      if (!response.ok || !payload.invitationSent) {
        const messages: Record<string, string> = {
          invitation_service_not_configured: "L’envoi des invitations n’est pas encore configuré.",
          account_not_eligible: "Ce compte ne peut pas envoyer cette invitation.",
          relationship_already_active: "Cette personne figure déjà parmi vos proches.",
          self_invitation: "Vous ne pouvez pas vous inviter vous-même.",
          invalid_email: "Adresse e-mail invalide.",
        };
        throw new Error(messages[payload.error ?? ""] ?? "L’invitation n’a pas pu être envoyée.");
      }
      setEmail("");
      setMessage("Invitation envoyée. La personne devra l’accepter et vérifier son adresse SAC.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Service momentanément indisponible.");
    } finally { setBusy(false); }
  }

  async function revoke(contactAccountId: string) {
    if (busy || !window.confirm("Retirer cette personne de vos proches ?")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/contacts/revoke", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactAccountId }), cache: "no-store",
      });
      const payload = await response.json() as { revoked?: boolean };
      if (!response.ok || !payload.revoked) throw new Error("Impossible de retirer ce proche.");
      setContacts((current) => current.filter((contact) => contact.accountId !== contactAccountId));
      setMessage("Ce lien de confiance est révoqué. Les alertes déjà en cours ne sont pas clôturées.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Service momentanément indisponible.");
    } finally { setBusy(false); }
  }

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await logoutDeviceSession();
      if (!ok) throw new Error("La déconnexion n’a pas pu être confirmée.");
      onLogout();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Déconnexion indisponible.");
    } finally { setBusy(false); }
  }

  return (
    <main className="sac-shell min-h-screen px-4 py-6 text-sac-ink sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-7 flex items-center justify-between gap-3">
          <a href="/" className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-sac-muted"><ArrowLeft size={17}/>Accueil</a>
          <button type="button" onClick={() => void signOut()} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/90 bg-white/70 px-4 text-sm font-bold shadow-glass disabled:opacity-50"><LogOut size={16}/>Déconnexion</button>
        </header>
        <section className="sac-glass-panel rounded-[2rem] p-5 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-sac-confirm/15 p-3 text-sac-confirm"><ShieldCheck size={25}/></div>
            <div><p className="text-xs font-bold uppercase tracking-widest text-sac-muted">SAC · espace privé</p><h1 className="text-2xl font-black">Mes proches</h1></div>
          </div>
          <p className="mt-4 text-sm leading-6 text-sac-muted">Seules les personnes qui acceptent votre invitation et disposent d’un compte SAC vérifié peuvent rejoindre votre cercle de confiance.</p>
          <form onSubmit={invite} className="mt-7 rounded-2xl border border-white/90 bg-white/55 p-4">
            <label htmlFor="trusted-contact-email" className="mb-2 block text-sm font-bold">Inviter un proche par e-mail</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input id="trusted-contact-email" type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="adresse@exemple.com" className="min-h-12 min-w-0 flex-1 rounded-xl border border-white bg-white/85 px-4 text-base outline-none focus:ring-2 focus:ring-sac-confirm/30"/>
              <button type="submit" disabled={busy || !email.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sac-primary-strong px-5 font-extrabold text-white disabled:opacity-50"><MailPlus size={17}/>{busy ? "Envoi…" : "Envoyer l’invitation"}</button>
            </div>
            <p className="mt-2 text-xs leading-5 text-sac-muted">L’invitation ne donne aucun accès avant son acceptation explicite.</p>
          </form>
          <div className="mt-8 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-extrabold"><UsersRound size={19}/>Cercle de confiance</h2>
            <button type="button" onClick={() => void loadContacts()} disabled={loading || busy} aria-label="Actualiser" className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white bg-white/70 px-3 text-xs font-bold disabled:opacity-50"><RefreshCw size={14}/>Actualiser</button>
          </div>
          {loading ? <p className="py-8 text-center text-sm text-sac-muted">Chargement des proches…</p> :
            contacts.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-sac-primary-strong/25 bg-white/35 px-4 py-8 text-center"><UsersRound className="mx-auto text-sac-muted" size={28}/><p className="mt-3 font-bold">Votre cercle est encore vide</p><p className="mt-1 text-sm text-sac-muted">Invitez une personne de confiance pour commencer.</p></div> :
            <ul className="mt-4 divide-y divide-white/80 rounded-2xl border border-white/80 bg-white/45 px-4">
              {contacts.map((contact) => <li key={contact.accountId} className="flex items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="truncate font-bold">{contact.email}</p><p className="mt-1 text-xs text-sac-muted">Proche vérifié</p></div><button type="button" disabled={busy} onClick={() => void revoke(contact.accountId)} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-sac-alert/20 bg-sac-alert/5 px-3 text-xs font-bold text-sac-alert disabled:opacity-50"><UserRoundMinus size={15}/>Retirer</button></li>)}
            </ul>}
          <PushNotificationSettings />
          <section className="mt-9 border-t border-white/80 pt-7">
            <h2 className="text-lg font-extrabold">Déclencher une alerte SOS</h2>
            <p className="mt-2 text-sm leading-6 text-sac-muted">L’alerte est privée et adressée uniquement aux proches choisis. Aucune localisation n’est obligatoire.</p>
            {contacts.length === 0 ? <p className="mt-4 rounded-xl bg-white/55 p-4 text-sm text-sac-muted">Ajoutez d’abord au moins un proche vérifié.</p> : <form onSubmit={triggerSos} className="mt-4 space-y-4 rounded-2xl border border-white/90 bg-white/55 p-4">
              <fieldset><legend className="mb-2 text-sm font-bold">Destinataires</legend>
                <div className="space-y-2">{contacts.map((contact) => <label key={contact.accountId} className="flex min-h-11 items-center gap-3 rounded-xl bg-white/65 px-3 text-sm"><input type="checkbox" checked={selectedRecipients.includes(contact.accountId)} onChange={(event) => setSelectedRecipients((current) => event.target.checked ? [...current, contact.accountId].slice(0,2) : current.filter((id) => id !== contact.accountId))}/><span className="truncate">{contact.email}</span></label>)}</div>
                <p className="mt-1 text-xs text-sac-muted">Maximum actuel : 2 proches sur l’offre gratuite.</p>
              </fieldset>
              <label className="block text-sm font-bold">Type d’urgence<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white bg-white px-3 font-normal"><option value="personal_danger">Danger personnel</option><option value="accident">Accident</option><option value="home_intrusion">Intrusion au domicile</option><option value="medical_emergency">Urgence médicale</option><option value="lost_or_disoriented_person">Personne perdue ou désorientée</option><option value="custom_alert">Autre situation</option></select></label>
              {category === "custom_alert" && <label className="block text-sm font-bold">Décrire la situation<textarea required maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-white bg-white p-3 font-normal"/></label>}
              <label className="block text-sm font-bold">Niveau<select value={level} onChange={(event) => setLevel(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white bg-white px-3 font-normal"><option value="preventive">Préventif</option><option value="urgent">Urgent</option><option value="critical">Critique</option></select></label>
              <label className="block text-sm font-bold">Nombre de rappels push avant évaluation du SMS : {reminderCount}<input type="range" min="1" max="5" value={reminderCount} onChange={(event) => setReminderCount(Number(event.target.value))} className="mt-2 w-full"/></label>
              <p className="text-xs leading-5 text-sac-muted">Un rappel est prévu toutes les 5 minutes. Ce nombre définit le seuil d’évaluation du SMS, pas la durée de l’alerte.</p>
              <button type="submit" disabled={busy || selectedRecipients.length === 0 || (category === "custom_alert" && !description.trim())} className="min-h-12 w-full rounded-xl bg-sac-alert px-4 font-extrabold text-white disabled:opacity-50">Déclencher l’alerte SOS</button>
            </form>}
          </section>
          <section className="mt-8 border-t border-white/80 pt-7">
            <h2 className="text-lg font-extrabold">Mes alertes</h2>
            {alerts.length === 0 ? <p className="mt-3 text-sm text-sac-muted">Aucune alerte enregistrée.</p> : <ul className="mt-3 space-y-3">{alerts.map((alert) => <li key={alert.id} className="rounded-xl border border-white/80 bg-white/55 p-3">
              <div className="flex items-center justify-between gap-2"><span className="text-sm font-bold">{alert.category.replaceAll("_"," ")}</span><span className={"rounded-full px-2 py-1 text-xs font-bold " + (alert.status === "active" ? "bg-sac-alert/10 text-sac-alert" : "bg-sac-confirm/10 text-sac-confirm")}>{alert.status === "active" ? "En cours" : "Clôturée"}</span></div>
              <p className="mt-1 text-xs text-sac-muted">{alert.participantRole === "author" ? "Votre alerte" : "Alerte reçue"} · {new Date(alert.createdAt).toLocaleString()}</p>
              {alert.description && <p className="mt-2 text-sm">{alert.description}</p>}
              <button type="button" onClick={() => setExpandedAlertId((current) => current === alert.id ? null : alert.id)} aria-expanded={expandedAlertId === alert.id} className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-sac-primary-strong/20 bg-white px-3 text-sm font-bold">{expandedAlertId === alert.id ? "Masquer le suivi" : "Consulter et agir"}</button>
              {expandedAlertId === alert.id && sessionIdentity && <PrivateSosAlertPanel alertId={alert.id} accountId={sessionIdentity.accountId} deviceId={sessionIdentity.deviceId} participantRole={alert.participantRole} status={alert.status} onUpdated={() => void loadContacts()}/>}
            </li>)}</ul>}
          </section>
          {message && <p role="status" className="mt-4 rounded-xl border border-sac-confirm/20 bg-sac-confirm/10 p-3 text-sm leading-6">{message}</p>}
          {error && <p role="alert" className="mt-4 rounded-xl border border-sac-alert/25 bg-sac-alert/5 p-3 text-sm leading-6 text-sac-alert">{error}</p>}
        </section>
      </div>
    </main>
  );
}
