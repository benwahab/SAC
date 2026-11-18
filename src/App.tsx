import { useEffect, useState } from "react";
import { ArrowUpRight, HeartHandshake, LockKeyhole, MapPin, ShieldCheck, UsersRound, Wifi } from "lucide-react";
import { isLanguage, languages, translations, type Language } from "./i18n/translations";

type HealthState = "checking" | "connected" | "unavailable";

export default function App() {
  const [health, setHealth] = useState<HealthState>("checking");
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = window.localStorage.getItem("sac-language");
      return isLanguage(saved) ? saved : "fr";
    } catch {
      return "fr";
    }
  });
  const t = translations[language];
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
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("API unavailable");
        const payload: { ok?: boolean; database?: string } = await response.json();
        setHealth(payload.ok && payload.database === "connected" ? "connected" : "unavailable");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setHealth("unavailable");
      });
    return () => controller.abort();
  }, []);

  const statusDot =
    health === "connected" ? "bg-sac-confirm" :
    health === "unavailable" ? "bg-sac-alert" : "animate-pulse bg-sac-primary-strong";

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
        <div className="flex items-center gap-3">
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
                      {health === "checking" && t.checking}
                      {health === "connected" && t.connected}
                      {health === "unavailable" && t.unavailable}
                    </p>
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
                  <span className="text-sm font-extrabold text-sac-ink">5 000 FCFA {t.perMonth}</span>
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
