# SAC Santé — Conception fonctionnelle et décisions validées

**Date de consolidation :** 21 novembre 2026  
**Statut :** conception fonctionnelle consolidée ; module non déclaré implémenté.  
**Périmètre :** rappels personnels et familiaux, suivi des patients par les cliniques et rappels de santé programmés.

## 1. Positionnement

SAC Santé étend SAC avec des fonctions de prévention et de suivi programmés. Il ne remplace pas le dispositif d'alerte d'urgence et ne modifie pas son cycle SOS.

Deux domaines métier restent strictement séparés :
- **Urgence / SOS :** déclenchement volontaire d'une alerte de sécurité et cycle de prise en charge existant.
- **SAC Santé :** rappels programmés, suivi médical et notifications de suivi non urgentes.

Un rappel de santé non confirmé ne déclenche jamais automatiquement un SOS, un appel d'urgence ou un SMS d'urgence.

## 2. Décisions utilisateur validées le 21 novembre 2026

Ces arbitrages sont validés et remplacent les options alternatives précédemment envisagées.

### 2.1 Compte obligatoire pour le patient

**Décision : le patient doit disposer d'un compte SAC.**
- Une clinique ne peut pas créer un dossier patient autonome pour une personne dépourvue de compte SAC.
- Le patient est identifié par son compte SAC et selon le parcours de vérification applicable.
- La clinique peut rechercher un compte via un mécanisme sécurisé et inviter le patient à autoriser le suivi.
- L'existence d'un compte ne donne aucun droit automatique à la clinique : le rattachement au suivi doit être autorisé et traçable.
- Si le patient n'a pas encore de compte, il doit créer son compte SAC avant l'activation du suivi clinique.

### 2.2 Réception des rappels dans le compte SAC

**Décision : les rappels sont reçus dans le compte SAC du patient.**
- Le canal de référence est la notification SAC associée au compte du patient.
- Les rappels sont visibles dans l'espace personnel SAC Santé.
- L'état du rappel est synchronisé côté serveur et consultable depuis les appareils autorisés du compte.
- Le SMS n'est pas le canal retenu par défaut. Toute extension future à d'autres canaux devra faire l'objet d'une décision distincte sur le consentement, la sécurité et les coûts.
- Les notifications sur écran verrouillé doivent préserver la confidentialité : ne pas exposer par défaut le nom d'un médicament, un diagnostic ou des détails médicaux.

### 2.3 Rappel non confirmé : notification de la clinique

**Décision : lorsqu'un rappel n'est pas confirmé, la clinique est informée.**
- Le système distingue « envoyé », « délivré si cette information est disponible », « consulté si cette information est disponible », « confirmé » et « non confirmé à l'échéance ».
- À l'échéance définie, si aucune confirmation valide n'a été reçue, un événement de non-confirmation est enregistré et la clinique responsable est notifiée.
- La notification identifie le patient et le rappel uniquement pour les professionnels autorisés à ce suivi.
- La clinique voit la date, l'heure, la nature du rappel et son état, dans les limites de ses droits.
- Une non-confirmation n'est pas une preuve que le patient n'a pas pris son médicament, manqué son rendez-vous ou interrompu son traitement. Elle signifie uniquement qu'aucune confirmation n'a été enregistrée.
- La clinique décide de la conduite à tenir dans le cadre de ses responsabilités professionnelles. SAC ne formule pas de diagnostic et ne modifie pas une prescription.
- Les délais d'échéance, règles de relance et éventuelles escalades restent à définir. Aucun délai arbitraire n'est imposé par cette décision.
- Cette notification professionnelle n'est jamais convertie automatiquement en SOS.

## 3. Expérience patient et famille

### 3.1 Rappels personnels

Un utilisateur peut programmer des rappels pour lui-même, selon les fonctions incluses dans son offre.

Données fonctionnelles envisagées :
- nom précis du médicament ou intitulé du rappel ;
- quantité ou consigne fournie par l'utilisateur ou un professionnel autorisé ;
- date de début et, si applicable, date de fin ;
- jours et heures ;
- instructions complémentaires ;
- fuseau horaire et état actif, suspendu ou terminé ;
- confirmation du rappel et historique des événements.

Le système rappelle les informations saisies ; il ne prescrit pas, ne calcule pas une posologie et ne recommande pas de modifier une dose.

### 3.2 Rappels pour un proche

Un utilisateur peut gérer un rappel pour un proche uniquement si ce proche dispose d'un compte SAC et a accepté explicitement le rattachement et le suivi.

Le proche peut consulter les rappels qui le concernent, accepter ou refuser le suivi, suspendre ou révoquer l'autorisation selon les règles du produit. Le créateur du rappel reste identifiable dans l'historique.

Aucun utilisateur ne peut programmer secrètement des rappels médicaux pour un autre compte.

### 3.3 Confirmation

Le patient peut confirmer un rappel depuis son espace SAC. Cette action est une déclaration du patient, pas une preuve médicale indépendante.

Une absence de confirmation reste un état distinct. Elle ne doit jamais être transformée en confirmation négative ni en affirmation que le médicament n'a pas été pris.

## 4. Espace clinique SAC Santé

Chaque clinique dispose d'un espace professionnel isolé, distinct de l'expérience citoyenne mobile.

Fonctions envisagées :
- création et gestion du profil de la clinique ;
- invitation et gestion des professionnels selon leurs rôles ;
- recherche et rattachement de patients disposant d'un compte SAC ;
- gestion des consentements et autorisations de suivi ;
- création de suivis individuels ;
- constitution de groupes de suivi ;
- programmation de rappels personnalisés ;
- consultation des confirmations et non-confirmations ;
- notification de l'équipe clinique en cas de rappel non confirmé ;
- historique des actions et rapports autorisés.

### 4.1 Dossier de suivi individuel

Un dossier de suivi peut contenir, selon le consentement et les permissions :
- référence du compte patient ;
- clinique responsable ;
- professionnel responsable ;
- motif ou catégorie de suivi ;
- rendez-vous et échéances ;
- rappels programmés ;
- consignes rédigées par un professionnel autorisé ;
- événements de suivi ;
- confirmations et non-confirmations ;
- statut du suivi, dates de début et de fin.

Le dossier SAC Santé ne collecte que les informations nécessaires au suivi convenu. Il ne devient pas un dossier médical exhaustif par défaut.

### 4.2 Groupes de patients

Une clinique peut créer des groupes correspondant à un programme ou à une catégorie de suivi (par exemple suivi prénatal, post-opératoire ou suivi d'une maladie chronique), sous réserve de validation clinique et juridique.

- Un groupe organise un programme commun ; il ne partage pas les dossiers entre patients.
- Chaque patient conserve un dossier individuel et des rappels individualisés.
- Les patients ne voient jamais les noms, comptes, rappels ou données des autres membres.
- Les consignes et horaires peuvent varier selon le patient.
- Un professionnel ne voit que les patients et groupes inclus dans son périmètre d'autorisation.

### 4.3 Rôles professionnels

La conception prévoit des permissions séparées, par exemple :
- médecin ou professionnel habilité : création et validation des consignes relevant de sa compétence ;
- infirmier ou professionnel de suivi : exécution et mise à jour des tâches expressément autorisées ;
- secrétaire : gestion administrative et rendez-vous, sans accès automatique aux détails médicaux ;
- administrateur de clinique : gestion de l'organisation et des accès, sans droit médical automatique.

Les rôles exacts, leurs actes autorisés et les exigences de qualification doivent être validés avant la mise en production. Aucun rôle administratif ne confère par défaut un accès intégral aux données de santé.

## 5. Cycle de vie d'un rappel clinique

1. Un professionnel autorisé crée un rappel lié à un patient ayant un compte SAC.
2. Le système vérifie le rattachement actif, le consentement et les permissions.
3. Le rappel est enregistré avec sa source, son auteur, son échéance et sa version.
4. SAC envoie une notification au compte du patient.
5. Le patient peut consulter et confirmer le rappel.
6. Si une confirmation valide arrive dans le délai prévu, l'état passe à « confirmé ».
7. Si aucune confirmation n'arrive à l'échéance, l'état passe à « non confirmé » et la clinique responsable reçoit une notification.
8. La clinique traite l'information selon son protocole et ses responsabilités.
9. Toute modification, suspension, annulation ou clôture est horodatée et auditée.

Les tâches planifiées doivent être idempotentes : une même échéance ne peut pas produire plusieurs notifications de non-confirmation identiques à la suite d'une relance technique.

Une confirmation tardive est enregistrée comme telle sans effacer l'événement historique de non-confirmation déjà émis.

## 6. Confidentialité, sécurité et gouvernance

Exigences minimales :
- consentement explicite du patient avant activation d'un suivi clinique ;
- possibilité de retirer le consentement et de mettre fin au rattachement, avec traitement des obligations de conservation applicables ;
- cloisonnement strict des données entre cliniques ;
- contrôle serveur de chaque accès par acteur, clinique, patient, ressource et action ;
- permissions professionnelles minimales et révocables ;
- journal d'audit des consultations et modifications sensibles ;
- chiffrement en transit et au repos selon les capacités de l'infrastructure retenue ;
- secrets et clés exclusivement côté serveur ;
- notifications à contenu discret par défaut ;
- limitation des données visibles aux secrétaires et personnels administratifs ;
- politique documentée de conservation, export et suppression ;
- révocation des accès au départ d'un professionnel ;
- aucun accès transversal de l'équipe SAC aux données médicales sans autorisation précise et motif contrôlé.

Les règles applicables au Niger en matière de données personnelles et de données de santé doivent être examinées et validées par un conseil compétent avant le lancement. Ce document ne constitue pas une déclaration de conformité juridique.

## 7. Séparation avec le système SOS

Les rappels SAC Santé utilisent un moteur de programmation et de notifications distinct du moteur SOS.
- Une non-confirmation de médicament ou de rendez-vous ne déclenche pas d'alerte d'urgence.
- Aucun contact de confiance n'est informé automatiquement d'un rappel clinique non confirmé.
- Les règles SOS existantes, y compris leurs seuils et leurs canaux de secours, ne sont pas réutilisées pour les rappels de santé.
- Une personne peut toujours déclencher volontairement un SOS par le parcours normal de SAC, indépendamment de ses rappels de santé.

## 8. Modèle de données conceptuel à étudier

Les noms ci-dessous sont indicatifs. Ils ne constituent pas des tables existantes ni une autorisation de migration.

Entités candidates :
- health_clinics : organisations cliniques ;
- health_clinic_members : professionnels et rôles dans une clinique ;
- health_patient_links : rattachement patient-clinique, consentement, état et dates ;
- health_followups : suivis individuels ;
- health_programs : programmes de suivi et groupes ;
- health_program_members : adhésion des patients à un programme ;
- health_reminders : rappels personnels ou cliniques ;
- health_reminder_events : événements immuables du cycle de rappel ;
- health_reminder_confirmations : déclarations de confirmation ;
- health_clinic_notifications : notifications destinées à l'équipe clinique ;
- health_audit_events : événements d'accès et d'administration sensibles.

Avant tout schéma D1, il faut vérifier les tables communes existantes (comptes, rôles, missions, notifications, documents et audit), réutiliser les entités pertinentes et éviter les doublons.

## 9. Offre et tarification — principes à arbitrer

La conception commerciale peut distinguer :
- fonctions essentielles de sécurité et SOS, qui ne doivent jamais être bloquées par un abonnement ;
- rappels personnels et familiaux pouvant relever d'une offre Premium ;
- espace SAC Santé professionnel pour les cliniques, avec une tarification potentiellement liée au nombre de patients actifs ou aux services utilisés.

Les prix, limites, périodes d'essai, modalités de paiement et fonctionnalités exactes par formule restent à décider. Aucun tarif ni quota n'est validé par ce document.

## 10. Points restant à décider avant implémentation

1. Méthode exacte de recherche, invitation et vérification de l'identité d'un patient.
2. Écran et étapes du consentement patient-clinique, y compris retrait et transfert de suivi.
3. Délai d'un rappel avant son classement « non confirmé ».
4. Règles de relance du patient et de notification de plusieurs professionnels de la clinique.
5. Gestion des rappels récurrents, changements d'heure, fuseaux horaires et indisponibilité réseau.
6. Matrice finale des rôles et actes professionnels autorisés.
7. Politique de conservation et suppression des données de santé et journaux associés.
8. Tarification et limites des offres individuelles, familiales et cliniques.
9. Validation juridique et clinique des parcours, contenus et responsabilités.
10. Architecture technique détaillée, tests d'isolation multi-cliniques et tests d'idempotence.

## 11. État d'avancement

À la date de ce document :
- les trois décisions de produit de la section 2 sont validées ;
- le présent document formalise la conception fonctionnelle ;
- aucun module SAC Santé n'est déclaré implémenté ;
- aucune migration D1, intégration de prestataire, notification clinique réelle ou donnée patient n'est créée par cette consolidation ;
- l'implémentation devra commencer par un audit du code et du modèle existants, puis par une conception détaillée des permissions, du consentement, du cycle de rappel et de la conservation.
