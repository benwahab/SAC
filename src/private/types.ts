import type { Language, PrivateCopy } from "../i18n/translations";

export type Contact = { accountId: string; email: string; createdAt: number };
export type SosAlert = {
  id: string; category: string; level: string; description: string | null; status: string;
  createdAt: number; closedAt: number | null; closureReason: string | null;
  participantRole: "author" | "recipient";
};
export type Screen =
  | { name: "home" } | { name: "contacts" } | { name: "invite" } | { name: "sos" }
  | { name: "history" } | { name: "settings" } | { name: "alert"; id: string };

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
  }
}

export function hashToScreen(hash: string): Screen {
  if (hash.startsWith("#/alerte/")) {
    try { const id = decodeURIComponent(hash.slice(9)); if (id) return { name: "alert", id }; } catch { /* hash invalide */ }
    return { name: "home" };
  }
  switch (hash) {
    case "#/proches": return { name: "contacts" };
    case "#/proches/inviter": return { name: "invite" };
    case "#/sos": return { name: "sos" };
    case "#/historique": return { name: "history" };
    case "#/reglages": return { name: "settings" };
    default: return { name: "home" };
  }
}

export function formatDate(value: number | string, language: Language, locale: string): string {
  void language;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}
