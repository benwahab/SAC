/** Modèle métier partagé du domaine SAC.
 * Les valeurs ci-dessous décrivent les décisions validées ; aucune règle de persistance
 * ou de rétention n'est déduite de ces types.
 */

export const ALERT_CATEGORIES = [
  {
    id: "personal_danger",
    label: "Danger personnel",
    description: "Menace, agression, intimidation, personne suivie ou situation inquiétante.",
  },
  {
    id: "accident",
    label: "Accident",
    description: "Accident de circulation, chute ou autre accident.",
  },
  {
    id: "home_intrusion",
    label: "Intrusion au domicile",
    description: "Entrée non autorisée ou tentative d'intrusion.",
  },
  {
    id: "medical_emergency",
    label: "Urgence médicale",
    description: "Malaise ou besoin d'assistance médicale.",
  },
  {
    id: "lost_or_disoriented_person",
    label: "Personne perdue ou désorientée",
    description: "Difficulté à retrouver son chemin ou à rejoindre un lieu sûr.",
  },
  {
    id: "custom_alert",
    label: "Alerte personnalisée",
    description: "Situation décrite librement par l'utilisateur.",
  },
] as const;

export type AlertCategory = (typeof ALERT_CATEGORIES)[number]["id"];

export const ALERT_LEVELS = [
  { id: "preventive", label: "Préventif" },
  { id: "urgent", label: "Urgent" },
  { id: "critical", label: "Critique" },
] as const;

export type AlertLevel = (typeof ALERT_LEVELS)[number]["id"];

export type AlertStatus =
  | "active"
  | "closed_by_author"
  | "cancelled_before_dispatch";

export type ContactInvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "revoked";

export type ContactResponseAction =
  | "acknowledged"
  | "volunteered"
  | "withdrawn";

export type LocationShareDuration =
  | "one_time"
  | "15_minutes"
  | "30_minutes"
  | "1_hour"
  | "until_closure";

export const LOCATION_SHARE_OPTIONS: ReadonlyArray<{
  id: LocationShareDuration;
  durationMinutes: number | null;
}> = [
  { id: "one_time", durationMinutes: 0 },
  { id: "15_minutes", durationMinutes: 15 },
  { id: "30_minutes", durationMinutes: 30 },
  { id: "1_hour", durationMinutes: 60 },
  { id: "until_closure", durationMinutes: null },
];

export type SubscriptionPlan = "free" | "premium";

export const CONTACT_LIMITS: Readonly<Record<SubscriptionPlan, number>> = {
  free: 2,
  premium: 10,
};

export const PREMIUM_MONTHLY_PRICE_FCFA = 5_000;

export interface AlertRecipientSnapshot {
  readonly contactUserId: string;
  readonly selectedAt: string;
}

export interface LocationConsent {
  readonly granted: boolean;
  readonly duration: LocationShareDuration;
}

export interface LocationSnapshot {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number | null;
  readonly capturedAt: string;
}
