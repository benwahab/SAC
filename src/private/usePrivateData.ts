import { useCallback, useEffect, useState } from "react";
import { getDeviceSession } from "../services/device/root-enrollment";
import type { PrivateCopy } from "../i18n/translations";
import type { AdminAccess, CloseContact, Contact, OwnProfile, ProximityInvitation, SosAlert } from "./types";

export function usePrivateData(copy: PrivateCopy, onLogout: () => void) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [closeContacts, setCloseContacts] = useState<CloseContact[]>([]);
  const [invitations, setInvitations] = useState<ProximityInvitation[]>([]);
  const [ownProfile, setOwnProfile] = useState<OwnProfile | null>(null);
  const [alerts, setAlerts] = useState<SosAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [socialLoading, setSocialLoading] = useState(true);
  const [error, setError] = useState("");
  const [socialError, setSocialError] = useState("");
  const [identity, setIdentity] = useState<{ accountId: string; deviceId: string } | null>(null);
  const [securityKeyConfigured, setSecurityKeyConfigured] = useState(true);
  const [adminAccess, setAdminAccess] = useState<AdminAccess | null>(null);

  const refreshProfile = useCallback(async () => {
    const response = await fetch("/api/account/profile", { credentials: "same-origin", cache: "no-store" });
    const payload = await response.json() as { profile?: OwnProfile };
    if (!response.ok || !payload.profile) {
      if (response.status === 401) onLogout();
      throw new Error(copy.profileLoadError);
    }
    setOwnProfile(payload.profile);
  }, [copy.profileLoadError, onLogout]);

  const refreshSocial = useCallback(async () => {
    setSocialLoading(true); setSocialError("");
    try {
      const [contactsResponse, invitationsResponse] = await Promise.all([
        fetch("/api/proximity/contacts", { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/proximity/invitations", { credentials: "same-origin", cache: "no-store" }),
      ]);
      if (contactsResponse.status === 401 || invitationsResponse.status === 401) { onLogout(); return; }
      const contactsPayload = await contactsResponse.json() as { contacts?: CloseContact[] };
      const invitationsPayload = await invitationsResponse.json() as { invitations?: ProximityInvitation[] };
      if (!contactsResponse.ok || !Array.isArray(contactsPayload.contacts) ||
          !invitationsResponse.ok || !Array.isArray(invitationsPayload.invitations)) {
        throw new Error(copy.socialLoadError);
      }
      setCloseContacts(contactsPayload.contacts);
      setInvitations(invitationsPayload.invitations);
    } catch (reason) {
      setSocialError(reason instanceof Error ? reason.message : copy.socialLoadError);
    } finally { setSocialLoading(false); }
  }, [copy.socialLoadError, onLogout]);

  const refreshAdminAccess = useCallback(async () => {
    const response = await fetch("/api/admin/access", { credentials: "same-origin", cache: "no-store" });
    if (response.status === 401) { onLogout(); return; }
    if (!response.ok) { setAdminAccess(null); return; }
    const accessPayload = await response.json() as Partial<AdminAccess>;
    setAdminAccess(accessPayload.canAccess === true && (accessPayload.role === "super_admin" || accessPayload.role === "delegate")
      ? { canAccess: true, role: accessPayload.role, activeMissions: Number.isSafeInteger(accessPayload.activeMissions) ? accessPayload.activeMissions! : 0 }
      : null);
  }, [onLogout]);

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const session = await getDeviceSession();
      if (!session.authenticated || !session.accountId || !session.deviceId) { onLogout(); return; }
      setIdentity({ accountId: session.accountId, deviceId: session.deviceId });
      setSecurityKeyConfigured(session.securityKeyConfigured !== false);
      const [response, alertsResponse, profileResponse] = await Promise.all([
        fetch("/api/contacts", { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/alerts", { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/account/profile", { credentials: "same-origin", cache: "no-store" }),
        refreshAdminAccess(),
      ]);
      const payload = await response.json() as { contacts?: Contact[] };
      if (!response.ok || !Array.isArray(payload.contacts)) {
        if (response.status === 401) onLogout();
        throw new Error(copy.loadContactsError);
      }
      setContacts(payload.contacts);
      const profilePayload = await profileResponse.json() as { profile?: OwnProfile };
      if (profileResponse.ok && profilePayload.profile) setOwnProfile(profilePayload.profile);
      else if (profileResponse.status === 401) onLogout();
      const alertsPayload = await alertsResponse.json() as { alerts?: SosAlert[] };
      if (alertsResponse.ok && Array.isArray(alertsPayload.alerts)) setAlerts(alertsPayload.alerts);
      else setError(copy.alertsLoadError);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.errorGeneric);
    } finally { setLoading(false); }
    await refreshSocial();
  }, [onLogout, copy, refreshAdminAccess, refreshSocial]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") void refreshAdminAccess();
    };
    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => {
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [refreshAdminAccess]);
  return {
    contacts, setContacts, closeContacts, invitations, ownProfile, setOwnProfile,
    alerts, loading, socialLoading, error, socialError, refresh, refreshProfile, refreshSocial,
    identity, securityKeyConfigured, adminAccess,
  };
}
