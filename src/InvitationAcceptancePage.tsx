import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, ShieldCheck, XCircle } from "lucide-react";
import { getDeviceSession } from "./services/device/root-enrollment";

type Invitation = { id: string; inviterEmail: string; expiresAt: number };

export default function InvitationAcceptancePage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [token, setToken] = useState("");
  const [invitationId, setInvitationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") ?? "";
    const rawToken = params.get("token") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(rawToken)) {
      setError("Le lien d’invitation est incomplet ou invalide.");
      setLoading(false);
      setAuthenticated(false);
      return;
    }
    setInvitationId(id);
    setToken(rawToken);
    window.history.replaceState(null, "", "/invitation/accept");
    void (async () => {
      try {
        const session = await getDeviceSession();
        setAuthenticated(session.authenticated);
        if (!session.authenticated) return;
        const response = await fetch(`/api/contacts/invitations?id=${encodeURIComponent(id)}&token=${encodeURIComponent(rawToken)}`, {
          credentials: "same-origin", cache: "no-store",
        });
        const payload = await response.json() as { invitation?: Invitation; error?: string };
        if (!response.ok || !payload.invitation) {
          throw new Error(payload.error === "invitation_not_found"
            ? "Cette invitation est invalide, expirée, déjà utilisée ou destinée à une autre adresse."
            : "Impossible de vérifier cette invitation pour le moment.");
        }
        setInvitation(payload.invitation);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Service momentanément indisponible.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function decide(action: "accept" | "decline") {
    if (!invitation || busy) return;
    const prompt = action === "accept"
      ? "Acceptez-vous explicitement de rejoindre le cercle de confiance de cette personne ?"
      : "Confirmez-vous votre refus de cette invitation ?";
    if (!window.confirm(prompt)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/contacts/invitations/${action}`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId: invitation.id, token }),
      });
      const payload = await response.json() as { accepted?: boolean; declined?: boolean; error?: string };
      const success = action === "accept" ? payload.accepted : payload.declined;
      if (!response.ok || !success) {
        const messages: Record<string, string> = {
          contact_limit_reached: "La personne qui vous invite a atteint sa limite de proches.",
          invalid_or_expired_invitation: "Cette invitation a expiré, a déjà été utilisée ou n’est plus valide.",
          invalid_invitation: "Le lien d’invitation est invalide.",
        };
        throw new Error(messages[payload.error ?? ""] ?? "Votre réponse n’a pas pu être enregistrée.");
      }
      setToken("");
      setInvitation(null);
      setNotice(action === "accept"
        ? "Invitation acceptée. Cette personne fait maintenant partie de votre cercle de confiance."
        : "Invitation refusée. Aucun lien de confiance n’a été créé.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Service momentanément indisponible.");
    } finally { setBusy(false); }
  }

  const returnTo = `/invitation/accept?id=${encodeURIComponent(invitationId)}&token=${encodeURIComponent(token)}`;
  const loginUrl = `/connexion?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <main className="sac-shell flex min-h-screen items-center justify-center px-4 py-8 text-sac-ink">
      <section className="sac-glass-panel w-full max-w-lg rounded-[2rem] p-6 sm:p-9">
        <a href="/" className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-sac-muted"><ArrowLeft size={16}/>Accueil</a>
        <div className="mt-6 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sac-primary/60 text-sac-confirm"><ShieldCheck size={25}/></span>
          <div><p className="text-xs font-bold uppercase tracking-widest text-sac-muted">SAC · invitation privée</p><h1 className="text-2xl font-black">Rejoindre un cercle de confiance</h1></div>
        </div>
        {loading ? <p className="py-8 text-sm text-sac-muted">Vérification sécurisée de l’invitation…</p> : authenticated === false ? (
          <div className="mt-6 rounded-2xl border border-white/80 bg-white/60 p-4">
            <p className="text-sm leading-6">Connectez-vous avec le compte SAC dont l’adresse e-mail vérifiée correspond à celle qui a reçu l’invitation. Aucun lien ne sera créé sans votre accord explicite.</p>
            <a href={loginUrl} className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-sac-primary-strong px-4 text-sm font-extrabold text-white">Se connecter pour répondre</a>
          </div>
        ) : invitation ? (
          <div className="mt-6 rounded-2xl border border-white/80 bg-white/60 p-4">
            <p className="text-sm leading-6">Le compte <strong>{invitation.inviterEmail}</strong> souhaite vous ajouter à son cercle de confiance.</p>
            <p className="mt-3 flex items-center gap-2 text-xs text-sac-muted"><Clock3 size={14}/>Expiration : {new Date(invitation.expiresAt).toLocaleString()}</p>
            <p className="mt-4 rounded-xl bg-white/80 p-3 text-xs leading-5 text-sac-muted">Accepter crée une relation de confiance dans un seul sens. Cela ne donne pas automatiquement accès à votre localisation ni à vos propres contacts. Vous pouvez refuser sans créer de relation.</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button type="button" disabled={busy} onClick={() => void decide("accept")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sac-confirm px-4 text-sm font-extrabold text-white disabled:opacity-50"><CheckCircle2 size={17}/>Accepter</button>
              <button type="button" disabled={busy} onClick={() => void decide("decline")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-sac-alert/20 bg-sac-alert/5 px-4 text-sm font-bold text-sac-alert disabled:opacity-50"><XCircle size={17}/>Refuser</button>
            </div>
          </div>
        ) : null}
        {notice && <div role="status" className="mt-4 rounded-xl border border-sac-confirm/20 bg-sac-confirm/10 p-4 text-sm leading-6">{notice}<a href="/espace-prive" className="mt-3 inline-flex min-h-10 items-center font-extrabold text-sac-confirm underline">Ouvrir mon espace privé</a></div>}
        {error && <p role="alert" className="mt-4 rounded-xl border border-sac-alert/25 bg-sac-alert/5 p-4 text-sm leading-6 text-sac-alert">{error}</p>}
      </section>
    </main>
  );
}
