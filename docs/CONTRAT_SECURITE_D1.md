# SAC — Contrat de sécurité des opérations D1

**Statut :** conception technique documentée, non implémentée.  
**Périmètre :** sessions par appareil, autorisations serveur, révocations et opérations concurrentes.  
**Interdiction :** ce document n'autorise ni migration D1, ni endpoint de production, ni connexion au GPS réel.

## 1. Références et garanties vérifiées

Le projet utilise Cloudflare Pages Functions avec un binding D1 nommé `DB`. Les opérations applicatives doivent utiliser l'API Binding D1 depuis Pages Functions, pas l'API REST Cloudflare pour les mutations sensibles.

La documentation Cloudflare de `D1Database.batch()` établit que :
- les instructions préparées fournies au batch sont exécutées séquentiellement et non concurremment ;
- le batch constitue une transaction SQL ;
- si une instruction échoue, la séquence entière est annulée et les écritures du batch sont restaurées.

Références officielles :
- [D1 Database API — batch et sessions](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [D1 Prepared Statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)
- [D1 Read Replication et Sessions API](https://developers.cloudflare.com/d1/best-practices/read-replication/)
- [D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)

**Limite essentielle :** une instruction SQL qui ne modifie aucune ligne n'est pas nécessairement une erreur SQL. Le batch peut donc se terminer normalement alors qu'une condition métier n'a pas été satisfaite. Il ne faut jamais supposer qu'un `UPDATE ... WHERE ...` ayant modifié zéro ligne provoque le rollback des autres instructions.

Le batch ne permet pas au code TypeScript de lire le résultat de sa première instruction pour décider ensuite, au milieu de la même transaction, s'il doit construire la deuxième. Les conditions de sécurité doivent donc être exprimées dans les instructions SQL elles-mêmes, ou dans une seule instruction lorsque c'est possible.

Les appels D1 séparés hors d'un même batch ne doivent jamais être présentés comme une transaction commune. La garantie documentée du batch ne doit pas être extrapolée à une succession de requêtes indépendantes.

## 2. Séparation des identités

Trois notions restent distinctes :

1. **Compte SAC** : identité applicative de l'utilisateur.
2. **Appareil** : terminal enregistré, avec son état et son compteur monotone `auth_version`.
3. **Session applicative** : autorisation temporaire liée à un seul compte et à un seul appareil.

Les sessions applicatives SAC ne sont pas les « D1 Sessions » de Cloudflare. Ces dernières sont un mécanisme de cohérence de lecture/réplication, pas un système d'authentification.

Le contrat pur existant dans `src/domain/session-authorization.ts` est un évaluateur de règles. Il ne prouve pas qu'une session provient d'un jeton présenté par le client, ni que les valeurs reçues sont les valeurs courantes de D1. Le serveur doit établir ces faits.

## 3. Lecture d'autorisation pour chaque requête protégée

À chaque requête protégée, le serveur doit retrouver la session depuis une preuve de possession valide et vérifier, dans une lecture SQL liée :

- le hash du jeton présenté ;
- l'état actif de la session ;
- sa date d'expiration, comparée à l'heure serveur ;
- le compte attendu et son état courant strictement `active` ;
- l'appareil lié à cette session ;
- l'état actif actuel de cet appareil ;
- l'égalité entre `session.auth_version` et `user_devices.auth_version`.

La lecture doit joindre les enregistrements de session et d'appareil par leurs clés relationnelles et ne doit pas accepter un `accountId`, un `deviceId`, un état ou une version fournis par le navigateur comme autorité.

Aucun cache positif d'autorisation n'est permis à ce stade. Une réponse d'autorisation ancienne ne doit pas survivre à une révocation. Pour les opérations sensibles, la condition d'autorisation doit aussi être réévaluée dans l'instruction d'écriture finale afin de fermer la fenêtre entre lecture et mutation.

Les identifiants de session, compte et appareil doivent être non ambigus et validés. Les requêtes utilisent exclusivement `prepare(...).bind(...)` pour les valeurs externes ; aucune valeur utilisateur ne doit être concaténée au SQL.

## 4. Écritures sensibles et concurrence

Pour une mutation protégée, la condition SQL finale doit vérifier à nouveau l'existence d'une session active non expirée et de l'appareil actif correspondant, avec la bonne version d'autorisation. La vérification ne doit pas se limiter à une lecture TypeScript faite avant l'écriture.

Quand plusieurs tables doivent être modifiées ensemble :
- regrouper les instructions dépendantes dans un seul `DB.batch([...])` ;
- répéter les prédicats d'autorisation nécessaires dans chaque instruction qui pourrait écrire ;
- utiliser des contraintes uniques et des changements d'état conditionnels pour les opérations à usage unique ;
- contrôler les métadonnées de résultat et les lignes affectées avant de répondre au client ;
- ne jamais annoncer une réussite métier uniquement parce que la promesse du batch s'est résolue.

Un batch peut être atomique tout en étant logiquement incorrect si une instruction secondaire écrit malgré l'échec métier d'une première condition. Les tests doivent donc vérifier les effets réels en base, pas seulement l'absence d'exception.

Pour une opération pouvant être représentée par une seule instruction SQL conditionnelle, préférer cette forme. Pour une opération multi-table, la conception doit prouver que chaque instruction est correctement gardée et que l'échec d'une précondition ne laisse aucun effet partiel.

## 5. Révocation d'un appareil

La règle produit est qu'un appareil peut être révoqué indépendamment des autres appareils du compte.

La conception serveur doit traiter ensemble, dans une opération atomique contrôlée :
- le passage de l'appareil ciblé à l'état révoqué ;
- l'incrément monotone de son `auth_version` ;
- l'invalidation de toutes ses sessions ;
- la révocation de ses abonnements push ;
- l'annulation ou l'invalidation de ses enrôlements en attente ;
- le blocage de nouveaux partages GPS initiés par cet appareil ;
- le traitement explicite des partages en cours selon la règle produit ;
- l'événement d'audit sans jeton, secret ni coordonnée GPS.

La session de l'acteur qui demande la révocation doit être authentifiée indépendamment de l'appareil ciblé. Le serveur ne doit jamais faire confiance à `actorDeviceId`, `rootDeviceId`, `targetDeviceId` ou `authVersion` fournis seuls dans le corps HTTP : ils doivent être établis à partir de la session authentifiée et de l'état courant D1.

**Cas à traiter explicitement :** si l'appareil révoqué est aussi celui qui effectue la demande, l'invalidation de sa session ne doit pas interrompre au milieu du processus les écritures nécessaires à la révocation. La transaction doit d'abord prouver l'autorisation de l'acteur, puis garantir toutes les conséquences de la révocation sans dépendre d'une session que la première instruction vient de rendre invalide. Ce cas n'est pas encore implémenté.

La révocation serveur bloque les futures requêtes après prise en compte par D1 ; elle ne supprime pas à distance les données locales ni les clés d'un appareil hors ligne.

## 6. Opérations à usage unique et anti-rejeu

Pour un défi d'enrôlement, un OTP ou une autre valeur à usage unique :
- le défi est lié au compte, aux appareils concernés, à son contexte et à son expiration ;
- sa consommation est protégée par une contrainte unique ou une transition conditionnelle ;
- la consommation et la création de l'effet métier sont réunies dans une même transaction D1 ;
- une requête concurrente utilisant le même défi ne doit produire qu'un seul effet ;
- un rejeu, une expiration ou un contexte différent est refusé.

Le résultat doit être vérifié après le batch. Les tests doivent lancer plusieurs demandes concurrentes avec le même défi et démontrer qu'une seule est acceptée, sans doublon dans les tables métier ni dans l'audit.

## 7. Jetons, secrets et journalisation

Le jeton de session doit être imprévisible et généré avec un générateur cryptographiquement sûr. Seul son hash adapté à la vérification doit être persisté ; le jeton brut ne doit jamais être stocké dans D1, les logs, les traces, les messages d'erreur ou les événements d'audit.

Le mode de transport du jeton (cookie sécurisé ou autre mécanisme) reste à décider après analyse CSRF, XSS, PWA et Capacitor. Aucun transport n'est implicitement validé par ce document.

Les logs peuvent contenir un identifiant de corrélation opaque, le type d'événement, le résultat et l'horodatage. Ils ne doivent contenir ni jeton, OTP, clé privée, secret de cérémonie, payload GPS ou coordonnée précise.

## 8. GPS : séparation stricte

Ce contrat D1 ne lève aucune interdiction relative au stockage GPS. Tant que la destruction cryptographique irréversible à J+30 n'est pas prouvée contre Time Travel, sauvegardes et restaurations administratives :

- aucune coordonnée GPS précise ne doit être ajoutée à D1 ;
- aucune clé GPS ou clé de déchiffrement ne doit être stockée dans D1 ;
- aucun payload GPS ne doit être écrit dans R2, une file, un journal ou une trace ;
- les prototypes cryptographiques ne doivent pas être connectés aux données GPS réelles.

La réussite des tests d'autorisation D1 ne constitue pas une preuve de destruction GPS.

## 9. Tests d'intégration obligatoires avant migration ou endpoint

Les tests doivent utiliser une base D1 locale de test et, avant activation réelle, une Preview isolée. Ils doivent notamment couvrir :

1. session active valide et liée au bon compte/appareil ;
2. session révoquée, expirée à la seconde exacte ou avec hash incorrect ;
3. appareil pending ou revoked ;
4. `auth_version` incrémentée : toutes les anciennes sessions de cet appareil refusées ;
5. deux appareils du même compte : révocation de l'un sans invalider l'autre ;
6. révocation concurrente avec une mutation protégée : aucun effet accepté après la révocation ;
7. révocation de l'appareil acteur lui-même ;
8. deux consommations concurrentes du même défi : exactement une réussite ;
9. échec d'une instruction au milieu d'un batch : aucune écriture antérieure du batch conservée ;
10. condition métier à zéro ligne : aucune écriture secondaire indue ;
11. rejeu après succès, expiration, compte ou appareil substitué ;
12. absence de jetons, OTP, secrets et GPS dans les logs et événements.

Les tests de concurrence doivent être exécutés sur le runtime D1 de test et non remplacés par des tests unitaires du seul évaluateur TypeScript.

## 10. Conditions de passage à l'implémentation

### 10.1 Tranche limitée compte / OTP e-mail

La migration `migrations/0001_account_email_otp.sql` et les routes `/api/auth/register`, `/api/auth/resend-email` et `/api/auth/verify-email` constituent une première tranche explicitement limitée au compte en attente, aux identités e-mail/téléphone et au défi de vérification e-mail.

Cette tranche ne crée aucune session, aucun appareil, aucun certificat, aucune racine cryptographique, aucun contact de confiance, aucune alerte ni donnée GPS. Ses invariants locaux sont documentés dans `ARBITRAGES_TECHNIQUES_COMPTES_OTP_SESSIONS.md` et testés avec SQLite dans `tests/d1_email_otp_schema.test.py`.

La migration est versionnée mais **n'a pas été appliquée à la base distante**. Les tests SQLite ne remplacent pas encore une validation sur le runtime D1 Cloudflare isolé. L'activation de l'authentification publique reste bloquée tant que le test runtime D1, la configuration des secrets d'envoi et la revue sécurité n'ont pas été réalisés.

### 10.2 Périmètre restant soumis aux conditions préalables

Pour toute extension vers les appareils, certificats, racines, sessions, récupération, autorisations ou mutations métier, les préconditions suivantes restent obligatoires :
- validation du schéma relationnel détaillé et de ses contraintes pour le domaine concerné ;
- validation des contrats de compte, appareil, session et récupération ;
- conception détaillée des opérations atomiques, y compris révocation de soi-même ;
- définition et revue du transport du jeton, CSRF, XSS et comportement PWA ;
- tests d'intégration D1 démontrant les invariants de concurrence et d'autorisation ;
- confirmation que le déploiement Pages Preview est isolé de la base de production.

Aucune migration de ces domaines ne découle de la migration OTP. Le choix du fournisseur Resend est indépendant des fournisseurs push, SMS et paiement, qui restent non sélectionnés.


## Référence complémentaire — restauration et continuité

Lire `CONTRAT_RESILIENCE_CONTINUITE_ET_REPRISE_INCIDENT.md` avant toute conception de sauvegarde, restauration ou reprise D1. Une restauration ne peut réactiver les sessions, appareils, invitations, permissions ou alertes révoqués/clôturés, ni ressusciter des données GPS/alertes purgées. La base restaurée doit rester isolée jusqu'à réconciliation et vérification des invariants. Aucun objectif RTO/RPO ou procédure de restauration n'est approuvé par cette référence.
