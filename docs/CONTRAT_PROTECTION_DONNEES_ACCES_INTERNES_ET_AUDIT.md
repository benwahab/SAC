# SAC — Contrat de protection des données personnelles, accès internes et traçabilité

**Date :** 18 novembre 2026  
**Statut :** consolidation normative des invariants déjà validés et propositions techniques à arbitrer.  
**Portée :** documentation uniquement ; aucun rôle, accès, journal, endpoint, export, stockage, fournisseur, secret ou mécanisme n'est activé par ce contrat.

## 1. Objet et documents de référence

Ce contrat relie sans les remplacer :
- `CATALOGUE_RESSOURCES_MATRICE_PERMISSIONS.md` ;
- `CLASSIFICATION_DONNEES_ET_ACCES_ADMIN.md` ;
- `GOUVERNANCE_MISSIONS_ADMIN_ET_CYCLE_DE_VIE.md` ;
- `MODELE_MENACES_ET_PLAN_SECURITE_ADMIN.md` ;
- `CONTRATS_OPERATIONS_ADMIN_ATOMIQUES.md` ;
- `MODELE_DONNEES_ADMIN_ET_INTEGRATION_SAC.md` ;
- `PROPOSITION_POLITIQUE_GENERALE_CONSERVATION_DONNEES.md`.

Il ferme les ambiguïtés de parcours autour de la consultation interne, de l'accès exceptionnel, de la traçabilité et de l'intégrité des journaux. Il ne remplace pas les arbitrages encore ouverts dans ces documents.

## 2. Invariants déjà établis — à préserver

1. Le Super Admin est l'unique autorité qui crée, attribue, modifie, suspend, reprend, révoque et termine les missions/délégations.
2. Un délégataire ne peut jamais déléguer, créer un compte administratif, attribuer une mission, s'auto-augmenter ou étendre ses droits.
3. Une permission non explicitement accordée est refusée. Rôle, permission et mission restent distincts.
4. Toute autorisation est recalculée côté serveur à chaque requête, selon le compte, la session, la mission active, la permission atomique, la ressource et le périmètre.
5. Les accès administratifs ne donnent aucun droit général sur les données personnelles.
6. Les secrets C4 — mots de passe, OTP, jetons bruts, clés privées, secrets de récupération — ne sont jamais lisibles par les consoles internes.
7. Le GPS précis reste interdit/NO-GO tant que la destruction irréversible et la non-résurrection après restauration ne sont pas démontrées.
8. Les traces historiques ne sont ni réécrites ni effacées par un rôle administratif.
9. Les durées de conservation générales proposées restent non approuvées ; le contrat spécialisé des alertes/GPS conserve ses règles validées.
10. Aucun mécanisme décrit ici n'est réputé opérationnel avant implémentation, tests et revue.

## 3. Règle d'accès aux données

Toute opération de lecture, recherche, aperçu, pagination, téléchargement ou export doit satisfaire simultanément :

- identité d'acteur authentifiée et compte/session actifs ;
- rôle fonctionnel connu côté serveur ;
- mission déterminée, active, non expirée, non suspendue et non révoquée ;
- permission atomique correspondant à l'action exacte ;
- ressource et périmètre correspondant exactement à la mission ;
- finalité/motif exigé pour la classe de données concernée ;
- champs strictement nécessaires à cette finalité ;
- éventuelles conditions renforcées validées pour une action critique.

L'absence, l'ambiguïté, l'incohérence ou l'indisponibilité d'une de ces preuves entraîne un refus. Aucun droit ne peut être déduit d'une URL, d'un identifiant fourni par le navigateur, d'un bouton visible, d'un rôle stocké côté client ou d'une ancienne autorisation mise en cache.

Une permission de lecture ne vaut jamais permission de recherche globale, d'accès aux pièces jointes, de téléchargement ou d'export. Chaque sous-ressource et chaque page paginée sont contrôlées séparément.

## 4. Matrice de minimisation opérationnelle

| Classe | Données | Exigence d'affichage interne |
|---|---|---|
| C0 | État général non sensible, version, santé publique | Selon fonction, sans identité utilisateur |
| C1 | Procédures, paramètres non secrets, statistiques agrégées | Mission si nécessaire ; agrégation privilégiée |
| C2 | Identité, e-mail, téléphone déclaré, profil, métadonnées de compte | Champs masqués par défaut ; révélation ciblée si la tâche l'exige |
| C3 | Alertes individuelles, proches, interventions, notes et historique nominatif | Accès nominatif, dossier/alerte unique, motif obligatoire et journalisation de lecture |
| C4 | Mots de passe, OTP, jetons bruts, clés privées, secrets de récupération, GPS précis | Jamais affichés ni exportés par une console administrative ordinaire ; GPS précis non collecté tant que NO-GO |

Le masquage est appliqué côté serveur, pas uniquement par CSS. Les réponses API ne doivent pas contenir les champs cachés. Les recherches doivent utiliser les mêmes contrôles de périmètre que les fiches détaillées.

Les données d'un proche ne deviennent pas accessibles parce qu'il partage un appareil, un numéro, un foyer ou une relation avec le titulaire. Les groupes privés ne confèrent aucun droit d'accès aux alertes ou au GPS.

## 5. Parcours d'une consultation sensible C3

Parcours cible :

1. L'acteur ouvre une demande ou un dossier métier identifié.
2. Il choisit une ressource précise et indique une finalité compréhensible.
3. Le serveur vérifie mission, permission, périmètre, état de la ressource et conditions.
4. Le serveur construit une vue minimale avec masquage des champs non nécessaires.
5. Un événement de consultation est inscrit avant que le contenu soit rendu accessible, ou l'accès est refusé si l'écriture obligatoire de la trace échoue.
6. Chaque pagination, pièce jointe, nouvelle recherche ou téléchargement répète le contrôle.
7. La fin de mission, sa suspension, sa révocation ou son expiration coupe les requêtes futures immédiatement.

**Proposition à arbitrer :** exiger une référence de dossier et une justification structurée pour chaque lecture C3, avec une durée d'accès ponctuelle très courte. Aucune durée n'est fixée ici.

Une urgence ne crée pas de privilège implicite. Si aucun acteur n'est habilité, la demande est transmise au Super Admin. Aucun mode « break-glass » ne doit être ajouté sans décision explicite, périmètre, authentification renforcée, journalisation et revue indépendante.

## 6. Recherche, statistiques et prévention de l'exploration

- Pas de recherche globale de personnes par défaut.
- Les recherches doivent être limitées aux ressources couvertes par une mission active.
- Les filtres, suggestions, compteurs, facettes, exports et messages d'erreur ne doivent pas révéler l'existence d'une ressource hors périmètre.
- Les statistiques privilégient les agrégats et doivent prévenir la ré-identification par petits groupes ou filtres successifs.
- Toute consultation répétitive, volumineuse ou atypique peut produire un signal de sécurité ; elle ne doit pas provoquer automatiquement une sanction sans règle approuvée.
- Les limites de volume et seuils d'alerte restent à arbitrer ; aucun chiffre n'est présumé validé.

## 7. Exports et copies hors SAC

Un export est une capacité distincte, jamais incluse implicitement dans la lecture.

Avant génération : autorisation d'export distincte, motif, périmètre, catégories et champs explicitement autorisés, bénéficiaire et échéance. Avant chaque téléchargement : réauthentification si exigée par la politique validée, vérification actuelle de la mission, permission, bénéficiaire, état du fichier et expiration.

Après révocation ou expiration, aucun téléchargement futur ne doit être possible, même si le fichier a été préparé auparavant. Les liens ne sont ni transférables ni permanents. Les fichiers temporaires doivent être privés, chiffrés selon une conception validée et supprimés/inaccessibles selon la politique de conservation approuvée.

Les exports ne contiennent jamais C4, GPS précis, OTP, clés privées ou jetons bruts. SAC ne peut pas garantir l'effacement de copies indépendantes qu'un destinataire aurait déjà téléchargées hors de ses systèmes ; il faut donc minimiser les exports et avertir explicitement de cette limite avant toute autorisation.

**À arbitrer :** formats, champs, limites de volume, durée de disponibilité, chiffrement, autorisation renforcée, durée de conservation et procédure de révocation des copies encore sous contrôle SAC.

## 8. Journal d'audit : événements et séparation

Distinguer au minimum :
- journal métier : événements de cycle de vie et décisions ;
- journal de sécurité : authentifications, refus, révocations, anomalies ;
- journal d'accès aux données : lectures C2/C3, recherches sensibles, pièces jointes et exports ;
- logs techniques : diagnostics expurgés, erreurs et corrélations.

Ne pas fusionner ces flux en un journal général contenant des copies de données privées.

Chaque événement d'audit devrait inclure : identifiant unique, horodatage UTC serveur, acteur et type d'acteur, rôle effectif, mission et version, permission évaluée, action, résultat, ressource et périmètre, motif/référence de dossier lorsque requis, identifiant de corrélation et référence cryptographique à l'événement précédent si le mécanisme est retenu.

Ne jamais inclure : mot de passe, OTP, jeton brut, clé privée, secret de récupération, GPS précis, contenu intégral d'une alerte, corps complet de messages privés ou pièce jointe.

Les consultations du journal et ses exports sont eux-mêmes journalisés. Le lecteur ne peut pas modifier les événements qu'il consulte.

## 9. Intégrité et résistance à l'altération

Exigences cibles :
1. écriture côté serveur uniquement ; aucun événement d'audit faisant autorité ne vient du client ;
2. append-only au niveau logique et permissions de stockage séparées des rôles applicatifs ;
3. mutation sensible et événement d'audit obligatoire dans une même frontière transactionnelle ; si la trace ne peut pas être créée, la mutation échoue ;
4. séquence monotone ou chaînage cryptographique avec vérification indépendante ;
5. détection et alerte en cas de rupture, doublon, suppression, divergence ou retard anormal ;
6. copie de contrôle indépendante des droits du compte applicatif, selon une architecture à concevoir ;
7. accès aux preuves, vérifications et exports de journaux également tracés.

Un hash chaîné stocké uniquement dans la même base et sous les mêmes privilèges n'est pas une preuve suffisante contre un opérateur capable de réécrire toute la base. Le scellement externe, la séparation des responsabilités et les sauvegardes protégées nécessitent une étude technique et contractuelle.

**À arbitrer :** stockage immuable/externe, cadence de scellement, ancrage indépendant, gestion des clés, vérificateur, alertes, accès de contrôle et conservation légale. Aucun fournisseur n'est choisi.

## 10. Pouvoirs du Super Admin et séparation des responsabilités

Le Super Admin conserve l'autorité unique de gouvernance des missions. Cette autorité ne signifie pas qu'il peut effacer une trace, lire un secret C4 ou contourner les règles de minimisation.

- Toute création, attribution, modification, suspension, reprise, révocation ou clôture de mission est explicitement motivée et auditée.
- Une action du Super Admin est soumise aux mêmes contrôles d'intégrité et à la même impossibilité de réécriture de l'historique.
- Le Super Admin ne peut pas faire passer une lecture pour une simple opération technique afin d'éviter sa traçabilité.
- Aucun délégataire ne peut s'attribuer une permission ou transmettre une mission.
- Les actes particulièrement sensibles (export C3, clôture administrative, changement de permission critique, accès exceptionnel) doivent faire l'objet d'une authentification renforcée si cette proposition est approuvée.

**Point de gouvernance à arbitrer :** comment contrôler indépendamment les actions du Super Admin sans transférer à un autre rôle son autorité de création/gestion des missions. Options à étudier : vérification cryptographique externe, journal scellé hors de son contrôle applicatif, revue périodique indépendante en lecture seule. Aucun second administrateur ne reçoit implicitement un droit de veto ou de délégation.

## 11. Incidents et révocation

En cas de suspicion d'abus :
1. préserver les journaux et identifiants de corrélation ;
2. identifier les missions, sessions, appareils, ressources et exports concernés ;
3. le Super Admin suspend ou révoque les missions/sessions relevant de son autorité ;
4. les requêtes, téléchargements et workers futurs revalident l'autorisation ;
5. les tâches différées et liens d'export sont annulés ou rendus inaccessibles ;
6. les données déjà consultées ou copiées ne sont pas réputées effacées ;
7. les notifications et obligations de signalement sont déterminées par une procédure validée et une revue juridique ;
8. la résolution est consignée par de nouveaux événements, sans effacer l'historique initial.

La réponse à incident ne doit ni clôturer automatiquement une alerte SOS ni altérer son instantané initial, ses destinataires ou ses règles de continuité.

## 12. Rétention et droit à l'effacement

Ce contrat ne crée aucune durée de conservation. La matrice générale de conservation reste une proposition à arbitrer, sous réserve des règles déjà validées pour les alertes et le GPS.

La traçabilité ne justifie pas de conserver indéfiniment des données personnelles en clair. Le futur modèle devra distinguer preuve minimale, pseudonymisation, données de contenu et obligations légales, puis documenter les effets de suppression/restauration. Les journaux ne doivent pas devenir une copie parallèle des profils ou alertes.

Toute restauration doit préserver les révocations, suppressions et expirations intervenues avant le point de restauration ; une restauration brute ne doit jamais réactiver un accès ou une ressource retirée.

## 13. Tests d'acceptation obligatoires

1. permission absente, mission expirée ou acteur suspendu : lecture refusée ;
2. identifiant d'une ressource d'un autre compte : refus sans révéler son existence ;
3. recherche, pagination et pièce jointe hors périmètre : refus ;
4. champ masqué absent de la réponse API, pas seulement caché dans l'interface ;
5. lecture C3 sans motif/référence si cette exigence est approuvée : refus ;
6. délégataire tentant de créer/étendre une mission : refus ;
7. export sans permission distincte : refus ;
8. lien préparé puis mission révoquée : téléchargement refusé ;
9. export transféré à un autre compte : refus ;
10. mutation sensible avec échec du journal obligatoire : aucune mutation validée ;
11. tentative de modification/suppression du journal par chaque rôle : refus ;
12. altération, suppression, duplication ou rupture de chaîne détectée par vérificateur indépendant ;
13. compte Super Admin compromis : aucune possibilité d'effacer les preuves hors de son contrôle applicatif ;
14. aucun secret, contenu SOS complet ou GPS précis dans audit, logs, erreurs ou export ;
15. restauration : révocations et suppressions antérieures restent effectives ;
16. consultation et export du journal produisent eux-mêmes une trace ;
17. révocation pendant un téléchargement ou un worker : aucun accès futur après le commit de révocation ;
18. les données déjà téléchargées sont identifiées comme copies hors contrôle SAC, sans fausse promesse d'effacement.

## 14. Points restant à arbitrer

- champs exacts et règles de masquage par ressource et mission ;
- motif structuré et référence obligatoire pour chaque accès C3 ;
- existence ou interdiction définitive d'un mécanisme break-glass ;
- seuils de volume et détection des consultations atypiques ;
- authentification renforcée et opérations qui la déclenchent ;
- architecture de scellement externe et séparation du contrôle du Super Admin ;
- mécanisme de copie immuable et vérification indépendante ;
- formats, durées, chiffrement et révocation des exports ;
- rétention et purge des journaux, après revue juridique ;
- procédure de notification et de gestion d'incident ;
- revue indépendante de sécurité, conformité et protection des données.

## 15. Conditions de passage à l'implémentation

Avant tout code, endpoint, stockage, journal ou migration :
1. arbitrer les points ouverts pertinents ;
2. consolider les matrices de données/champs et permissions ;
3. finaliser le modèle relationnel sans conflit avec le modèle global ;
4. concevoir le stockage d'audit et son vérificateur indépendant ;
5. définir la restauration forward-only des révocations et suppressions ;
6. écrire les tests d'accès négatifs, de concurrence, d'intégrité et de restauration ;
7. réaliser une revue indépendante de sécurité et de conformité ;
8. obtenir une autorisation explicite distincte pour l'implémentation.

**Conclusion :** aucun accès interne ne doit être fondé sur la confiance accordée au titre d'un acteur. La permission, la mission, la ressource, la finalité et les champs visibles doivent être contrôlés ensemble. Le Super Admin reste l'autorité de gouvernance, mais ses actions restent traçables et les preuves ne doivent pas dépendre uniquement de son propre contrôle.
