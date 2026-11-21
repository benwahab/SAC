export type Language = "fr" | "en" | "ar";

export interface Translation {
  appName: string; tagline: string; privateApp: string; languageLabel: string;
  offersEyebrow: string; offersTitle: string; offersSubtitle: string; freeLabel: string; recommendedLabel: string; freePrice: string; premiumPrice: string;
  offerDetails: string; offerIncluded: string; closeOfferDetails: string; freeOfferDetails: string[]; premiumOfferDetails: string[]; premiumPendingDetails: string;
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
    offersEyebrow: "Choisissez votre formule", offersTitle: "Nos offres", offersSubtitle: "Les essentiels restent accessibles à tous.", freeLabel: "Essentielle", recommendedLabel: "Plus de liberté", freePrice: "Gratuit", premiumPrice: "Premium",
    offerDetails: "Détails de la formule", offerIncluded: "Inclus dans cette formule", closeOfferDetails: "Fermer les détails",
    freeOfferDetails: ["Jusqu’à 2 contacts de confiance", "Accès aux fonctions essentielles d’alerte et de SOS", "Accès aux fonctions fondamentales de protection des trajets"],
    premiumOfferDetails: ["Jusqu’à 10 contacts de confiance", "Accès aux fonctions essentielles d’alerte et de SOS", "Accès aux fonctions fondamentales de protection des trajets", "Tarif : 5 000 FCFA par mois"],
    premiumPendingDetails: "Les avantages Premium supplémentaires sont encore en cours de définition. Aucun autre avantage n’est annoncé avant validation.",
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
    offersEyebrow: "Choose your plan", offersTitle: "Our plans", offersSubtitle: "Essential safety stays accessible to everyone.", freeLabel: "Essential", recommendedLabel: "More freedom", freePrice: "Free", premiumPrice: "Premium",
    offerDetails: "Plan details", offerIncluded: "Included in this plan", closeOfferDetails: "Close details",
    freeOfferDetails: ["Up to 2 trusted contacts", "Access to essential alerts and SOS features", "Access to core trip-protection features"],
    premiumOfferDetails: ["Up to 10 trusted contacts", "Access to essential alerts and SOS features", "Access to core trip-protection features", "Price: 5,000 XOF per month"],
    premiumPendingDetails: "Additional Premium benefits are still being defined. No other benefits are advertised before approval.",
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
    offersEyebrow: "اختر باقتك", offersTitle: "باقاتنا", offersSubtitle: "تظل أساسيات السلامة متاحة للجميع.", freeLabel: "أساسية", recommendedLabel: "حرية أكبر", freePrice: "مجاناً", premiumPrice: "مميزة",
    offerDetails: "تفاصيل الباقة", offerIncluded: "المزايا المتضمنة في هذه الباقة", closeOfferDetails: "إغلاق التفاصيل",
    freeOfferDetails: ["حتى جهتي اتصال موثوقتين", "الوصول إلى وظائف التنبيه والاستغاثة الأساسية", "الوصول إلى الوظائف الأساسية لحماية الرحلات"],
    premiumOfferDetails: ["حتى 10 جهات اتصال موثوقة", "الوصول إلى وظائف التنبيه والاستغاثة الأساسية", "الوصول إلى الوظائف الأساسية لحماية الرحلات", "السعر: 5,000 فرنك أفريقي شهرياً"],
    premiumPendingDetails: "لا تزال المزايا الإضافية للباقة المميزة قيد التحديد. ولن يتم الإعلان عن مزايا أخرى قبل اعتمادها.",
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

/* ------------------------------------------------------------------ */
/* Espace privé connecté : écrans tableau de bord, proches, SOS, etc.  */
/* ------------------------------------------------------------------ */
const privateFr = {
  navHome: "Accueil", navContacts: "Proches", navSos: "SOS", navHistory: "Historique", navSettings: "Réglages", navLabel: "Navigation principale",
  back: "Retour", refresh: "Actualiser", loading: "Chargement…", errorGeneric: "Service momentanément indisponible.", loadContactsError: "Impossible de charger les proches pour le moment.", alertsLoadError: "Les alertes n’ont pas pu être chargées.", privateSpace: "Espace privé", sessionExpired: "Votre session a expiré. Reconnectez-vous.",
  dashTitle: "Mon espace", dashSubtitle: "Votre cercle de confiance, toujours à portée.", dashCalmTitle: "Aucune alerte en cours", dashCalmText: "Tout est calme. Votre cercle est prêt si vous avez besoin d’aide.",
  dashOwnActive: "Votre alerte est en cours", dashReceivedActive: "Un proche a besoin d’aide", dashOpen: "Ouvrir le suivi", dashSosCta: "Déclencher un SOS", dashSosHint: "Privé, adressé uniquement à vos proches choisis.",
  dashCircle: "Cercle de confiance", dashCircleCount: "Proches vérifiés : {n}", dashCircleEmpty: "Votre cercle est encore vide.", dashInvite: "Inviter un proche", dashSeeAll: "Voir tout", dashRecent: "Dernières alertes", dashNoRecent: "Aucune alerte enregistrée.",
  emergencyNote: "SAC ne remplace pas les services d’urgence. Il prévient vos proches de confiance.",
  contactsTitle: "Mes proches", contactsIntro: "Seules les personnes qui acceptent votre invitation et disposent d’un compte SAC vérifié peuvent rejoindre votre cercle de confiance.", contactsEmpty: "Votre cercle est encore vide", contactsEmptyHint: "Invitez une personne de confiance pour commencer.",
  contactVerified: "Proche vérifié", contactRemove: "Retirer", contactRemoveConfirm: "Retirer cette personne de vos proches ?", contactRemoveError: "Impossible de retirer ce proche.", contactRemoved: "Ce lien de confiance est révoqué. Les alertes déjà en cours ne sont pas clôturées.",
  contactsAdd: "Inviter un proche", contactsLimit: "Maximum actuel : 2 proches sur l’offre gratuite.", pendingTitle: "Invitations envoyées", pendingSoon: "Le suivi des invitations envoyées sera disponible prochainement. Une invitation n’ouvre aucun accès avant son acceptation explicite.",
  inviteTitle: "Inviter un proche", inviteIntro: "L’invitation est envoyée par e-mail. La personne doit l’accepter et disposer d’un compte SAC vérifié.", inviteLabel: "Adresse e-mail du proche", invitePlaceholder: "adresse@exemple.com", inviteSend: "Envoyer l’invitation", inviteSending: "Envoi…",
  inviteNote: "L’invitation ne donne aucun accès avant son acceptation explicite.", inviteSent: "Invitation envoyée. La personne devra l’accepter et vérifier son adresse SAC.", inviteAnother: "Inviter une autre personne", inviteBack: "Retour à mes proches",
  inviteErrNotConfigured: "L’envoi des invitations n’est pas encore configuré.", inviteErrNotEligible: "Ce compte ne peut pas envoyer cette invitation.", inviteErrAlready: "Cette personne figure déjà parmi vos proches.", inviteErrSelf: "Vous ne pouvez pas vous inviter vous-même.", inviteErrEmail: "Adresse e-mail invalide.", inviteErrGeneric: "L’invitation n’a pas pu être envoyée.",
  sosTitle: "Déclencher un SOS", sosIntro: "L’alerte est privée et adressée uniquement aux proches choisis. Aucune localisation n’est obligatoire.", sosRecipients: "Destinataires", sosNeedContact: "Ajoutez d’abord au moins un proche vérifié.", sosAddContact: "Inviter un proche",
  sosType: "Type d’urgence", cat_personal_danger: "Danger personnel", cat_accident: "Accident", cat_home_intrusion: "Intrusion au domicile", cat_medical_emergency: "Urgence médicale", cat_lost_or_disoriented_person: "Personne perdue ou désorientée", cat_custom_alert: "Autre situation",
  sosDescribe: "Décrire la situation", sosLevel: "Niveau", level_preventive: "Préventif", level_urgent: "Urgent", level_critical: "Critique",
  sosReminders: "Rappels push avant évaluation du SMS : {n}", sosRemindersNote: "Un rappel est prévu toutes les 5 minutes. Ce nombre définit le seuil d’évaluation du SMS, pas la durée de l’alerte.",
  sosButton: "SOS", sosButtonSending: "Création…", sosCriticalNote: "Une alerte critique part immédiatement, sans étape de confirmation.", sosConfirmTitle: "Confirmer le déclenchement ?", sosConfirmText: "Cette alerte privée sera adressée aux proches sélectionnés.", sosConfirmYes: "Oui, déclencher", sosConfirmNo: "Annuler",
  sosCreated: "Alerte enregistrée. Cela ne confirme pas encore l’envoi ni la réception des notifications.",
  sosErrNotTrusted: "Un proche sélectionné ne fait plus partie de votre cercle.", sosErrLimit: "La limite de proches autorisée est dépassée.", sosErrNotEligible: "Votre compte ne peut pas déclencher une alerte.", sosErrInvalid: "Vérifiez les informations de l’alerte et les destinataires.", sosErrGeneric: "L’alerte n’a pas pu être créée.",
  alertNotFound: "Cette alerte n’est plus accessible.", alertOwnTitle: "Suivi de votre alerte", alertReceivedTitle: "Alerte reçue", alertStatusActive: "En cours", alertStatusClosed: "Clôturée", alertRoleAuthor: "Votre alerte", alertRoleRecipient: "Alerte reçue",
  alertDetailsTitle: "Détail et actions de l’alerte",
  trackLevel: "Niveau", trackCreated: "Créée le", trackTimeline: "Chronologie", trackNoEvents: "Aucun événement disponible.", trackLoading: "Chargement du suivi…", trackDetailError: "Les détails de cette alerte ne sont pas accessibles.", trackEventsError: "La chronologie de cette alerte est momentanément indisponible.", trackLoadError: "Impossible de charger cette alerte.",
  respSelf: "Vous êtes actuellement le responsable principal de cette alerte.", respOther: "Un autre proche est actuellement le responsable principal.", respNone: "Aucun responsable principal n’a encore été désigné.",
  closedOn: "Clôturée le {d}", closureCompleted: "Situation terminée", closureCancelled: "Annulée",
  evt_triggered: "Alerte déclenchée", evt_acknowledged: "Alerte vue par un proche", evt_volunteered: "Un proche s’est porté volontaire", evt_withdrew: "Un proche s’est retiré", evt_closed_by_author: "Alerte clôturée par son auteur", actorSelf: "Vous", actorOther: "Un participant",
  receiveIntro: "Deux gestes, dans l’ordre que vous voulez. Les deux sont facultatifs et distincts.", respPrivate: "Votre réponse est privée et ne clôture pas l’alerte. Seul son auteur peut la clôturer.",
  ackBtn: "J’ai pris connaissance", ackDone: "Reçue", ackDoneText: "Votre proche voit que vous avez vu son alerte.", volunteerBtn: "Je me porte volontaire", volunteerHint: "Se proposer ne donne pas encore la responsabilité : le serveur confirme qui devient responsable principal.", withdrawBtn: "Me retirer de la prise en charge", volunteerRecorded: "Votre volontariat est enregistré. L’attribution de la responsabilité principale suit l’ordre confirmé par le serveur.", withdrewText: "Votre retrait est enregistré. Vous ne pouvez pas reprendre cette même candidature.",
  confirmAck: "Confirmer que vous avez bien pris connaissance de cette alerte ?", confirmVolunteer: "Confirmer que vous vous portez volontaire pour prendre en charge cette alerte ?", confirmWithdraw: "Confirmer votre retrait de la prise en charge ?",
  noticeAck: "Votre accusé de réception est enregistré.", noticeVolunteerMain: "Vous êtes le responsable principal de cette alerte.", noticeVolunteerOther: "Votre volontariat est enregistré. Un autre proche est actuellement responsable.", noticeWithdrawTransfer: "Votre retrait est enregistré. La responsabilité a été transférée à un autre volontaire.", noticeWithdrawNone: "Votre retrait est enregistré. Aucun autre volontaire n’a encore pris la responsabilité.",
  respErrInvalid: "Cette action n’est plus possible pour cette alerte.", respErrClosed: "Cette alerte est clôturée ou n’est plus accessible.", respErrGeneric: "Votre réponse n’a pas pu être enregistrée.",
  authorCloseHint: "Clôturez uniquement lorsque la situation est terminée ou si l’alerte a été déclenchée par erreur. Seul vous pouvez la clôturer.", closeDone: "Situation terminée", closeCancel: "Annuler cette alerte", confirmCloseDone: "Confirmer que la situation est terminée et clôturer cette alerte ?", confirmCloseCancel: "Confirmer l’annulation et clôturer cette alerte ?", noticeClosedDone: "Alerte clôturée comme terminée.", noticeClosedCancel: "Alerte clôturée comme annulée.", closeErrClosed: "Cette alerte est déjà clôturée ou n’est plus accessible.", closeErrInvalid: "La clôture n’a pas pu être validée.", closeErrGeneric: "La clôture de l’alerte a échoué.",
  historyTitle: "Historique", historyAll: "Toutes", historyMine: "Les miennes", historyReceived: "Reçues", historyEmpty: "Aucune alerte enregistrée.", historyOpen: "Consulter", historyClosedWhy: "Clôture : {r}",
  gpsTitle: "Localisation SOS", gpsAria: "Partage GPS sécurisé", gpsLast: "Dernière position reçue · non archivée", gpsAccuracy: "Précision annoncée : ±{m} m", gpsFootnote: "Les coordonnées sont chiffrées entre appareils authentifiés par SAC. Elles ne sont pas conservées dans l’historique et sont effacées à la clôture de l’alerte.",
  gpsConsentTitle: "Partage de position", gpsConsentAuthor: "Votre position précise n’est jamais partagée automatiquement. Vous choisissez quand la partager avec les destinataires de cette alerte.", gpsConsentRecipient: "La position de votre proche n’est jamais affichée automatiquement. Vous choisissez quand recevoir et afficher sa position.", gpsConsentHint: "Le partage est chiffré de bout en bout et s’arrête à la clôture de l’alerte. Vous pouvez l’arrêter à tout moment.", gpsShareStart: "Partager ma position", gpsShareStop: "Arrêter le partage", gpsReceiveStart: "Recevoir la position", gpsReceiveStop: "Arrêter la réception", gpsReveal: "Afficher la position", gpsHide: "Masquer la position",
  gps_connecting: "Connexion sécurisée en cours…", gps_waiting_for_author: "En attente de la connexion sécurisée de l’auteur…", gps_waiting_for_devices: "En attente de la connexion de vos proches…", gps_receiving: "Réception d’une position chiffrée en direct.", gps_sharing: "Partage chiffré en direct avec les appareils autorisés.", gps_closed: "Partage GPS arrêté ou indisponible.",
  gpserr_gps_relay_not_ready: "Le service GPS chiffré n’est pas encore activé sur SAC.", gpserr_authentication_required: "Votre session doit être renouvelée avant le partage GPS.", gpserr_contact_identity_invalid: "L’identité de l’appareil n’a pas pu être authentifiée automatiquement. Aucune position ne lui est transmise.", gpserr_gps_permission_denied: "L’autorisation de localisation a été refusée sur cet appareil.", gpserr_gps_unavailable: "La position GPS est momentanément indisponible.", gpserr_relay_disconnected: "La connexion GPS sécurisée a été interrompue.", gpserr_invalid_location_packet: "Une position chiffrée invalide a été écartée.",
  settingsTitle: "Réglages", settingsDevice: "Cet appareil", settingsDeviceOk: "Session sécurisée active sur cet appareil.", settingsDevices: "Sessions ouvertes", settingsDevicesSoon: "Consultez les sessions actives de votre compte. Vous pouvez fermer individuellement une autre session.", settingsSessionsTitle: "Sessions ouvertes", settingsSessionsIntro: "Consultez les sessions actives de votre compte et fermez séparément celles que vous ne reconnaissez plus.", settingsSessionsLoading: "Chargement des sessions…", settingsSessionsEmpty: "Aucune autre session active.", settingsSessionsCurrent: "Session actuelle", settingsSessionsOther: "Autre session", settingsSessionsCreated: "Ouverte le", settingsSessionsLastActive: "Dernière activité", settingsSessionsExpires: "Expire le", settingsSessionsRevoke: "Fermer cette session", settingsSessionsRevokeConfirm: "Fermer cette autre session ?", settingsSessionsRevoked: "Session fermée.", settingsSessionsError: "Impossible de charger ou de modifier les sessions.", settingsSecondaryDeviceNote: "L’ajout et l’approbation d’appareils secondaires ne sont pas encore disponibles. Cette rubrique gère les sessions déjà ouvertes.", settingsLanguage: "Langue", settingsLogout: "Se déconnecter", settingsLoggingOut: "Déconnexion…", logoutError: "La déconnexion n’a pas pu être confirmée.", settingsPrivacy: "Confidentialité", settingsPrivacyText: "Vos alertes sont privées, adressées uniquement à vos proches de confiance. Aucun fil public.",
  pushTitle: "Notifications sur cet appareil", pushIntro: "Recevoir les alertes privées envoyées par vos proches, même lorsque SAC n’est pas ouvert.", pushOn: "Appareil enregistré", pushDisable: "Désactiver", pushWait: "Patientez…", pushNotConfigured: "Le service de livraison Push doit encore être configuré côté serveur. L’activation sera disponible ensuite.", pushUnsupported: "Ce navigateur ne prend pas en charge les notifications Push nécessaires à SAC.", pushDenied: "Les notifications sont bloquées dans les réglages du navigateur. Autorisez-les pour SAC depuis les paramètres du navigateur.", pushEnable: "Activer les notifications", pushEnabling: "Activation…", pushEnabledMsg: "Cet appareil est enregistré pour recevoir les alertes privées SAC.", pushDisabledMsg: "Les notifications SAC sont désactivées sur cet appareil.", pushErrEnable: "Impossible d’activer les notifications.", pushErrDisable: "Impossible de désactiver les notifications.",
};

export type PrivateCopy = Record<keyof typeof privateFr, string>;

const privateEn: PrivateCopy = {
  navHome: "Home", navContacts: "Contacts", navSos: "SOS", navHistory: "History", navSettings: "Settings", navLabel: "Main navigation",
  back: "Back", refresh: "Refresh", loading: "Loading…", errorGeneric: "Service temporarily unavailable.", loadContactsError: "Unable to load your contacts right now.", alertsLoadError: "Alerts could not be loaded.", privateSpace: "Private space", sessionExpired: "Your session has expired. Please sign in again.",
  dashTitle: "My space", dashSubtitle: "Your trusted circle, always within reach.", dashCalmTitle: "No active alert", dashCalmText: "All is calm. Your circle is ready if you need help.",
  dashOwnActive: "Your alert is active", dashReceivedActive: "A loved one needs help", dashOpen: "Open tracking", dashSosCta: "Trigger an SOS", dashSosHint: "Private, sent only to the contacts you choose.",
  dashCircle: "Trusted circle", dashCircleCount: "Verified contacts: {n}", dashCircleEmpty: "Your circle is still empty.", dashInvite: "Invite a contact", dashSeeAll: "See all", dashRecent: "Latest alerts", dashNoRecent: "No alerts recorded.",
  emergencyNote: "SAC does not replace emergency services. It notifies the people you trust.",
  contactsTitle: "My contacts", contactsIntro: "Only people who accept your invitation and have a verified SAC account can join your trusted circle.", contactsEmpty: "Your circle is still empty", contactsEmptyHint: "Invite someone you trust to get started.",
  contactVerified: "Verified contact", contactRemove: "Remove", contactRemoveConfirm: "Remove this person from your contacts?", contactRemoveError: "Unable to remove this contact.", contactRemoved: "This trust link is revoked. Alerts already in progress are not closed.",
  contactsAdd: "Invite a contact", contactsLimit: "Current maximum: 2 contacts on the free plan.", pendingTitle: "Sent invitations", pendingSoon: "Tracking of sent invitations will be available soon. An invitation grants no access until it is explicitly accepted.",
  inviteTitle: "Invite a contact", inviteIntro: "The invitation is sent by email. The person must accept it and have a verified SAC account.", inviteLabel: "Contact’s email address", invitePlaceholder: "address@example.com", inviteSend: "Send invitation", inviteSending: "Sending…",
  inviteNote: "The invitation grants no access until it is explicitly accepted.", inviteSent: "Invitation sent. The person will need to accept it and verify their SAC address.", inviteAnother: "Invite someone else", inviteBack: "Back to my contacts",
  inviteErrNotConfigured: "Invitation sending is not configured yet.", inviteErrNotEligible: "This account cannot send this invitation.", inviteErrAlready: "This person is already one of your contacts.", inviteErrSelf: "You cannot invite yourself.", inviteErrEmail: "Invalid email address.", inviteErrGeneric: "The invitation could not be sent.",
  sosTitle: "Trigger an SOS", sosIntro: "The alert is private and sent only to the contacts you choose. No location is required.", sosRecipients: "Recipients", sosNeedContact: "First add at least one verified contact.", sosAddContact: "Invite a contact",
  sosType: "Type of emergency", cat_personal_danger: "Personal danger", cat_accident: "Accident", cat_home_intrusion: "Home intrusion", cat_medical_emergency: "Medical emergency", cat_lost_or_disoriented_person: "Lost or disoriented person", cat_custom_alert: "Other situation",
  sosDescribe: "Describe the situation", sosLevel: "Level", level_preventive: "Preventive", level_urgent: "Urgent", level_critical: "Critical",
  sosReminders: "Push reminders before SMS evaluation: {n}", sosRemindersNote: "A reminder is planned every 5 minutes. This number sets the SMS evaluation threshold, not the alert duration.",
  sosButton: "SOS", sosButtonSending: "Creating…", sosCriticalNote: "A critical alert is sent immediately, with no confirmation step.", sosConfirmTitle: "Confirm triggering?", sosConfirmText: "This private alert will be sent to the selected contacts.", sosConfirmYes: "Yes, trigger", sosConfirmNo: "Cancel",
  sosCreated: "Alert recorded. This does not yet confirm that notifications were sent or received.",
  sosErrNotTrusted: "A selected contact is no longer part of your circle.", sosErrLimit: "The allowed number of contacts has been exceeded.", sosErrNotEligible: "Your account cannot trigger an alert.", sosErrInvalid: "Check the alert details and recipients.", sosErrGeneric: "The alert could not be created.",
  alertNotFound: "This alert is no longer accessible.", alertOwnTitle: "Tracking your alert", alertReceivedTitle: "Alert received", alertStatusActive: "Active", alertStatusClosed: "Closed", alertRoleAuthor: "Your alert", alertRoleRecipient: "Received alert",
  alertDetailsTitle: "Alert details and actions",
  trackLevel: "Level", trackCreated: "Created on", trackTimeline: "Timeline", trackNoEvents: "No events available.", trackLoading: "Loading tracking…", trackDetailError: "The details of this alert are not accessible.", trackEventsError: "This alert’s timeline is temporarily unavailable.", trackLoadError: "Unable to load this alert.",
  respSelf: "You are currently the primary responder for this alert.", respOther: "Another contact is currently the primary responder.", respNone: "No primary responder has been designated yet.",
  closedOn: "Closed on {d}", closureCompleted: "Situation over", closureCancelled: "Cancelled",
  evt_triggered: "Alert triggered", evt_acknowledged: "Alert seen by a contact", evt_volunteered: "A contact volunteered", evt_withdrew: "A contact withdrew", evt_closed_by_author: "Alert closed by its author", actorSelf: "You", actorOther: "A participant",
  receiveIntro: "Two actions, in any order. Both are optional and separate.", respPrivate: "Your response is private and does not close the alert. Only its author can close it.",
  ackBtn: "I have seen it", ackDone: "Received", ackDoneText: "Your loved one can see that you have seen their alert.", volunteerBtn: "I volunteer to help", volunteerHint: "Volunteering does not yet give you responsibility: the server confirms who becomes primary responder.", withdrawBtn: "Withdraw from handling", volunteerRecorded: "Your offer is recorded. Primary responsibility follows the order confirmed by the server.", withdrewText: "Your withdrawal is recorded. You cannot resume this same offer.",
  confirmAck: "Confirm that you have taken note of this alert?", confirmVolunteer: "Confirm that you volunteer to handle this alert?", confirmWithdraw: "Confirm your withdrawal from handling?",
  noticeAck: "Your acknowledgement is recorded.", noticeVolunteerMain: "You are the primary responder for this alert.", noticeVolunteerOther: "Your offer is recorded. Another contact is currently responsible.", noticeWithdrawTransfer: "Your withdrawal is recorded. Responsibility was transferred to another volunteer.", noticeWithdrawNone: "Your withdrawal is recorded. No other volunteer has taken responsibility yet.",
  respErrInvalid: "This action is no longer possible for this alert.", respErrClosed: "This alert is closed or no longer accessible.", respErrGeneric: "Your response could not be recorded.",
  authorCloseHint: "Close only when the situation is over or if the alert was triggered by mistake. Only you can close it.", closeDone: "Situation over", closeCancel: "Cancel this alert", confirmCloseDone: "Confirm that the situation is over and close this alert?", confirmCloseCancel: "Confirm cancellation and close this alert?", noticeClosedDone: "Alert closed as over.", noticeClosedCancel: "Alert closed as cancelled.", closeErrClosed: "This alert is already closed or no longer accessible.", closeErrInvalid: "The closure could not be validated.", closeErrGeneric: "Closing the alert failed.",
  historyTitle: "History", historyAll: "All", historyMine: "Mine", historyReceived: "Received", historyEmpty: "No alerts recorded.", historyOpen: "View", historyClosedWhy: "Closure: {r}",
  gpsTitle: "SOS location", gpsAria: "Secure GPS sharing", gpsLast: "Last position received · not archived", gpsAccuracy: "Reported accuracy: ±{m} m", gpsFootnote: "Coordinates are encrypted between devices authenticated by SAC. They are not kept in the history and are erased when the alert is closed.",
  gpsConsentTitle: "Location sharing", gpsConsentAuthor: "Your precise location is never shared automatically. You choose when to share it with the recipients of this alert.", gpsConsentRecipient: "Your contact’s location is never displayed automatically. You choose when to receive and display it.", gpsConsentHint: "Sharing is end-to-end encrypted and stops when the alert is closed. You can stop it at any time.", gpsShareStart: "Share my location", gpsShareStop: "Stop sharing", gpsReceiveStart: "Receive location", gpsReceiveStop: "Stop receiving", gpsReveal: "Show location", gpsHide: "Hide location",
  gps_connecting: "Secure connection in progress…", gps_waiting_for_author: "Waiting for the author’s secure connection…", gps_waiting_for_devices: "Waiting for your contacts to connect…", gps_receiving: "Receiving an encrypted live position.", gps_sharing: "Sharing live, encrypted, with authorised devices.", gps_closed: "GPS sharing stopped or unavailable.",
  gpserr_gps_relay_not_ready: "The encrypted GPS service is not yet enabled on SAC.", gpserr_authentication_required: "Your session must be renewed before GPS sharing.", gpserr_contact_identity_invalid: "The device identity could not be authenticated automatically. No position is sent to it.", gpserr_gps_permission_denied: "Location permission was denied on this device.", gpserr_gps_unavailable: "The GPS position is temporarily unavailable.", gpserr_relay_disconnected: "The secure GPS connection was interrupted.", gpserr_invalid_location_packet: "An invalid encrypted position was discarded.",
  settingsTitle: "Settings", settingsDevice: "This device", settingsDeviceOk: "Secure session active on this device.", settingsDevices: "Open sessions", settingsDevicesSoon: "Review your active account sessions and close any other session individually.", settingsSessionsTitle: "Open sessions", settingsSessionsIntro: "Review your active account sessions and close any session you no longer recognise.", settingsSessionsLoading: "Loading sessions…", settingsSessionsEmpty: "No other active session.", settingsSessionsCurrent: "Current session", settingsSessionsOther: "Other session", settingsSessionsCreated: "Opened", settingsSessionsLastActive: "Last activity", settingsSessionsExpires: "Expires", settingsSessionsRevoke: "Close this session", settingsSessionsRevokeConfirm: "Close this other session?", settingsSessionsRevoked: "Session closed.", settingsSessionsError: "Unable to load or update sessions.", settingsSecondaryDeviceNote: "Adding and approving secondary devices is not available yet. This section manages sessions that have already been opened.", settingsLanguage: "Language", settingsLogout: "Sign out", settingsLoggingOut: "Signing out…", logoutError: "Sign-out could not be confirmed.", settingsPrivacy: "Privacy", settingsPrivacyText: "Your alerts are private and sent only to your trusted contacts. There is no public feed.",
  pushTitle: "Notifications on this device", pushIntro: "Receive private alerts sent by your contacts, even when SAC is not open.", pushOn: "Device registered", pushDisable: "Turn off", pushWait: "Please wait…", pushNotConfigured: "The Push delivery service still has to be configured on the server. Activation will be available afterwards.", pushUnsupported: "This browser does not support the Push notifications SAC needs.", pushDenied: "Notifications are blocked in your browser settings. Allow them for SAC from the browser settings.", pushEnable: "Turn on notifications", pushEnabling: "Turning on…", pushEnabledMsg: "This device is registered to receive private SAC alerts.", pushDisabledMsg: "SAC notifications are turned off on this device.", pushErrEnable: "Unable to turn on notifications.", pushErrDisable: "Unable to turn off notifications.",
};

const privateAr: PrivateCopy = {
  navHome: "الرئيسية", navContacts: "الأحباء", navSos: "استغاثة", navHistory: "السجل", navSettings: "الإعدادات", navLabel: "التنقل الرئيسي",
  back: "رجوع", refresh: "تحديث", loading: "جارٍ التحميل…", errorGeneric: "الخدمة غير متاحة مؤقتاً.", loadContactsError: "تعذّر تحميل أحبائك حالياً.", alertsLoadError: "تعذّر تحميل التنبيهات.", privateSpace: "المساحة الخاصة", sessionExpired: "انتهت جلستك. سجّل الدخول من جديد.",
  dashTitle: "مساحتي", dashSubtitle: "دائرة الأشخاص الذين تثق بهم، دائماً في متناولك.", dashCalmTitle: "لا يوجد تنبيه جارٍ", dashCalmText: "كل شيء هادئ. دائرتك جاهزة إذا احتجت إلى مساعدة.",
  dashOwnActive: "تنبيهك جارٍ", dashReceivedActive: "أحد أحبائك يحتاج إلى مساعدة", dashOpen: "فتح المتابعة", dashSosCta: "إطلاق استغاثة", dashSosHint: "خاصة، وتُرسل فقط إلى الأحباء الذين تختارهم.",
  dashCircle: "دائرة الثقة", dashCircleCount: "الأحباء الموثّقون: {n}", dashCircleEmpty: "دائرتك لا تزال فارغة.", dashInvite: "دعوة أحد الأحباء", dashSeeAll: "عرض الكل", dashRecent: "آخر التنبيهات", dashNoRecent: "لا توجد تنبيهات مسجلة.",
  emergencyNote: "لا يحل SAC محل خدمات الطوارئ. إنه يُبلغ الأشخاص الذين تثق بهم.",
  contactsTitle: "أحبائي", contactsIntro: "لا ينضم إلى دائرة الثقة إلا الأشخاص الذين يقبلون دعوتك ولديهم حساب SAC موثّق.", contactsEmpty: "دائرتك لا تزال فارغة", contactsEmptyHint: "ادعُ شخصاً تثق به للبدء.",
  contactVerified: "حبيب موثّق", contactRemove: "إزالة", contactRemoveConfirm: "إزالة هذا الشخص من أحبائك؟", contactRemoveError: "تعذّرت إزالة هذا الشخص.", contactRemoved: "تم إلغاء رابط الثقة. التنبيهات الجارية لا تُغلق.",
  contactsAdd: "دعوة أحد الأحباء", contactsLimit: "الحد الحالي: جهتا اتصال في الباقة المجانية.", pendingTitle: "الدعوات المرسلة", pendingSoon: "ستتوفر قريباً متابعة الدعوات المرسلة. لا تمنح الدعوة أي وصول قبل قبولها صراحةً.",
  inviteTitle: "دعوة أحد الأحباء", inviteIntro: "تُرسل الدعوة بالبريد الإلكتروني. على الشخص قبولها وأن يكون لديه حساب SAC موثّق.", inviteLabel: "البريد الإلكتروني للشخص", invitePlaceholder: "address@example.com", inviteSend: "إرسال الدعوة", inviteSending: "جارٍ الإرسال…",
  inviteNote: "لا تمنح الدعوة أي وصول قبل قبولها صراحةً.", inviteSent: "تم إرسال الدعوة. على الشخص قبولها والتحقق من عنوانه في SAC.", inviteAnother: "دعوة شخص آخر", inviteBack: "العودة إلى أحبائي",
  inviteErrNotConfigured: "إرسال الدعوات غير مُعدّ بعد.", inviteErrNotEligible: "لا يمكن لهذا الحساب إرسال هذه الدعوة.", inviteErrAlready: "هذا الشخص موجود بالفعل بين أحبائك.", inviteErrSelf: "لا يمكنك دعوة نفسك.", inviteErrEmail: "عنوان بريد إلكتروني غير صالح.", inviteErrGeneric: "تعذّر إرسال الدعوة.",
  sosTitle: "إطلاق استغاثة", sosIntro: "التنبيه خاص ويُرسل فقط إلى الأحباء الذين تختارهم. لا يُشترط تحديد الموقع.", sosRecipients: "المستلمون", sosNeedContact: "أضف أولاً حبيباً موثّقاً واحداً على الأقل.", sosAddContact: "دعوة أحد الأحباء",
  sosType: "نوع الطوارئ", cat_personal_danger: "خطر شخصي", cat_accident: "حادث", cat_home_intrusion: "اقتحام المنزل", cat_medical_emergency: "حالة طبية طارئة", cat_lost_or_disoriented_person: "شخص تائه أو مشوّش", cat_custom_alert: "حالة أخرى",
  sosDescribe: "صف الحالة", sosLevel: "المستوى", level_preventive: "وقائي", level_urgent: "عاجل", level_critical: "حرج",
  sosReminders: "تذكيرات الدفع قبل تقييم الرسائل النصية: {n}", sosRemindersNote: "يُجدول تذكير كل 5 دقائق. يحدد هذا العدد عتبة تقييم الرسائل النصية وليس مدة التنبيه.",
  sosButton: "استغاثة", sosButtonSending: "جارٍ الإنشاء…", sosCriticalNote: "يُرسل التنبيه الحرج فوراً دون خطوة تأكيد.", sosConfirmTitle: "تأكيد الإطلاق؟", sosConfirmText: "سيُرسل هذا التنبيه الخاص إلى الأحباء المحددين.", sosConfirmYes: "نعم، أطلق", sosConfirmNo: "إلغاء",
  sosCreated: "تم تسجيل التنبيه. هذا لا يؤكد بعد إرسال الإشعارات أو استلامها.",
  sosErrNotTrusted: "أحد الأحباء المحددين لم يعد ضمن دائرتك.", sosErrLimit: "تم تجاوز العدد المسموح به من الأحباء.", sosErrNotEligible: "لا يمكن لحسابك إطلاق تنبيه.", sosErrInvalid: "تحقق من معلومات التنبيه والمستلمين.", sosErrGeneric: "تعذّر إنشاء التنبيه.",
  alertNotFound: "لم يعد هذا التنبيه متاحاً.", alertOwnTitle: "متابعة تنبيهك", alertReceivedTitle: "تنبيه مستلم", alertStatusActive: "جارٍ", alertStatusClosed: "مغلق", alertRoleAuthor: "تنبيهك", alertRoleRecipient: "تنبيه مستلم",
  alertDetailsTitle: "تفاصيل التنبيه والإجراءات",
  trackLevel: "المستوى", trackCreated: "تاريخ الإنشاء", trackTimeline: "التسلسل الزمني", trackNoEvents: "لا توجد أحداث متاحة.", trackLoading: "جارٍ تحميل المتابعة…", trackDetailError: "تفاصيل هذا التنبيه غير متاحة.", trackEventsError: "التسلسل الزمني لهذا التنبيه غير متاح مؤقتاً.", trackLoadError: "تعذّر تحميل هذا التنبيه.",
  respSelf: "أنت حالياً المسؤول الرئيسي عن هذا التنبيه.", respOther: "حبيب آخر هو حالياً المسؤول الرئيسي.", respNone: "لم يتم تعيين مسؤول رئيسي بعد.",
  closedOn: "أُغلق في {d}", closureCompleted: "انتهى الموقف", closureCancelled: "أُلغي",
  evt_triggered: "تم إطلاق التنبيه", evt_acknowledged: "اطّلع أحد الأحباء على التنبيه", evt_volunteered: "تطوّع أحد الأحباء", evt_withdrew: "انسحب أحد الأحباء", evt_closed_by_author: "أغلق صاحب التنبيه التنبيه", actorSelf: "أنت", actorOther: "مشارك",
  receiveIntro: "إجراءان بالترتيب الذي تريده. كلاهما اختياري ومنفصل.", respPrivate: "ردّك خاص ولا يغلق التنبيه. وحده صاحب التنبيه يستطيع إغلاقه.",
  ackBtn: "اطّلعت على التنبيه", ackDone: "تم الاستلام", ackDoneText: "يرى حبيبك أنك اطّلعت على تنبيهه.", volunteerBtn: "أتطوع للمساعدة", volunteerHint: "التطوع لا يمنحك المسؤولية بعد: يؤكد الخادم من يصبح المسؤول الرئيسي.", withdrawBtn: "الانسحاب من المتابعة", volunteerRecorded: "تم تسجيل تطوعك. تتبع المسؤولية الرئيسية الترتيب الذي يؤكده الخادم.", withdrewText: "تم تسجيل انسحابك. لا يمكنك استئناف التطوع نفسه.",
  confirmAck: "تأكيد أنك اطّلعت على هذا التنبيه؟", confirmVolunteer: "تأكيد تطوعك لمتابعة هذا التنبيه؟", confirmWithdraw: "تأكيد انسحابك من المتابعة؟",
  noticeAck: "تم تسجيل إقرارك بالاستلام.", noticeVolunteerMain: "أنت المسؤول الرئيسي عن هذا التنبيه.", noticeVolunteerOther: "تم تسجيل تطوعك. حبيب آخر هو المسؤول حالياً.", noticeWithdrawTransfer: "تم تسجيل انسحابك. انتقلت المسؤولية إلى متطوع آخر.", noticeWithdrawNone: "تم تسجيل انسحابك. لم يتولَّ متطوع آخر المسؤولية بعد.",
  respErrInvalid: "لم يعد هذا الإجراء ممكناً لهذا التنبيه.", respErrClosed: "هذا التنبيه مغلق أو لم يعد متاحاً.", respErrGeneric: "تعذّر تسجيل ردك.",
  authorCloseHint: "لا تغلق التنبيه إلا عند انتهاء الموقف أو إذا أُطلق بالخطأ. وحدك تستطيع إغلاقه.", closeDone: "انتهى الموقف", closeCancel: "إلغاء هذا التنبيه", confirmCloseDone: "تأكيد انتهاء الموقف وإغلاق هذا التنبيه؟", confirmCloseCancel: "تأكيد الإلغاء وإغلاق هذا التنبيه؟", noticeClosedDone: "أُغلق التنبيه بعد انتهاء الموقف.", noticeClosedCancel: "أُغلق التنبيه كتنبيه ملغى.", closeErrClosed: "هذا التنبيه مغلق بالفعل أو لم يعد متاحاً.", closeErrInvalid: "تعذّر التحقق من الإغلاق.", closeErrGeneric: "فشل إغلاق التنبيه.",
  historyTitle: "السجل", historyAll: "الكل", historyMine: "تنبيهاتي", historyReceived: "المستلمة", historyEmpty: "لا توجد تنبيهات مسجلة.", historyOpen: "عرض", historyClosedWhy: "الإغلاق: {r}",
  gpsTitle: "موقع الاستغاثة", gpsAria: "مشاركة GPS آمنة", gpsLast: "آخر موقع مستلم · غير مؤرشف", gpsAccuracy: "الدقة المعلنة: ±{m} م", gpsFootnote: "الإحداثيات مشفّرة بين الأجهزة التي يوثّقها SAC. لا تُحفظ في السجل وتُمحى عند إغلاق التنبيه.",
  gpsConsentTitle: "مشاركة الموقع", gpsConsentAuthor: "لا يُشارك موقعك الدقيق تلقائياً. أنت تختار متى تشاركه مع مستلمي هذا التنبيه.", gpsConsentRecipient: "لا يُعرض موقع حبيبك تلقائياً. أنت تختار متى تستقبله وتعرضه.", gpsConsentHint: "المشاركة مشفّرة من طرف إلى طرف وتتوقف عند إغلاق التنبيه. يمكنك إيقافها في أي وقت.", gpsShareStart: "شارك موقعي", gpsShareStop: "إيقاف المشاركة", gpsReceiveStart: "استقبال الموقع", gpsReceiveStop: "إيقاف الاستقبال", gpsReveal: "عرض الموقع", gpsHide: "إخفاء الموقع",
  gps_connecting: "جارٍ إنشاء الاتصال الآمن…", gps_waiting_for_author: "في انتظار الاتصال الآمن لصاحب التنبيه…", gps_waiting_for_devices: "في انتظار اتصال أحبائك…", gps_receiving: "استقبال موقع مباشر مشفّر.", gps_sharing: "مشاركة مباشرة مشفّرة مع الأجهزة المصرّح لها.", gps_closed: "توقفت مشاركة GPS أو أنها غير متاحة.",
  gpserr_gps_relay_not_ready: "خدمة GPS المشفّرة غير مفعّلة بعد على SAC.", gpserr_authentication_required: "يجب تجديد جلستك قبل مشاركة GPS.", gpserr_contact_identity_invalid: "تعذّر توثيق هوية الجهاز تلقائياً. لا يُرسل إليه أي موقع.", gpserr_gps_permission_denied: "تم رفض إذن تحديد الموقع على هذا الجهاز.", gpserr_gps_unavailable: "موقع GPS غير متاح مؤقتاً.", gpserr_relay_disconnected: "انقطع اتصال GPS الآمن.", gpserr_invalid_location_packet: "تم تجاهل موقع مشفّر غير صالح.",
  settingsTitle: "الإعدادات", settingsDevice: "هذا الجهاز", settingsDeviceOk: "الجلسة الآمنة نشطة على هذا الجهاز.", settingsDevices: "الجلسات المفتوحة", settingsDevicesSoon: "راجع جلسات حسابك النشطة وأغلق كل جلسة أخرى بشكل منفصل.", settingsSessionsTitle: "الجلسات المفتوحة", settingsSessionsIntro: "راجع جلسات حسابك النشطة وأغلق أي جلسة لم تعد تتعرف عليها.", settingsSessionsLoading: "جارٍ تحميل الجلسات…", settingsSessionsEmpty: "لا توجد جلسات نشطة أخرى.", settingsSessionsCurrent: "الجلسة الحالية", settingsSessionsOther: "جلسة أخرى", settingsSessionsCreated: "تاريخ الفتح", settingsSessionsLastActive: "آخر نشاط", settingsSessionsExpires: "تنتهي في", settingsSessionsRevoke: "إغلاق هذه الجلسة", settingsSessionsRevokeConfirm: "هل تريد إغلاق هذه الجلسة الأخرى؟", settingsSessionsRevoked: "تم إغلاق الجلسة.", settingsSessionsError: "تعذّر تحميل الجلسات أو تعديلها.", settingsSecondaryDeviceNote: "إضافة الأجهزة الثانوية والموافقة عليها غير متاحة بعد. يدير هذا القسم الجلسات المفتوحة بالفعل.", settingsLanguage: "اللغة", settingsLogout: "تسجيل الخروج", settingsLoggingOut: "جارٍ تسجيل الخروج…", logoutError: "تعذّر تأكيد تسجيل الخروج.", settingsPrivacy: "الخصوصية", settingsPrivacyText: "تنبيهاتك خاصة وتُرسل فقط إلى أحبائك الموثوقين. لا توجد خلاصة عامة.",
  pushTitle: "الإشعارات على هذا الجهاز", pushIntro: "استقبل التنبيهات الخاصة التي يرسلها أحباؤك حتى عندما لا يكون SAC مفتوحاً.", pushOn: "الجهاز مسجّل", pushDisable: "إيقاف", pushWait: "يرجى الانتظار…", pushNotConfigured: "لا يزال يجب إعداد خدمة إرسال الإشعارات على الخادم. سيتوفر التفعيل بعد ذلك.", pushUnsupported: "لا يدعم هذا المتصفح إشعارات الدفع التي يحتاجها SAC.", pushDenied: "الإشعارات محظورة في إعدادات المتصفح. اسمح بها لـ SAC من إعدادات المتصفح.", pushEnable: "تفعيل الإشعارات", pushEnabling: "جارٍ التفعيل…", pushEnabledMsg: "هذا الجهاز مسجّل لاستقبال تنبيهات SAC الخاصة.", pushDisabledMsg: "تم إيقاف إشعارات SAC على هذا الجهاز.", pushErrEnable: "تعذّر تفعيل الإشعارات.", pushErrDisable: "تعذّر إيقاف الإشعارات.",
};

export const privateTranslations: Record<Language, PrivateCopy> = { fr: privateFr, en: privateEn, ar: privateAr };

export function fillCopy(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

export function localeFor(language: Language): string {
  return language === "ar" ? "ar" : language === "en" ? "en-GB" : "fr-FR";
}

export type AdminPermission = "read" | "create" | "update" | "process" | "export" | "delete";

export interface AdminTranslation {
  title: string; subtitle: string; unavailable: string; denied: string; loading: string; loadError: string;
  assignee: string; search: string; scope: string; scopeHint: string; due: string;
  create: string; missions: string; empty: string; emptyAudit: string; suspend: string;
  resume: string; revoke: string; active: string; suspended: string; revoked: string;
  saved: string; select: string; back: string; choose: string; edit: string; save: string;
  cancel: string; audit: string; actor: string; action: string; result: string;
  permissionsLabel: string; signIn: string; conflict: string;
  permissions: Record<AdminPermission, string>;
}

export const adminTranslations: Record<Language, AdminTranslation> = {
  fr: {
    title: "Administration SAC", subtitle: "Missions et délégations",
    unavailable: "Accès réservé au Super Admin sur ordinateur ou tablette.",
    denied: "Accès refusé ou session expirée.", loading: "Chargement…",
    loadError: "Impossible de charger les données administratives.",
    assignee: "Collaborateur (e-mail vérifié)", search: "Rechercher un e-mail",
    scope: "Périmètre précis", scopeHint: "Ex. : zone:niamey ou module:assistance",
    due: "Échéance (facultative)", create: "Attribuer la mission",
    missions: "Missions attribuées", empty: "Aucune mission pour le moment.",
    emptyAudit: "Aucun événement pour le moment.", suspend: "Suspendre", resume: "Reprendre",
    revoke: "Révoquer", active: "Active", suspended: "Suspendue", revoked: "Révoquée",
    saved: "Mission enregistrée.", select: "Sélectionner un compte", back: "Retour à l’accueil",
    choose: "Choisissez au moins une permission.", edit: "Modifier",
    save: "Enregistrer les modifications", cancel: "Annuler", audit: "Journal d’audit",
    actor: "Acteur", action: "Action", result: "Résultat",
    permissionsLabel: "Permissions explicitement accordées", signIn: "Se connecter",
    conflict: "La mission a été modifiée entre-temps. Rechargez et réessayez.",
    permissions: { read: "Consulter", create: "Créer", update: "Modifier", process: "Traiter", export: "Exporter", delete: "Supprimer" },
  },
  en: {
    title: "SAC administration", subtitle: "Missions and delegations",
    unavailable: "Access is limited to the Super Admin on desktop or tablet.",
    denied: "Access denied or session expired.", loading: "Loading…",
    loadError: "Unable to load administrative data.",
    assignee: "Collaborator (verified email)", search: "Search email",
    scope: "Exact scope", scopeHint: "e.g. area:niamey or module:support",
    due: "Deadline (optional)", create: "Assign mission",
    missions: "Assigned missions", empty: "No missions yet.",
    emptyAudit: "No events yet.", suspend: "Suspend", resume: "Resume",
    revoke: "Revoke", active: "Active", suspended: "Suspended", revoked: "Revoked",
    saved: "Mission saved.", select: "Select an account", back: "Back to home",
    choose: "Choose at least one permission.", edit: "Edit",
    save: "Save changes", cancel: "Cancel", audit: "Audit log",
    actor: "Actor", action: "Action", result: "Outcome",
    permissionsLabel: "Explicitly granted permissions", signIn: "Sign in",
    conflict: "The mission changed in the meantime. Reload and try again.",
    permissions: { read: "Read", create: "Create", update: "Update", process: "Process", export: "Export", delete: "Delete" },
  },
  ar: {
    title: "إدارة SAC", subtitle: "المهام والتفويضات",
    unavailable: "الوصول مخصص للمسؤول الأعلى عبر الكمبيوتر أو الجهاز اللوحي.",
    denied: "تم رفض الوصول أو انتهت الجلسة.", loading: "جارٍ التحميل…",
    loadError: "تعذر تحميل البيانات الإدارية.",
    assignee: "المتعاون (بريد موثّق)", search: "ابحث عن البريد",
    scope: "النطاق المحدد", scopeHint: "مثال area:niamey أو module:support",
    due: "الموعد النهائي (اختياري)", create: "إسناد المهمة",
    missions: "المهام المسندة", empty: "لا توجد مهام حالياً.",
    emptyAudit: "لا توجد أحداث حالياً.", suspend: "تعليق", resume: "استئناف",
    revoke: "إلغاء", active: "نشطة", suspended: "معلقة", revoked: "ملغاة",
    saved: "تم حفظ المهمة.", select: "اختر حساباً", back: "العودة للرئيسية",
    choose: "اختر صلاحية واحدة على الأقل.", edit: "تعديل",
    save: "حفظ التغييرات", cancel: "إلغاء", audit: "سجل التدقيق",
    actor: "المنفذ", action: "الإجراء", result: "النتيجة",
    permissionsLabel: "الصلاحيات الممنوحة صراحةً", signIn: "تسجيل الدخول",
    conflict: "تم تعديل المهمة في هذه الأثناء. أعد التحميل وحاول مجدداً.",
    permissions: { read: "قراءة", create: "إنشاء", update: "تعديل", process: "معالجة", export: "تصدير", delete: "حذف" },
  },
};
