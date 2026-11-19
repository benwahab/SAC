import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, LogOut, MailPlus, RefreshCw, ShieldCheck, UserRoundMinus, UsersRound } from "lucide-react";
import { getDeviceSession, logoutDeviceSession } from "./services/device/root-enrollment";

type Contact = { accountId: string; email: string; createdAt: number };
type Props = { onLogout: () => void };

export default function PrivateSpacePage({ onLogout }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = await getDeviceSession();
      if (!session.authenticated) {
        onLogout();
        return;
      }
      const response = await fetch("/api/contacts", { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json() as { contacts?: Contact[]; error?: string };
      if (!response.ok || !Array.isArray(payload.contacts)) {
        if (response.status === 401) onLogout();
        throw new Error("Impossible de charger les proches pour le moment.");
      }
      setContacts(payload.contacts);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Service momentanément indisponible.");
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => { void loadContacts(); }, [loadContacts]);

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
          {message && <p role="status" className="mt-4 rounded-xl border border-sac-confirm/20 bg-sac-confirm/10 p-3 text-sm leading-6">{message}</p>}
          {error && <p role="alert" className="mt-4 rounded-xl border border-sac-alert/25 bg-sac-alert/5 p-3 text-sm leading-6 text-sac-alert">{error}</p>}
        </section>
      </div>
    </main>
  );
}
