# SAC — Console professionnelle et organisation des services

**Date :** 18 novembre 2026  
**Statut :** conception fonctionnelle ; console non déclarée implémentée.  
**Référence générale :** `docs/CONSOLIDATION_GENERALE_SAC.md` et `docs/DECISIONS_COMPLEMENTAIRES_2026-11-18.md`.

## 1. Séparation des expériences

SAC comprend deux expériences distinctes :

1. Application citoyenne, mobile-first, destinée aux alertes personnelles et familiales.
2. Console professionnelle, destinée au pilotage et à la gestion de l'organisation.

La console professionnelle est conçue pour ordinateur et tablette. Sur téléphone, y compris pour un Super Admin ou un collaborateur, l'expérience disponible reste l'application citoyenne.

L'accès direct à la console depuis un téléphone doit être refusé côté serveur, et pas seulement masqué par CSS ou par la navigation. La détection du type d'appareil reste imparfaite et peut être falsifiée ; combiner les signaux disponibles, les contrôles serveur et une politique d'accès explicite, sans prétendre garantir une détection infaillible.

La console doit occuper tout l'espace disponible, avec une interface professionnelle, sobre, lisible et ergonomique. Elle reprend l'identité vert clair effet verre dépoli de SAC, mais avec moins d'effets décoratifs et davantage de densité fonctionnelle. Pas de marges latérales violettes.

## 2. Les onze espaces principaux

Le menu principal est limité aux espaces suivants :

1. **Vue d'ensemble** — indicateurs, supervision, activité récente et raccourcis.
2. **Utilisateurs** — comptes, états, assistance de compte et suivi autorisé.
3. **Alertes** — supervision des alertes dans les limites strictes de confidentialité.
4. **Finances** — comptabilité, trésorerie, budgets, revenus, dépenses et paiements.
5. **Assistance** — demandes, tickets, centre d'aide et incidents.
6. **Sécurité** — accès, événements, appareils, risques, audits et continuité.
7. **Équipe et missions** — collaborateurs, missions, délégations, communication interne, calendrier et rapports.
8. **Relations externes** — partenaires, fournisseurs selon le périmètre, candidatures et conventions.
9. **Ressources** — RH, logistique, équipements, documents et moyens.
10. **Pilotage** — objectifs, indicateurs, projets, risques et rapports de direction.
11. **Paramètres** — configuration, langues, identité, fournisseurs, fonctionnalités et versions.

Les fonctions secondaires sont regroupées sous ces espaces, par onglets, sous-menus ou vues contextuelles. Ne pas créer un espace principal par fonctionnalité.

Le Super Admin peut personnaliser l'organisation de sa console (réordonner, renommer, masquer, regrouper ou désactiver certains espaces), sous réserve de contrôles de dépendances, de sécurité, de conservation et d'audit. Les fonctions fondamentales de SOS et de sécurité ne peuvent pas être supprimées par simple personnalisation.

## 3. Vue d'ensemble

Éléments envisagés :
- profil et compte du Super Admin ;
- notifications ;
- indicateurs utilisateurs ;
- alertes actives ;
- abonnements actifs ;
- demandes ou incidents à traiter ;
- activité récente ;
- graphiques d'inscriptions, alertes, clôtures, abonnements et revenus confirmés ;
- supervision technique des services ;
- raccourcis autorisés vers les tâches fréquentes.

Aucune statistique fictive ou de démonstration ne doit apparaître comme une donnée de production. Les données calculées, déclarées, vérifiées et validées doivent être distinguées.

La supervision technique (serveurs, base, push, SMS, paiements, stockage) est distincte du contenu privé des alertes.

## 4. Gouvernance du Super Admin

Le Super Admin conserve seul le pouvoir de :
- créer et inviter les collaborateurs ;
- créer ou autoriser les comptes administratifs ;
- créer, attribuer, modifier, suspendre et retirer les missions ;
- créer, attribuer, modifier, suspendre et révoquer les délégations ;
- accorder, modifier et retirer les permissions ;
- décider des validations et publications institutionnelles ;
- autoriser les budgets, engagements, paiements et publications sensibles selon les politiques définies ;
- autoriser les mises en production.

Un collaborateur ne peut jamais :
- déléguer une mission à une autre personne ;
- créer un administrateur ;
- attribuer des permissions ;
- modifier ses propres droits ;
- s'accorder l'accès à un autre service ;
- publier une communication institutionnelle sans autorisation.

Une mission peut être attribuée à plusieurs personnes, mais cela ne crée pas de hiérarchie de délégation. Les tâches et sous-tâches restent attribuées par le Super Admin.

Le Super Admin dispose d'une visibilité complète sur les travaux délégués, rapports, livrables et historiques. Cela ne lui donne pas un droit illimité de lecture des clés privées, kits de récupération ou coordonnées GPS précises des citoyens.

## 5. Gestion des collaborateurs

Chaque collaborateur possède :
- un compte individuel ;
- un profil professionnel ;
- un service et des missions attribuées ;
- des permissions explicites ;
- un état de compte ;
- un historique des activités pertinentes ;
- des dates de dernière connexion/activité selon ce qui est réellement disponible.

Cycle :
1. invitation ;
2. acceptation ;
3. création et vérification du compte ;
4. attribution d'une mission et de permissions par le Super Admin ;
5. exécution ;
6. rapports et livrables ;
7. évaluation ;
8. clôture, suspension ou révocation.

Une invitation en attente ne donne aucun accès. La suspension doit être appliquée côté serveur et les traces historiques sont conservées.

## 6. Équipe et missions

Toutes les fonctions suivantes restent dans l'espace « Équipe et missions ».

### 6.1 Missions et tâches

Une mission peut comporter :
- titre, référence et description ;
- service ;
- responsable(s) ;
- priorité ;
- dates de début et d'échéance ;
- objectifs ;
- livrables attendus ;
- pièces jointes ;
- tâches et sous-tâches ;
- dépendances ;
- historique et commentaires autorisés.

États proposés pour les tâches :
- À faire ;
- En cours ;
- Bloquée ;
- En attente ;
- Terminée (soumise à revue) ;
- Validée (approbation du Super Admin).

« Terminée » ne signifie pas « Validée ». Le collaborateur soumet le livrable ; le Super Admin approuve ou demande une correction.

### 6.2 Rapports d'avancement

Un collaborateur peut transmettre :
- mission concernée ;
- état d'avancement ;
- travail effectué ;
- difficultés éventuelles ;
- pièces justificatives autorisées.

Le Super Admin peut lire, commenter, demander des précisions, marquer la réception et demander une correction. La réception d'un rapport ne clôture pas automatiquement la mission.

### 6.3 Évaluation des missions

À la fin d'une mission, le Super Admin peut évaluer la qualité, le respect des délais, la communication et les résultats. Une échelle de 1 à 5 est une proposition de conception, pas un choix final de notation.

L'évaluation est privée. Le collaborateur peut consulter son évaluation et ajouter une observation, sans modifier ou supprimer l'original. Aucun classement public n'est prévu.

### 6.4 Communication interne

Fonctions envisagées :
- messages individuels ;
- groupes de discussion créés ou contrôlés par le Super Admin ;
- annonces d'équipe ;
- pièces jointes autorisées ;
- statut envoyé/livré/lu seulement si la technologie le permet ;
- archivage des conversations ;
- historique des messages.

Un groupe de discussion ne donne pas automatiquement des permissions professionnelles. Les collaborateurs ne peuvent pas ajouter librement de nouveaux participants ni publier des annonces officielles générales sans autorisation.

### 6.5 Réunions et calendrier

Fonctions :
- réunions d'équipe et individuelles ;
- titre, date, heure, durée, agenda et participants ;
- lieu ou lien de visioconférence ;
- documents préparatoires ;
- réponses présent / peut-être / absent ;
- modification, annulation et notification des changements ;
- rappels et compte rendu.

Les participants ne voient que les réunions, missions et échéances qui les concernent.

Les rappels 24 h / 1 h avant réunion et 48 h avant échéance sont des valeurs proposées et configurables, pas des règles finales confirmées.

### 6.6 Absences et disponibilités

Les collaborateurs peuvent déclarer une indisponibilité, congé, déplacement ou absence, sans diagnostic médical obligatoire.

Le Super Admin reçoit l'information et décide selon la procédure retenue. Les autres collaborateurs ne voient pas les motifs personnels. Le système peut avertir lorsqu'une mission est attribuée pendant une absence ou une surcharge ; il ne doit pas réattribuer automatiquement une mission.

Les modalités exactes de validation des congés restent à arbitrer.

### 6.7 Compétences et formations

Les profils de compétences peuvent être proposés par les collaborateurs puis validés par le Super Admin. Le système peut recommander des profils adaptés à une mission, mais ne l'attribue jamais automatiquement.

Le catalogue de formation peut contenir les formations obligatoires/facultatives, ressources, échéances, progression, évaluations et certificats. La validation finale reste réservée au Super Admin.

## 7. Secrétariat

Le secrétariat est un service professionnel à permissions limitées.

Fonctions confirmées :
- planifier des rendez-vous pour le Super Admin ;
- transmettre les demandes de confirmation ;
- recevoir la décision : confirmé, annulé ou reporté ;
- informer le visiteur ;
- recevoir et classer des documents ;
- transmettre les documents au Super Admin ;
- imprimer depuis un ordinateur ou une tablette lorsque le navigateur et le système le permettent.

Les visiteurs sans rendez-vous peuvent être reçus directement ; leur enregistrement n'est pas obligatoire.

La secrétaire ne peut pas approuver à la place du Super Admin, créer des délégations, consulter les finances ou lire les données privées des citoyens sans autorisation spécifique.

La préparation de courriers administratifs par la secrétaire pour validation avant impression reste une proposition à confirmer.

L'ouverture de la boîte d'impression ne constitue pas une preuve d'impression physique.

## 8. Ressources humaines

Périmètre fonctionnel envisagé :
- dossiers du personnel ;
- coordonnées et informations professionnelles ;
- contrats et avenants ;
- absences et congés ;
- plannings et présence ;
- heures supplémentaires ;
- rémunérations et paie ;
- évaluations ;
- formation ;
- recrutement et candidatures ;
- intégration ;
- discipline selon règles applicables ;
- départ et restitution des équipements.

La paie suit une séparation des tâches : préparation RH, contrôle comptable, autorisation financière, confirmation de paiement par la trésorerie, archivage du bulletin.

Salaires, données de santé, dossiers disciplinaires et documents personnels sont fortement restreints. Les durées légales et règles sociales doivent être validées localement.

## 9. Comptabilité et finances

Périmètre :
- plan comptable configurable ;
- dépenses et recettes ;
- journaux et écritures en partie double ;
- banques, caisse et portefeuilles de monnaie mobile ;
- factures et avoirs ;
- paiements et rapprochements ;
- budgets et révisions ;
- dettes et créances ;
- avances et prêts ;
- paie et charges ;
- immobilisations et amortissements ;
- trésorerie et prévisions ;
- engagements récurrents ;
- validations financières ;
- clôtures périodiques ;
- rapports financiers.

Une écriture comptabilisée ne doit pas être silencieusement modifiée ; une correction passe par une écriture tracée.

Les règles fiscales et sociales, le plan comptable applicable et les déclarations obligatoires doivent être validés par un professionnel compétent au Niger et dans les pays futurs.

## 10. Logistique

Périmètre :
- expression des besoins ;
- fournisseurs et documents fournisseurs ;
- demandes de devis ;
- comparaison des offres ;
- commandes ;
- réceptions et contrôles ;
- stocks et inventaires ;
- mouvements et ajustements ;
- entrepôts et emplacements ;
- équipements et affectations ;
- maintenance ;
- flotte et déplacements ;
- locaux et installations ;
- contrats logistiques ;
- indicateurs et rapports.

Cycle achat :
besoin → validation → consultation → comparaison → autorisation d'achat → commande → réception/inspection → facture → comptabilité.

Les mouvements de stock sont traçables. Les ajustements ne sont pas silencieux. Les réceptions alimentent le stock et la comptabilité via des références communes, sans double saisie de l'opération.

Les changements de coordonnées bancaires fournisseurs, paiements exceptionnels et sorties de stock sensibles exigent des contrôles renforcés.

## 11. Juridique et conformité

Périmètre :
- contrats et conventions ;
- obligations contractuelles ;
- conformité réglementaire ;
- audits ;
- échéances ;
- partenariats et engagements ;
- dossiers de litiges et réclamations ;
- assurances et sinistres ;
- archives juridiques.

Cycle documentaire : reçu/préparé → revue juridique → corrections → validation Super Admin → signature par personne autorisée → archivage.

Une validation interne SAC ne constitue pas une signature juridique. La signature électronique et les formalités applicables doivent être validées selon le droit local.

Les alertes de veille juridique doivent être vérifiées par une personne compétente avant d'être traitées comme obligations applicables.

## 12. DSI — Informatique et systèmes d'information

Périmètre :
- infrastructure, domaines, réseau et hébergement ;
- applications et logiciels ;
- comptes et licences ;
- cybersécurité ;
- sauvegardes et restauration ;
- équipements informatiques ;
- imprimantes et terminaux ;
- incidents et tickets ;
- maintenance ;
- projets techniques ;
- versions et mises en production.

Supervision :
- disponibilité réelle ;
- temps de réponse ;
- erreurs serveur ;
- base de données ;
- stockage ;
- intégrité des sauvegardes ;
- notifications ;
- SMS ;
- paiements.

Un état vert ne peut être affiché qu'après un contrôle réel. Une sauvegarde réussie n'est fiable qu'après un test de restauration.

Le DSI agit dans le périmètre de sa mission ; il ne devient pas propriétaire des données ni détenteur d'un accès général aux alertes privées.

## 13. Relations externes

Périmètre :
- registre des partenaires ;
- fournisseurs selon leurs relations contractuelles ;
- propositions de partenariat ;
- candidatures de collaboration ;
- offres de service ;
- conventions et engagements ;
- suivi et évaluation des relations.

L'acceptation d'une candidature ne donne pas automatiquement un compte professionnel. Une invitation distincte et une mission explicite sont nécessaires.

Les documents des candidats et partenaires restent privés et soumis à une politique de conservation.

## 14. Pilotage

Fonctions :
- vision stratégique ;
- objectifs ;
- indicateurs ;
- projets ;
- résultats financiers ;
- performance d'équipe ;
- risques organisationnels ;
- alertes de direction ;
- rapports périodiques ;
- prévisions et scénarios ;
- suivi des directives.

Les indicateurs distinguent données calculées, déclarées, vérifiées et validées. Les simulations sont clairement marquées comme telles.

Les suivis de directives sont intégrés dans Pilotage ; aucun registre supplémentaire indépendant n'est créé uniquement pour les décisions.

## 15. Documents et archivage communs

Tous les services utilisent le même service documentaire central.

Tout document généré est archivé automatiquement dès sa génération, dans la rubrique d'origine, avec référence, date, auteur, service, version et statut. L'impression, sa demande et sa confirmation sont suivies séparément.

Les fichiers restent privés, protégés par permissions, liens temporaires et contrôles de sécurité. Les versions antérieures restent traçables selon les règles de conservation. Aucun document ne doit être supprimé ou écrasé silencieusement.

## 16. Données, permissions et audit

- Les permissions sont vérifiées côté serveur.
- L'appartenance à un service ne donne pas accès à toutes ses données.
- Les missions définissent le périmètre.
- Les informations RH, financières, juridiques et citoyennes sont séparées.
- Les actions sensibles sont historisées.
- Les secrets, clés privées, kits de récupération et GPS précis ne sont pas exposés dans la console.
- Le support et la DSI n'ont pas de droit général sur les alertes privées.
- Les collaborateurs ne peuvent pas s'auto-accorder des permissions.

Les tables conceptuelles déjà listées dans les documents du modèle de données doivent être harmonisées avant toute migration D1 ; ne pas créer des doublons pour chaque service.

## 17. État et limites

Tout ce document décrit la conception cible. Il ne prouve pas que la console, les modules RH, finances, logistique, secrétariat, juridique, DSI ou pilotage sont développés.

Avant de considérer un module comme livré, vérifier :
- le code réellement présent ;
- les routes et contrôles serveur ;
- les permissions ;
- les migrations D1 ;
- les tests et preuves ;
- les documents et archives ;
- les contrôles de sécurité et de conformité.

Aucun développement, migration, fournisseur ou déploiement n'est autorisé par la seule présence de cette spécification.