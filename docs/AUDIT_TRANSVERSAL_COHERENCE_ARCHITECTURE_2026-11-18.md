# SAC — Audit transversal de cohérence de l'architecture

**Date :** 18 novembre 2026  
**Référence auditée :** dépôt `benwahab/SAC`, branche `main`, commit de référence `8af7ad1c0f1527377bcade23408e705206fd8753`.  
**Nature :** audit documentaire et lecture ciblée du code existant. Aucun code applicatif, test, schéma, migration D1, ressource Cloudflare, fournisseur ou déploiement n'a été modifié.  
**Verdict :** architecture conceptuellement structurée, mais **NON PRÊTE POUR MIGRATION MÉTIER, ACTIVATION DU SOS RÉEL OU LANCEMENT PUBLIC**.

## 1. Synthèse exécutive

L'architecture SAC n'a pas besoin d'être recommencée. Les domaines majeurs sont documentés et plusieurs invariants sont répétés de manière cohérente : compte privé, e-mail vérifié avant activation, destinataires SOS figés, clôture réservée à l'auteur sauf exception étroite déjà définie, absence de droits familiaux implicites, GPS soumis à un verrou strict, et séparation entre décision métier et livraison technique.

L'audit relève néanmoins des écarts qui doivent être corrigés avant toute implémentation :
1. le contrat TypeScript du cycle de compte ne représente pas les cinq états validés ;
2. la documentation GPS conserve des formulations historiques et une consigne d'archive locale de 30 jours qui ne doit pas être appliquée aux positions d'une alerte après sa clôture ;
3. les règles de clôture d'une alerte par l'administration sont décrites avec des périmètres qui doivent être unifiés ;
4. le modèle relationnel, les contrats spécialisés et certains prototypes ne sont pas encore synchronisés ;
5. le statut juridique nigérien postérieur à juin 2026 n'est pas suffisamment authentifié pour une mise en production ;
6. les preuves d'exploitation, de reprise, de sécurité cryptographique et de fonctionnement réel du SOS ne sont pas disponibles.

Les éléments explicitement marqués « proposition », « à arbitrer » ou « à valider » restent non approuvés. Leur présence dans un document de synthèse ne les transforme pas en décisions.

## 2. Écarts critiques à traiter

### P0-01 — Machine à états des comptes incomplète dans le code

**Référence normative :** cinq états validés :
- `pending_verification`
- `active`
- `suspended`
- `deletion_pending`
- `deleted`

**Constat code :** `src/domain/account-lifecycle.ts` n'accepte que `active`, `deletion_pending` et `deleted`. Il ne représente ni l'inscription en attente de vérification ni la suspension. Les transitions de suspension, reprise, suppression depuis un compte suspendu et leurs effets sur les activités ouvertes ne sont donc pas représentés dans ce contrat pur.

**Risque :** modèle SQL et autorisations futurs pourraient être construits autour d'une machine d'états différente de la règle produit. L'absence d'un état dans le type ne doit jamais être compensée par un statut générique ou une permission implicite.

**Action requise :** établir une table canonique des états et transitions, acteur autorisé, préconditions, effets sur sessions/appareils/activités et événements d'audit ; aligner le contrat TypeScript et ses tests après arbitrage des transitions encore ouvertes. Aucun changement de code n'est autorisé par cet audit.

### P0-02 — Portée de la conservation GPS : archive locale de 30 jours à isoler

**Règle produit validée pour les alertes :**
- les positions GPS précises associées à une alerte sont supprimées immédiatement à la clôture ;
- seule la nature/catégorie de l'alerte reste dans l'historique pendant 30 jours ;
- à J+30 après clôture, l'entrée d'alerte et sa catégorie sont supprimées définitivement ;
- aucune sauvegarde, restauration, export, réplication ou Time Travel ne doit ressusciter les données supprimées.

**Précision issue du recoupement :** la ligne du suivi a depuis été qualifiée de cible candidate non approuvée, et non d'architecture effectivement retenue. La section 11 de `DECISIONS_PRODUIT_RESTANTES.md` décrit également une ancienne proposition d'historique GPS local hors ligne. Ces éléments doivent rester visibles comme historique, mais ne peuvent être lus comme une autorisation de conservation. Les anciennes formulations « 30 jours après la fin du partage » sont hors périmètre des alertes clôturées.

**Action requise :**
- marquer explicitement les formulations historiques comme supersédées ou candidates non approuvées ;
- confirmer qu'aucune archive GPS locale post-clôture n'est autorisée pour les alertes ;
- ne pas appliquer cette durée aux trajets sans décision distincte : leur conservation reste à arbitrer ;
- définir le moment exact de purge des caches, buffers, paquets en transit, copies locales et clés ;
- maintenir GPS NO-GO jusqu'à preuve de non-résurrection et revue indépendante.

Aucune interprétation technique ne doit modifier la règle produit de suppression immédiate du GPS d'une alerte à sa clôture. Le recoupement documentaire a permis de qualifier l'ancienne archive locale de candidate non approuvée ; il ne s'agit donc pas d'une décision à implémenter. Le présent P0 documentaire est traité par la rectification des références, sans lever le NO-GO technique.

### P0-03 — Autorité de clôture SOS et exception administrative

**Invariants :** seul l'auteur clôt normalement son alerte. Une exception administrative étroite est documentée pour un scénario spécifique de titulaire suspendu et de suspicion d'abus/perte de téléphone, sous autorité nominative et permission dédiée.

**Écart :** certains contrats de sécurité résument la règle comme « seul l'auteur clôture », tandis que la revue relationnelle et le contrat de suppression décrivent l'exception administrative. Le contrat TypeScript actuel `src/domain/alert-lifecycle.ts` ne représente que `closed_by_author`.

**Risque :** une implémentation pourrait soit supprimer l'exception déjà décidée, soit l'élargir à une capacité générale de clôture administrative.

**Action requise :** créer une matrice normative unique : scénario déclencheur, état du compte, autorité exacte, permission nominative, vérifications, motif, trace obligatoire, effet sur destinataires/rappels/GPS et interdictions. Le modèle métier devra représenter distinctement clôture par auteur et clôture exceptionnelle autorisée. Aucun droit général de clôture ne doit être créé.

### P0-04 — Contradictions et transitions de suppression de compte

Le contrat de suppression distingue demande et finalisation, interdit de finaliser en présence d'une alerte ou d'un trajet actif, et préserve la continuité de l'activité existante. Plusieurs cas restent explicitement ouverts : compte suspendu, auteur qui ne revient jamais, suspension pendant suppression, SOS programmé en course avec déclenchement, effets sur relations/groupes/invitations.

**Action requise :** résoudre les transitions avant schéma et API. Les compteurs fournis par le client ne peuvent pas prouver l'absence d'activité ; le serveur devra relire l'état persistant et arbitrer atomiquement les courses. Ne pas ajouter de clôture automatique ni de transfert d'autorité par défaut.

### P0-05 — Statut juridique et autorité compétente au Niger

La documentation rapporte la suppression de la HAPDP en juin 2026 et le transfert de missions, mais l'ordonnance n° 2026-30, le décret authentique et les procédures ministérielles applicables n'ont pas été authentifiés dans le dossier consulté.

**Action requise :** obtenir les textes primaires au Journal officiel, identifier par écrit les services compétents, faire analyser les obligations applicables et faire valider l'entité responsable du traitement, les formalités, les transferts et les délais d'incident par un conseil nigérien. Ne pas présenter l'ancienne HAPDP comme interlocuteur opérationnel. Ce point bloque les traitements réels et le lancement public.

### P0-06 — Modèle relationnel non prêt et absence de preuve D1 métier

La revue relationnelle conclut explicitement NON PRÊT POUR MIGRATION. Les migrations métier ne sont pas validées ; D1 est documentée comme vide au dernier audit ; la route `/api/health` vérifie seulement une requête élémentaire `SELECT 1`. Elle ne prouve ni authentification, ni SOS, ni transaction, ni outbox, ni purge, ni restauration.

**Action requise :** conserver le statut NON PRÊT POUR MIGRATION jusqu'à la fermeture des P0, l'alignement des machines à états, la validation des contraintes composites, des transactions et de la matrice de conservation, puis tests d'intégration D1 isolés. Ne pas déduire une fonctionnalité métier du seul état de santé technique.

## 3. Écarts majeurs à résoudre avant les domaines concernés

### P1-01 — Invitation et preuve d'acceptation

Le contrat du cycle de vie prévoit une invitation liée à l'adresse e-mail vérifiée du compte qui accepte, avec consommation atomique du jeton et création de relation après consentement. D'autres descriptions du modèle relationnel indiquent encore que le moyen exact de preuve de destination reste à arbitrer.

**Clarification nécessaire :** distinguer la règle déjà documentée (l'e-mail d'invitation doit correspondre à l'e-mail vérifié du compte acceptant) du protocole technique détaillé (token, expiration, rejeu, sessions, transaction, cas de changement d'e-mail). Les valeurs de durée et relances restent des propositions.

### P1-02 — Rappels SOS et escalade SMS

Les règles de rappel push toutes les cinq minutes, le choix de 1 à 5 rappels avant seuil SMS et la valeur par défaut de 2 sont à conserver comme règles produit documentées. Le SMS reste conditionné à un fournisseur réel, à une preuve adaptée du numéro de destination et à des tests. Acceptation fournisseur, livraison, ouverture et lecture humaine doivent rester distinctes.

**Action :** vérifier que chaque contrat de notification reprend les mêmes termes et qu'aucun texte ne promet une livraison garantie ou ne confond le seuil d'escalade avec la durée de l'alerte.

### P1-03 — Durées de conservation hors GPS

La politique générale de conservation est une proposition. Les durées concernant comptes, invitations, appareils, sessions, logs, support, exports et preuves ne sont pas approuvées et ne doivent pas être transformées en constantes ou contraintes SQL.

**Action :** construire une matrice finale par catégorie, finalité, base juridique, point de départ, durée, accès, purge, sauvegarde et restauration ; validation juridique préalable.

### P1-04 — Groupes, SOS programmé, SOS discret, paiements

Ces domaines restent des propositions/conceptions, pas des capacités validées pour migration. Le groupe ne confère aucun droit d'alerte ou de localisation. Les courses entre programmation et déclenchement, la récupération du code discret, les limites de paiement et les obligations associées exigent des arbitrages distincts.

**Action :** ne pas les inclure dans le premier schéma métier tant que les parcours, transitions, autorisations, risques et tests ne sont pas approuvés.

### P1-05 — Cryptographie et multi-appareils

Le jumelage secondaire et la récupération de racine sont expérimentaux/incomplets. Une signature auto-incluse ne prouve pas l'identité ; le transcript doit lier canoniquement racine, compte, appareils, challenge, nonce, cérémonie et expiration. Le challenge doit être consommé une seule fois côté serveur. Une revue cryptographique indépendante est requise.

**Action :** aucun endpoint d'approbation d'appareil, aucune récupération de racine et aucune donnée GPS réelle avant validation du protocole, tests adversariaux et revue indépendante.

### P1-06 — Résilience et reprise

Les contrats définissent correctement les états réseau et la non-résurrection, mais aucune preuve de restauration, reprise d'outbox, continuité réelle des rappels, tests opérateur ou bascule fournisseur n'est démontrée.

**Action :** définir RTO/RPO, runbooks, responsabilités, source de vérité des révocations/purges, procédures d'isolement et critères de réouverture ; exécuter les exercices sur environnement isolé avant toute déclaration de préparation opérationnelle.

## 4. Points cohérents à préserver — ne pas les rouvrir sans raison

- Compte : e-mail obligatoire et vérifié par OTP e-mail avant activation ; téléphone obligatoire comme coordonnée déclarée, mais non vérifiée ; aucun SMS OTP de compte.
- Authentification : e-mail + mot de passe ; OTP non requis à chaque connexion ordinaire ; minimum de mot de passe 12 caractères.
- Sessions : déconnexion après 30 jours consécutifs d'inactivité et réauthentification au plus tard à 90 jours absolus.
- Proches : compte SAC actif, e-mail vérifié, invitation distincte et acceptation explicite ; relation directionnelle.
- Groupes : appartenance distincte d'une relation de confiance ; aucun droit SOS/GPS implicite.
- SOS : alertes privées, destinataires initiaux figés, rappels toutes les cinq minutes jusqu'à clôture autorisée, aucun faux succès avant confirmation serveur.
- GPS d'alerte : suppression immédiate à la clôture ; catégorie seule pendant 30 jours ; purge totale à J+30 ; non-résurrection obligatoire.
- Gouvernance : seul le Super Admin crée, attribue, modifie, suspend et retire les missions/délégations ; les délégués ne délèguent pas.
- Architecture : React/Vite/TypeScript, Pages Functions, D1 cible, R2 privé conditionnel, PWA d'abord ; aucune migration sans autorisation.
- Les fonctions non implémentées ne doivent jamais être présentées comme opérationnelles.

## 5. Ordre de résolution recommandé

| Ordre | Travail | Critère de sortie |
|---|---|---|
| 1 | Corriger la hiérarchie des règles GPS et clarifier l'archive locale | aucune phrase ne permet une conservation GPS d'alerte après clôture |
| 2 | Unifier les machines à états compte et alerte | matrice d'états/transitions/acteurs sans divergence entre contrats et code cible |
| 3 | Résoudre suppression, suspension et clôture exceptionnelle | scénarios et courses atomiques approuvés |
| 4 | Unifier invitations et preuve de destination | un seul parcours de consentement et de vérification |
| 5 | Finaliser matrice de conservation hors GPS | chaque catégorie possède une règle validée juridiquement |
| 6 | Authentifier textes et formalités Niger | avis juridique local et sources primaires archivées |
| 7 | Finaliser modèle relationnel et autorisations | revue NON PRÊT levée formellement, contraintes et tests définis |
| 8 | Revue cryptographique et restauration | preuves indépendantes et tests adversariaux concluants |
| 9 | Implémentation par lots autorisés | code, tests, migrations et déploiements vérifiés séparément |

## 6. Conditions de sortie de l'audit

L'audit documentaire ne peut être considéré comme clos que lorsque :
- chaque P0 possède un document normatif corrigé et un propriétaire de décision ;
- les propositions restent identifiables comme telles ;
- le registre de décisions renvoie vers les contrats de référence sans reformuler des règles périmées ;
- le modèle relationnel et les contrats TypeScript décrivent les mêmes états ;
- la règle GPS d'alerte est cohérente dans tous les documents de référence ;
- les obligations nigériennes ont été authentifiées et revues par un juriste ;
- les critères de migration, de sécurité, de reprise et de lancement sont vérifiables.

## 7. Limites de cet audit

Cet audit est une lecture ciblée des documents de référence et de contrats de code connus. Il ne constitue pas une revue ligne par ligne de tout le dépôt, un test d'intrusion, une revue cryptographique indépendante, un avis juridique, une validation de ressources Cloudflare ou une preuve d'exécution sur appareils Android/iOS. Les constats portant sur l'état de D1 et les ressources doivent être rafraîchis en lecture seule avant toute implémentation.

**Conclusion :** SAC dispose d'une architecture documentaire riche et de plusieurs décisions produit solides. Le risque principal n'est plus l'absence de documents : c'est la divergence entre documents anciens et récents, entre contrats et code, et entre garanties écrites et preuves techniques. La priorité est maintenant la normalisation et la preuve, pas l'ajout de nouvelles fonctionnalités.
