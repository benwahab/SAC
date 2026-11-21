import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, Clock3, History, Home, Settings, ShieldCheck, UsersRound } from "lucide-react";
import BrandLogo from "../components/BrandLogo";
import type { PrivateCopy } from "../i18n/translations";
import type { Screen } from "./types";

export function Halo({ title, eyebrow, onBack, backLabel, children, tone = "orange" }: {
  title: string; eyebrow?: string; onBack?: () => void; backLabel?: string; children?: ReactNode; tone?: "orange" | "alert";
}) {
  const bg = tone === "alert" ? "linear-gradient(165deg,#D21E3A 0%,#B5172F 100%)" : "linear-gradient(165deg,#2E8B68 0%,#3FAE7A 58%,#1F5F45 100%)";
  return (
    <header className="relative overflow-hidden px-5 pb-12 pt-5 text-white" style={{ background: bg }}>
      <svg className="pointer-events-none absolute -top-12 end-[-80px] rtl:-scale-x-100" width="320" height="320" viewBox="0 0 320 320" aria-hidden="true">
        <g fill="none" stroke="#fff" strokeWidth="2" opacity=".2"><circle cx="160" cy="160" r="60" /><circle cx="160" cy="160" r="105" /><circle cx="160" cy="160" r="150" /></g>
      </svg>
      <span className="absolute end-5 top-5 z-10 grid h-10 w-20 place-items-center rounded-xl bg-white/95 px-2 shadow-sm"><BrandLogo className="h-6 w-auto" /></span>
      <div className="relative pe-24">
        {onBack && <button type="button" onClick={onBack} className="mb-3 inline-flex min-h-12 items-center gap-2 rounded-full bg-white/15 pe-4 ps-3 text-sm font-bold text-white"><ArrowLeft size={18} className="rtl:rotate-180" />{backLabel}</button>}
        {eyebrow && <p className="text-xs font-bold uppercase tracking-widest text-white/80">{eyebrow}</p>}
        <h1 className="mt-1 text-[1.75rem] font-extrabold leading-tight tracking-tight">{title}</h1>
        {children}
      </div>
    </header>
  );
}

export function Sheet({ children }: { children: ReactNode }) {
  return <div className="relative -mt-6 flex flex-col gap-4 rounded-t-[28px] bg-sac-canvas px-4 pb-36 pt-6">{children}</div>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={"rounded-[20px] border border-[#F0EAE5] bg-white p-4 shadow-card " + className}>{children}</section>;
}

export function Notice({ kind, children }: { kind: "ok" | "error"; children: ReactNode }) {
  return kind === "ok"
    ? <p role="status" className="rounded-2xl border border-sac-confirm/25 bg-sac-confirm/10 p-3 text-sm font-semibold leading-6">{children}</p>
    : <p role="alert" className="rounded-2xl border border-sac-alert/25 bg-sac-alert/5 p-3 text-sm font-semibold leading-6 text-sac-alert">{children}</p>;
}

export function LevelBadge({ level, label }: { level: string; label: string }) {
  const style = level === "critical" ? "bg-sac-alert text-white" : level === "urgent" ? "bg-sac-primary text-white" : "bg-sac-sand text-sac-ink";
  return <span className={"inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-extrabold " + style}>{level !== "preventive" && <AlertTriangle size={15} aria-hidden="true" />}{label}</span>;
}

export function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return active
    ? <span className="inline-flex items-center gap-1.5 rounded-full border border-sac-alert px-2.5 py-1 text-xs font-extrabold text-sac-alert"><Clock3 size={13} aria-hidden="true" />{label}</span>
    : <span className="inline-flex items-center gap-1.5 rounded-full border border-sac-confirm px-2.5 py-1 text-xs font-extrabold text-sac-confirm"><ShieldCheck size={13} aria-hidden="true" />{label}</span>;
}

export function Avatar({ email }: { email: string }) {
  return <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sac-primary/10 text-base font-extrabold text-sac-deep" aria-hidden="true">{email.slice(0, 1).toUpperCase()}</span>;
}

export function ProfileAvatar({ photoUrl, name, size = "md" }: { photoUrl?: string | null; name: string; size?: "sm" | "md" | "lg" }) {
  const dimension = size === "lg" ? "size-24 text-3xl" : size === "sm" ? "size-10 text-sm" : "size-12 text-base";
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [photoUrl]);
  return photoUrl && !failed
    ? <img src={photoUrl} alt="" onError={() => setFailed(true)} className={dimension + " shrink-0 rounded-full border border-white bg-sac-sand object-cover shadow-sm"} />
    : <span className={dimension + " flex shrink-0 items-center justify-center rounded-full bg-sac-primary/10 font-extrabold text-sac-deep"} aria-hidden="true">{(name.trim().slice(0, 1) || "?").toUpperCase()}</span>;
}

export const fieldClass = "min-h-12 w-full rounded-[14px] border border-[#E8DCD3] bg-white px-4 text-base text-sac-ink outline-none focus:border-sac-primary focus:ring-4 focus:ring-sac-primary/15";
export const primaryBtn = "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-sac-primary px-5 text-base font-extrabold text-white shadow-orange disabled:opacity-50 disabled:shadow-none";
export const ghostBtn = "inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] border border-sac-primary/30 bg-white px-4 text-sm font-bold text-sac-ember disabled:opacity-50";

export function BottomNav({ current, copy, go, securityKeyConfigured = true }: { current: Screen["name"]; copy: PrivateCopy; go: (screen: Screen) => void; securityKeyConfigured?: boolean }) {
  const item = (name: Screen["name"], label: string, icon: ReactNode, badge?: number) => (
    <button type="button" onClick={() => go({ name } as Screen)} aria-current={current === name ? "page" : undefined}
      aria-label={badge ? `${label} — ${copy.securityKeyBadgeLabel}` : undefined}
      className={"flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-bold " + (current === name ? "text-sac-primary" : "text-sac-muted")}>
      <span className="relative">{icon}{badge ? <span className="absolute -end-2 -top-1 flex size-4 items-center justify-center rounded-full bg-sac-alert text-[9px] font-black text-white">{badge}</span> : null}</span>
      <span>{label}</span>
    </button>
  );
  return (
    <nav aria-label={copy.navLabel} className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-lg">
      <div className="grid h-[72px] grid-cols-5 items-center rounded-[28px] border border-white/80 bg-white/90 px-1 shadow-nav backdrop-blur-xl">
        {item("home", copy.navHome, <Home size={22} />)}
        {item("contacts", copy.navContacts, <UsersRound size={22} />)}
        <button type="button" onClick={() => go({ name: "sos" })} aria-label={copy.navSos} aria-current={current === "sos" ? "page" : undefined}
          className="sac-pulse relative -mt-9 mx-auto flex size-[68px] items-center justify-center rounded-full border-4 border-white bg-sac-alert text-base font-black tracking-wide text-white shadow-sos">
          {copy.navSos}
        </button>
        {item("history", copy.navHistory, <History size={22} />)}
        {item("settings", copy.navSettings, <Settings size={22} />, securityKeyConfigured ? undefined : 1)}
      </div>
    </nav>
  );
}
