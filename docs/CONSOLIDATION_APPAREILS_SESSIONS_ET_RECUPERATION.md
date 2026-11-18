# SAC — Consolidation appareils, sessions et récupération du compte

**Date :** 18 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche unique `main`  
**Statut :** consolidation documentaire. Les règles explicitement validées sont distinguées des propositions et des blocages. Aucun code, endpoint, migration D1, fournisseur, secret Cloudflare ou déploiement n'est autorisé par ce document.

## 1. Objet et hiérarchie des contrats

Ce document sert de point d'entrée transversal entre :
- `PROTOCOLE_MULTI_APPAREILS.md` ;
- `TRANSCRIPT_CEREMONIE_MULTI_APPAREILS.md` ;
- `REVUE_COHERENCE_PROTOCOLE_MULTI_APPAREILS.md` ;
- `RECUPERATION_COMPTE_ET_RACINE.md` ;
- `AUDIT_RECUPERATION_COMPTE_SANS_APPAREIL_FIABLE.md` ;
- `ARBITRAGE_RECUPERATION_RACINE_ET_ATOMICITE_D1.md` ;
- `AUDIT_CYCLE_VIE_SESSIONS_ET_RENOUVELLEMENT.md` ;
- `ARBITRAGES_TECHNIQUES_COMPTES_OTP_SESSIONS.md`.

Il ne remplace pas ces contrats détaillés et ne valide pas les propositions cryptographiques. En cas de divergence :
1. les décisions utilisateur explicitement validées priment ;
2. l'arbitrage de sécurité qui interdit une opération en V1 prime sur une proposition de version ultérieure ;
3. un document marqué « proposition », « audit » ou « bloquant » ne devient pas normatif par simple référencement ;
4. aucun agent ne choisit silencieusement un format cryptographique ou une procédure de récupération.

## 2. Décisions validées à préserver

### Compte et preuve
- Le compte utilise cinq états : `pending_verification`, `active`, `suspended`, `deletion_pending`, `deleted`.
- E-mail obligatoire à l'inscription ; OTP e-mail valide obligatoire pour activer le compte.
- Téléphone obligatoire comme coordonnée déclarée, mais non vérifiée ; aucun OTP SMS pour le compte.
- Connexion standard : e-mail + mot de passe. L'OTP n'est pas exigé à chaque connexion par défaut.
- Le mot de passe a un minimum de 12 caractères.
- Le contrôle de l'e-mail, le contrôle du compte et la confiance cryptographique de l'appareil sont trois preuves distinctes.

### Sessions
- Déconnexion automatique après 30 jours consécutifs sans activité.
- Réauthentification obligatoire au plus tard après 90 jours, même si l'utilisateur est actif.
- Les deux limites s'appliquent ensemble : la limite d'inactivité peut interrompre une session avant le plafond absolu.
- Une session appartient à un compte et à un appareil précis.
- Une session ou un jeton révoqué ne peut pas être renouvelé ni restauré depuis une sauvegarde.
- Les changements d'adresse IP ou de réseau mobile ne bloquent pas à eux seuls l'utilisateur.

### Appareils et racine
- Un appareil secondaire ne s'approuve pas lui-même et ne se promeut jamais racine.
- Pour la V1, l'appareil racine unique est le seul autorisé à approuver l'ajout d'un appareil secondaire ; aucun appareil secondaire ne peut approuver un autre appareil. Cette décision produit a été validée le 17 novembre 2026.
- Un appareil révoqué ne peut plus ouvrir ou renouveler de session ; sa révocation ne supprime pas le compte ni les autres appareils.
- OTP, mot de passe, réinitialisation de mot de passe, e-mail, SMS et intervention du support ne restaurent pas une clé privée racine.
- La récupération d'accès au compte ne restaure pas l'identité cryptographique.
- La racine perdue ou compromise n'est pas remplacée en V1. La transition de racine reste interdite tant qu'une procédure ultérieure n'est pas arbitrée, spécifiée et revue indépendamment.
- Les contacts ne sont pas des administrateurs du compte et ne peuvent pas récupérer le compte ou approuver une racine à la place du titulaire.

## 3. Matrice des scénarios utilisateur

| Situation | Accès au compte | Appareil / session | Racine et GPS | Statut |
|---|---|---|---|---|
| Mot de passe oublié, appareil racine encore disponible | Réinitialisation selon procédure renforcée à définir | Session à rétablir après preuve requise | La racine ne change pas ; preuve locale racine toujours exigée | Facteurs exacts à arbitrer |
| Téléphone secondaire perdu, racine disponible | Compte reste distinct de l'appareil perdu | Révoquer l'appareil perdu et ses sessions ; autres appareils inchangés | Racine inchangée | Révocation prévue ; parcours UI/API non implémenté |
| Téléphone racine perdu, secondaire approuvé disponible | Accès compte éventuellement possible selon ses droits existants | Le secondaire reste secondaire ; il ne remplace pas la racine | Pas de promotion automatique ; opérations dépendant de la racine bloquées si racine déclarée perdue/révoquée | Limites exactes du secondaire à arbitrer |
| Téléphone racine volé, possiblement déverrouillé | Sécurisation du compte selon autorité de preuve à définir | Révocation urgente à concevoir ; ne pas prétendre effacer le téléphone hors ligne | Après commit de révocation, ancienne racine et certificats dépendants refusés ; GPS bloqué | Procédure opérationnelle à arbitrer |
| Tous les appareils approuvés perdus | Récupération d'accès éventuellement distincte, facteurs non finalisés | Aucun nouvel appareil approuvé en V1 sur simple OTP/e-mail/mot de passe | Aucune nouvelle racine en V1 ; GPS et fonctions qui en dépendent bloqués | Blocage V1 explicite |
| E-mail compromis ou perdu | E-mail seul insuffisant ; changement d'adresse par appareil sûr et preuve appropriée à spécifier | Aucun nouvel appareil approuvé par OTP sur nouvel e-mail seul | Aucune modification de racine | Parcours à arbitrer |
| SIM swap / numéro détourné | Téléphone déclaré non vérifié ; SMS ne récupère pas le compte | Aucun appareil approuvé | Aucune racine restaurée | Règle de sécurité |
| Ancienne sauvegarde restaurée | Ne prouve pas le contrôle actuel du compte | État serveur courant prévaut ; session/appareil révoqué reste refusé | Racine révoquée non réactivée | Règle de sécurité |
| Réseau/IP modifié | Connexion ne doit pas être bloquée pour ce seul motif | Session vérifiée selon état serveur | Aucun effet sur racine | Règle validée |

**Limite de communication :** « révoqué côté serveur » ne signifie jamais « téléphone effacé ». SAC ne peut pas effacer à distance les copies locales d'un appareil hors ligne.

## 4. Parcours d'enrôlement d'un appareil secondaire

Le principe de double autorisation est retenu dans les contrats comme exigence de conception : l'appareil racine approuve précisément la demande et le nouvel appareil prouve la possession de ses clés. Cependant, le protocole cryptographique complet n'est pas homologué.

Avant implémentation, il faut résoudre sans divergence :
- format canonique unique : le protocole existant mentionne RFC 8785/JCS tandis que le transcript récent cite CBOR déterministe comme exemple ;
- signatures exactes : signature racine et preuve de possession du nouvel appareil ;
- nonce racine, nonce nouvel appareil, défi serveur, propriétaire, taille, durée et consommation unique ;
- valeur SAS de comparaison indépendante et vecteurs de test ;
- validation des clés P-256 et rejet des points invalides ;
- consommation atomique du défi et vérification de l'état racine au commit ;
- révocation concurrente, reprise idempotente et restauration ;
- compatibilité Web, Android, iOS et serveur.

Le certificat TypeScript actuel est un prototype local, pas un enrôlement complet. Il ne faut ni le déclarer prêt ni connecter son résultat à une permission réelle avant revue indépendante.

## 5. Sessions : règles et décisions manquantes

### Règles applicables
À chaque requête protégée, le serveur doit contrôler l'état actuel du compte, de l'appareil, de la session, l'expiration et la version d'autorisation. Le client ne fournit jamais la preuve de son propre état.

À la révocation d'un appareil :
- l'appareil passe à l'état révoqué ;
- toutes ses sessions et capacités de renouvellement sont invalidées ;
- ses abonnements push et certificats doivent être traités selon le contrat final ;
- les autres appareils restent actifs ;
- les mutations dont l'écriture finale intervient après le commit de révocation échouent.

### Non décidé
- présence ou absence d'un refresh token distinct ;
- renouvellement silencieux ou réauthentification périodique ;
- rotation, famille de jetons et détection de rejeu si refresh token ;
- transport final des sessions PWA et du futur client Capacitor ;
- notification de sécurité et délai d'information après révocation.

L'audit des sessions doit être lu avec la décision utilisateur des 30/90 jours ci-dessus : les durées sont validées ; le mécanisme de renouvellement ne l'est pas.

## 6. Récupération : séparation en trois couches

### Couche A — récupérer l'accès au compte
Peut éventuellement permettre de retrouver l'accès applicatif après vérification renforcée. Les facteurs indépendants, le fournisseur, les délais, les limites, les notifications et les cas de perte de tous les facteurs ne sont pas encore décidés.

Une réinitialisation de mot de passe ne modifie pas la racine et n'approuve aucun appareil.

### Couche B — enrôler un appareil
Un appareil neuf doit suivre la cérémonie multi-appareils avec une racine encore valide. Un OTP ou un compte récupéré ne suffit pas. Si aucune racine valide n'existe, l'enrôlement normal est bloqué en V1.

### Couche C — remplacer une racine perdue
Interdit en V1. Les états de remplacement, nouvelle génération et ré-ancrage des contacts présents dans les documents d'étude sont des propositions pour une version ultérieure, pas une fonctionnalité approuvée.

Si une version ultérieure est étudiée, elle devra au minimum :
- créer localement une nouvelle paire indépendante, jamais importer l'ancienne clé ;
- révoquer l'ancienne racine et empêcher son retour après restauration ;
- lier la nouvelle génération à un transcript et à des preuves auditées ;
- faire vérifier indépendamment la nouvelle empreinte par chaque contact concerné avant le partage GPS avec ce contact ;
- ne jamais transformer les contacts en quorum d'authentification du compte ;
- obtenir une revue cryptographique indépendante et des tests interopérables.

Le nombre de contacts requis, les contacts injoignables et la méthode de vérification indépendante restent ouverts.

## 7. SOS sans GPS pendant une récupération : contradiction à résoudre

Un document de récupération indique que le SOS sans GPS doit rester disponible ; l'audit de récupération sans appareil fiable précise toutefois que cette disponibilité n'est pas démontrée et que son authentification, son anti-abus et sa transmission restent à spécifier.

**Règle de lecture prudente :** le maintien du SOS non-GPS est un objectif produit, pas une garantie technique actuellement réalisable. Aucun contournement par OTP seul, session neuve non approuvée ou ancienne session révoquée n'est autorisé. Le comportement doit faire l'objet d'un arbitrage explicite et d'un mécanisme d'authentification indépendant avant activation.

## 8. Autorité D1, restauration et concurrence

Toute opération de révocation, enrôlement ou récupération doit être validée contre l'état serveur courant au moment de l'écriture finale. L'atomicité de `DB.batch()` ne suffit pas : un `UPDATE` qui touche zéro ligne n'interrompt pas automatiquement les autres instructions.

Le futur contrat doit démontrer :
- préconditions vérifiées dans l'écriture transactionnelle ;
- révocation, invalidation des sessions/certificats/cérémonies liées sans effet partiel ;
- sérialisation des opérations par compte et époque de racine ;
- idempotence après perte de réponse ;
- rejet d'une ancienne génération, d'un défi consommé ou d'une session révoquée ;
- restauration « forward-only » qui rejoue les révocations et ne réactive aucune ressource.

Aucun SQL définitif n'est prêt à partir des contrats actuels.

## 9. Tests bloquants avant mise en service

1. OTP e-mail ou réinitialisation de mot de passe ne modifie jamais l'empreinte ni la génération racine.
2. Un secondaire ne peut pas s'approuver ni promouvoir un autre appareil.
3. Un appareil révoqué revenant en ligne est refusé avant lecture de données privées.
4. Révocation d'un appareil parmi plusieurs : les autres restent actifs.
5. Deux approbations, révocations ou récupérations concurrentes ne produisent aucun état double.
6. Toute mutation dont l'écriture finale arrive après la révocation échoue.
7. Défi expiré, consommé, d'un autre compte ou altéré : refus.
8. Sérialisation et signatures identiques sur Web, Android, iOS et serveur.
9. Perte réseau avant/après commit : reprise idempotente, sans seconde racine ni session.
10. Restauration d'un snapshot antérieur : aucune session, aucun certificat et aucun appareil révoqué ne redevient actif.
11. Changement d'IP/réseau seul : pas de blocage arbitraire.
12. Tous les scénarios de perte d'appareil, SIM swap, e-mail compromis et récupération sans appareil fiable.
13. Aucun OTP, jeton brut, clé privée, secret de récupération, transcript sensible ou GPS dans les journaux.
14. Les fonctions GPS restent NO-GO tant que les garanties J+30 ne sont pas démontrées.

## 10. État de préparation

| Domaine | État | Peut-on implémenter ? |
|---|---|---|
| Règles compte/e-mail/mot de passe | Décisions produit validées | Après fermeture des contrats techniques et autorisation |
| Sessions 30 jours inactivité / 90 jours maximum | Durées validées | Pas avant transport, renouvellement et tests |
| Révocation appareil | Exigence produit établie | Pas avant protocole transactionnel D1 et API autorisés |
| Enrôlement secondaire | Contrat cryptographique contradictoire/incomplet | Non |
| Récupération d'accès | Facteurs et procédure incomplets | Non |
| Récupération de racine | Interdite en V1 | Non |
| SOS non-GPS pendant récupération | Contradiction et mécanisme non résolus | Non |
| GPS | GO technique non obtenu | Non |

## 11. Arbitrages restants prioritaires

1. Choisir les facteurs de récupération d'accès et leur indépendance.
2. Définir le comportement si tous les facteurs sont perdus.
3. Décider si un secondaire peut initier certaines demandes de compte, et lesquelles.
4. Définir le mécanisme opérationnel de révocation urgente d'un téléphone racine perdu/volé.
5. Choisir refresh token ou sessions sans renouvellement silencieux.
6. Arbitrer le format canonique, les signatures, nonces, SAS et le transcript de cérémonie.
7. Décider du comportement du SOS non-GPS pendant récupération.
8. Pour une version ultérieure seulement, définir la vérification des nouvelles empreintes et le traitement des contacts injoignables.

## 12. Limites

Cette consolidation est documentaire. Elle ne modifie ni code ni tests, ne crée aucune API, migration D1, ressource Cloudflare, fournisseur, notification ou déploiement. Elle ne valide aucune récupération de racine et ne lève aucun verrou GPS.

**Conclusion :** le socle de principes est cohérent, mais l'enrôlement multi-appareils, la récupération d'accès et les sessions ne sont pas prêts pour la production. La récupération de racine reste explicitement hors V1.

## Sécurité des connexions et sessions

La politique de défense contre les tentatives frauduleuses, le vol/rejeu de session, les connexions simultanées, la révocation et les notifications est détaillée dans `PROPOSITION_SECURITE_CONNEXIONS_ET_SESSIONS.md`. Les recommandations y restent à arbitrer ; elles ne changent pas les décisions validées sur les durées 30/90 jours ni le verrou de racine V1.
