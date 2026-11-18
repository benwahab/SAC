# SAC — Plan directeur de réalisation

**Date :** 18 novembre 2026  
**Statut :** feuille de route de conception ; calendrier et fournisseurs non validés.  
**Stack obligatoire :** React + Vite + TypeScript + Tailwind CSS + Lucide React, API REST Cloudflare Pages Functions, D1, R2 sous réserve d'activation, PWA d'abord, Capacitor envisagé ensuite.

## 1. Objectif

Ce plan organise les travaux dans un ordre qui limite les reprises et donne la priorité à la fiabilité du SOS, à la sécurité des comptes et à la confidentialité.

Une phase n'est pas terminée parce que l'interface est visible. Elle est terminée seulement lorsque ses exigences, son code, ses tests et ses preuves ont été vérifiés.

Ce document n'autorise pas à lui seul une modification du code, une migration D1, une ressource Cloudflare, un fournisseur externe ou un déploiement.

## 2. Phase 0 — Audit du dépôt et de l'infrastructure

Avant toute nouvelle fonctionnalité :
- confirmer le dépôt `benwahab/SAC` et la branche `main` ;
- vérifier le dernier commit ;
- lire les documents de référence ;
- inspecter le code et les fichiers réellement présents ;
- inspecter les migrations et ressources D1 ;
- vérifier les bindings Cloudflare Pages ;
- vérifier le statut de R2 sans présumer qu'il est activé ;
- examiner les workflows CI et les résultats récents ;
- identifier les prototypes, contrats purs et tests déjà présents ;
- établir une liste des fonctions réelles, expérimentales, documentées et absentes.

**Livrable :** état initial technique avec preuves et liste des écarts. Ne pas répéter un travail déjà réalisé.

## 3. Phase 1 — Socle technique

Vérifier et compléter, dans le périmètre autorisé :
- application React/Vite/TypeScript ;
- organisation des modules ;
- contrats API ;
- Pages Functions ;
- gestion des erreurs ;
- validation des entrées ;
- D1 et migrations versionnées ;
- workflow CI ;
- tests ;
- gestion des environnements ;
- supervision et journaux sans secrets ;
- sauvegardes et procédure de restauration.

Ne pas ajouter un deuxième backend autonome. Les règles métier sensibles restent côté serveur.

**Passage :** build, typecheck et tests pertinents reproductibles ; procédure de restauration réellement vérifiée.

## 4. Phase 2 — Identité, authentification et appareils

Travaux :
- inscription et vérification ;
- OTP email selon la décision actuelle ;
- sessions et renouvellement ;
- profils et moyens de contact ;
- appareils individuels ;
- appareil racine et secondaires ;
- approbation et révocation ;
- kit de récupération hors ligne ;
- récupération du compte ;
- récupération séparée de l'identité cryptographique ;
- changement d'adresse email/téléphone ;
- protections contre abus, rejeu et force brute.

Les fournisseurs d'authentification et d'email restent à sélectionner.

**Passage :** tests de sécurité, révocation et récupération réussis ; aucun OTP ou kit en clair ; aucun secondaire ne peut s'auto-promouvoir racine.

## 5. Phase 3 — Proches et groupes

Travaux :
- invitations par email/téléphone ;
- acceptation et vérification ;
- gestion des relations de confiance ;
- révocation ;
- préférences de destinataires ;
- groupes privés ;
- invitations et départs de groupes ;
- permissions individuelles de partage.

**Passage :** aucune invitation en attente ni appartenance à un groupe ne donne accès implicitement aux alertes ou au GPS.

## 6. Phase 4 — Cycle SOS essentiel

Ordre :
1. catégories et niveaux ;
2. parcours SOS guidé ;
3. parcours critique immédiat préconfiguré ;
4. sélection ponctuelle des destinataires autorisés dans le parcours guidé ;
5. validation serveur ;
6. création atomique de l'alerte ;
7. instantané des destinataires ;
8. événements et historique ;
9. accusé de réception ;
10. candidatures volontaires ;
11. attribution atomique d'un responsable principal ;
12. retrait et transfert ;
13. annulation et clôture réservées à l'auteur.

**Passage :** aucun double enregistrement, aucun destinataire non autorisé, aucun double responsable principal, aucun contact ne peut clôturer l'alerte, aucune fausse confirmation d'envoi.

## 7. Phase 5 — Notifications et escalade

Travaux :
- abonnements push par appareil ;
- outbox et tâches récupérables ;
- rappels toutes les cinq minutes ;
- seuil choisi de 1 à 5 rappels (2 par défaut) ;
- escalade SMS ;
- événements fournisseur ;
- annulation des tâches non engagées ;
- reprise après panne ;
- idempotence et déduplication ;
- affichage précis des états d'envoi/livraison/lecture/prise en charge.

Les fournisseurs push et SMS restent à choisir. Aucun SMS ne doit être présenté comme garanti hors réseau.

**Passage :** tests de panne, concurrence, répétition, livraison tardive et annulation réussis.

## 8. Phase 6 — GPS et confidentialité

Cette phase est un blocage critique.

Avant toute collecte réelle de coordonnées précises, démontrer :
- expiration au plus tard à J+30 ;
- destruction irréversible des clés nécessaires ;
- résistance aux sauvegardes, réplications, snapshots et D1 Time Travel ;
- résistance aux téléphones éteints ou hors ligne ;
- résistance au recul d'horloge et à la restauration locale ;
- absence de coordonnées dans logs, traces, analytics, files, exports et documents ;
- impossibilité pour les administrateurs de restaurer les données expirées.

**NO-GO :** tant que la preuve complète n'existe pas, ne pas connecter de flux GPS réel ni persister de coordonnées précises. La position indisponible ne bloque pas la création d'une alerte.

Références obligatoires : `docs/PLAN_VALIDATION_DESTRUCTION_GPS_J30.md` et `docs/SECURITE_GPS_DESTRUCTION_CRYPTO.md`.

## 9. Phase 7 — Protection des trajets et Déclencheur discret

La Protection des trajets comprend les trois modes définis dans le cahier des charges. Le détail des délais, relances et comportements reste à valider.

Le Déclencheur discret (trois pressions physiques rapides) nécessite une étude de faisabilité native. La PWA seule ne garantit pas l'écoute des boutons lorsque l'application est verrouillée, arrêtée ou suspendue.

**Passage :** essais réels sur appareils ciblés, y compris TECNO, Infinix et Samsung ; documenter précisément les limites et les permissions.

## 10. Phase 8 — Abonnements et paiements

Travaux :
- plans et versions ;
- souscriptions ;
- paiements ;
- confirmations serveur ;
- renouvellements ;
- expirations ;
- remboursements ;
- événements fournisseur ;
- reçus et documents ;
- rapprochements.

Tarifs de référence : gratuit jusqu'à deux proches ; Premium à 5 000 FCFA/mois jusqu'à dix proches. Les options Premium au-delà du nombre de contacts restent à préciser.

**Passage :** tests de paiements confirmés, refusés, en attente, répétés, tardifs, remboursés et frauduleux ; aucun paiement ne peut être confirmé par le navigateur seul. Le SOS essentiel reste gratuit.

## 11. Phase 9 — Application citoyenne

Finaliser :
- accueil ;
- proches ;
- alertes ;
- sécurité ;
- compte ;
- appareils ;
- aide ;
- abonnements ;
- paramètres ;
- français, anglais et arabe RTL.

Optimiser le chargement mobile, les connexions faibles, la taille des ressources et les états de transmission.

**Passage :** tests d'accessibilité, langues, réseau faible, PWA installée, Android réel et iOS lorsque la cible native est engagée.

## 12. Phase 10 — Console professionnelle

La console est une expérience distincte, ordinateur/tablette. Son accès depuis un téléphone doit être refusé côté serveur dans les limites réelles de détection d'appareil.

Construire progressivement :
- authentification professionnelle ;
- Super Admin ;
- collaborateurs ;
- rôles et permissions ;
- missions et délégations ;
- onze espaces principaux ;
- supervision réelle ;
- audit et notifications internes.

Aucune permission n'est accordée par simple appartenance à un service. Le Super Admin est le seul à créer, attribuer, modifier, suspendre et révoquer les missions/délégations/permissions.

**Passage :** tests d'autorisation négatifs, révocation, séparation des données et audit.

## 13. Phase 11 — Services professionnels

Ajouter progressivement les fonctions :
- secrétariat ;
- RH ;
- comptabilité et finances ;
- logistique ;
- juridique et conformité ;
- DSI ;
- relations externes ;
- pilotage ;
- ressources documentaires.

Les services réutilisent les références centrales. Une opération ne doit pas être dupliquée entre logistique et comptabilité. Les modules ne sont pas tous obligatoires pour le premier lancement citoyen.

**Passage :** permissions, workflows, archives, rapports et règles locales vérifiés.

## 14. Phase 12 — Tests transversaux et lancement pilote

Avant le lancement :
- tests unitaires ;
- tests d'intégration D1 ;
- tests end-to-end ;
- tests de sécurité ;
- tests de concurrence ;
- tests de charge ;
- tests de réseau faible ;
- tests Android/iOS ;
- tests de restauration ;
- tests des fournisseurs ;
- audit de confidentialité ;
- vérification juridique et réglementaire ;
- contrôle des coûts et du support.

Le lancement au Niger est progressif. La zone pilote, les participants, les seuils de réussite et la date restent à définir. Une expansion vers d'autres pays exige une validation locale distincte.

## 15. Conditions de passage communes

Chaque phase possède une fiche :
- objectifs ;
- inclusions et exclusions ;
- dépendances ;
- fichiers et tables concernés ;
- permissions ;
- risques ;
- tests obligatoires ;
- preuves ;
- anomalies ;
- décision de passage.

Cycle de livraison :
préparer → développer → tester → corriger → vérifier → rapporter → validation du Super Admin → autorisation de publication → déployer → vérifier en production.

Une CI verte ne prouve pas à elle seule que le SOS, les SMS, le GPS ou les paiements fonctionnent réellement.

## 16. Priorités

- **P0 :** identité, sécurité, SOS, destinataires, notifications, révocation, confidentialité et tests critiques.
- **P0 bloquant GPS :** preuve J+30 avant toute collecte GPS précise.
- **P1 :** application citoyenne complète, langues, assistance et abonnements.
- **P2 :** Protection des trajets et Déclencheur discret selon faisabilité.
- **P2/P3 :** console professionnelle et services administratifs selon les ressources et priorités de lancement.
- **P3 :** expansion régionale.

Ces niveaux indiquent un ordre recommandé, pas un calendrier promis.

## 17. Discipline de développement

- Dépôt unique : `benwahab/SAC`.
- Branche unique : `main`.
- Avant chaque écriture, vérifier le dernier commit et les fichiers concernés.
- Ne jamais créer de branche ou de dépôt parallèle.
- Ne pas écraser le travail d'un autre assistant.
- Aucun code applicatif, migration D1, ressource Cloudflare, fournisseur ou déploiement sans autorisation explicite.
- Aucun secret ou donnée personnelle réelle dans Git.
- Les tâches de suivi ne sont cochées qu'après preuve observable.

## 18. État de la feuille de route

Ce plan décrit l'ordre cible. Il ne signifie pas que les phases sont terminées. L'état réel est suivi dans `TODO_SUPERVISION.md` et doit être vérifié sur le code, les ressources et les résultats CI récents avant chaque mise à jour.

## Référence complémentaire — résilience et continuité

La mise en production doit également satisfaire `CONTRAT_RESILIENCE_CONTINUITE_ET_REPRISE_INCIDENT.md` : tests de réseau faible, perte de réponse après commit, workers redémarrés, indisponibilité des fournisseurs, sauvegarde/restauration isolée et non-résurrection. Une phase n'est pas validée par un simple health check ; les objectifs RTO/RPO et runbooks restent à arbitrer et à démontrer.
