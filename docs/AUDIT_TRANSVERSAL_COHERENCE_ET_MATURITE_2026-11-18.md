# SAC — Audit transversal de cohérence et de maturité

**Date :** 18 novembre 2026  
**Dépôt :** `benwahab/SAC` — branche unique `main`  
**Statut :** audit documentaire transversal ; photographie du code fondée sur l'audit d'état réel du 18 novembre 2026 et les fichiers relus dans le dépôt.  
**Autorisation :** documentation uniquement. Aucun code, test, migration D1, ressource Cloudflare, fournisseur, secret, déploiement ou traitement réel n'a été modifié ou activé.

## 1. Conclusion exécutive

SAC dispose maintenant d'un corpus documentaire riche couvrant le produit, les comptes, les appareils, les alertes, la confidentialité, la sécurité, les communications, la résilience et la conformité. Le principal risque n'est plus l'absence de documents : c'est la coexistence de documents de générations différentes, d'exigences normatives, de propositions et de prototypes qui peuvent être lus comme s'ils avaient le même statut.

L'architecture cible peut être poursuivie au niveau documentaire, mais **SAC n'est pas prêt pour une mise en production d'alertes réelles, de GPS réel ou d'authentification complète**. Les blocages sont concrets : backend métier SOS absent, base D1 vide, cycle de compte incomplet dans le code, protocole cryptographique multi-appareils non homologué, fournisseurs de communication non sélectionnés, destruction GPS non démontrée et circuit réglementaire nigérien postérieur à juin 2026 non authentifié.

### Verdict par domaine

| Domaine | Maturité documentaire | État opérationnel vérifié | Verdict |
|---|---|---|---|
| Vision produit / UX | Détaillée | Accueil PWA présent, SOS désactivé | Partiel |
| Stack et hébergement | Définis | React/Vite/TS, Pages Functions, D1 | Socle seulement |
| Comptes / OTP | Règles fonctionnelles détaillées | Authentification réelle non démontrée | Bloquant |
| Cycle de compte | Machine cible à cinq états | TypeScript ne gère que trois états | Bloquant avant migration |
| Appareils / racine | Contrats détaillés | Jumelage multi-appareils expérimental | Bloquant |
| Proches / invitations | Invariants clairs, détails proposés | Pas de backend métier vérifié | Bloquant |
| SOS | Contrats et tests attendus détaillés | Aucun vrai cycle SOS serveur | Bloquant |
| Notifications / SMS | Contrats détaillés | Aucun fournisseur ni livraison réelle prouvée | Bloquant |
| GPS / trajets | Règles de confidentialité détaillées | Destruction irréversible non prouvée ; GPS NO-GO | Bloquant absolu |
| Groupes / SOS différés | Propositions documentées | Non implémentés et non approuvés | Hors V1 tant qu'arbitrage absent |
| Gouvernance juridique | Pré-analyse et contrat disponibles | Formalités nigériennes 2026 non authentifiées | Bloquant lancement |
| Résilience / restauration | Contrat et scénarios détaillés | Exercices réels non démontrés | Bloquant lancement |

## 2. Référentiel de priorité — règle à appliquer partout

L'ordre de référence est :
1. dernière validation explicite de l'utilisateur ;
2. registre des décisions datées et arbitrages explicites ;
3. contrat spécialisé le plus récent pour le domaine concerné ;
4. consolidation générale et cahier des charges ;
5. architecture et plans ;
6. propositions clairement marquées non approuvées ;
7. code et tests, qui décrivent seulement l'état construit et ne peuvent pas modifier une décision produit.

Une proposition ne devient jamais une décision par répétition dans plusieurs fichiers. Une fonctionnalité décrite n'est pas implémentée parce qu'elle figure dans un plan. Si deux sources normatives se contredisent, arrêter l'action concernée, inscrire le conflit et faire prévaloir la règle spécialisée la plus récente, sans effacer l'historique de la décision.

## 3. Incohérences transversales identifiées et corrections documentaires réalisées

### C-01 — Rétention GPS : anciennes règles incompatibles avec la décision finale

**Gravité : P0 — confidentialité et conformité.**

Des passages anciens de `ARCHITECTURE_ET_MODELE_DONNEES.md`, `CAHIER_DES_CHARGES_SAC.md` et `MACHINES_ETATS_ET_CONSERVATION.md` indiquaient que les coordonnées GPS restaient conservées 30 jours après la fin du partage. Cela contredisait la décision utilisateur ultérieure et le contrat spécialisé.

**Règle normative unique :**
- à la clôture effective d'une alerte SOS, suppression immédiate de toutes les positions GPS précises associées ;
- pendant 30 jours après clôture, seule la nature/catégorie de l'alerte reste dans l'historique ;
- à J+30 après clôture, suppression définitive de l'entrée et de sa catégorie ;
- aucune sauvegarde, snapshot, réplication, D1 Time Travel, export ou restauration ne peut ressusciter les positions ni l'alerte purgée ;
- les 30 jours ne sont pas une durée de conservation GPS ;
- la durée GPS des trajets indépendants d'une alerte reste non arbitrée et ne peut pas être déduite de la règle SOS ;
- GPS réel NO-GO jusqu'à preuve technique indépendante et autorisation explicite.

**Correction effectuée :** les passages normatifs des trois documents ont été réalignés. Le contrat spécialisé `CONTRAT_CONSERVATION_ALERTES_ET_PURGE.md` demeure la source de vérité.

**Reste à faire :** effectuer une recherche exhaustive ultérieure des formulations historiques dans tout le dépôt ; toute occurrence ancienne conservée à titre d'historique doit être explicitement marquée « remplacée / non applicable » pour empêcher une lecture erronée.

### C-02 — Machine de compte cible et contrat TypeScript divergents

**Gravité : P0 — intégrité des comptes.**

La machine métier approuvée comporte exactement cinq états :
`pending_verification`, `active`, `suspended`, `deletion_pending`, `deleted`.

Le fichier réel `src/domain/account-lifecycle.ts` accepte seulement :
`active`, `deletion_pending`, `deleted`.

Il manque donc au contrat TypeScript les états d'inscription non vérifiée et de suspension administrative, ainsi que leurs transitions et invariants. Cette différence est déjà décrite dans les documents mais n'est pas corrigée dans le code.

**Règle à préserver :**
- e-mail obligatoire et vérifié par OTP e-mail avant activation ;
- téléphone obligatoire mais seulement déclaré/non vérifié ;
- aucun SMS OTP de compte ;
- aucun accès privé ni SOS avant activation ;
- suspension administrative réservée au Super Admin ; verrouillage de risque technique distinct ;
- suppression terminale sans restauration de l'ancien compte.

**Action bloquante :** réconcilier le contrat TypeScript et les tests avec la machine approuvée, puis seulement concevoir la migration D1. Aucune correction de code n'a été faite dans cet audit.

### C-03 — Rappels push et seuil SMS : séparer les deux mécanismes dans toutes les spécifications

**Gravité : P1 — comportement d'urgence.**

Les règles établies sont :
- rappels push aux destinataires de l'instantané initial toutes les cinq minutes ;
- le lanceur choisit de 1 à 5 rappels avant le seuil d'escalade SMS ;
- 2 rappels, soit 10 minutes, sont présélectionnés ;
- le choix porte sur le seuil de bascule SMS, pas sur la durée totale de l'alerte ;
- les rappels SOS continuent jusqu'à la clôture autorisée ; accusé de réception et prise en charge ne valent pas clôture ;
- seul l'auteur clôture, sous réserve de l'exception administrative très limitée déjà documentée ;
- aucun SMS réel n'est garanti sans fournisseur et tests.

**Risque documentaire :** certains résumés peuvent faire croire que le nombre choisi limite le nombre total de rappels push. Ce n'est pas la règle. Le seuil de 1 à 5 détermine l'escalade SMS ; il ne clôture pas l'alerte et ne modifie pas à lui seul les rappels continus.

**À préciser avant API :** séquence exacte de l'événement SMS, déduplication, retards, fournisseur indisponible, SMS accepté avant clôture mais livré après, et comportement lorsque le responsable principal est attribué avant/après le seuil. Ne pas transformer ces questions techniques en nouvelles règles produit.

### C-04 — Destinataire révoqué pendant une alerte active

**Gravité : P1 — confidentialité et sécurité humaine.**

L'instantané initial des destinataires est immuable. En revanche, les droits d'un proche révoqué après le déclenchement (détail de l'alerte, positions, rappels déjà planifiés, candidature et responsabilité principale) ne sont pas tous arbitrés dans un document unique.

Des propositions de coupure immédiate de l'accès au détail et du GPS, de maintien d'un rappel opaque, et de promotion du prochain volontaire existent, mais restent des propositions non approuvées.

**Action bloquante avant API :** arbitrer une politique unique et la répercuter dans le contrat SOS, le contrat notifications, le contrat de relation, la matrice d'autorisation et les transactions D1. Ne pas laisser une implémentation choisir implicitement.

### C-05 — Appareil racine, appareil secondaire et récupération

**Gravité : P0 — identité cryptographique.**

Les décisions cohérentes sont :
- plusieurs appareils autorisés pour un même compte ;
- chaque appareil possède sa propre session et son identité ;
- seul l'appareil racine actif peut approuver un appareil secondaire en V1 ;
- un secondaire ne devient jamais racine par perte, vol ou indisponibilité du premier ;
- OTP e-mail, mot de passe, SMS, support et Super Admin ne remplacent pas la racine ;
- aucune racine perdue ou compromise n'est remplacée en V1 tant qu'un protocole distinct n'a pas été approuvé.

Le protocole multi-appareils, le transcript signé, l'anti-rejeu, l'atomicité des défis et la validation de clés sont encore expérimentaux ou à revue indépendante. Le contrat technique ne doit pas être présenté comme homologué.

**Action bloquante :** revue cryptographique indépendante, spécification canonique, tests adversariaux et arbitrage des scénarios de perte/compromission avant toute intégration.

### C-06 — États, durées et effets des trajets

**Gravité : P1.**

Les modes de Protection des trajets sont documentés, mais plusieurs valeurs (grâce d'arrivée, rappels, durée d'accompagnement, plafond, fraîcheur, arrêt GPS en cas d'alerte orpheline) sont explicitement des propositions.

La conservation GPS d'un trajet est distincte de la purge GPS d'une alerte et reste non définie. Une ancienne valeur de conservation ne doit pas être reprise comme décision.

**Action bloquante avant activation :** arbitrage produit, contrat de conservation dédié, revue de sécurité, validation juridique et preuve de destruction/non-résurrection. Aucun GPS réel avant cela.

### C-07 — Groupes, SOS programmé et SOS discret

**Gravité : P1 / périmètre.**

Les documents sont des propositions de conception :
- groupes privés : limites, propriété, invitation, transfert et nombre de groupes ;
- SOS programmé : fuseau, revalidation des destinataires, annulation/course avec déclenchement ;
- SOS discret : secret, essais, récupération, comportement hors ligne et anti-abus.

Ces fonctionnalités ne sont pas des décisions V1 acquises et ne doivent pas retarder le socle SOS ordinaire ni être implémentées sur la seule base des propositions.

### C-08 — Politique générale de conservation hors GPS

**Gravité : P1 — conformité.**

La matrice générale des durées est une proposition non approuvée. Les durées proposées pour comptes, identités, appareils, sessions, invitations, relations, groupes, notifications, journaux, support et exports ne doivent pas être copiées dans le schéma D1 ou un job de purge avant validation juridique et produit.

La règle d'alerte/GPS spécialisée est, elle, validée et prévaut. Il faut distinguer les données nécessaires à la preuve de sécurité des données de confort, et ne jamais archiver un document généré/imprimé de façon à contourner une règle de purge.

### C-09 — Juridiction et formalités Niger 2026

**Gravité : P0 — lancement.**

La suppression de la HAPDP et le transfert de missions ont été rapportés en juin 2026. L'ordonnance 2026-30, les dispositions précises abrogées et les circuits opérationnels des ministères ne sont pas encore authentifiés dans le dossier. Les pages historiques HAPDP ne suffisent pas à établir la procédure actuelle.

**Action bloquante :** obtenir les textes authentiques au Journal officiel, confirmer par écrit le service compétent, identifier l'entité responsable du traitement, obtenir un avis juridique local sur téléphone, données de santé, GPS, fournisseurs et transferts. Aucun lancement ni collecte réelle ne doit supposer ces formalités accomplies.

## 4. Décisions utilisateur consolidées — ne pas rouvrir sans nouvelle demande

- Stack : React/Vite/TypeScript/Tailwind, Cloudflare Pages Functions, D1 ; PWA mobile-first ; Capacitor envisagé pour natif ; ne pas migrer vers Next.js/PostgreSQL.
- Identité visuelle : vert clair glass, blanc, rouge alerte ; pas de violet ni bleu nuit comme couleur principale. Les hex exacts restent à valider.
- Langues de lancement : français, anglais, arabe avec RTL ; les autres langues sont ultérieures.
- E-mail obligatoire et vérifié par OTP avant activation ; téléphone obligatoire mais déclaré/non vérifié ; aucun SMS OTP de compte.
- Mot de passe minimum 12 caractères.
- Sessions : 30 jours consécutifs d'inactivité, 90 jours maximum absolus.
- Cinq états de compte tels que définis dans le contrat de cycle de vie.
- Proches : compte SAC actif, e-mail vérifié, invitation acceptée explicitement ; relation directionnelle ; téléphone déclaré seul insuffisant.
- Plusieurs appareils par compte ; séparation accès compte / appareil / racine cryptographique.
- En V1, pas de remplacement automatique ou par OTP de la racine cryptographique perdue/compromise.
- SOS privé aux proches choisis ; destinataires figés à la création ; rappels toutes les cinq minutes ; seul l'auteur clôture, sous exception administrative très étroite et documentée.
- Choix de 1 à 5 rappels push avant seuil SMS, 2 par défaut ; ne pas confondre ce seuil avec la durée totale des rappels.
- GPS d'alerte supprimé immédiatement à la clôture ; catégorie seule 30 jours ; alerte/catégorie purgées à J+30 ; aucune résurrection.
- GPS réel NO-GO tant que la preuve de destruction et non-résurrection n'est pas démontrée.
- Super Admin seul crée/attribue/modifie/suspend/retire les missions ; les délégués ne délèguent pas et n'attribuent pas à leur tour.
- Tout document généré et imprimé est archivé automatiquement dans sa rubrique d'origine avec référence, date, auteur, version et statut ; cette règle ne contourne jamais les durées de conservation ni la purge GPS.

## 5. État réel du code — ne pas confondre avec l'architecture cible

Selon l'audit du 18 novembre 2026 :
- application React/Vite/TypeScript ;
- route API `/api/health` seulement ; elle vérifie une requête D1 élémentaire `SELECT 1 AS ok` ;
- base D1 `sac-db` observée vide ;
- aucune migration métier D1 ;
- pas de vrai backend d'authentification/OTP ;
- pas de cycle SOS serveur, destinataires persistés, outbox métier ou notifications réelles démontrées ;
- SOS affiché comme « En préparation » et désactivé ;
- le service worker PWA ne garantit pas de SOS hors ligne ;
- les prototypes purs TypeScript ne remplacent pas la persistance, l'authentification ou les autorisations serveur ;
- le GPS réel n'est pas activé et doit rester NO-GO ;
- le sélecteur FR/EN/AR et les traductions de l'accueil ont été ajoutés ; cela ne signifie pas que tous les écrans et tous les parcours sont traduits ;
- aucun test Android réel n'est démontré par cet audit.

Un ping santé ne prouve ni authentification, ni déclenchement SOS, ni livraison push/SMS, ni sauvegarde/restauration, ni suppression irréversible.

## 6. Ordre des dépendances et portes de sortie

### P0-A — Gouvernance et spécifications
1. Authentifier les textes nigériens postérieurs à juin 2026 et obtenir le circuit officiel.
2. Identifier l'entité porteuse et le responsable du traitement.
3. Finaliser les arbitrages P0 du cycle compte, invitation, appareil et racine.
4. Reconciler le modèle d'états, les contrats TypeScript, le modèle global et le schéma relationnel proposé.
5. Valider les autorisations serveur par acteur/ressource et les opérations atomiques.

### P0-B — Socle compte
1. Contrat cinq états aligné dans TypeScript et tests.
2. Inscription, OTP e-mail, activation, session, révocation et récupération du compte.
3. Appareil approuvé et séparation cryptographique.
4. Revue indépendante du protocole racine/multi-appareils.
5. Migration D1 seulement après validation des contrats et du schéma.

### P0-C — SOS essentiel non-GPS
1. Déclenchement authentifié et autorisé.
2. Transaction atomique alerte + instantané des destinataires + premier événement + outbox.
3. Idempotence, rejeu, concurrence et retour réseau ambigu.
4. Cycle des réponses, accusés, volontaires et responsable principal.
5. Clôture autorisée et purge métier.
6. Rappels serveur durables, puis intégration push et SMS après sélection et essais de fournisseurs.
7. Tests Android/PWA réseau faible et incidents.

Le SOS essentiel ne doit pas dépendre du GPS. Une panne de GPS ne doit pas empêcher la création d'une alerte non-GPS.

### P0-D — Confidentialité, droit et exploitation
1. Contrats et politiques publiables, revus juridiquement.
2. Matrice de conservation hors GPS validée.
3. Contrats sous-traitants et transferts.
4. Procédure de droits et d'incidents.
5. Tests de sauvegarde/restauration forward-only.
6. Exercices d'incident et runbooks.
7. Validation indépendante de sécurité avant lancement.

### P1 — Fonctions complémentaires
- trajets et partage GPS après GO distinct ;
- groupes privés ;
- SOS programmé et discret ;
- console professionnelle complète ;
- abonnements/paiements ;
- autres pays ;
- langues additionnelles.

Aucun P1 ne doit fragiliser le chemin critique SOS non-GPS.

## 7. Questions qui restent réellement ouvertes

1. Quelle politique d'accès et de livraison appliquer à un contact révoqué pendant un SOS actif ?
2. Quelle séquence exacte de rappels push et SMS, y compris après le seuil choisi et après attribution d'un responsable principal ?
3. Quels facteurs permettent la récupération du compte sans appareil fiable, sans restaurer la racine ?
4. Quelle procédure de confinement d'une racine volée/compromise est possible sans introduire un remplacement de racine non validé ?
5. Quelle durée GPS, si une quelconque conservation est nécessaire, pour les trajets indépendants d'une alerte ?
6. Quelles valeurs finales pour les modes de trajet ?
7. Quelles règles d'invitation (expiration, relances, quotas, cooldowns) et de retrait/révocation ?
8. Quelles limites et règles de propriété des groupes ?
9. Quel comportement pour SOS programmé et SOS discret ?
10. Quelle matrice de conservation hors GPS est juridiquement défendable ?
11. Quel âge minimum V1 et quelles règles mineurs/tutelle ?
12. Quels fournisseurs et pays de traitement sont autorisés ?
13. Quels RTO/RPO, disponibilité, capacité réservée et procédures d'astreinte ?
14. Quels champs d'export, motif d'accès C3, break-glass et scellement indépendant des audits ?

Aucun chiffre ou mécanisme non validé ne doit être inventé pour fermer artificiellement ces questions.

## 8. Conditions minimales pour déclarer SAC prêt à lancer

SAC ne peut être déclaré prêt que lorsque :
- chaque règle produit critique a une source de vérité sans contradiction ;
- chaque état métier a un contrat, une transition serveur et des tests ;
- les cinq états du compte sont alignés dans le code ;
- l'authentification e-mail et la gestion des appareils sont opérationnelles et auditées ;
- la revue cryptographique indépendante est concluante ;
- le SOS non-GPS est réellement opérationnel, idempotent et testé sur réseau faible ;
- les notifications sont intégrées à un fournisseur testé, avec statuts honnêtes ;
- la politique de conservation hors GPS est approuvée ;
- les exigences juridiques et formalités du Niger sont confirmées ;
- les tests de restauration ne ressuscitent ni révocations ni données purgées ;
- le GPS reste désactivé tant que sa destruction irréversible n'est pas prouvée ;
- les conditions d'utilisation et la politique de confidentialité correspondent exactement aux fonctions réellement actives ;
- CI et tests sont verts sur le commit effectivement destiné au lancement, et tests réels Android sont documentés.

## 9. Corrections documentaires effectuées dans cet audit

- `ARCHITECTURE_ET_MODELE_DONNEES.md` : anciennes durées GPS corrigées pour distinguer alerte et trajet.
- `CAHIER_DES_CHARGES_SAC.md` : ancienne conservation GPS après fin de partage remplacée par la règle normative.
- `MACHINES_ETATS_ET_CONSERVATION.md` : matrice GPS réalignée sur la suppression à la clôture et distinction des trajets.
- Présent audit ajouté comme point de convergence transversal.

Les modifications sont documentaires. Le code et les migrations restent intacts.

## 10. Références prioritaires

- `CONSOLIDATION_GENERALE_SAC.md`
- `DECISIONS_COMPLEMENTAIRES_2026-11-18.md`
- `DECISIONS_ET_POINTS_A_VALIDER.md`
- `DECISIONS_PRODUIT_RESTANTES.md`
- `MACHINES_ETATS_ET_CONSERVATION.md`
- `CONTRAT_CONSERVATION_ALERTES_ET_PURGE.md`
- `CONTRAT_PROPOSE_SUPPRESSION_COMPTE_ET_CAS_PARTICULIERS.md`
- `ARBITRAGE_P0_CYCLE_COMPTE_ET_PREUVE_PROCHES.md`
- `CONTRAT_SECURITE_CYCLE_SOS_ET_INTEGRITE_ALERTES.md`
- `CONTRAT_SECURITE_COMPTES_ET_APPAREILS_EN_URGENCE.md`
- `CONTRAT_RESILIENCE_CONTINUITE_ET_REPRISE_INCIDENT.md`
- `CONTRAT_GOUVERNANCE_JURIDIQUE_ET_CONFORMITE.md`
- `AUDIT_ETAT_REEL_CODE_2026-11-18.md`
- `TODO_SUPERVISION.md`

**Conclusion :** le corpus SAC est substantiel et couvre les principaux domaines. La prochaine progression utile n'est pas d'ajouter des fonctions ou des règles au hasard : c'est de fermer les arbitrages P0, d'aligner le code sur les décisions déjà prises, de prouver les garanties de sécurité et de lever les blocages juridiques avant d'activer les traitements sensibles.
