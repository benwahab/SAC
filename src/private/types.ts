import type { Language, PrivateCopy } from "../i18n/translations";

export type Contact = { accountId: string; email: string; createdAt: number };
export type TrustedByContact = { ownerAccountId: string; email: string; createdAt: number };
export type PrivacySettings = {
  searchByName: boolean; searchByEmail: boolean;
  photoVisibleInSearch: boolean; photoVisibleToContacts: boolean;
};
export type OwnProfile = {
  accountId: string; firstName: string; lastName: string;
  email: string; phone: string; phoneVerified: boolean;
  photoUrl: string | null; photoVersion: number; privacy: PrivacySettings;
};
export type RelationPermission = "profile_photo" | "contact_details";
export type CloseContact = {
  accountId: string; firstName: string; lastName: string; photoUrl: string | null;
  connectedAt: number;
  permissionsToMe: { profilePhoto: boolean; contactDetails: boolean };
  permissionsFromMe: { profilePhoto: boolean; contactDetails: boolean };
  contactDetails: { email: string | null; phone: string | null; phoneVerified: boolean } | null;
};
export type ProximityInvitation = {
  id: string; direction: "sent" | "received";
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  accountId: string; firstName: string; lastName: string; photoUrl: string | null;
  createdAt: number; expiresAt: number; decidedAt: number | null;
};
export type SosAlert = {
  id: string; category: string; level: string; description: string | null; status: string;
  createdAt: number; closedAt: number | null; closureReason: string | null;
  participantRole: "author" | "recipient";
};
export type Screen =
  | { name: "home" } | { name: "contacts" } | { name: "invite" } | { name: "sos" }
  | { name: "history" } | { name: "settings" } | { name: "reminders" } | { name: "alert"; id: string }
  | { name: "account" } | { name: "contact"; id: string } | { name: "alertContacts" };

export type AdminAccess = {
  canAccess: boolean;
  role: "super_admin" | "delegate" | null;
  activeMissions: number;
};

export type ScreenProps = {
  copy: PrivateCopy; language: Language;
  go: (screen: Screen) => void;
  notice: string; setNotice: (value: string) => void;
};

export function screenToHash(screen: Screen): string {
  switch (screen.name) {
    case "home": return "#/";
    case "alert": return "#/alerte/" + encodeURIComponent(screen.id);
    case "contacts": return "#/proches";
    case "invite": return "#/proches/inviter";
    case "sos": return "#/sos";
    case "history": return "#/historique";
    case "settings": return "#/reglages";
    case "reminders": return "#/rappels";
    case "account": return "#/compte";
    case "contact": return "#/proches/" + encodeURIComponent(screen.id);
    case "alertContacts": return "#/reglages/contacts-alerte";
  }
}

export function hashToScreen(hash: string): Screen {
  if (hash.startsWith("#/alerte/")) {
    try { const id = decodeURIComponent(hash.slice(9)); if (id) return { name: "alert", id }; } catch { /* hash invalide */ }
    return { name: "home" };
  }
  if (hash.startsWith("#/proches/")) {
    try {
      const id = decodeURIComponent(hash.slice(10));
      if (id && id !== "inviter") return { name: "contact", id };
    } catch { /* hash invalide */ }
  }
  switch (hash) {
    case "#/proches": return { name: "contacts" };
    case "#/compte": return { name: "account" };
    case "#/reglages/contacts-alerte": return { name: "alertContacts" };
    case "#/proches/inviter": return { name: "invite" };
    case "#/sos": return { name: "sos" };
    case "#/historique": return { name: "history" };
    case "#/reglages": return { name: "settings" };
    case "#/rappels": return { name: "reminders" };
    default: return { name: "home" };
  }
}

export function formatDate(value: number | string, language: Language, locale: string): string {
  void language;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}
