export type Language = "fr" | "en" | "ar";

export interface Translation {
  appName: string; tagline: string; privateApp: string; languageLabel: string;
  offersEyebrow: string; offersTitle: string; offersSubtitle: string; freeLabel: string; recommendedLabel: string; freePrice: string; premiumPrice: string;\n  offerDetails: string; offerIncluded: string; closeOfferDetails: string; freeOfferDetails: string[]; premiumOfferDetails: string[]; premiumPendingDetails: string;
  trustEyebrow: string; heroTitle: string; heroSecond: string; heroThird: string;
  heroDescription: string; sosLabel: string; preparing: string; sosStatus: string;
  protectedData: string; chosenContacts: string; personalSpace: string; accompaniment: string;
  serverStatus: string; checking: string; connected: string; unavailable: string; offline: string; schemaIncomplete: string; retry: string;
  freePlan: string; premiumPlan: string; contacts: string; perMonth: string; freeSafety: string;
  principles: string; principlesTitle: string; contactTitle: string; contactDescription: string;
  locationTitle: string; locationDescription: string; helpTitle: string; helpDescription: string;
  responsibleEyebrow: string; emergencyTitle: string; emergencyDescription: string;
  followProject: string; footer: string; installApp: string; installIosHelp: string; installAndroidHelp: string; close: string;
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
    offersEyebrow: "Choisissez votre formule", offersTitle: "Nos offres", offersSubtitle: "Les essentiels restent accessibles à tous.", freeLabel: "Essentielle", recommendedLabel: "Plus de liberté", freePrice: "Gratuit", premiumPrice: "Premium",\n    offerDetails: "Détails de la formule", offerIncluded: "Inclus dans cette formule", closeOfferDetails: "Fermer les détails",\n    freeOfferDetails: ["Jusqu’à 2 contacts de confiance", "Accès aux fonctions essentielles d’alerte et de SOS", "Accès aux fonctions fondamentales de protection des trajets"],\n    premiumOfferDetails: ["Jusqu’à 10 contacts de confiance", "Accès aux fonctions essentielles d’alerte et de SOS", "Accès aux fonctions fondamentales de protection des trajets", "Tarif : 5 000 FCFA par mois"],\n    premiumPendingDetails: "Les avantages Premium supplémentaires sont encore en cours de définition. Aucun autre avantage n’est annoncé avant validation.",
    trustEyebrow: "Votre cercle de confiance, toujours au centre",
    heroTitle: "Votre sécurité.", heroSecond: "Vos proches.", heroThird: "Votre décision.",
    heroDescription: "SAC vous aidera à prévenir les personnes qui comptent pour vous en cas de danger et à sécuriser vos déplacements, tout en gardant le contrôle de vos informations.",
    sosLabel: "SOS", preparing: "En préparation",
    sosStatus: "Le déclenchement sera activé après validation des envois réels et des protections.",
    protectedData: "Données protégées", chosenContacts: "Contacts choisis",
    personalSpace: "Espace personnel", accompaniment: "SAC vous accompagne",
    serverStatus: "État du serveur", checking: "Vérification de la connexion…",
    connected: "API et base de données accessibles", unavailable: "Connexion serveur à vérifier", offline: "Aucune connexion Internet détectée", schemaIncomplete: "Structure de base de données incomplète", retry: "Réessayer",
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
    followProject: "Suivre le projet", footer: "SAC — Sécurité, Alerte, Citoyenne · Votre sécurité, votre décision.", installApp: "Installer SAC", installIosHelp: "Sur iPhone ou iPad : touchez Partager dans Safari, puis « Sur l’écran d’accueil » pour installer SAC.", installAndroidHelp: "Dans le menu de votre navigateur, choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».", close: "Fermer"
  },
  en: {
    appName: "Safety · Alert · Citizen", tagline: "Your safety. Your loved ones. Your decision.",
    privateApp: "Private app", languageLabel: "Language",
    offersEyebrow: "Choose your plan", offersTitle: "Our plans", offersSubtitle: "Essential safety stays accessible to everyone.", freeLabel: "Essential", recommendedLabel: "More freedom", freePrice: "Free", premiumPrice: "Premium",\n    offerDetails: "Plan details", offerIncluded: "Included in this plan", closeOfferDetails: "Close details",\n    freeOfferDetails: ["Up to 2 trusted contacts", "Access to essential alerts and SOS features", "Access to core trip-protection features"],\n    premiumOfferDetails: ["Up to 10 trusted contacts", "Access to essential alerts and SOS features", "Access to core trip-protection features", "Price: 5,000 XOF per month"],\n    premiumPendingDetails: "Additional Premium benefits are still being defined. No other benefits are advertised before approval.",
    trustEyebrow: "Your trusted circle always comes first",
    heroTitle: "Your safety.", heroSecond: "Your loved ones.", heroThird: "Your decision.",
    heroDescription: "SAC helps you notify the people who matter when you are in danger and make your journeys safer, while keeping control of your information.",
    sosLabel: "SOS", preparing: "In preparation",
    sosStatus: "SOS will be enabled only after real delivery and security protections have been validated.",
    protectedData: "Protected data", chosenContacts: "Chosen contacts",
    personalSpace: "Personal space", accompaniment: "SAC is here for you",
    serverStatus: "Server status", checking: "Checking connection…",
    connected: "API and database are reachable", unavailable: "Server connection needs checking", offline: "No Internet connection detected", schemaIncomplete: "Database schema is incomplete", retry: "Try again",
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
    followProject: "Follow the project", footer: "SAC — Safety, Alert, Citizen · Your safety, your decision.", installApp: "Install SAC", installIosHelp: "On iPhone or iPad: tap Share in Safari, then choose “Add to Home Screen” to install SAC.", installAndroidHelp: "Open your browser menu and choose “Install app” or “Add to Home screen”.", close: "Close"
  },
  ar: {
    appName: "السلامة · التنبيه · المواطنة", tagline: "سلامتك. أحباؤك. قرارك.",
    privateApp: "تطبيق خاص", languageLabel: "اللغة",
    offersEyebrow: "اختر باقتك", offersTitle: "باقاتنا", offersSubtitle: "تظل أساسيات السلامة متاحة للجميع.", freeLabel: "أساسية", recommendedLabel: "حرية أكبر", freePrice: "مجاناً", premiumPrice: "مميزة",\n    offerDetails: "تفاصيل الباقة", offerIncluded: "المزايا المتضمنة في هذه الباقة", closeOfferDetails: "إغلاق التفاصيل",\n    freeOfferDetails: ["حتى جهتي اتصال موثوقتين", "الوصول إلى وظائف التنبيه والاستغاثة الأساسية", "الوصول إلى الوظائف الأساسية لحماية الرحلات"],\n    premiumOfferDetails: ["حتى 10 جهات اتصال موثوقة", "الوصول إلى وظائف التنبيه والاستغاثة الأساسية", "الوصول إلى الوظائف الأساسية لحماية الرحلات", "السعر: 5,000 فرنك أفريقي شهرياً"],\n    premiumPendingDetails: "لا تزال المزايا الإضافية للباقة المميزة قيد التحديد. ولن يتم الإعلان عن مزايا أخرى قبل اعتمادها.",
    trustEyebrow: "دائرة الأشخاص الذين تثق بهم تأتي أولاً",
    heroTitle: "سلامتك.", heroSecond: "أحباؤك.", heroThird: "قرارك.",
    heroDescription: "يساعدك SAC على إبلاغ الأشخاص المهمين لديك عند التعرض للخطر وعلى جعل تنقلاتك أكثر أماناً، مع احتفاظك بالتحكم في معلوماتك.",
    sosLabel: "استغاثة", preparing: "قيد الإعداد",
    sosStatus: "لن يتم تفعيل الاستغاثة إلا بعد التحقق من الإرسال الفعلي وإجراءات الحماية.",
    protectedData: "بيانات محمية", chosenContacts: "جهات اتصال تختارها",
    personalSpace: "المساحة الشخصية", accompaniment: "SAC إلى جانبك",
    serverStatus: "حالة الخادم", checking: "جارٍ التحقق من الاتصال…",
    connected: "واجهة الخدمة وقاعدة البيانات متاحتان", unavailable: "يجب التحقق من اتصال الخادم", offline: "لا يوجد اتصال بالإنترنت", schemaIncomplete: "هيكل قاعدة البيانات غير مكتمل", retry: "إعادة المحاولة",
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
    followProject: "تابع المشروع", footer: "SAC — السلامة والتنبيه والمواطنة · سلامتك، قرارك.", installApp: "تثبيت SAC", installIosHelp: "على iPhone أو iPad: اضغط على «مشاركة» في Safari ثم اختر «إضافة إلى الشاشة الرئيسية» لتثبيت SAC.", installAndroidHelp: "افتح قائمة المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».", close: "إغلاق"
  }
};
