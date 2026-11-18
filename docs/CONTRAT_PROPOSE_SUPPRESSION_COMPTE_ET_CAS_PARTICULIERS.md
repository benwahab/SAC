# SAC — Contrat proposé de suppression du compte et cas particuliers

**Date :** 18 novembre 2026  
**Statut :** consolidation des invariants déjà validés et propositions à arbitrer. Ce document ne valide aucune nouvelle règle produit et n'autorise aucune implémentation.  
**Références normatives :** `ARBITRAGE_P0_CYCLE_COMPTE_ET_PREUVE_PROCHES.md`, `CONTRAT_CONSERVATION_ALERTES_ET_PURGE.md`, `PROPOSITION_POLITIQUE_GENERALE_CONSERVATION_DONNEES.md`, `PROPOSITIONS_ARBITRAGE_TRAJETS_ET_ALERTES_ORPHELINES.md`.

## 1. Décisions déjà validées — invariants à préserver

1. Le compte possède exactement cinq états : `pending_verification`, `active`, `suspended`, `deletion_pending`, `deleted`.
2. L'e-mail est obligatoire à l'inscription ; seul un OTP e-mail valide permet l'activation. Avant cela, aucun accès privé ni session.
3. Le téléphone est obligatoire comme coordonnée déclarée, mais n'est pas vérifié et ne remplace jamais l'e-mail.
4. Une suspension administrative est décidée par le Super Admin ; elle bloque les activités générales et révoque les sessions générales. Elle ne supprime pas les données.
5. Un verrouillage technique de sécurité sur une tentative ou une session n'est pas une suspension du compte.
6. La demande de suppression et sa finalisation sont deux opérations distinctes. Une demande interdit les nouveaux flux métier.
7. La finalisation est interdite tant qu'une alerte ou un trajet est actif.
8. Le compte `deleted` est terminal : aucune restauration ni réactivation de l'ancien compte.
9. Les permissions exceptionnelles déjà validées pour un titulaire suspendu pendant une alerte existante sont strictement limitées à cette alerte et à l'appareil d'origine. Elles ne donnent pas une session générale. Dans le scénario spécifique déjà décrit, seul l'administrateur SAC habilité peut effectuer la clôture exceptionnelle ; le titulaire suspendu peut seulement la demander.
10. Une alerte SOS déjà transmise continue selon ses règles : destinataires initiaux figés et rappels toutes les cinq minutes jusqu'à la clôture autorisée.
11. À la clôture d'une alerte, toutes les positions GPS précises associées sont supprimées immédiatement. Seule la catégorie reste 30 jours, puis l'entrée et sa catégorie sont supprimées définitivement. Aucune sauvegarde/restauration ne peut les ressusciter.
12. Les durées de conservation non GPS ne sont pas encore approuvées. La matrice générale demeure une proposition.

## 2. Machine de suppression — séparation des opérations

### 2.1 Demande

La demande n'est pas la suppression physique. Elle doit :
- être authentifiée et attribuée au titulaire du compte ;
- être confirmée explicitement avec explication des conséquences ;
- créer un événement d'audit minimal ;
- interdire immédiatement toute nouvelle activité métier ;
- ne pas supprimer prématurément les données nécessaires aux alertes/trajets déjà actifs ;
- révoquer les sessions et appareils non nécessaires au parcours limité de clôture, selon un mécanisme à valider.

La confirmation renforcée, le délai de réflexion, la possibilité d'annulation et les canaux de demande restent à formaliser. Le document ne fixe aucun délai de grâce.

### 2.2 Période de traitement

Pendant `deletion_pending` :
- aucun nouveau SOS immédiat, SOS programmé, trajet, invitation, groupe, partage ou nouvelle relation ;
- aucune nouvelle prise en charge ou nouvelle délégation issue du compte, sauf opération strictement nécessaire à la sécurité d'une activité existante et explicitement autorisée ;
- les alertes et trajets déjà actifs ne sont ni supprimés ni clôturés par le seul fait de la demande ;
- le compte ne doit pas conserver une session générale ordinaire simplement pour permettre la suppression ;
- tout accès résiduel doit être limité à la finalisation des activités existantes, à l'annulation des programmations non déclenchées et à la consultation des informations nécessaires pour terminer le parcours, sous réserve d'arbitrage.

**Proposition de sécurité :** ouvrir un mode de clôture restreint, à durée et permissions minimales, séparé d'une session générale. Il ne doit permettre ni création, ni invitation, ni modification de profil, ni accès aux fonctions sans rapport avec les activités ouvertes. Cette proposition n'est pas approuvée.

### 2.3 Finalisation

La finalisation ne peut être exécutée que si le serveur confirme, dans une opération atomique :
- aucune alerte active attribuée comme auteur au compte ;
- aucun trajet actif dont le compte est l'auteur ;
- aucun traitement de clôture ou transfert de responsabilité encore en cours ;
- aucune course concurrente ayant créé une activité entre le contrôle et la finalisation ;
- les obligations de conservation approuvées sont appliquées ;
- les sessions, certificats, appareils, abonnements push, invitations et droits ont un traitement défini.

Les compteurs fournis par le client ne constituent jamais une preuve. Le serveur relit les ressources persistées et vérifie les préconditions au moment de l'écriture finale.

À la finalisation :
- passer à `deleted` de manière terminale ;
- invalider toutes les sessions, jetons, certificats, appareils et moyens d'accès ;
- supprimer ou pseudonymiser les données personnelles selon une matrice de conservation validée ;
- ne garder que les preuves minimales explicitement justifiées, avec champs, accès et durée validés ;
- appliquer les marqueurs de suppression nécessaires à la non-résurrection après restauration ;
- ne pas produire un export implicite des données supprimées.

Aucune durée ou liste de conservation n'est figée ici : se référer à la matrice générale en attente d'arbitrage et à toute obligation juridique confirmée.

## 3. Cas par état du compte

### 3.1 Inscription `pending_verification`

**Déjà validé :** aucun accès privé, aucune session, aucune alerte tant que l'e-mail n'est pas vérifié.

**À arbitrer :**
- durée de validité de l'inscription non vérifiée ;
- purge de l'inscription abandonnée ;
- traitement d'une demande d'effacement avant vérification ;
- traitement d'une adresse e-mail déjà inscrite, sans énumération.

**Proposition :**
- expiration automatique de l'inscription provisoire après 24 heures ;
- le défi OTP et les données provisoires sont invalidés puis purgés selon une règle dédiée ;
- l'effacement immédiat peut être demandé par un lien à usage unique envoyé à la même adresse, sans activer le compte ni créer de session ;
- une empreinte anti-abus éventuelle est séparée, minimale et à durée courte, après validation juridique.

Le délai de 24 heures et le parcours d'effacement par lien sont des propositions, pas des décisions. Le téléphone déclaré ne sert jamais à prouver la demande.

### 3.2 Compte `active`

**Déjà validé :** le titulaire authentifié peut demander la suppression ; le compte passe à `deletion_pending`, bloque les nouveaux flux et ne peut être finalisé tant qu'une alerte ou un trajet est actif.

**Proposition :**
- demander une réauthentification récente et une confirmation explicite ;
- informer l'utilisateur des activités encore ouvertes et de ce qui doit être terminé ;
- lui permettre de clôturer ses propres alertes/trajets selon les règles ordinaires, sans donner de droit nouveau aux proches ou à l'administration ;
- annuler les SOS programmés non déclenchés lors de la demande, avec événement d'annulation et notification appropriée.

L'annulation des SOS programmés, le niveau de réauthentification et les notifications sont à confirmer.

### 3.3 Compte `suspended`

**Déjà validé :** la suspension interdit l'accès général et révoque les sessions générales ; elle ne supprime pas les données. Le titulaire n'obtient que les capacités exceptionnelles déjà définies pour une alerte préexistante.

**À arbitrer :**
- le titulaire suspendu peut-il demander la suppression ?
- quel canal authentifié permet de vérifier cette demande sans rétablir une session générale ?
- la demande de suppression peut-elle être mise en attente sans lever la suspension ?
- que faire si une alerte/trajet est encore actif ?

**Proposition de prudence :**
- ne jamais réactiver le compte simplement pour traiter une demande de suppression ;
- autoriser une demande enregistrée par un canal de vérification distinct, sans accès aux données privées ni session générale ;
- conserver l'état `suspended` tant qu'une décision administrative n'a pas été prise, et représenter la demande comme une procédure séparée plutôt que d'inventer un sixième état ;
- ne finaliser qu'après traitement des activités ouvertes et validation de la conservation.

Cette proposition doit être arbitrée. Aucun administrateur ne peut supprimer arbitrairement un compte ou contourner les règles de clôture d'alerte.

### 3.4 Compte `deletion_pending`

**Déjà validé :** aucun nouveau flux métier ; finalisation différée si alerte ou trajet actif ; annulation possible avant finalisation selon le contrat existant, avec cas de suspension concomitante non résolu.

**À arbitrer :**
- durée maximale de la période de traitement ;
- comportement si le titulaire ne revient jamais ;
- portée exacte du mode de clôture restreint ;
- suspension administrative concomitante ;
- sort des SOS programmés, invitations, groupes, relations et abonnements.

**Proposition :**
- pas de clôture automatique d'une alerte par silence ou expiration de suppression ;
- pas de transfert automatique de l'autorité de clôture à un proche ;
- si le titulaire ne revient pas, conserver la procédure en attente et déclencher uniquement un processus de support/sécurité préalablement approuvé, sans divulguer le contenu de l'alerte ;
- ne jamais transformer le délai de suppression du compte en autorisation de clôturer une alerte.

Cette proposition préserve le principe « seul l'auteur clôture » et l'exception administrative étroite déjà documentée pour un titulaire suspendu ; elle ne tranche pas la procédure de secours.

### 3.5 Compte `deleted`

- état terminal ;
- toutes les authentifications et autorisations révoquées ;
- aucune restauration de l'ancien compte depuis une sauvegarde ;
- une nouvelle inscription, si autorisée, crée une nouvelle identité de compte ;
- aucune relation, invitation, mission ou appartenance ne doit être réactivée implicitement ;
- toute preuve conservée doit avoir une finalité, des champs, un accès et une durée validés.

La possibilité de réutiliser une ancienne adresse e-mail ou un ancien numéro, les délais anti-abus et les éventuelles empreintes sont encore à arbitrer.

## 4. Alertes, trajets et SOS programmés lors d'une demande

### Alertes SOS actives
- L'instantané des destinataires initiaux reste inchangé.
- Les rappels prévus continuent jusqu'à la clôture autorisée.
- La demande de suppression ne clôture pas l'alerte.
- Les règles de GPS et de partage sont celles des contrats SOS/GPS ; ce document n'autorise aucune prolongation de collecte.
- Si le titulaire ne revient pas, aucune clôture automatique n'est déduite de son silence.

### Trajets actifs
- La demande ne clôture pas le trajet.
- Le principe actuel selon lequel seul l'auteur clôture le trajet reste applicable.
- L'arrêt/expiration du partage de position est distinct de la fin du trajet et reste soumis aux décisions spécifiques des trajets.
- Aucun GPS ne doit être collecté ou conservé en contradiction avec le GO technique J+30.

### SOS programmés non déclenchés
- **Proposition :** les annuler à la demande de suppression, puisque le compte ne doit plus initier d'activité future.
- L'annulation doit être atomique avec le déclenchement : exactement un des deux événements gagne.
- Si le déclenchement gagne la course, l'alerte créée devient une activité existante et suit son cycle normal ; la suppression reste en attente.
- Si l'annulation gagne, aucun dossier d'alerte n'est créé.
- Ce comportement doit être explicitement approuvé avant implémentation.

## 5. Effets sur les proches, groupes et relations

**Invariants déjà établis :**
- groupe, appartenance, relation de confiance et destinataire d'alerte sont des objets séparés ;
- une appartenance à un groupe ne donne aucun droit SOS/GPS ;
- les destinataires d'une alerte active sont figés ;
- la suppression d'un compte ne doit pas réécrire rétroactivement l'instantané d'une alerte.

**Propositions à arbitrer :**
- à la demande, suspendre les nouvelles invitations et révoquer les invitations sortantes non acceptées ;
- à la finalisation, révoquer les relations de confiance et appartenances actives, sans supprimer le compte des autres membres ;
- supprimer les groupes dont le compte est propriétaire uniquement après transfert accepté ou fermeture explicite ; ne pas transférer automatiquement la propriété ;
- conserver dans les alertes existantes un identifiant de participant pseudonymisé si nécessaire à la continuité et à l'audit, selon durée approuvée ;
- ne pas notifier les proches du motif de suppression ; toute notification éventuelle reste neutre et minimale.

Aucune de ces conséquences relationnelles n'est approuvée par le présent document.

## 6. Courses concurrentes et invariants serveur

Les scénarios suivants doivent être définis et testés avant API/D1 :
- demande de suppression contre création d'une alerte ;
- demande contre création d'un trajet ;
- demande contre déclenchement d'un SOS programmé ;
- finalisation contre création concurrente ou activité non encore reflétée dans le client ;
- suspension contre demande de suppression ;
- annulation de suppression contre finalisation ;
- suppression contre acceptation d'une invitation ;
- suppression contre révocation d'un appareil/session ;
- rétablissement après restauration d'une sauvegarde antérieure.

Une commande doit utiliser un état/version attendu, une clé d'idempotence et une transaction serveur. Si deux opérations incompatibles se présentent, une seule peut réussir ; l'autre reçoit un résultat explicite et sûr. Aucun succès n'est affiché avant confirmation de l'écriture serveur.

## 7. Tests d'acceptation obligatoires

1. Aucun compte `pending_verification` ne possède de session ni ne peut créer d'activité.
2. Expiration d'une inscription provisoire ne peut pas activer le compte.
3. Une demande de suppression active bloque les nouveaux flux.
4. Un client ne peut pas falsifier le nombre d'alertes/trajets actifs pour forcer la finalisation.
5. La finalisation échoue si une alerte ou un trajet est actif.
6. Une demande de suppression ne ferme pas une alerte ni un trajet.
7. Une alerte existante conserve son instantané de destinataires et ses rappels selon les règles validées.
8. Un compte suspendu ne récupère jamais une session générale par le parcours de suppression.
9. L'exception de clôture pour compte suspendu ne devient pas une permission générale.
10. Une course entre demande et création d'activité ne permet pas de créer une activité après acceptation de la demande.
11. Une course entre annulation et finalisation ne peut pas produire un compte à la fois actif et supprimé.
12. Un compte `deleted` ne peut pas être restauré par backup/Time Travel.
13. Les appareils, certificats, sessions et abonnements révoqués ne sont pas réactivés après restauration.
14. Les suppressions de données personnelles suivent la matrice validée ; aucune durée proposée non approuvée n'est codée.
15. Les positions GPS sont supprimées à la clôture de l'alerte et la catégorie d'alerte est supprimée à J+30 selon le contrat spécialisé.
16. Les preuves conservées ne permettent pas de reconstituer les données supprimées.

## 8. Arbitrages à obtenir avant fermeture du P0

| Sujet | Proposition de travail | Statut |
|---|---|---|
| Expiration de `pending_verification` | 24 heures | À confirmer |
| Effacement avant vérification e-mail | Lien à usage unique à la même adresse, sans activation | À confirmer |
| Suppression depuis `suspended` | Demande via canal distinct, sans lever la suspension | À confirmer |
| Suspension pendant `deletion_pending` | Suspension prioritaire ; aucune session de clôture générale | À confirmer |
| Réauthentification pour demander suppression | Authentification récente + confirmation explicite | À confirmer |
| Mode restreint pour clôturer activités | Permissions minimales, pas de session générale | À confirmer |
| SOS programmé non déclenché | Annulation atomique à la demande | À confirmer |
| Compte absent pendant une alerte | Pas de clôture automatique ; procédure de secours à définir | À confirmer |
| Durée maximale de traitement | Aucune durée fixée ici | À arbitrer |
| Relations, groupes et invitations | Révocation à la finalisation, sans transfert automatique | À confirmer |
| Conservation après suppression | Matrice non GPS + validation juridique | À confirmer |
| Réutilisation e-mail/téléphone | Politique anti-abus et délai à définir | À arbitrer |

## 9. Garde-fous de mise en œuvre

- Réconcilier d'abord les cinq états validés avec `src/domain/account-lifecycle.ts`, qui ne représente encore que trois états.
- Ne pas utiliser un booléen générique du type `allowCloseExistingActivity` pour mélanger droits du titulaire actif, titulaire en suppression et titulaire suspendu.
- Définir des capacités séparées, limitées à une ressource et contrôlées côté serveur.
- Les compteurs d'activités sont recalculés depuis D1 dans la transaction de finalisation.
- Les marqueurs de suppression/révocation doivent survivre aux restaurations.
- Les journaux ne contiennent aucun OTP, mot de passe, jeton brut, clé privée, GPS précis ni contenu privé d'alerte.
- La revue indépendante de sécurité et la validation juridique sont obligatoires avant le schéma final.

## 10. Limites et statut

Cette intervention est documentaire. Elle ne modifie aucun code, test, API, SQL, migration D1, ressource Cloudflare, fournisseur, notification ou déploiement. Les valeurs et parcours signalés « à confirmer » ne sont pas des décisions utilisateur.

**Verdict :** les invariants de demande/finalisation et les cinq états sont consolidés ; le P0 reste ouvert tant que les transitions des comptes non vérifiés/suspendus, les activités orphelines, le mode restreint et les durées de conservation ne sont pas arbitrés.

## Complément d'arbitrage

Lire `RECOMMANDATIONS_ARBITRAGE_FINAL_SUPPRESSION_COMPTES.md` pour les recommandations regroupées par état, les courses concurrentes et les effets sur les invitations/groupes. Ces recommandations restent non approuvées et ne remplacent pas les invariants de ce contrat.
