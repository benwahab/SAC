import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, XCircle } from "lucide-react";
import BrandLogo from "./components/BrandLogo";
import { languages, type Language } from "./i18n/translations";
import { getDeviceSession } from "./services/device/root-enrollment";

type Invitation = { id: string; inviterEmail: string; expiresAt: number };

type Props = {
  language: Language;
  setLanguage: (language: Language) => void;
};

const copy = {
  fr: {
    back: "Accueil", eyebrow: "SAC · invitation privée", title: "Rejoindre un cercle de confiance",
    checking: "Vérification sécurisée de l’invitation…",
    invalid: "Le lien d’invitation est incomplet ou invalide.",
    invalidOrExpired: "Cette invitation est invalide, expirée, déjà utilisée ou destinée à une autre adresse.",
    verifyUnavailable: "Impossible de vérifier cette invitation pour le moment.",
    serviceUnavailable: "Service momentanément indisponible.",
    loginIntro: "Connectez-vous avec le compte SAC dont l’adresse e-mail vérifiée correspond à celle qui a reçu l’invitation. Aucun lien ne sera créé sans votre accord explicite.",
    login: "Se connecter pour répondre",
    inviter: "souhaite vous ajouter à son cercle de confiance.",
    expiry: "Expiration :",
    privacy: "Accepter crée une relation de confiance dans un seul sens. Cela ne donne pas automatiquement accès à votre localisation ni à vos propres contacts. Vous pouvez refuser sans créer de relation.",
    acceptPrompt: "Acceptez-vous explicitement de rejoindre le cercle de confiance de cette personne ?",
    declinePrompt: "Confirmez-vous votre refus de cette invitation ?",
    accept: "Accepter", decline: "Refuser",
    limit: "La personne qui vous invite a atteint sa limite de proches.",
    expired: "Cette invitation a expiré, a déjà été utilisée ou n’est plus valide.",
    invalidLink: "Le lien d’invitation est invalide.",
    responseFailed: "Votre réponse n’a pas pu être enregistrée.",
    accepted: "Invitation acceptée. Cette personne fait maintenant partie de votre cercle de confiance.",
    declined: "Invitation refusée. Aucun lien de confiance n’a été créé.",
    openPrivate: "Ouvrir mon espace privé", language: "Langue",
  },
  en: {
    back: "Home", eyebrow: "SAC · private invitation", title: "Join a trusted circle",
    checking: "Securely checking the invitation…",
    invalid: "The invitation link is incomplete or invalid.",
    invalidOrExpired: "This invitation is invalid, expired, already used, or addressed to another email.",
    verifyUnavailable: "The invitation cannot be verified right now.",
    serviceUnavailable: "The service is temporarily unavailable.",
    loginIntro: "Sign in with the SAC account whose verified email address received this invitation. No connection will be created without your explicit consent.",
    login: "Sign in to respond",
    inviter: "wants to add you to their trusted circle.",
    expiry: "Expires:",
    privacy: "Accepting creates a one-way trusted relationship. It does not automatically grant access to your location or your own contacts. You can decline without creating a relationship.",
    acceptPrompt: "Do you explicitly agree to join this person’s trusted circle?",
    declinePrompt: "Do you confirm that you want to decline this invitation?",
    accept: "Accept", decline: "Decline",
    limit: "The person inviting you has reached their trusted-contact limit.",
    expired: "This invitation has expired, was already used, or is no longer valid.",
    invalidLink: "The invitation link is invalid.",
    responseFailed: "Your response could not be saved.",
    accepted: "Invitation accepted. This person is now part of your trusted circle.",
    declined: "Invitation declined. No trusted relationship was created.",
    openPrivate: "Open my private space", language: "Language",
  },
  ar: {
    back: "الرئيسية", eyebrow: "SAC · دعوة خاصة", title: "الانضمام إلى دائرة ثقة",
    checking: "جارٍ التحقق الآمن من الدعوة…",
    invalid: "رابط الدعوة غير مكتمل أو غير صالح.",
    invalidOrExpired: "الدعوة غير صالحة أو منتهية أو مستخدمة مسبقاً أو مرسلة إلى عنوان آخر.",
    verifyUnavailable: "تعذر التحقق من الدعوة حالياً.",
    serviceUnavailable: "الخدمة غير متاحة مؤقتاً.",
    loginIntro: "سجّل الدخول باستخدام حساب SAC الذي استقبل عنوان بريده الإلكتروني الموثّق هذه الدعوة. لن يتم إنشاء أي ارتباط دون موافقتك الصريحة.",
    login: "تسجيل الدخول للرد",
    inviter: "يرغب في إضافتك إلى دائرة الثقة الخاصة به.",
    expiry: "تنتهي الصلاحية:",
    privacy: "ينشئ القبول علاقة ثقة في اتجاه واحد فقط. ولا يمنح تلقائياً إمكانية الوصول إلى موقعك أو جهات اتصالك. يمكنك الرفض دون إنشاء أي علاقة.",
    acceptPrompt: "هل توافق صراحةً على الانضمام إلى دائرة الثقة لهذا الشخص؟",
    declinePrompt: "هل تؤكد رغبتك في رفض هذه الدعوة؟",
    accept: "قبول", decline: "رفض",
    limit: "لقد وصل الشخص الذي أرسل الدعوة إلى الحد الأقصى لجهات الاتصال الموثوقة.",
    expired: "انتهت صلاحية الدعوة أو استُخدمت مسبقاً أو لم تعد صالحة.",
    invalidLink: "رابط الدعوة غير صالح.",
    responseFailed: "تعذر حفظ ردك.",
    accepted: "تم قبول الدعوة. أصبح هذا الشخص الآن ضمن دائرة الثقة الخاصة بك.",
    declined: "تم رفض الدعوة. لم يتم إنشاء أي علاقة ثقة.",
    openPrivate: "فتح مساحتي الخاصة", language: "اللغة",
  },
} satisfies Record<Language, Record<string, string>>;

export default function InvitationAcceptancePage({ language, setLanguage }: Props) {
  const text = copy[language];
  const rtl = language === "ar";
  const [initialLink] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return { id: params.get("id") ?? "", rawToken: params.get("token") ?? "" };
  });
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [token, setToken] = useState("");
  const [invitationId, setInvitationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const { id, rawToken } = initialLink;
    if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(rawToken)) {
      setError(text.invalid);
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
          throw new Error(payload.error === "invitation_not_found" ? text.invalidOrExpired : text.verifyUnavailable);
        }
        setInvitation(payload.invitation);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : text.serviceUnavailable);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function decide(action: "accept" | "decline") {
    if (!invitation || busy) return;
    const prompt = action === "accept" ? text.acceptPrompt : text.declinePrompt;
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
          contact_limit_reached: text.limit,
          invalid_or_expired_invitation: text.expired,
          invalid_invitation: text.invalidLink,
        };
        throw new Error(messages[payload.error ?? ""] ?? text.responseFailed);
      }
      setToken("");
      setInvitation(null);
      setNotice(action === "accept" ? text.accepted : text.declined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.serviceUnavailable);
    } finally { setBusy(false); }
  }

  const returnTo = `/invitation/accept?id=${encodeURIComponent(invitationId)}&token=${encodeURIComponent(token)}`;
  const loginUrl = `/connexion?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <main className="sac-shell flex min-h-screen items-center justify-center px-4 py-8 text-sac-ink" dir={rtl ? "rtl" : "ltr"}>
      <section className="sac-glass-panel w-full max-w-lg rounded-[2rem] p-6 sm:p-9">
        <div className="flex items-center justify-between gap-3">
          <a href="/" className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-sac-muted"><ArrowLeft size={16}/>{text.back}</a>
          <div className="flex items-center gap-1 rounded-full border border-white/80 bg-white/70 p-1" role="group" aria-label={text.language} dir="ltr">
            {languages.map(item => <button key={item.code} type="button" onClick={() => setLanguage(item.code)} aria-pressed={language === item.code} aria-label={item.label} className={"min-h-8 min-w-8 rounded-full px-2 text-xs font-bold " + (language === item.code ? "bg-sac-primary-strong text-white" : "text-sac-muted")}>{item.nativeLabel}</button>)}
          </div>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <span className="grid h-12 w-24 place-items-center rounded-2xl bg-white/85 px-3 shadow-sm"><BrandLogo className="h-7 w-auto" /></span>
          <div><p className="text-xs font-bold uppercase tracking-widest text-sac-muted">{text.eyebrow}</p><h1 className="text-2xl font-black">{text.title}</h1></div>
        </div>
        {loading ? <p className="py-8 text-sm text-sac-muted">{text.checking}</p> : authenticated === false ? (
          <div className="mt-6 rounded-2xl border border-white/80 bg-white/60 p-4">
            <p className="text-sm leading-6">{text.loginIntro}</p>
            <a href={loginUrl} className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-sac-primary-strong px-4 text-sm font-extrabold text-white">{text.login}</a>
          </div>
        ) : invitation ? (
          <div className="mt-6 rounded-2xl border border-white/80 bg-white/60 p-4">
            <p className="text-sm leading-6"><strong>{invitation.inviterEmail}</strong> {text.inviter}</p>
            <p className="mt-3 flex items-center gap-2 text-xs text-sac-muted"><Clock3 size={14}/>{text.expiry} {new Date(invitation.expiresAt).toLocaleString(language)}</p>
            <p className="mt-4 rounded-xl bg-white/80 p-3 text-xs leading-5 text-sac-muted">{text.privacy}</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button type="button" disabled={busy} onClick={() => void decide("accept")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sac-confirm px-4 text-sm font-extrabold text-white disabled:opacity-50"><CheckCircle2 size={17}/>{text.accept}</button>
              <button type="button" disabled={busy} onClick={() => void decide("decline")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-sac-alert/20 bg-sac-alert/5 px-4 text-sm font-bold text-sac-alert disabled:opacity-50"><XCircle size={17}/>{text.decline}</button>
            </div>
          </div>
        ) : null}
        {notice && <div role="status" className="mt-4 rounded-xl border border-sac-confirm/20 bg-sac-confirm/10 p-4 text-sm leading-6">{notice}<a href="/espace-prive" className="mt-3 inline-flex min-h-10 items-center font-extrabold text-sac-confirm underline">{text.openPrivate}</a></div>}
        {error && <p role="alert" className="mt-4 rounded-xl border border-sac-alert/25 bg-sac-alert/5 p-4 text-sm leading-6 text-sac-alert">{error}</p>}
      </section>
    </main>
  );
}
