import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, Download, HeartHandshake, LockKeyhole, MapPin, Share2, ShieldCheck, UsersRound, Wifi, X } from "lucide-react";
import { isLanguage, languages, translations, type Language } from "./i18n/translations";
import { completeRootEnrollment, requestRootEnrollment, type RootEnrollmentCeremony } from "./services/device/root-enrollment";
import PrivateSpacePage from "./PrivateSpacePage";
import InvitationAcceptancePage from "./InvitationAcceptancePage";


type LoginPageProps = {
  language: Language;
  setLanguage: (language: Language) => void;
  returnTo: string;
};

function LoginPage({ language, setLanguage, returnTo }: LoginPageProps) {
  const copy = {
    fr: {
      title: "Bienvenue sur SAC", subtitle: "Votre espace personnel sécurisé.",
      email: "Adresse e-mail", phone: "Téléphone avec indicatif international",
      password: "Mot de passe", code: "Code de vérification à 6 chiffres",
      signIn: "Connexion", create: "Créer un compte", register: "Créer mon compte",
      verify: "Vérifier mon adresse", resend: "Renvoyer un code",
      back: "Retour", home: "Retour à l’accueil", language: "Langue",
      private: "Espace privé", loginUnavailable: "Connectez-vous avec votre adresse vérifiée et votre mot de passe pour sécuriser ce téléphone.",
      rootIntro: "Votre adresse e-mail est vérifiée. Authentifiez-vous pour enregistrer la clé racine sur cet appareil.", prepareRoot: "Préparer mon appareil", createRoot: "Créer la clé sécurisée", rootReady: "Les options sont prêtes. Confirmez maintenant la création de la clé sur votre téléphone.", rootSuccess: "Appareil enregistré. Votre session sécurisée est ouverte.", rootPreparing: "Préparation…", rootCreating: "Confirmation sur l’appareil…",
      registerIntro: "Créez votre compte. Votre adresse e-mail doit être vérifiée avant toute activation.",
      verifyIntro: "Saisissez le code envoyé à votre adresse e-mail. Il est valable 10 minutes.",
      resendWait: "Vous pourrez demander un nouveau code dans", seconds: "s",
      success: "Adresse e-mail vérifiée et compte activé. Connectez-vous pour enregistrer la clé sécurisée de votre téléphone.",
      completeIntro: "Appareil sécurisé enregistré",
      genericAccepted: "Si cette adresse est éligible, vous recevrez les instructions de vérification.",
      serviceUnavailable: "Le service de vérification n’est pas encore configuré. Aucun compte n’a été activé.",
      invalidCode: "Code incorrect, expiré ou déjà utilisé. Vérifiez le code ou demandez-en un nouveau.",
      invalidEmail: "Adresse e-mail invalide.", invalidPhone: "Saisissez un numéro au format international, par exemple +22790000000.",
      passwordShort: "Le mot de passe doit contenir au moins 12 caractères.",
      invalidLanguage: "Langue non prise en charge.", requestError: "Impossible de traiter la demande. Réessayez plus tard.",
      passwordHint: "12 caractères minimum. Les espaces et caractères Unicode sont acceptés.",
      languageLabel: "Langue", emailSent: "Demande prise en compte. Consultez votre boîte e-mail si l’adresse est éligible.",
    },
    en: {
      title: "Welcome to SAC", subtitle: "Your secure personal space.",
      email: "Email address", phone: "Phone with international country code",
      password: "Password", code: "6-digit verification code",
      signIn: "Sign in", create: "Create an account", register: "Create my account",
      verify: "Verify my email", resend: "Resend code",
      back: "Back", home: "Back to home", language: "Language",
      private: "Private space", loginUnavailable: "Sign in with your verified email and password to secure this phone.",
      rootIntro: "Your email is verified. Sign in to register the root key on this device.", prepareRoot: "Prepare my device", createRoot: "Create secure key", rootReady: "Options are ready. Confirm key creation on your phone now.", rootSuccess: "Device registered. Your secure session is open.", rootPreparing: "Preparing…", rootCreating: "Confirm on your device…",
      registerIntro: "Create your account. Your email address must be verified before activation.",
      verifyIntro: "Enter the code sent to your email address. It is valid for 10 minutes.",
      resendWait: "You can request another code in", seconds: "s",
      success: "Email verified and account activated. Sign in to register your phone’s secure key.",
      completeIntro: "Secure device registered",
      genericAccepted: "If this address is eligible, you will receive verification instructions.",
      serviceUnavailable: "The verification service is not configured yet. No account has been activated.",
      invalidCode: "The code is incorrect, expired, or already used. Check it or request a new one.",
      invalidEmail: "Invalid email address.", invalidPhone: "Enter an international number, for example +22790000000.",
      passwordShort: "Your password must contain at least 12 characters.",
      invalidLanguage: "Unsupported language.", requestError: "The request could not be processed. Try again later.",
      passwordHint: "At least 12 characters. Spaces and Unicode characters are accepted.",
      languageLabel: "Language", emailSent: "Request received. Check your inbox if the address is eligible.",
    },
    ar: {
      title: "مرحباً بك في SAC", subtitle: "مساحتك الشخصية الآمنة.",
      email: "البريد الإلكتروني", phone: "رقم الهاتف مع رمز الدولة الدولي",
      password: "كلمة المرور", code: "رمز التحقق المكوّن من 6 أرقام",
      signIn: "تسجيل الدخول", create: "إنشاء حساب", register: "إنشاء حسابي",
      verify: "التحقق من بريدي", resend: "إعادة إرسال الرمز",
      back: "رجوع", home: "العودة إلى الصفحة الرئيسية", language: "اللغة",
      private: "مساحة خاصة", loginUnavailable: "سجّل الدخول ببريدك الموثّق وكلمة المرور لتأمين هذا الهاتف.",
      rootIntro: "تم التحقق من بريدك. سجّل الدخول لتسجيل المفتاح الأساسي على هذا الجهاز.", prepareRoot: "تهيئة جهازي", createRoot: "إنشاء المفتاح الآمن", rootReady: "الخيارات جاهزة. أكّد الآن إنشاء المفتاح على هاتفك.", rootSuccess: "تم تسجيل الجهاز وفتح جلستك الآمنة.", rootPreparing: "جارٍ التحضير…", rootCreating: "أكّد على جهازك…",
      registerIntro: "أنشئ حسابك. يجب التحقق من بريدك الإلكتروني قبل تفعيل الحساب.",
      verifyIntro: "أدخل الرمز المرسل إلى بريدك الإلكتروني. صلاحية الرمز 10 دقائق.",
      resendWait: "يمكنك طلب رمز جديد خلال", seconds: "ث",
      success: "تم التحقق من البريد وتفعيل الحساب. سجّل الدخول لتسجيل المفتاح الآمن لهاتفك.",
      completeIntro: "تم تسجيل الجهاز الآمن",
      genericAccepted: "إذا كان هذا العنوان مؤهلاً، فستصلك تعليمات التحقق.",
      serviceUnavailable: "خدمة التحقق غير مهيأة بعد. لم يتم تفعيل أي حساب.",
      invalidCode: "الرمز غير صحيح أو منتهي الصلاحية أو مستخدم مسبقاً. تحقق منه أو اطلب رمزاً جديداً.",
      invalidEmail: "عنوان بريد إلكتروني غير صالح.", invalidPhone: "أدخل رقماً دولياً، مثل +22790000000.",
      passwordShort: "يجب ألا تقل كلمة المرور عن 12 حرفاً.",
      invalidLanguage: "اللغة غير مدعومة.", requestError: "تعذرت معالجة الطلب. حاول مرة أخرى لاحقاً.",
      passwordHint: "12 حرفاً على الأقل. المسافات ومحارف Unicode مقبولة.",
      languageLabel: "اللغة", emailSent: "تم استلام الطلب. تحقق من بريدك إذا كان العنوان مؤهلاً.",
    },
  }[language];

  type Mode = "login" | "register" | "verify" | "enroll" | "complete";
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [rootCeremony, setRootCeremony] = useState<RootEnrollmentCeremony | null>(null);
  const rtl = language === "ar";

  useEffect(() => {
    if (resendAt === null) {
      setSecondsRemaining(0);
      return;
    }
    const update = () => setSecondsRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);

  function errorMessage(codeValue: string | undefined): string {
    switch (codeValue) {
      case "invalid_email": return copy.invalidEmail;
      case "invalid_phone": return copy.invalidPhone;
      case "password_too_short": return copy.passwordShort;
      case "invalid_language": return copy.invalidLanguage;
      case "invalid_or_expired_code": return copy.invalidCode;
      case "verification_service_not_configured":
      case "verification_email_unavailable": return copy.serviceUnavailable;
      default: return copy.requestError;
    }
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone, password, language }),
      });
      const payload = await response.json() as { error?: string; message?: string; retryAfterSeconds?: number };
      if (!response.ok) {
        setError(errorMessage(payload.error));
        return;
      }
      setPassword("");
      setCode("");
      setMode("verify");
      setNotice(payload.message ?? copy.genericAccepted);
      setResendAt(Date.now() + (payload.retryAfterSeconds ?? 60) * 1000);
    } catch {
      setError(copy.requestError);
    } finally {
      setBusy(false);
    }
  }

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const payload = await response.json() as { error?: string; verified?: boolean; accountActivated?: boolean };
      if (!response.ok || !payload.verified || !payload.accountActivated) {
        setError(errorMessage(payload.error ?? "invalid_or_expired_code"));
        return;
      }
      setCode("");
      setMode("login");
      setNotice(copy.success);
    } catch {
      setError(copy.requestError);
    } finally {
      setBusy(false);
    }
  }

  async function submitRootOptions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const ceremony = await requestRootEnrollment(email, password);
      setRootCeremony(ceremony);
      setPassword("");
      setMode("enroll");
    } catch (reason) {
      setError(errorMessage(reason instanceof Error ? reason.message : undefined));
    } finally {
      setBusy(false);
    }
  }

  async function confirmRootEnrollment() {
    if (!rootCeremony || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await completeRootEnrollment(rootCeremony);
      setRootCeremony(null);
      setPassword("");
      setMode("complete");
      setNotice(copy.rootSuccess);
    } catch (reason) {
      setError(errorMessage(reason instanceof Error ? reason.message : undefined));
    } finally {
      setBusy(false);
    }
  }
  async function resendCode() {
    if (busy || secondsRemaining > 0) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/resend-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json() as { error?: string; message?: string; retryAfterSeconds?: number };
      if (!response.ok) {
        setError(errorMessage(payload.error));
        return;
      }
      setNotice(payload.message ?? copy.emailSent);
      setResendAt(Date.now() + (payload.retryAfterSeconds ?? 60) * 1000);
    } catch {
      setError(copy.requestError);
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "min-h-12 w-full rounded-xl border border-white/90 bg-white/75 px-4 text-base text-sac-ink outline-none transition focus:border-sac-confirm focus:ring-2 focus:ring-sac-confirm/20 disabled:opacity-60";
  const primaryButton = "min-h-12 w-full rounded-xl bg-sac-primary-strong px-4 font-extrabold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <main className="sac-shell flex min-h-screen items-center justify-center px-5 py-10 text-sac-ink" dir={rtl ? "rtl" : "ltr"}>
      <section className="sac-glass-panel w-full max-w-md rounded-[2rem] p-6 sm:p-9">
        <div className="flex items-start justify-between gap-4">
          <a href="/" className="flex flex-col" aria-label="SAC accueil">
            <span className="text-xl font-black tracking-[0.2em]">SAC</span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-sac-muted">{copy.private}</span>
          </a>
          <div className="flex items-center gap-1 rounded-full border border-white/90 bg-white/70 p-1 shadow-glass" role="group" aria-label={copy.languageLabel} dir="ltr">
            {languages.map((item) => (
              <button key={item.code} type="button" onClick={() => setLanguage(item.code)} aria-pressed={language === item.code} aria-label={item.label} className={"min-h-9 min-w-9 rounded-full px-2 text-xs font-extrabold " + (language === item.code ? "bg-sac-primary-strong text-white" : "text-sac-muted hover:bg-sac-primary/60")}>{item.nativeLabel}</button>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <h1 className="text-3xl font-black tracking-tight">{copy.title}</h1>
          <p className="mt-2 text-sm leading-6 text-sac-muted">{mode === "register" ? copy.registerIntro : mode === "verify" ? copy.verifyIntro : mode === "complete" ? copy.completeIntro : copy.subtitle}</p>
        </div>

        {mode === "login" && (
          <div className="mt-8 space-y-4">
            <p className="text-sm leading-6 text-sac-muted">{copy.loginUnavailable}</p>
            <form className="space-y-4" onSubmit={submitRootOptions}>
              <div>
                <label className="mb-2 block text-sm font-bold" htmlFor="sac-login-email">{copy.email}</label>
                <input id="sac-login-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold" htmlFor="sac-login-password">{copy.password}</label>
                <input id="sac-login-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
              </div>
              <button type="submit" disabled={busy || !email || !password} className={primaryButton}>{busy ? copy.rootPreparing : copy.prepareRoot}</button>
            </form>
            <button type="button" className="min-h-11 w-full rounded-xl border border-sac-primary-strong/30 bg-white/60 px-4 text-sm font-bold text-sac-ink" onClick={() => { setMode("register"); setError(""); setNotice(""); }}>{copy.create}</button>
          </div>
        )}

        {mode === "enroll" && rootCeremony && (
          <div className="mt-8 space-y-4">
            <p className="rounded-xl border border-sac-confirm/25 bg-sac-confirm/10 p-4 text-sm leading-6 text-sac-ink">{copy.rootIntro}</p>
            <p className="text-sm leading-6 text-sac-muted">{copy.rootReady}</p>
            <button type="button" disabled={busy} onClick={confirmRootEnrollment} className={primaryButton}>{busy ? copy.rootCreating : copy.createRoot}</button>
            <button type="button" disabled={busy} onClick={() => { setRootCeremony(null); setMode("login"); setError(""); setNotice(""); }} className="min-h-11 w-full rounded-xl border border-sac-primary-strong/30 bg-white/60 px-4 text-sm font-bold text-sac-ink">{copy.back}</button>
          </div>
        )}

        {mode === "register" && (
          <form className="mt-8 space-y-4" onSubmit={submitRegistration}>
            <div>
              <label className="mb-2 block text-sm font-bold" htmlFor="sac-register-email">{copy.email}</label>
              <input id="sac-register-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold" htmlFor="sac-register-phone">{copy.phone}</label>
              <input id="sac-register-phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="+22790000000" value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold" htmlFor="sac-register-password">{copy.password}</label>
              <input id="sac-register-password" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
              <p className="mt-2 text-xs leading-5 text-sac-muted">{copy.passwordHint}</p>
            </div>
            <button type="submit" disabled={busy} className={primaryButton}>{busy ? "…" : copy.register}</button>
            <button type="button" disabled={busy} onClick={() => { setMode("login"); setError(""); setNotice(""); }} className="min-h-11 w-full rounded-xl border border-sac-primary-strong/30 bg-white/60 px-4 text-sm font-bold text-sac-ink disabled:opacity-60">{copy.back}</button>
          </form>
        )}

        {mode === "verify" && (
          <form className="mt-8 space-y-4" onSubmit={submitVerification}>
            <p className="rounded-xl border border-white/90 bg-white/55 p-3 text-sm font-semibold" dir="ltr">{email}</p>
            <label className="block text-sm font-bold" htmlFor="sac-email-code">{copy.code}</label>
            <input id="sac-email-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className={inputClass + " text-center text-2xl font-black tracking-[0.45em]"} dir="ltr" />
            <button type="submit" disabled={busy || code.length !== 6} className={primaryButton}>{busy ? "…" : copy.verify}</button>
            <button type="button" disabled={busy || secondsRemaining > 0} onClick={resendCode} className="min-h-11 w-full rounded-xl border border-sac-primary-strong/30 bg-white/60 px-4 text-sm font-bold text-sac-ink disabled:cursor-not-allowed disabled:opacity-50">{copy.resend}</button>
            {secondsRemaining > 0 && <p className="text-center text-xs text-sac-muted">{copy.resendWait} {secondsRemaining}{copy.seconds}</p>}
            <button type="button" disabled={busy} onClick={() => { setMode("register"); setCode(""); setError(""); setNotice(""); }} className="min-h-10 w-full text-sm font-bold text-sac-muted">{copy.back}</button>
          </form>
        )}

        {mode === "complete" && (
          <div className="mt-8 space-y-4">
            <div className="rounded-xl border border-sac-confirm/25 bg-sac-confirm/10 p-4 text-sm leading-6 text-sac-ink" role="status">{copy.rootSuccess}</div>
            <a href={returnTo} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-sac-primary-strong px-4 text-sm font-extrabold text-white">{returnTo.startsWith("/invitation/accept?") ? "Continuer vers l’invitation" : "Ouvrir mon espace privé"}</a>
            <a href="/" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-white/90 bg-white/70 px-4 text-sm font-bold text-sac-ink">{copy.home}</a>
          </div>
        )}

        {notice && mode !== "complete" && <p role="status" aria-live="polite" className="mt-5 rounded-xl border border-sac-confirm/20 bg-sac-confirm/5 p-4 text-xs leading-6 text-sac-muted">{notice}</p>}
        {error && <p role="alert" aria-live="assertive" className="mt-4 rounded-xl border border-sac-alert/25 bg-sac-alert/5 p-4 text-xs leading-6 text-sac-alert">{error}</p>}
        {mode !== "login" && mode !== "complete" && <a href="/" className="mt-6 inline-flex min-h-10 items-center text-sm font-bold text-sac-confirm hover:underline">{copy.home}</a>}
      </section>
    </main>
  );
}

type HealthState = "checking" | "connected" | "schema_incomplete" | "unavailable";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function App() {
  const [health, setHealth] = useState<HealthState>("checking");
  const [healthRefresh, setHealthRefresh] = useState(0);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installHelp, setInstallHelp] = useState<"ios" | "android" | null>(null);
  const [isAppleDevice, setIsAppleDevice] = useState(false);
  const [isAndroidDevice, setIsAndroidDevice] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(() => navigator.onLine);
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = window.localStorage.getItem("sac-language");
      return isLanguage(saved) ? saved : "fr";
    } catch {
      return "fr";
    }
  });
  const t = translations[language];
  const signInLabel = language === "fr" ? "Connexion" : language === "en" ? "Sign in" : "تسجيل الدخول";
  const isLoginPage = window.location.pathname === "/connexion";
  const isPrivateSpacePage = window.location.pathname === "/espace-prive";
  const isInvitationAcceptancePage = window.location.pathname === "/invitation/accept";
  const requestedReturnTo = new URLSearchParams(window.location.search).get("returnTo") ?? "";
  const loginReturnTo = requestedReturnTo.startsWith("/invitation/accept?") && !requestedReturnTo.startsWith("//")
    ? requestedReturnTo
    : "/espace-prive";
  const isRtl = language === "ar";

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    try {
      window.localStorage.setItem("sac-language", language);
    } catch {
      // Language selection remains available for the current session.
    }
  }, [language, isRtl]);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);

    const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(navigator.userAgent);
    setIsAppleDevice(isAppleMobile);
    setIsAndroidDevice(isAndroid);
    if (!standalone && isAppleMobile) setInstallHelp("ios");

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setInstallHelp(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) {
      if (isAppleDevice) {
        setInstallHelp((current) => current === "ios" ? null : "ios");
      } else {
        setInstallHelp((current) => current === "android" ? null : "android");
      }
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === "accepted") setIsInstalled(true);
      else setInstallHelp("android");
    } catch {
      setInstallPrompt(null);
      setInstallHelp(isAppleDevice ? "ios" : "android");
    }
  };

  useEffect(() => {
    let controller: AbortController | null = null;

    const checkHealth = () => {
      controller?.abort();
      if (!navigator.onLine) {
        setNetworkOnline(false);
        setHealth("unavailable");
        return;
      }

      setNetworkOnline(true);
      setHealth("checking");
      controller = new AbortController();
      fetch("/api/health", { signal: controller.signal, cache: "no-store" })
        .then(async (response) => {
          const payload: { ok?: boolean; database?: string } = await response.json();
          if (payload.database === "schema_incomplete") {
            setHealth("schema_incomplete");
            return;
          }
          if (!response.ok) throw new Error("API unavailable");
          setHealth(payload.ok && payload.database === "connected" ? "connected" : "unavailable");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setHealth("unavailable");
        });
    };

    const handleOffline = () => {
      controller?.abort();
      setNetworkOnline(false);
      setHealth("unavailable");
    };

    const handleOnline = () => checkHealth();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    checkHealth();

    return () => {
      controller?.abort();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [healthRefresh]);

  if (isLoginPage) return <LoginPage language={language} setLanguage={setLanguage} returnTo={loginReturnTo} />;
  if (isInvitationAcceptancePage) return <InvitationAcceptancePage />;
  if (isPrivateSpacePage) return <PrivateSpacePage onLogout={() => { window.location.assign("/connexion"); }} />;

  const statusDot =
    health === "connected" ? "bg-sac-confirm" :
    health === "schema_incomplete" || health === "unavailable" ? "bg-sac-alert" : "animate-pulse bg-sac-primary-strong";

  const pillars = [
    { icon: UsersRound, title: t.contactTitle, description: t.contactDescription },
    { icon: MapPin, title: t.locationTitle, description: t.locationDescription },
    { icon: HeartHandshake, title: t.helpTitle, description: t.helpDescription },
  ];

  return (
    <div className="sac-shell min-h-screen overflow-hidden text-sac-ink" dir={isRtl ? "rtl" : "ltr"}>
      <header className="sac-header relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <a href="/" aria-label="SAC" className="flex min-w-0 flex-col">
          <span className="text-xl font-black tracking-[0.2em] text-sac-ink">SAC</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sac-muted">{t.appName}</span>
        </a>
        <div className="flex items-center gap-2 sm:gap-3">
          {!isInstalled && (installPrompt || installHelp || isAppleDevice || isAndroidDevice) && (
            <button type="button" onClick={() => void installApp()} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-sac-confirm/25 bg-white/75 px-3 py-2 text-xs font-extrabold text-sac-ink shadow-glass hover:bg-white">
              <Download size={14} />{t.installApp}
            </button>
          )}
          <a href="/connexion" className="hidden rounded-full border border-white/90 bg-white/65 px-4 py-2 text-xs font-extrabold text-sac-ink shadow-glass hover:bg-white sm:inline-flex">{signInLabel}</a>
          <div className="hidden items-center gap-2 rounded-full border border-white/80 bg-white/55 px-3 py-2 text-xs font-semibold text-sac-ink shadow-glass sm:flex">
            <LockKeyhole size={14} className="text-sac-confirm" />{t.privateApp}
          </div>
          <div className="sac-language-switch flex items-center gap-1 rounded-full border border-white/90 bg-white/65 p-1 shadow-glass" role="group" aria-label={t.languageLabel} dir="ltr">
            {languages.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => setLanguage(item.code)}
                aria-pressed={language === item.code}
                aria-label={item.label}
                title={item.label}
                className={"min-h-9 min-w-9 rounded-full px-2 text-xs font-extrabold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sac-confirm " + (language === item.code ? "bg-sac-primary-strong text-white shadow-sm" : "text-sac-muted hover:bg-sac-primary/60")}
              >{item.nativeLabel}</button>
            ))}
          </div>
        </div>
      </header>
      {installHelp && !isInstalled && (
        <aside className="mx-auto -mt-2 mb-4 flex max-w-6xl items-start gap-3 px-5 sm:px-8" aria-live="polite">
          <div className="sac-glass-card flex flex-1 items-start gap-3 rounded-2xl p-4 text-sm leading-6 text-sac-ink">
            {installHelp === "ios" ? <Share2 size={19} className="mt-1 shrink-0 text-sac-confirm" /> : <Download size={19} className="mt-1 shrink-0 text-sac-confirm" />}
            <p>{installHelp === "ios" ? t.installIosHelp : t.installAndroidHelp}</p>
            <button type="button" onClick={() => setInstallHelp(null)} aria-label={t.close} className="ml-auto rounded-lg p-1 text-sac-muted hover:bg-white/70"><X size={16} /></button>
          </div>
        </aside>
      )}

      <main>
        <section className="sac-hero-layout relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-8 sm:px-8 sm:pb-24 sm:pt-14 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="pointer-events-none absolute -right-40 -top-24 h-[28rem] w-[28rem] rounded-full bg-sac-primary/70 blur-3xl" />
          <div className="sac-copy relative">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/90 bg-white/65 px-3 py-2 text-xs font-bold text-sac-ink shadow-glass backdrop-blur-xl">
              <span className="h-2 w-2 rounded-full bg-sac-confirm" />{t.trustEyebrow}
            </div>
            <h1 className="max-w-2xl text-4xl font-black leading-[1.08] tracking-tight text-sac-ink sm:text-5xl lg:text-[3.7rem]">
              {t.heroTitle}<span className="block text-sac-primary-strong">{t.heroSecond}</span><span className="block">{t.heroThird}</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-sac-muted sm:text-lg">{t.heroDescription}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button type="button" disabled aria-describedby="sos-status" className="inline-flex min-h-14 cursor-not-allowed items-center justify-center gap-3 rounded-2xl border border-sac-alert/20 bg-sac-alert/10 px-7 text-base font-extrabold text-sac-alert opacity-80">
                <ShieldCheck size={20} />{t.sosLabel}
                <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">{t.preparing}</span>
              </button>
              <span className="text-sm leading-6 text-sac-muted" id="sos-status">{t.sosStatus}</span>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-sac-ink">
              <span className="sac-inline-icon inline-flex items-center gap-2"><LockKeyhole size={16} className="text-sac-confirm" />{t.protectedData}</span>
              <span className="sac-inline-icon inline-flex items-center gap-2"><UsersRound size={16} className="text-sac-confirm" />{t.chosenContacts}</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-sac-primary/80 via-white/70 to-sac-confirm/10 blur-xl" />
            <div className="sac-glass-panel relative rounded-[2rem] p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-sac-muted">{t.personalSpace}</p>
                  <h2 className="mt-1 text-xl font-extrabold text-sac-ink">{t.accompaniment}</h2>
                </div>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sac-primary/70 text-sac-confirm"><ShieldCheck size={25} /></span>
              </div>
              <div className="mt-7 rounded-2xl border border-white/90 bg-white/55 p-5 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/80 text-sac-confirm shadow-sm"><Wifi size={19} /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-sac-ink">{t.serverStatus}</p>
                    <p className="mt-0.5 text-xs text-sac-muted" aria-live="polite">
                      {!networkOnline && t.offline}
                      {networkOnline && health === "checking" && t.checking}
                      {networkOnline && health === "connected" && t.connected}
                      {networkOnline && health === "schema_incomplete" && t.schemaIncomplete}
                      {networkOnline && health === "unavailable" && t.unavailable}
                    </p>
                    {networkOnline && health !== "connected" && (
                      <button
                        type="button"
                        onClick={() => setHealthRefresh((value) => value + 1)}
                        disabled={health === "checking"}
                        className="mt-2 min-h-9 rounded-lg border border-sac-primary-strong/25 bg-white/70 px-3 text-xs font-bold text-sac-ink disabled:opacity-50"
                      >{health === "checking" ? t.checking : t.retry}</button>
                    )}
                  </div>
                  <span className={"ml-auto h-2.5 w-2.5 shrink-0 rounded-full " + statusDot} />
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-xl bg-white/55 px-4 py-3">
                  <span className="text-sm font-semibold text-sac-muted">{t.freePlan}</span>
                  <span className="text-sm font-extrabold text-sac-ink">2 {t.contacts}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-white/55 px-4 py-3">
                  <span className="text-sm font-semibold text-sac-muted">{t.premiumPlan}</span>
                  <span className="text-sm font-extrabold text-sac-ink">10 {t.contacts}</span>
                </div>
              </div>
              <p className="mt-5 text-xs leading-5 text-sac-muted">{t.freeSafety}</p>
            </div>
          </div>
        </section>

        <section className="border-y border-white/80 bg-white/45 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
            <div className="sac-copy max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-sac-confirm">{t.principles}</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-sac-ink sm:text-4xl">{t.principlesTitle}</h2>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {pillars.map(({ icon: Icon, title, description }) => (
                <article key={title} className="sac-glass-card rounded-2xl p-6 transition-shadow hover:shadow-glass-hover">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sac-primary/75 text-sac-confirm"><Icon size={23} /></span>
                  <h3 className="mt-5 text-lg font-extrabold text-sac-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-sac-muted">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
          <div className="sac-responsible-panel flex flex-col gap-5 rounded-3xl px-6 py-8 text-sac-ink sm:flex-row sm:items-center sm:justify-between sm:px-9">
            <div className="sac-copy max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sac-confirm">{t.responsibleEyebrow}</p>
              <h2 className="mt-2 text-2xl font-extrabold">{t.emergencyTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-sac-muted">{t.emergencyDescription}</p>
            </div>
            <a href="https://github.com/benwahab/SAC" target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-white/90 bg-white/80 px-4 py-3 text-sm font-bold text-sac-ink shadow-glass transition hover:bg-white">
              {t.followProject}<ArrowUpRight size={16} />
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/80 bg-white/45 px-5 py-7 text-center text-xs text-sac-muted backdrop-blur-xl">{t.footer}</footer>
    </div>
  );
}
