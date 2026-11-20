import { LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { useState } from "react";
import PushNotificationSettings from "../../components/PushNotificationSettings";
import { languages, type Language } from "../../i18n/translations";
import { logoutDeviceSession } from "../../services/device/root-enrollment";
import type { ScreenProps } from "../types";
import { Card, Halo, Notice, Sheet } from "../ui";

export default function Settings({ copy, language, setLanguage, onLogout }: ScreenProps & { setLanguage: (l: Language) => void; onLogout: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
        <Card><h2 className="flex items-center gap-2 font-extrabold"><Smartphone size={18} />{copy.settingsDevice}</h2>
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-sac-confirm"><ShieldCheck size={17} />{copy.settingsDeviceOk}</p></Card>
        <PushNotificationSettings copy={copy} />
        <Card className="!bg-sac-sand"><h2 className="font-extrabold">{copy.settingsDevices}</h2><p className="mt-1 text-sm leading-6 text-sac-muted">{copy.settingsDevicesSoon}</p></Card>
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
