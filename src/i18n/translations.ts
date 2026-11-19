export type Language = "fr" | "en" | "ar";

export interface Translation {
  appName: string; tagline: string; privateApp: string; languageLabel: string;
  trustEyebrow: string; heroTitle: string; heroSecond: string; heroThird: string;
  heroDescription: string; sosLabel: string; preparing: string; sosStatus: string;
  protectedData: string; chosenContacts: string; personalSpace: string; accompaniment: string;
  serverStatus: string; checking: string; connected: string; unavailable: string; offline: string;
  freePlan: string; premiumPlan: string; contacts: string; perMonth: string; freeSafety: string;
  principles: string; principlesTitle: string; contactTitle: string; contactDescription: string;
  locationTitle: string; locationDescription: string; helpTitle: string; helpDescription: string;
  responsibleEyebrow: string; emergencyTitle: string; emergencyDescription: string;
  followProject: string; footer: string;
}

export const languages: { code: Language; label: string; nativeLabel: string }[] = [
  { code: "fr", label: "Français", nativeLabel: "FR" },
  { code: "en", label: "English", nativeLabel: "EN" },
  { code: "ar", label: "العربية", nativeLabel: "ع" },
];

export function isLanguage(value: string | null): value is Language {
  return value === "fr" || value === "en" || value === "ar";
}

export const translations: Record<Language, Translation> = {
  fr: {
    appName: "Sécurité · Alerte · Citoyenne", tagline: "Votre sécurité. Vos proches. Votre décision.",
    privateApp: "Application privée", languageLabel: "Langue",
    trustEyebrow: "Votre cercle de confiance, toujours au centre",
    heroTitle: "Votre sécurité.", heroSecond: "Vos proches.", heroThird: "Votre décision.",
    heroDescription: "SAC vous aidera à prévenir les personnes qui comptent pour vous en cas de danger et à sécuriser vos déplacements, tout en gardant le contrôle de vos informations.",
    sosLabel: "SOS", preparing: "En préparation",
    sosStatus: "Le déclenchement sera activé après validation des envois réels et des protections.",
    protectedData: "Données protégées", chosenContacts: "Contacts choisis",
    personalSpace: "Espace personnel", accompaniment: "SAC vous accompagne",
    serverStatus: "État du serveur", checking: "Vérification de la connexion…",
    connected: "API et base de données accessibles", unavailable: "Connexion serveur à vérifier", offline: "Aucune connexion Internet détectée",
    freePlan: "Formule gratuite", premiumPlan: "Formule Premium", contacts: "contacts",
    perMonth: "/ mois", freeSafety: "Les fonctions de sécurité essentielles, dont le SOS, resteront accessibles gratuitement.",
    principles: "Les principes SAC", principlesTitle: "La confiance commence par le contrôle.",
    contactTitle: "Vos proches, votre choix",
    contactDescription: "Vous choisissez les personnes de confiance qui peuvent recevoir vos alertes. Aucun fil public, aucun partage automatique avec une institution.",
    locationTitle: "Une position sous contrôle",
    locationDescription: "La localisation ne sera partagée qu'avec votre autorisation. Une position ancienne sera toujours signalée comme telle.",
    helpTitle: "Une aide qui s'organise",
    helpDescription: "Vos proches pourront accuser réception ou proposer leur aide. Vous gardez le contrôle de la clôture de votre alerte.",
    responsibleEyebrow: "Une application responsable",
    emergencyTitle: "SAC ne remplace pas les services d'urgence.",
    emergencyDescription: "SAC est conçu pour prévenir vos proches de confiance. Il ne garantit pas une intervention des secours.",
    followProject: "Suivre le projet", footer: "SAC — Sécurité, Alerte, Citoyenne · Votre sécurité, votre décision."
  },
  en: {
    appName: "Safety · Alert · Citizen", tagline: "Your safety. Your loved ones. Your decision.",
    privateApp: "Private app", languageLabel: "Language",
    trustEyebrow: "Your trusted circle always comes first",
    heroTitle: "Your safety.", heroSecond: "Your loved ones.", heroThird: "Your decision.",
    heroDescription: "SAC helps you notify the people who matter when you are in danger and make your journeys safer, while keeping control of your information.",
    sosLabel: "SOS", preparing: "In preparation",
    sosStatus: "SOS will be enabled only after real delivery and security protections have been validated.",
    protectedData: "Protected data", chosenContacts: "Chosen contacts",
    personalSpace: "Personal space", accompaniment: "SAC is here for you",
    serverStatus: "Server status", checking: "Checking connection…",
    connected: "API and database are reachable", unavailable: "Server connection needs checking", offline: "No Internet connection detected",
    freePlan: "Free plan", premiumPlan: "Premium plan", contacts: "contacts",
    perMonth: "/ month", freeSafety: "Essential safety features, including SOS, will remain free.",
    principles: "SAC principles", principlesTitle: "Trust begins with control.",
    contactTitle: "Your loved ones, your choice",
    contactDescription: "You choose the trusted people who can receive your alerts. No public feed and no automatic sharing with institutions.",
    locationTitle: "Location under your control",
    locationDescription: "Your location is shared only with your permission. Older positions are always identified as such.",
    helpTitle: "Help that comes together",
    helpDescription: "Your loved ones can acknowledge an alert or offer to help. You remain in control of closing it.",
    responsibleEyebrow: "A responsible app",
    emergencyTitle: "SAC does not replace emergency services.",
    emergencyDescription: "SAC is designed to notify people you trust. It does not guarantee that emergency responders will intervene.",
    followProject: "Follow the project", footer: "SAC — Safety, Alert, Citizen · Your safety, your decision."
  },
  ar: {
    appName: "السلامة · التنبيه · المواطنة", tagline: "سلامتك. أحباؤك. قرارك.",
    privateApp: "تطبيق خاص", languageLabel: "اللغة",
    trustEyebrow: "دائرة الأشخاص الذين تثق بهم تأتي أولاً",
    heroTitle: "سلامتك.", heroSecond: "أحباؤك.", heroThird: "قرارك.",
    heroDescription: "يساعدك SAC على إبلاغ الأشخاص المهمين لديك عند التعرض للخطر وعلى جعل تنقلاتك أكثر أماناً، مع احتفاظك بالتحكم في معلوماتك.",
    sosLabel: "استغاثة", preparing: "قيد الإعداد",
    sosStatus: "لن يتم تفعيل الاستغاثة إلا بعد التحقق من الإرسال الفعلي وإجراءات الحماية.",
    protectedData: "بيانات محمية", chosenContacts: "جهات اتصال تختارها",
    personalSpace: "المساحة الشخصية", accompaniment: "SAC إلى جانبك",
    serverStatus: "حالة الخادم", checking: "جارٍ التحقق من الاتصال…",
    connected: "واجهة الخدمة وقاعدة البيانات متاحتان", unavailable: "يجب التحقق من اتصال الخادم", offline: "لا يوجد اتصال بالإنترنت",
    freePlan: "الخطة المجانية", premiumPlan: "الخطة المميزة", contacts: "جهات اتصال",
    perMonth: "شهرياً", freeSafety: "ستظل وظائف السلامة الأساسية، بما فيها الاستغاثة، متاحة مجاناً.",
    principles: "مبادئ SAC", principlesTitle: "الثقة تبدأ بالتحكم.",
    contactTitle: "أحباؤك، اختيارك",
    contactDescription: "أنت تختار الأشخاص الموثوق بهم الذين يمكنهم تلقي تنبيهاتك. لا توجد خلاصة عامة ولا مشاركة تلقائية مع المؤسسات.",
    locationTitle: "موقعك تحت سيطرتك",
    locationDescription: "لن تتم مشاركة موقعك إلا بإذنك. وسيتم دائماً توضيح أن الموقع قديم إذا لم يكن حديثاً.",
    helpTitle: "مساعدة بتنسيق واضح",
    helpDescription: "يمكن لأحبائك تأكيد استلام التنبيه أو عرض المساعدة. وتبقى أنت المتحكم في إغلاق التنبيه.",
    responsibleEyebrow: "تطبيق مسؤول",
    emergencyTitle: "لا يحل SAC محل خدمات الطوارئ.",
    emergencyDescription: "صُمم SAC لإبلاغ الأشخاص الذين تثق بهم. ولا يضمن تدخل فرق الطوارئ.",
    followProject: "تابع المشروع", footer: "SAC — السلامة والتنبيه والمواطنة · سلامتك، قرارك."
  }
};
