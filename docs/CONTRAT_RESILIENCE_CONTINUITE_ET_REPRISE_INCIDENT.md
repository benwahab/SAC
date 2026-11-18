# SAC — Contrat de résilience opérationnelle, continuité et reprise après incident

**Date :** 18 novembre 2026  
**Statut :** contrat d'architecture et de validation. Les objectifs chiffrés, fournisseurs, procédures opérationnelles et mécanismes nouveaux restent à arbitrer.  
**Portée :** disponibilité, réseau faible, coupure Internet, panne API/D1, panne fournisseur, files de tâches, reprise après incident, sauvegardes, restauration, continuité SOS et communication de crise.  
**Nature :** documentation uniquement. Aucun mécanisme de reprise, sauvegarde, réplication, bascule, fournisseur ou service SOS réel n'est activé par ce document.

## 1. Références et priorité

À lire avec :
- `CONTRAT_SECURITE_CYCLE_SOS_ET_INTEGRITE_ALERTES.md` ;
- `CONTRAT_SECURITE_NOTIFICATIONS_ET_COMMUNICATIONS.md` ;
- `CONTRAT_SECURITE_TRAJETS_ET_LOCALISATION.md` ;
- `CONTRAT_CONSERVATION_ALERTES_ET_PURGE.md` ;
- `CONTRAT_SECURITE_D1.md` ;
- `CONTRAT_PREVENTION_ABUS_USURPATION_ET_SATURATION.md` ;
- `PLAN_DIRECTEUR_REALISATION_SAC.md` ;
- `AUDIT_ETAT_REEL_CODE_2026-11-18.md`.

Les règles métier et de confidentialité spécialisées prévalent sur toute stratégie de continuité. Une reprise technique ne peut jamais réactiver une alerte clôturée, un compte supprimé, une session révoquée, un appareil révoqué, une invitation expirée ou révoquée, une relation supprimée, une permission retirée ou une donnée qui doit être définitivement purgée.

## 2. État réel connu — ne pas confondre preuve et objectif

L'audit du 18 novembre 2026 établit :
- l'application utilise React, Vite, TypeScript, une PWA et Cloudflare Pages Functions ;
- une route `/api/health` exécute `SELECT 1 AS ok` via le binding D1 ;
- ce test vérifie une connectivité D1 élémentaire, pas le schéma métier, l'authentification, le cycle SOS, les notifications, les sauvegardes ni la capacité de reprise ;
- le service worker ne fournit pas de SOS hors ligne ;
- le SOS réel reste désactivé tant que le parcours serveur, la persistance, les destinataires, les transactions et les tests ne sont pas validés ;
- les notifications et fournisseurs réels ne sont pas démontrés comme opérationnels ;
- aucun test réel de restauration D1, de bascule, de panne fournisseur ou d'appareil Android/iOS n'est prouvé par cet audit.

Ces limites sont un constat daté du périmètre audité. Toute évolution doit être vérifiée à nouveau avant d'affirmer qu'une capacité existe.

## 3. Principes de continuité

1. **Vérité d'état :** l'interface ne doit jamais présenter comme transmis, livré, lu ou pris en charge ce qui n'a pas été confirmé par la source compétente.
2. **Priorité SOS :** la création et la cohérence métier de l'alerte sont prioritaires sur les fonctions secondaires et les fournisseurs de notification.
3. **Pas de dépendance GPS :** l'indisponibilité GPS ne bloque jamais la création d'un SOS ; le GPS réel reste NO-GO jusqu'à la preuve J+30.
4. **Pas de promesse hors ligne :** sans réception serveur, SAC ne prétend pas que les proches ont été avertis.
5. **Idempotence :** une reprise après délai dépassé, perte de réponse ou redémarrage ne crée pas de doublon métier.
6. **Reprise contrôlée :** chaque tâche peut être reprise sans réécrire l'histoire ni répéter une action externe de façon incontrôlée.
7. **Confidentialité :** les caches, sauvegardes, journaux, files et rapports d'incident ne doivent pas devenir des copies secondaires de données sensibles.
8. **Non-résurrection :** la restauration d'une sauvegarde ne réactive aucun état ou droit devenu invalide après la date de cette sauvegarde.
9. **Dégradation honnête :** une fonction indisponible est identifiée comme telle ; l'interface ne remplace pas un échec par un succès simulé.
10. **Indépendance des fonctions :** panne de push, e-mail, SMS futur, GPS, analytics ou stockage média ne doit pas annuler une alerte déjà créée.

## 4. États réseau et expérience utilisateur

La PWA doit distinguer explicitement les situations suivantes, sans les confondre :

| État | Signification | Comportement requis |
|---|---|---|
| Hors ligne | Aucun échange serveur confirmé | Afficher que la commande n'est pas transmise ; ne pas annoncer de SOS envoyé |
| Envoi en cours | Requête en attente de réponse | Afficher un état d'attente sans créer une nouvelle commande à chaque toucher |
| Résultat inconnu | La réponse réseau a été perdue après une éventuelle réception serveur | Retrouver l'état avec l'identifiant de commande ou la même clé idempotente |
| Reçu par le serveur | Création métier confirmée par le serveur | Afficher l'alerte créée, sans prétendre que les proches l'ont reçue |
| Notification en file | Travail planifié mais non envoyé | Afficher un état de traitement, pas une livraison |
| Accepté par fournisseur | Le fournisseur a accepté la requête | Ne pas afficher comme livré ou lu |
| Livraison confirmée | Une preuve fiable du canal indique la livraison | Distinguer livraison technique et lecture humaine |
| Ouvert dans SAC | Action authentifiée d'ouverture enregistrée | Ne pas prétendre connaître la compréhension ou la réaction humaine |
| Service indisponible | L'API ou le stockage nécessaire ne répond pas | Message clair ; pas de confirmation fictive |

Les textes et couleurs définitifs de ces états restent à intégrer dans le système de traduction. Les états doivent être accessibles, compréhensibles et utilisables sur réseau lent.

### 4.1 Réseau intermittent et requêtes en cours

- Une perte de réponse n'est pas la preuve que la transaction serveur a échoué.
- Le client conserve une référence de commande non sensible et réutilise la même clé d'idempotence.
- Il interroge l'état serveur avant de proposer un nouveau déclenchement.
- Les commandes non confirmées restent clairement marquées comme non transmises ou résultat inconnu.
- Les horodatages du terminal ne font pas autorité sur la chronologie serveur.
- Le client ne doit pas rejouer en rafale une file locale après reconnexion.
- Aucune donnée GPS précise ne doit être mise en file locale ou rejouée dans le cadre du présent contrat.

### 4.2 Téléphone fermé, application suspendue ou désinstallée

La PWA ne garantit pas l'exécution continue d'une tâche lorsque le navigateur est fermé, que le système suspend l'application ou que le téléphone est éteint. Les rappels SOS qui ont été créés et confirmés côté serveur doivent donc dépendre d'un mécanisme serveur durable, pas de la présence permanente du téléphone auteur.

Le comportement des notifications locales, des notifications push et des fonctions natives doit être testé séparément sur les appareils cibles. Aucun comportement Android/iOS n'est présumé identique.

## 5. Disponibilité du cycle SOS

Le cycle SOS doit être conçu autour d'une transaction serveur atomique qui crée ensemble :
- l'alerte ;
- l'instantané immuable des destinataires ;
- l'événement initial ;
- la référence de commande/idempotence ;
- les tâches d'outbox nécessaires au cycle.

Une transaction partiellement créée ne doit pas être présentée comme un SOS actif. Si la transaction échoue, aucune confirmation de création ne doit être affichée.

Après confirmation serveur :
- l'alerte existe indépendamment de la disponibilité des notifications ;
- les rappels prévus continuent selon le cycle approuvé, même si l'auteur ferme son téléphone ;
- une panne de push ou de SMS ne clôture pas et n'annule pas l'alerte ;
- le redémarrage d'un worker ne duplique pas les rappels ;
- la clôture par l'auteur reste le point d'arrêt métier prévu ;
- aucune reprise ne change les destinataires initiaux ni la responsabilité sans transition métier autorisée.

**Limite honnête :** si le serveur et la base nécessaires à la création sont indisponibles, SAC ne peut pas garantir qu'une alerte a été reçue. Le parcours doit le dire explicitement et ne pas afficher une fausse transmission.

## 6. Pannes de services et dégradation contrôlée

| Composant indisponible | Fonctions qui peuvent être affectées | Invariant à préserver |
|---|---|---|
| Push | Notifications push retardées ou perdues | Alerte et état métier inchangés |
| E-mail | OTP, invitations et messages e-mail en attente | Pas d'activation sans e-mail vérifié ; pas de faux succès |
| SMS futur | Relais SMS indisponible | Pas de promesse de SMS ; cycle SOS reste cohérent |
| GPS | Position indisponible | Déclenchement SOS possible sans GPS |
| Stockage média | Médias indisponibles | Ne pas bloquer le SOS essentiel ni afficher un média inexistant |
| Analytics | Mesures différées | Aucun impact sur autorisation ou cycle SOS |
| D1/API métier | Création/lecture/écriture impossible selon le périmètre | Ne jamais annoncer une opération non confirmée |
| Worker/outbox | Notifications et tâches retardées | Tâches récupérables, idempotentes et sans duplication |
| Interface statique/CDN | PWA inaccessible ou ancienne version | Ne pas prétendre qu'une version obsolète peut exécuter des fonctions serveur non disponibles |

Une panne doit être isolée autant que possible. Les fonctions non critiques ne doivent pas épuiser les ressources nécessaires aux commandes SOS, à l'authentification et à la révocation.

## 7. Outbox, workers et reprise après panne

Les contrats SOS et notifications définissent déjà l'outbox durable, les identifiants déterministes, les baux, la déduplication et les reprises.

Exigences consolidées :
1. Chaque tâche possède un identifiant stable et une clé d'idempotence adaptée à son effet.
2. Le worker acquiert un bail serveur borné ; un worker concurrent ne peut pas exécuter simultanément le même travail de manière non contrôlée.
3. Une tâche dont le bail expire peut être reprise après vérification de son état et de son résultat externe.
4. Les erreurs transitoires et permanentes sont distinguées.
5. Les reprises ont une stratégie bornée et une politique de mise en quarantaine à définir ; aucune boucle infinie de retry.
6. Les tâches sont réordonnées selon les règles métier, pas selon l'ordre arbitraire de retour des fournisseurs.
7. Un webhook tardif ou rejoué ne fait jamais régresser l'état métier.
8. Une tâche annulée, expirée, révoquée ou devenue non autorisée ne doit pas être réactivée par un redémarrage.
9. Les résultats ambigus du fournisseur doivent être réconciliés avant tout nouvel envoi qui risquerait un doublon.
10. Les erreurs et baux expirés sont observables sans journaliser de secrets ni de contenu sensible.

Les délais, nombre de tentatives, intervalles, durée des baux et seuils de quarantaine restent à arbitrer et à tester. Aucun chiffre nouveau n'est approuvé ici.

## 8. Sauvegardes, restauration et non-résurrection

Une sauvegarde sert à restaurer la continuité technique ; elle n'est pas une autorité permettant de revenir sur les décisions métier prises après sa création.

### 8.1 Invariants après restauration

La procédure doit réconcilier l'état restauré avec les faits et suppressions qui doivent rester applicables :
- comptes supprimés et états de compte terminaux ;
- sessions, jetons, certificats et appareils révoqués ;
- invitations expirées, refusées ou révoquées ;
- relations de confiance et permissions retirées ;
- alertes clôturées ;
- positions GPS déjà supprimées ;
- alertes et catégories arrivées à J+30 ;
- tâches d'outbox déjà exécutées, annulées ou expirées ;
- abonnements push invalides ou révoqués ;
- changements de configuration de sécurité postérieurs à la sauvegarde.

La restauration ne doit jamais remettre en service une ancienne session, un ancien jeton, un ancien appareil, une invitation ou une permission.

### 8.2 Règle de conservation des alertes — non négociable

Le contrat spécialisé prévaut :
1. À la clôture d'une alerte, toutes les positions GPS précises liées à cette alerte sont supprimées immédiatement.
2. Seule la nature/catégorie de l'alerte demeure dans l'historique pendant 30 jours après clôture.
3. À J+30, l'entrée d'historique et sa catégorie sont supprimées définitivement.
4. Aucune sauvegarde, snapshot, réplication, export contrôlé, restauration ou D1 Time Travel ne doit rendre ces données récupérables ou lisibles.
5. Une restauration ne peut pas contourner cette exigence au motif qu'une sauvegarde antérieure contenait encore les données.

Cette exigence s'applique aussi aux copies indirectes dans les files, logs, traces, caches, exports et rapports d'incident. Le GPS réel reste NO-GO tant que la preuve technique complète de suppression et de non-résurrection n'existe pas.

### 8.3 Procédure de restauration contrôlée

Avant de rouvrir les écritures et l'accès utilisateur après une restauration :
1. isoler l'environnement restauré des utilisateurs et des fournisseurs externes ;
2. vérifier l'identité de l'environnement, la version du schéma et la provenance de la sauvegarde ;
3. appliquer/réconcilier les suppressions, révocations et expirations postérieures à la sauvegarde à partir d'une source d'autorité indépendante et durable ;
4. vérifier les invariants de conservation GPS/alertes ;
5. empêcher l'envoi automatique de tâches d'outbox anciennes avant réconciliation ;
6. vérifier que les alertes clôturées ne sont pas réouvertes et que les rappels anciens ne repartent pas ;
7. vérifier sessions, appareils, invitations, permissions et abonnements ;
8. exécuter les contrôles d'intégrité et tests de cohérence ;
9. faire approuver la remise en service par les rôles explicitement désignés dans une procédure à arbitrer ;
10. conserver un rapport de restauration minimisé, sans réintroduire de données purgées.

Si la non-résurrection ne peut pas être démontrée, l'environnement reste isolé et la remise en service est NO-GO.

## 9. Objectifs de reprise et gouvernance d'incident

Les valeurs RTO (délai cible de rétablissement) et RPO (perte de données maximale admissible) ne sont pas fixées dans ce contrat. Elles doivent être définies par criticité :
- création et lecture d'alerte SOS ;
- authentification et révocation ;
- rappels et outbox ;
- gestion des proches ;
- fonctions de trajet, si elles sont ultérieurement activées ;
- médias et fonctions secondaires ;
- console professionnelle et administration.

Le choix doit tenir compte de la capacité réelle de l'équipe, des coûts, des garanties Cloudflare/D1, des dépendances fournisseurs et des conditions réseau au Niger et dans les pays d'usage.

### 9.1 Niveaux d'incident proposés

Cadre de classification à arbitrer :
- **P0 — sécurité/vie privée :** fuite de données, accès non autorisé, résurrection de données purgées, altération d'alertes ou compromission de secrets ;
- **P1 — continuité SOS :** création d'alerte indisponible, rappels durablement interrompus, corruption de la chronologie ou de l'instantané destinataires ;
- **P2 — fonctions critiques secondaires :** authentification, révocation, invitations ou communications indisponibles ;
- **P3 — fonctions non critiques :** médias, statistiques, confort, analytics ou interface secondaire.

Une fuite, une compromission ou une résurrection de données peut imposer l'isolement d'un service, même si cela réduit temporairement sa disponibilité. Les décisions d'isolement et de notification doivent suivre une procédure documentée, pas une improvisation.

### 9.2 Runbook minimum à préparer

Pour chaque incident :
1. détecter et qualifier avec horodatage serveur ;
2. nommer un responsable d'incident et un remplaçant ;
3. préserver les preuves minimales sans copier le contenu sensible ;
4. contenir la cause sans effacer les traces ;
5. déterminer les alertes et utilisateurs réellement affectés sans supposer une livraison ;
6. rétablir le service dans un environnement vérifié ;
7. réconcilier les files et états métier sans doublon ;
8. vérifier les suppressions et révocations ;
9. communiquer un état exact, sans divulguer d'informations privées ;
10. rédiger un retour d'expérience et des actions correctives.

Les rôles, contacts d'escalade, délais de communication et critères de notification restent à définir. Aucune permanence opérationnelle n'est présumée exister.

## 10. Observabilité sans surveillance

La supervision doit mesurer le fonctionnement sans collecter le contenu privé :
- disponibilité API et D1 ;
- latence, taux d'erreur et saturation par catégorie de route ;
- taille et ancienneté des files ;
- baux expirés, retries et tâches en quarantaine ;
- résultats techniques des fournisseurs, distincts des états métier ;
- échecs de sauvegarde et de restauration ;
- résultat des purges et contrôles de non-résurrection ;
- version déployée et compatibilité du schéma.

Interdictions :
- GPS précis, mot de passe, OTP, jeton brut, clé privée ou racine cryptographique dans les logs ;
- corps complet de SOS, description, adresse ou détails familiaux dans les métriques ;
- données de destinataires dans les tableaux publics de santé ;
- considérer une métrique ou un ping health comme preuve que le SOS est fonctionnel.

Les durées de conservation des logs et métriques restent soumises à la politique générale à arbitrer.

## 11. Tests de résilience obligatoires

### Réseau et PWA
1. Perte de réseau avant envoi : aucune confirmation de SOS.
2. Perte de réponse après commit serveur : récupération de la même alerte sans doublon.
3. Reconnexion après plusieurs minutes : aucune rafale de commandes ou positions historiques.
4. Application suspendue ou fermée : les tâches serveur déjà confirmées continuent selon leur cycle.
5. Téléphone redémarré : aucune fausse confirmation issue d'un état local périmé.
6. Service worker obsolète : incompatibilité détectée ou erreur explicite, aucune écriture métier avec ancien contrat non supporté.

### API, D1 et workers
7. D1 indisponible avant création : aucun SOS annoncé comme créé.
8. D1 répond mais schéma métier absent/incompatible : health basique ne doit pas annoncer le système métier opérationnel.
9. Transaction de création interrompue : aucun état partiel visible.
10. Worker arrêté après acquisition d'un bail : reprise sans doublon.
11. Webhook fournisseur dupliqué ou retardé : aucun recul d'état.
12. Panne fournisseur prolongée : alerte métier préservée et état de livraison honnête.
13. Quota ou saturation d'une fonction non critique : capacité SOS isolée autant que l'architecture le permet.
14. Retry en boucle : bornage, observation et mise en quarantaine.
15. Deux workers concurrents : une seule exécution métier effective.

### Sauvegarde et restauration
16. Restauration d'une sauvegarde avant révocation : l'appareil et ses sessions restent révoqués.
17. Restauration avant clôture : l'alerte ne redevient pas active.
18. Restauration avant expiration d'invitation : invitation expirée reste inutilisable.
19. Restauration avant suppression J+30 : catégorie et entrée purgées restent irrécupérables.
20. Restauration d'une copie antérieure à la clôture : aucune position GPS supprimée ne redevient lisible.
21. Outbox restaurée : aucun rappel déjà exécuté, annulé ou devenu invalide ne repart.
22. Abonnements push restaurés : les abonnements révoqués ne sont pas réactivés.
23. Restauration incomplète ou source d'autorité indisponible : environnement maintenu isolé.
24. Retour arrière de version : migrations, contrats et files ne corrompent pas les états métier.

### Exploitation
25. Panne simultanée d'un fournisseur et d'un worker : l'alerte demeure cohérente.
26. Secret fournisseur compromis : révocation/rotation sans exposition de données métier.
27. Pic de trafic : mesure, limitation et dégradation sans bloquer aveuglément le SOS.
28. Incident de confidentialité : isolement, préservation des preuves et reprise contrôlée.
29. Reprise après restauration : validation explicite avant ouverture des écritures et envois externes.
30. Exercice complet documenté : chronologie, temps de détection, restauration, erreurs et preuves.

## 12. Arbitrages restant ouverts

- RTO/RPO par fonction et objectifs de disponibilité réalistes ;
- capacité d'astreinte et responsabilité d'incident ;
- source indépendante d'autorité pour les suppressions/révocations postérieures à une sauvegarde ;
- fréquence, durée et chiffrement des sauvegardes ;
- tests périodiques de restauration et environnement isolé ;
- stratégie de versionnement et compatibilité du service worker PWA ;
- quotas, priorités et capacité réservée au SOS ;
- seuils d'alerte et tableaux de supervision ;
- stratégie de retry, durée des baux, quarantaine et réconciliation des résultats ambigus ;
- communication aux utilisateurs et autorités compétentes selon les obligations applicables ;
- fournisseur, région, SLA, coûts, réversibilité et garanties réelles de chaque dépendance ;
- procédure d'approbation de remise en service après incident.

Aucun RTO, RPO, SLA, fournisseur, région, fréquence de sauvegarde, durée de retry ou seuil de supervision n'est approuvé par ce document.

## 13. Conditions avant mise en production

SAC ne peut pas être déclaré prêt pour une exploitation SOS réelle avant :
1. parcours serveur de création d'alerte réellement implémenté et autorisé ;
2. persistance atomique et tests D1 d'intégration ;
3. outbox et workers récupérables et idempotents ;
4. authentification, sessions et révocations opérationnelles ;
5. états de livraison honnêtes et essais contrôlés des canaux réellement activés ;
6. procédures de panne et de restauration exécutées en environnement isolé ;
7. preuve de non-résurrection des données supprimées ;
8. levée du NO-GO GPS uniquement si toutes ses conditions propres sont démontrées ;
9. tests réseau faible et appareils cibles ;
10. revue indépendante de sécurité et confidentialité ;
11. runbooks, responsabilités et communications de crise approuvés ;
12. autorisation explicite avant toute modification de code, base, ressource Cloudflare, fournisseur, secret ou déploiement.

**Conclusion :** la résilience de SAC ne se mesure pas à une page qui s'ouvre ou à un serveur qui répond à un ping. Elle se démontre par la cohérence du SOS, la reprise sans doublon, la transparence envers l'utilisateur et l'impossibilité de ressusciter les données supprimées.
