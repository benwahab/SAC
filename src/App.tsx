import { useEffect, useState, type FormEvent } from "react";
import { Download, Eye, EyeOff, HeartHandshake, LockKeyhole, MapPin, Share2, ShieldCheck, UsersRound, X } from "lucide-react";
import { isLanguage, languages, translations, type Language } from "./i18n/translations";
import { completeRootAuthentication, requestRootAuthentication, type RootAuthenticationOptions } from "./services/device/root-authentication";
import { createPasswordSession } from "./services/device/password-session";
import PrivateSpacePage from "./PrivateSpacePage";
import InvitationAcceptancePage from "./InvitationAcceptancePage";
import AdminDashboard from "./AdminDashboard";


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
      password: "Mot de passe", confirmPassword: "Confirmer le mot de passe", passwordMismatch: "Les deux mots de passe ne correspondent pas.", code: "Code de vérification à 6 chiffres",
      signIn: "Connexion", create: "Créer un compte", register: "Créer mon compte",
      verify: "Vérifier mon adresse", resend: "Renvoyer un code",
      back: "Retour", home: "Retour à l’accueil", language: "Langue",
      private: "Espace privé", loginUnavailable: "Connectez-vous avec votre adresse vérifiée et votre mot de passe. Vous pourrez configurer la clé de sécurité plus tard dans vos réglages.",
      rootIntro: "Votre appareil sécurisé est prêt. Confirmez votre identité pour ouvrir votre session.", prepareRoot: "Se connecter", createRoot: "Confirmer sur cet appareil", rootReady: "Confirmez la connexion avec la clé sécurisée de ce téléphone.", rootSuccess: "Connexion sécurisée réussie. Votre session est ouverte.", rootPreparing: "Vérification…", rootCreating: "Confirmation sur l’appareil…",
      registerIntro: "Créez votre compte. Votre adresse e-mail doit être vérifiée avant toute activation.",
      verifyIntro: "Saisissez le code envoyé à votre adresse e-mail. Il est valable 10 minutes.",
      resendWait: "Vous pourrez demander un nouveau code dans", seconds: "s",
      success: "Adresse e-mail vérifiée et compte activé. Connectez-vous. Vous pourrez configurer la clé de sécurité dans vos réglages.",
      completeIntro: "Connexion sécurisée",
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
      password: "Password", confirmPassword: "Confirm password", passwordMismatch: "The passwords do not match.", code: "6-digit verification code",
      signIn: "Sign in", create: "Create an account", register: "Create my account",
      verify: "Verify my email", resend: "Resend code",
      back: "Back", home: "Back to home", language: "Language",
      private: "Private space", loginUnavailable: "Sign in with your verified email and password. You can configure the security key later in your settings.",
      rootIntro: "Your secure device is ready. Confirm your identity to open your session.", prepareRoot: "Sign in", createRoot: "Confirm on this device", rootReady: "Confirm sign-in with this phone’s secure key.", rootSuccess: "Secure sign-in successful. Your session is open.", rootPreparing: "Checking…", rootCreating: "Confirm on your device…",
      registerIntro: "Create your account. Your email address must be verified before activation.",
      verifyIntro: "Enter the code sent to your email address. It is valid for 10 minutes.",
      resendWait: "You can request another code in", seconds: "s",
      success: "Email verified and account activated. Sign in. You can configure the security key in your settings.",
      completeIntro: "Secure sign-in",
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
      password: "كلمة المرور", confirmPassword: "تأكيد كلمة المرور", passwordMismatch: "كلمتا المرور غير متطابقتين.", code: "رمز التحقق المكوّن من 6 أرقام",
      signIn: "تسجيل الدخول", create: "إنشاء حساب", register: "إنشاء حسابي",
      verify: "التحقق من بريدي", resend: "إعادة إرسال الرمز",
      back: "رجوع", home: "العودة إلى الصفحة الرئيسية", language: "اللغة",
      private: "مساحة خاصة", loginUnavailable: "سجّل الدخول ببريدك الموثّق وكلمة المرور. يمكنك إعداد مفتاح الأمان لاحقاً من الإعدادات.",
      rootIntro: "جهازك الآمن جاهز. أكّد هويتك لفتح جلستك.", prepareRoot: "تسجيل الدخول", createRoot: "التأكيد على هذا الجهاز", rootReady: "أكّد تسجيل الدخول باستخدام المفتاح الآمن لهذا الهاتف.", rootSuccess: "تم تسجيل الدخول بأمان وفتح جلستك.", rootPreparing: "جارٍ التحقق…", rootCreating: "أكّد على جهازك…",
      registerIntro: "أنشئ حسابك. يجب التحقق من بريدك الإلكتروني قبل تفعيل الحساب.",
      verifyIntro: "أدخل الرمز المرسل إلى بريدك الإلكتروني. صلاحية الرمز 10 دقائق.",
      resendWait: "يمكنك طلب رمز جديد خلال", seconds: "ث",
      success: "تم التحقق من البريد وتفعيل الحساب. سجّل الدخول. يمكنك إعداد مفتاح الأمان من الإعدادات.",
      completeIntro: "تسجيل دخول آمن",
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

  type Mode = "login" | "register" | "verify" | "authenticate" | "complete";
  const [mode, setMode] = useState<Mode>(() => new URLSearchParams(window.location.search).get("mode") === "register" ? "register" : "login");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [registerPasswordVisible, setRegisterPasswordVisible] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [rootCeremony, setRootCeremony] = useState<RootAuthenticationOptions | null>(null);
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
      case "invalid_credentials":
      case "invalid_authentication":
      case "authentication_expired_or_unavailable":
      case "webauthn_not_supported":
      case "root_device_unavailable":
      case "root_enrollment_not_approved":
        return language === "fr" ? "Identifiants incorrects ou appareil sécurisé indisponible sur ce téléphone." : language === "en" ? "Invalid credentials or secure device unavailable on this phone." : "بيانات الدخول غير صحيحة أو الجهاز الآمن غير متاح على هذا الهاتف.";
      case "too_many_attempts":
        return language === "fr" ? "Trop de tentatives. Réessayez dans 15 minutes." : language === "en" ? "Too many attempts. Try again in 15 minutes." : "محاولات كثيرة. حاول مرة أخرى بعد 15 دقيقة.";
      default: return copy.requestError;
    }
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError(copy.passwordMismatch);
      setNotice("");
      return;
    }
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
      setConfirmPassword("");
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
      try {
        const ceremony = await requestRootAuthentication(email, password);
        setRootCeremony(ceremony);
        setPassword("");
        setMode("authenticate");
      } catch (reason) {
        if (!(reason instanceof Error) || reason.message !== "root_enrollment_required") throw reason;
        await createPasswordSession(email, password);
        setPassword("");
        window.location.assign(returnTo);
      }
    } catch (reason) {
      setError(errorMessage(reason instanceof Error ? reason.message : undefined));
    } finally {
      setBusy(false);
    }
  }

  async function confirmRootAuthentication() {
    if (!rootCeremony || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await completeRootAuthentication(rootCeremony);
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
    <main className="sac-shell sac-auth-page flex min-h-screen items-center justify-center px-5 py-10 text-sac-ink" dir={rtl ? "rtl" : "ltr"}>
      <div className="sac-auth-layout relative z-10 mx-auto grid w-full max-w-5xl items-center gap-8 lg:grid-cols-[1fr_minmax(0,28rem)] lg:gap-14">
        <aside className="sac-auth-brand hidden lg:block">
          <div className="sac-auth-brand-mark mb-7 grid h-16 w-16 place-items-center rounded-2xl"><ShieldCheck size={34} strokeWidth={1.5}/></div>
          <p className="text-xs font-black uppercase tracking-[.28em] text-sac-primary-strong">SAC · SÉCURITÉ · CONFIANCE</p>
          <h2 className="mt-5 max-w-xl text-5xl font-black leading-[1.08] tracking-tight text-sac-ink">{language === "fr" ? <>Toujours proches.<span className="block text-sac-primary-strong">Même à distance.</span></> : language === "en" ? <>Always close.<span className="block text-sac-primary-strong">Even from afar.</span></> : <>دائماً قريبون.<span className="block text-sac-primary-strong">حتى عن بُعد.</span></>}</h2>
          <p className="mt-6 max-w-md text-base leading-8 text-sac-muted">{language === "fr" ? "Un espace sécurisé pour rester relié aux personnes qui comptent, et leur transmettre une alerte lorsque vous en avez besoin." : language === "en" ? "A secure space to stay connected to the people who matter and reach them when you need help." : "مساحة آمنة للبقاء على اتصال بمن يهمك أمرهم وطلب المساعدة عند الحاجة."}</p>
          <div className="sac-auth-brand-orbit mt-10 flex h-48 w-48 items-center justify-center rounded-full"><div className="grid h-28 w-28 place-items-center rounded-full border border-sac-primary/20 bg-sac-primary/10 text-sac-primary-strong shadow-[0_0_55px_rgba(63,174,122,.30)]"><HeartHandshake size={48} strokeWidth={1.35}/></div></div>
        </aside>
        <section className="sac-glass-panel sac-auth-card w-full max-w-md rounded-[2rem] p-6 sm:p-9">
        <div className="flex items-start justify-between gap-4">
          <a href="/" className="flex flex-col" aria-label="SAC accueil">
            <span className="text-xl font-black tracking-[0.2em]">SAC</span>
          </a>
          <div className="sac-language-switch flex items-center gap-1 rounded-full border border-white/90 bg-white/70 p-1 shadow-glass" role="group" aria-label={copy.languageLabel} dir="ltr">
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
                <div className="relative">
                  <input id="sac-login-password" type={passwordVisible ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass + (rtl ? " pl-12" : " pr-12")} />
                  <button type="button" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? translations[language].hidePassword : translations[language].showPassword} aria-pressed={passwordVisible} aria-controls="sac-login-password" title={passwordVisible ? translations[language].hidePassword : translations[language].showPassword} className={"sac-password-toggle flex h-11 w-11 items-center justify-center rounded-lg text-sac-muted transition hover:text-sac-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sac-confirm/40 " + (rtl ? "left-1" : "right-1")}>
                    {passwordVisible ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={busy || !email || !password} className={primaryButton}>{busy ? copy.rootPreparing : copy.prepareRoot}</button>
            </form>
            <button type="button" className="min-h-11 w-full rounded-xl border border-sac-primary-strong/30 bg-white/60 px-4 text-sm font-bold text-sac-ink" onClick={() => { setMode("register"); setError(""); setNotice(""); }}>{copy.create}</button>
          </div>
        )}

        {mode === "authenticate" && rootCeremony && (
          <div className="mt-8 space-y-4">
            <p className="rounded-xl border border-sac-confirm/25 bg-sac-confirm/10 p-4 text-sm leading-6 text-sac-ink">{copy.rootIntro}</p>
            <p className="text-sm leading-6 text-sac-muted">{copy.rootReady}</p>
            <button type="button" disabled={busy} onClick={confirmRootAuthentication} className={primaryButton}>{busy ? copy.rootCreating : copy.createRoot}</button>
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
              <div className="relative">
                <input id="sac-register-password" type={registerPasswordVisible ? "text" : "password"} autoComplete="new-password" required minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass + (rtl ? " pl-12" : " pr-12")} />
                <button type="button" onClick={() => setRegisterPasswordVisible((visible) => !visible)} aria-label={registerPasswordVisible ? translations[language].hidePassword : translations[language].showPassword} aria-pressed={registerPasswordVisible} aria-controls="sac-register-password" title={registerPasswordVisible ? translations[language].hidePassword : translations[language].showPassword} className={"sac-password-toggle flex h-11 w-11 items-center justify-center rounded-lg text-sac-muted transition hover:text-sac-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sac-confirm/40 " + (rtl ? "left-1" : "right-1")}>
                  {registerPasswordVisible ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
                </button>
              </div>
              <p className="mt-2 text-xs leading-5 text-sac-muted">{copy.passwordHint}</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold" htmlFor="sac-register-confirm-password">{copy.confirmPassword}</label>
              <div className="relative">
                <input id="sac-register-confirm-password" type={confirmPasswordVisible ? "text" : "password"} autoComplete="new-password" required minLength={12} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputClass + (rtl ? " pl-12" : " pr-12")} />
                <button type="button" onClick={() => setConfirmPasswordVisible((visible) => !visible)} aria-label={confirmPasswordVisible ? translations[language].hidePassword : translations[language].showPassword} aria-pressed={confirmPasswordVisible} aria-controls="sac-register-confirm-password" title={confirmPasswordVisible ? translations[language].hidePassword : translations[language].showPassword} className={"sac-password-toggle flex h-11 w-11 items-center justify-center rounded-lg text-sac-muted transition hover:text-sac-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sac-confirm/40 " + (rtl ? "left-1" : "right-1")}>
                  {confirmPasswordVisible ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
                </button>
              </div>
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
      </div>
    </main>
  );
}


interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function App() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installHelp, setInstallHelp] = useState<"ios" | "android" | null>(null);
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [isAppleDevice, setIsAppleDevice] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [openOffer, setOpenOffer] = useState<"free" | "premium" | null>(null);
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
  const isAdminPage = window.location.pathname === "/administration";
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
    const dismissed = () => { try { return window.sessionStorage.getItem("sac-install-dialog-dismissed") === "1"; } catch { return false; } };
    if (!standalone && (isAppleMobile || isAndroid) && !dismissed()) {
      setInstallHelp(isAppleMobile ? "ios" : "android");
      setInstallDialogOpen(true);
    }

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      if (!dismissed()) { setInstallHelp("android"); setInstallDialogOpen(true); }
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setInstallHelp(null);
      setInstallDialogOpen(false);
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
        setInstallHelp("ios");
      setInstallDialogOpen(true);
      } else {
        setInstallHelp("android");
        setInstallDialogOpen(true);
      }
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === "accepted") { setIsInstalled(true); setInstallDialogOpen(false); }
      else { setInstallHelp("android"); setInstallDialogOpen(true); }
    } catch {
      setInstallPrompt(null);
      setInstallHelp(isAppleDevice ? "ios" : "android");
      setInstallDialogOpen(true);
    }
  };

  if (isLoginPage) return <LoginPage language={language} setLanguage={setLanguage} returnTo={loginReturnTo} />;
  if (isInvitationAcceptancePage) return <InvitationAcceptancePage language={language} setLanguage={setLanguage} />;
  if (isPrivateSpacePage) return <PrivateSpacePage onLogout={() => { window.location.assign("/connexion"); }} />;
  if (isAdminPage) return <AdminDashboard language={language} />;

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
          <a href="/connexion" className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/25 bg-[#2E8B68] px-4 py-2 text-xs font-extrabold text-white shadow-lg shadow-emerald-950/20 hover:bg-[#3FAE7A]">{signInLabel}</a>
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
      {installDialogOpen && installHelp && !isInstalled && (
        <div className="sac-install-overlay fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setInstallDialogOpen(false); try { window.sessionStorage.setItem("sac-install-dialog-dismissed", "1"); } catch {} } }}>
          <section className="sac-install-dialog w-full max-w-md rounded-[1.75rem] p-6 sm:p-7" role="dialog" aria-modal="true" aria-labelledby="sac-install-title">
            <div className="flex items-start justify-between gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#2E8B68]/10 text-[#2E8B68]">{installHelp === "ios" ? <Share2 size={23}/> : <Download size={23}/>}</div>
              <button type="button" onClick={() => { setInstallDialogOpen(false); try { window.sessionStorage.setItem("sac-install-dialog-dismissed", "1"); } catch {} }} aria-label={t.close} className="rounded-full border border-black/10 p-2 text-sac-muted hover:bg-black/5"><X size={18}/></button>
            </div>
            <h2 id="sac-install-title" className="mt-5 text-xl font-black text-sac-ink">{t.installApp}</h2>
            <p className="mt-3 text-sm leading-7 text-sac-muted">{installHelp === "ios" ? t.installIosHelp : t.installAndroidHelp}</p>
            <button type="button" onClick={() => void installApp()} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2E8B68] px-4 text-sm font-extrabold text-white shadow-lg shadow-emerald-900/20 hover:bg-[#3FAE7A]"><Download size={17}/>{t.installApp}</button>
            <button type="button" onClick={() => { setInstallDialogOpen(false); try { window.sessionStorage.setItem("sac-install-dialog-dismissed", "1"); } catch {} }} className="mt-2 min-h-11 w-full rounded-xl px-4 text-sm font-bold text-sac-muted hover:bg-black/5">{t.close}</button>
          </section>
        </div>
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
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-sac-ink">
              <span className="sac-inline-icon inline-flex items-center gap-2"><LockKeyhole size={16} className="text-sac-confirm" />{t.protectedData}</span>
              <span className="sac-inline-icon inline-flex items-center gap-2"><UsersRound size={16} className="text-sac-confirm" />{t.chosenContacts}</span>
            </div>
          </div>

          <div className="sac-hero-art relative mx-auto flex min-h-[28rem] w-full max-w-[38rem] items-center justify-center overflow-hidden rounded-[2.2rem] p-5 sm:min-h-[36rem] sm:p-8">
            <div className="sac-art-orbit sac-art-orbit-one" />
            <div className="sac-art-orbit sac-art-orbit-two" />
            <div className="sac-art-glow" />
            <div className="sac-art-phone relative z-10 w-[min(68%,18rem)] rounded-[2.5rem] p-3">
              <div className="sac-art-phone-screen flex min-h-[25rem] flex-col rounded-[2rem] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black tracking-[.22em] text-white/65">SAC</span>
                  <span className="sac-art-secure inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-bold"><LockKeyhole size={11}/> {language === "fr" ? "PRIVÉ" : language === "en" ? "PRIVATE" : "خاص"}</span>
                </div>
                <div className="my-auto text-center">
                  <div className="sac-art-emblem mx-auto grid h-28 w-28 place-items-center rounded-full">
                    <ShieldCheck size={54} strokeWidth={1.45}/>
                  </div>
                  <p className="mt-7 text-[10px] font-bold uppercase tracking-[.2em] text-white/55">{language === "fr" ? "SÉCURITÉ DE VOS PROCHES" : language === "en" ? "YOUR LOVED ONES' SAFETY" : "سلامة أحبائك"}</p>
                  <p className="mt-2 text-2xl font-semibold leading-tight text-white">{language === "fr" ? "Toujours proches.\nMême à distance." : language === "en" ? "Always close.\nEven from afar." : "دائماً قريبون،\nحتى عن بُعد."}</p>
                </div>
                <div className="sac-art-contact flex items-center gap-3 rounded-2xl p-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><UsersRound size={19}/></span>
                  <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-white">{language === "fr" ? "Cercle de confiance" : language === "en" ? "Trusted circle" : "دائرة الثقة"}</span><span className="mt-1 block text-[10px] text-white/55">{language === "fr" ? "Les personnes qui comptent" : language === "en" ? "The people who matter" : "الأشخاص المهمون"}</span></span>
                  <span className="h-2 w-2 rounded-full bg-[#7ED6A0] shadow-[0_0_12px_#7ED6A0]"/>
                </div>
              </div>
            </div>
            <div className="sac-art-float sac-art-float-top absolute left-5 top-[16%] z-20 flex items-center gap-3 rounded-2xl px-4 py-3 sm:left-8">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#2E8B68]/20 text-[#8BE3B8]"><HeartHandshake size={21}/></span>
              <span><b className="block text-xs text-white">{language === "fr" ? "Un lien de confiance" : language === "en" ? "A trusted connection" : "رابط موثوق"}</b><small className="mt-1 block text-[10px] text-white/55">{language === "fr" ? "Vos proches, votre choix" : language === "en" ? "Your people, your choice" : "أحباؤك، اختيارك"}</small></span>
            </div>
            <div className="sac-art-float sac-art-float-bottom absolute bottom-[14%] right-4 z-20 flex items-center gap-3 rounded-2xl px-4 py-3 sm:right-7">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#2E8B68]/20 text-[#8BE3B8]"><MapPin size={20}/></span>
              <span><b className="block text-xs text-white">{language === "fr" ? "Alerte confidentielle" : language === "en" ? "Private alert" : "تنبيه خاص"}</b><small className="mt-1 block text-[10px] text-white/55">{language === "fr" ? "Uniquement à vos contacts" : language === "en" ? "Only to your contacts" : "لجهات اتصالك فقط"}</small></span>
            </div>
            <span className="sac-art-side-label absolute right-3 top-1/2 hidden -translate-y-1/2 rotate-90 text-[9px] font-black uppercase tracking-[.38em] sm:block">SÉCURITÉ • CONFIANCE • PROXIMITÉ</span>
          </div>
        </section>

        <section className="sac-offers-section relative px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
          <div className="sac-offers-panel relative mx-auto w-full max-w-4xl rounded-[2rem] p-6 sm:p-9">
            <div className="relative">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-sac-primary-strong">{t.offersEyebrow}</p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-sac-ink">{t.offersTitle}</h2>
                  <p className="mt-1 text-sm leading-6 text-sac-muted">{t.offersSubtitle}</p>
                </div>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sac-primary/70 text-sac-primary-strong"><ShieldCheck size={25} /></span>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
                <div className="sac-offer-wrap relative" onMouseEnter={() => setOpenOffer("free")} onMouseLeave={() => setOpenOffer(null)}>
                  <button type="button" aria-expanded={openOffer === "free"} aria-controls="sac-free-offer-details" onFocus={() => setOpenOffer("free")} onClick={() => setOpenOffer("free")} className="sac-offer-card sac-offer-free w-full rounded-2xl p-4 text-left">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-extrabold text-sac-ink">{t.freePlan}</h3>
                      <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-extrabold text-sac-ink">{t.freeLabel}</span>
                    </div>
                    <p className="mt-3 text-3xl font-black tracking-tight text-sac-ink">{t.freePrice}</p>
                    <p className="mt-1 text-sm text-sac-muted">2 {t.contacts}</p>
                  </button>
                  {openOffer === "free" && (
                    <div id="sac-free-offer-details" role="region" aria-label={t.freePlan + " — " + t.offerDetails} className="sac-offer-popover absolute inset-x-0 top-full z-[60] mt-3 rounded-2xl p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-sm font-extrabold text-sac-ink">{t.offerIncluded}</h4>
                        <button type="button" onClick={() => setOpenOffer(null)} aria-label={t.closeOfferDetails} className="sac-offer-close rounded-full px-2 py-1 text-xs font-bold">{t.closeOfferDetails}</button>
                      </div>
                      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-sac-ink">
                        {t.freeOfferDetails.map((detail) => <li key={detail}>{detail}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="sac-offer-wrap relative" onMouseEnter={() => setOpenOffer("premium")} onMouseLeave={() => setOpenOffer(null)}>
                  <button type="button" aria-expanded={openOffer === "premium"} aria-controls="sac-premium-offer-details" onFocus={() => setOpenOffer("premium")} onClick={() => setOpenOffer("premium")} className="sac-offer-card sac-offer-premium w-full rounded-2xl p-4 text-left">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-extrabold text-sac-ink">{t.premiumPlan}</h3>
                      <span className="rounded-full bg-sac-primary-strong px-3 py-1 text-xs font-extrabold text-white">{t.recommendedLabel}</span>
                    </div>
                    <p className="mt-3 text-3xl font-black tracking-tight text-sac-ink">{t.premiumPrice}</p>
                    <p className="mt-1 text-sm text-sac-muted">10 {t.contacts}</p>
                  </button>
                  {openOffer === "premium" && (
                    <div id="sac-premium-offer-details" role="region" aria-label={t.premiumPlan + " — " + t.offerDetails} className="sac-offer-popover absolute inset-x-0 top-full z-[60] mt-3 rounded-2xl p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-sm font-extrabold text-sac-ink">{t.offerIncluded}</h4>
                        <button type="button" onClick={() => setOpenOffer(null)} aria-label={t.closeOfferDetails} className="sac-offer-close rounded-full px-2 py-1 text-xs font-bold">{t.closeOfferDetails}</button>
                      </div>
                      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-sac-ink">
                        {t.premiumOfferDetails.map((detail) => <li key={detail}>{detail}</li>)}
                      </ul>
                      <p className="mt-3 border-t border-sac-primary-strong/15 pt-3 text-xs leading-5 text-sac-muted">{t.premiumPendingDetails}</p>
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-5 text-xs leading-5 text-sac-muted">{t.freeSafety}</p>
            </div>
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
          </div>
        </section>
      </main>

      <footer className="border-t border-white/80 bg-white/45 px-5 py-7 text-center text-xs text-sac-muted backdrop-blur-xl">{t.footer}</footer>
    </div>
  );
}
