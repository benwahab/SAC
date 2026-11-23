import { useEffect, useState } from "react";
import { KeyRound, LayoutDashboard, LogOut, ShieldCheck, Smartphone, MonitorSmartphone, UserRound, UsersRound } from "lucide-react";
import PushNotificationSettings from "../../components/PushNotificationSettings";
import { fillCopy, languages, type Language } from "../../i18n/translations";
import { completeRootEnrollment, logoutDeviceSession, requestRootEnrollmentFromSession } from "../../services/device/root-enrollment";
import type { AdminAccess, ScreenProps } from "../types";
import { Card, Halo, Notice, Sheet } from "../ui";

type SessionInfo = {
  id: string;
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
  current: boolean;
};

export default function Settings({ copy, language, go, setLanguage, onLogout, securityKeyConfigured, onSecurityKeyConfigured, adminAccess }: ScreenProps & { setLanguage: (l: Language) => void; onLogout: () => void; securityKeyConfigured: boolean; onSecurityKeyConfigured: () => void; adminAccess: AdminAccess | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState("");
  const [sessionsNotice, setSessionsNotice] = useState("");
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [securityKeyBusy, setSecurityKeyBusy] = useState(false);
  const [securityKeyError, setSecurityKeyError] = useState("");
  const [securityKeyNotice, setSecurityKeyNotice] = useState("");
  const locale = language === "ar" ? "ar" : language === "en" ? "en-GB" : "fr-FR";

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/auth/sessions", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = await response.json() as { sessions?: SessionInfo[] };
        if (!response.ok || !Array.isArray(payload.sessions)) throw new Error(copy.settingsSessionsError);
        if (active) setSessions(payload.sessions);
      } catch (reason) {
        if (active) setSessionsError(reason instanceof Error ? reason.message : copy.settingsSessionsError);
      } finally {
        if (active) setSessionsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [copy.settingsSessionsError]);

  async function revokeSession(sessionId: string) {
    if (revokingSessionId || !window.confirm(copy.settingsSessionsRevokeConfirm)) return;
    setRevokingSessionId(sessionId);
    setSessionsError("");
    setSessionsNotice("");
    try {
      const response = await fetch("/api/auth/revoke-session", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const payload = await response.json() as { revoked?: boolean };
      if (!response.ok || payload.revoked !== true) throw new Error(copy.settingsSessionsError);
      setSessions((current) => current.filter((item) => item.id !== sessionId));
      setSessionsNotice(copy.settingsSessionsRevoked);
    } catch (reason) {
      setSessionsError(reason instanceof Error ? reason.message : copy.settingsSessionsError);
    } finally {
      setRevokingSessionId(null);
    }
  }

  function securityKeyErrorMessage(reason: unknown): string {
    if (reason instanceof Error) {
      if (reason.message === "webauthn_not_supported" || reason.message.includes("ne prend pas en charge")) return copy.securityKeyUnsupported;
      if (reason.message.includes("annulée") || reason.message.includes("refusée")) return copy.securityKeyCancelled;
    }
    return copy.securityKeyError;
  }

  async function configureSecurityKey() {
    if (securityKeyBusy) return;
    setSecurityKeyBusy(true);
    setSecurityKeyError("");
    setSecurityKeyNotice("");
    try {
      const ceremony = await requestRootEnrollmentFromSession();
      await completeRootEnrollment(ceremony);
      setSecurityKeyNotice(copy.securityKeySuccess);
      onSecurityKeyConfigured();
    } catch (reason) {
      setSecurityKeyError(securityKeyErrorMessage(reason));
    } finally {
      setSecurityKeyBusy(false);
    }
  }

  async function signOut() {
    if (busy) return;
    setBusy(true); setError("");
    try { if (!(await logoutDeviceSession())) throw new Error(copy.logoutError); onLogout(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : copy.logoutError); } finally { setBusy(false); }
  }

  return (
    <>
      <Halo title={copy.settingsTitle} eyebrow={copy.privateSpace} />
      <Sheet>
        <Card>
          <h2 className="flex items-center gap-2 font-extrabold"><UserRound size={18} />{copy.settingsAccountTitle}</h2>
          <p className="mt-1 text-sm leading-6 text-sac-muted">{copy.settingsAccountText}</p>
          <button type="button" onClick={() => go({ name: "account" })} className="mt-3 inline-flex min-h-12 items-center justify-center rounded-[14px] bg-sac-primary px-4 text-sm font-extrabold text-white">{copy.settingsAccountOpen}</button>
        </Card>
        {adminAccess?.canAccess && (
          <Card className="!border-sac-primary/30 !bg-sac-primary/5">
            <h2 className="flex items-center gap-2 font-extrabold"><LayoutDashboard size={18} />{copy.adminSpaceTitle}</h2>
            <p className="mt-1 text-sm leading-6 text-sac-muted">{adminAccess.role === "super_admin" ? copy.adminSpaceSuperText : copy.adminSpaceDelegateText}</p>
            {adminAccess.role === "delegate" && <p className="mt-2 text-xs font-bold text-sac-primary-strong">{fillCopy(copy.adminSpaceMissionCount, { n: adminAccess.activeMissions })}</p>}
            <a href="/administration" className="mt-3 inline-flex min-h-12 items-center justify-center rounded-[14px] bg-sac-primary px-4 text-sm font-extrabold text-white">{copy.adminSpaceOpen}</a>
          </Card>
        )}
        <Card>
          <h2 className="flex items-center gap-2 font-extrabold"><UsersRound size={18} />{copy.settingsAlertContactsTitle}</h2>
          <p className="mt-1 text-sm leading-6 text-sac-muted">{copy.settingsAlertContactsText}</p>
          <button type="button" onClick={() => go({ name: "alertContacts" })} className="mt-3 inline-flex min-h-12 items-center justify-center rounded-[14px] border border-sac-primary/30 bg-white px-4 text-sm font-bold text-sac-ember">{copy.settingsAlertContactsOpen}</button>
        </Card>
        <Card className={securityKeyConfigured ? "" : "!border-sac-alert/30 !bg-sac-alert/5"}>
          <h2 className="flex items-center gap-2 font-extrabold"><KeyRound size={18} />{copy.securityKeyTitle}</h2>
          {securityKeyConfigured ? (
            <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-sac-confirm"><ShieldCheck size={17} />{copy.securityKeyConfigured}</p>
          ) : (
            <>
              <p className="mt-2 text-sm leading-6 text-sac-muted">{copy.securityKeyWhy}</p>
              <button type="button" disabled={securityKeyBusy} onClick={() => void configureSecurityKey()}
                className="mt-3 inline-flex min-h-12 items-center justify-center rounded-[14px] bg-sac-primary px-4 text-sm font-extrabold text-white disabled:opacity-50">
                {securityKeyBusy ? copy.securityKeyConfiguring : copy.securityKeyConfigure}
              </button>
              {securityKeyError && <p role="alert" className="mt-3 text-sm font-semibold text-sac-alert">{securityKeyError}</p>}
            </>
          )}
          {securityKeyNotice && <p role="status" className="mt-3 text-sm font-semibold text-sac-confirm">{securityKeyNotice}</p>}
        </Card>
        <Card><h2 className="flex items-center gap-2 font-extrabold"><Smartphone size={18} />{copy.settingsDevice}</h2>
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-sac-confirm"><ShieldCheck size={17} />{copy.settingsDeviceOk}</p></Card>
        <PushNotificationSettings copy={copy} />
        <Card className="!bg-sac-sand">
          <h2 className="flex items-center gap-2 font-extrabold"><MonitorSmartphone size={18} />{copy.settingsSessionsTitle}</h2>
          <p className="mt-1 text-sm leading-6 text-sac-muted">{copy.settingsSessionsIntro}</p>
          {sessionsLoading ? (
            <p className="mt-3 text-sm text-sac-muted">{copy.settingsSessionsLoading}</p>
          ) : sessionsError ? (
            <p role="alert" className="mt-3 text-sm text-sac-alert">{sessionsError}</p>
          ) : sessions.length === 0 ? (
            <p className="mt-3 text-sm text-sac-muted">{copy.settingsSessionsEmpty}</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {sessions.map((session) => (
                <li key={session.id} className="rounded-2xl border border-white/90 bg-white/80 p-3">
                  <p className="font-extrabold">{session.current ? copy.settingsSessionsCurrent : copy.settingsSessionsOther}</p>
                  <dl className="mt-2 space-y-1 text-xs leading-5 text-sac-muted">
                    <div><dt className="inline font-semibold">{copy.settingsSessionsCreated}: </dt><dd className="inline">{new Date(session.createdAt).toLocaleString(locale)}</dd></div>
                    <div><dt className="inline font-semibold">{copy.settingsSessionsLastActive}: </dt><dd className="inline">{new Date(session.lastActivityAt).toLocaleString(locale)}</dd></div>
                    <div><dt className="inline font-semibold">{copy.settingsSessionsExpires}: </dt><dd className="inline">{new Date(session.expiresAt).toLocaleString(locale)}</dd></div>
                  </dl>
                  {!session.current && (
                    <button type="button" disabled={revokingSessionId !== null} onClick={() => void revokeSession(session.id)}
                      className="mt-3 min-h-11 rounded-xl border border-sac-alert/30 bg-sac-alert/5 px-3 text-sm font-bold text-sac-alert disabled:opacity-50">
                      {revokingSessionId === session.id ? copy.pushWait : copy.settingsSessionsRevoke}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {sessionsNotice && <p role="status" className="mt-3 text-sm font-semibold text-sac-confirm">{sessionsNotice}</p>}
          <p className="mt-3 border-t border-white/80 pt-3 text-xs leading-5 text-sac-muted">{copy.settingsSecondaryDeviceNote}</p>
        </Card>
        <Card><h2 className="font-extrabold">{copy.settingsLanguage}</h2>
          <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label={copy.settingsLanguage}>{languages.map((l) => (
            <button key={l.code} type="button" aria-pressed={language === l.code} onClick={() => setLanguage(l.code)} className={"min-h-12 rounded-[14px] border text-sm font-extrabold " + (language === l.code ? "border-sac-primary bg-sac-primary text-white" : "border-[#E8DCD3] bg-white")}>{l.label}</button>))}</div></Card>
        <Card><h2 className="font-extrabold">{copy.settingsPrivacy}</h2><p className="mt-1 text-sm leading-6 text-sac-muted">{copy.settingsPrivacyText}</p></Card>
        {error && <Notice kind="error">{error}</Notice>}
        <button type="button" onClick={() => void signOut()} disabled={busy} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[18px] border-2 border-sac-alert bg-white px-5 font-extrabold text-sac-alert disabled:opacity-50"><LogOut size={19} />{busy ? copy.settingsLoggingOut : copy.settingsLogout}</button>
      </Sheet>
    </>
  );
}
