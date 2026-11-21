import { useCallback, useEffect, useState } from "react";
import { isLanguage, privateTranslations, type Language } from "./i18n/translations";
import { hashToScreen, screenToHash, type Screen } from "./private/types";
import { usePrivateData } from "./private/usePrivateData";
import { BottomNav } from "./private/ui";
import Account from "./private/screens/Account";
import AlertContacts from "./private/screens/AlertContacts";
import AlertScreen from "./private/screens/AlertScreen";
import CloseContact from "./private/screens/CloseContact";
import Contacts from "./private/screens/Contacts";
import Dashboard from "./private/screens/Dashboard";
import HistoryScreen from "./private/screens/History";
import Invite from "./private/screens/Invite";
import Reminders from "./private/screens/Reminders";
import Settings from "./private/screens/Settings";
import Sos from "./private/screens/Sos";

type Props = { onLogout: () => void };

function initialLanguage(): Language {
  try { const stored = window.localStorage.getItem("sac-language"); if (isLanguage(stored)) return stored; } catch { /* stockage indisponible */ }
  return "fr";
}

export default function PrivateSpacePage({ onLogout }: Props) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const [screen, setScreen] = useState<Screen>(() => hashToScreen(window.location.hash));
  const [notice, setNotice] = useState("");
  const copy = privateTranslations[language];
  const data = usePrivateData(copy, onLogout);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);
  useEffect(() => {
    const onHash = () => setScreen(hashToScreen(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try { window.localStorage.setItem("sac-language", next); } catch { /* langue valable pour la session */ }
  }, []);
  const go = useCallback((next: Screen) => {
    setScreen(next);
    window.location.hash = screenToHash(next);
    window.scrollTo({ top: 0 });
  }, []);
  const changeScreen = useCallback((next: Screen) => { setNotice(""); go(next); }, [go]);
  // Un message de confirmation survit uniquement à la navigation déclenchée par l'écran qui l'a émis.
  const shared = { copy, language, go: (next: Screen) => go(next), notice, setNotice };
  const nav = { ...shared, go: changeScreen };

  let body;
  switch (screen.name) {
    case "contacts": body = <Contacts {...nav} closeContacts={data.closeContacts} invitations={data.invitations} socialLoading={data.socialLoading} socialError={data.socialError} refreshSocial={data.refreshSocial} />; break;
    case "contact": body = <CloseContact {...nav} id={screen.id} refreshSocial={data.refreshSocial} />; break;
    case "invite": body = <Invite {...nav} refreshSocial={data.refreshSocial} />; break;
    case "account": body = <Account {...nav} ownProfile={data.ownProfile} setOwnProfile={data.setOwnProfile} refreshProfile={data.refreshProfile} onLogout={onLogout} />; break;
    case "alertContacts": body = <AlertContacts {...nav} contacts={data.contacts} setContacts={data.setContacts} loading={data.loading} error={data.error} refresh={data.refresh} />; break;
    case "sos": body = <Sos {...shared} contacts={data.contacts} refresh={data.refresh} />; break;
    case "history": body = <HistoryScreen {...nav} alerts={data.alerts} loading={data.loading} error={data.error} />; break;
    case "reminders": body = <Reminders {...nav} />; break;
    case "settings": body = <Settings {...nav} setLanguage={setLanguage} onLogout={onLogout} securityKeyConfigured={data.securityKeyConfigured} onSecurityKeyConfigured={() => { void data.refresh(); }} />; break;
    case "alert": body = <AlertScreen {...nav} notice={notice} id={screen.id} identity={data.identity} alerts={data.alerts} loading={data.loading} refresh={data.refresh} />; break;
    default: body = <Dashboard {...nav} contacts={data.contacts} closeContacts={data.closeContacts} ownProfile={data.ownProfile} alerts={data.alerts} loading={data.loading} error={data.error} securityKeyConfigured={data.securityKeyConfigured} />;
  }

  return (
    <div className="sac-app" dir={language === "ar" ? "rtl" : "ltr"}>
      <main className="mx-auto min-h-svh max-w-lg bg-sac-canvas">{body}</main>
      <BottomNav current={screen.name === "invite" || screen.name === "contact" ? "contacts" : screen.name === "alert" ? "history" : screen.name === "account" || screen.name === "alertContacts" ? "settings" : screen.name} copy={copy} go={changeScreen} securityKeyConfigured={data.securityKeyConfigured} />
    </div>
  );
}
