# SAC — Contrat de sécurité des comptes et appareils en situation d'urgence

**Date :** 18 novembre 2026  
**Statut :** consolidation des règles existantes et formalisation des parcours de crise. Les nouveaux mécanismes opérationnels restent des propositions à arbitrer.  
**Portée :** téléphone perdu/volé, appareil compromis, mot de passe oublié, e-mail compromis, SIM swap, changement de téléphone, perte de tous les appareils, récupération du compte et continuité des alertes.  
**Nature :** documentation uniquement. Aucun mécanisme de récupération, verrouillage d'urgence, endpoint, migration, notification ou fournisseur n'est implémenté par ce contrat.

## 1. Documents de référence

Lire avec :
- `CONSOLIDATION_APPAREILS_SESSIONS_ET_RECUPERATION.md` ;
- `PLAN_SOCLE_COMPTE_SESSIONS_APPAREILS.md` ;
- `ARBITRAGES_TECHNIQUES_COMPTES_OTP_SESSIONS.md` ;
- `PROPOSITION_SECURITE_CONNEXIONS_ET_SESSIONS.md` ;
- `PROTOCOLE_MULTI_APPAREILS.md` ;
- `RECUPERATION_COMPTE_ET_RACINE.md` ;
- `AUDIT_RECUPERATION_COMPTE_SANS_APPAREIL_FIABLE.md` ;
- `ARBITRAGE_RECUPERATION_RACINE_ET_ATOMICITE_D1.md` ;
- `CONTRAT_PROPOSE_SUPPRESSION_COMPTE_ET_CAS_PARTICULIERS.md` ;
- `CONTRAT_SECURITE_NOTIFICATIONS_ET_COMMUNICATIONS.md` ;
- `CONTRAT_SECURITE_CYCLE_SOS_ET_INTEGRITE_ALERTES.md` ;
- `CONTRAT_PROTECTION_DONNEES_ACCES_INTERNES_ET_AUDIT.md`.

Les décisions utilisateur explicitement validées prévalent. Les propositions et audits ne deviennent pas des décisions par leur reprise ici.

## 2. Invariants validés — ne pas rouvrir

### 2.1 Identité du compte
1. Le mode de connexion retenu est e-mail + mot de passe.
2. L'adresse e-mail est obligatoire et doit être vérifiée par OTP e-mail avant activation du compte.
3. Le téléphone est obligatoire comme coordonnée déclarée, mais non vérifiée.
4. Aucun SMS OTP n'est autorisé pour l'inscription, l'activation, la connexion ou la récupération du compte ; le SMS de secours SOS est un usage séparé.
5. Le mot de passe comporte au minimum 12 caractères.
6. L'OTP e-mail n'est pas demandé à chaque connexion normale par défaut.
7. L'OTP prouve uniquement le contrôle temporaire de l'adresse e-mail ; il n'approuve aucun appareil secondaire et ne restaure aucune racine cryptographique.

### 2.2 Sessions et appareils
1. Chaque session appartient à un compte et à un appareil précis.
2. Déconnexion après 30 jours consécutifs sans activité.
3. Réauthentification obligatoire au plus tard après 90 jours, même si l'utilisateur est actif.
4. Un appareil secondaire ne s'approuve pas lui-même et ne se promeut jamais appareil racine.
5. La révocation d'un appareil invalide ses sessions et capacités de renouvellement ; les autres appareils du compte restent actifs.
6. Un appareil révoqué ne peut pas renouveler une session depuis un ancien jeton ou une ancienne sauvegarde.
7. Les changements d'adresse IP ou de réseau mobile ne bloquent pas à eux seuls un utilisateur.
8. La révocation serveur ne signifie pas effacement à distance du téléphone : un appareil hors ligne peut conserver des données locales déjà reçues.

### 2.3 Racine cryptographique
1. La récupération du compte ne restaure pas la racine cryptographique.
2. Mot de passe, OTP, e-mail, SMS, support et réinitialisation du mot de passe ne remplacent ni ne recréent une clé privée racine.
3. Les contacts de confiance ne sont ni administrateurs du compte ni récupérateurs de racine.
4. Un appareil secondaire reste secondaire, même si l'appareil racine est perdu, volé ou révoqué.
5. La racine perdue ou compromise n'est pas remplacée en V1. La transition vers une nouvelle racine et le ré-ancrage des contacts restent interdits tant qu'une procédure ultérieure n'a pas été arbitrée, spécifiée et revue indépendamment.
6. Le protocole multi-appareils et le kit de récupération restent non homologués ; aucune implémentation ne peut se fonder sur les prototypes actuels.

## 3. Trois autorités séparées

SAC doit distinguer sans exception :

| Autorité | Ce qu'elle permet | Ce qu'elle ne permet pas |
|---|---|---|
| Accès au compte | Connexion au compte et fonctions ordinaires autorisées par l'état du compte | Approuver une nouvelle clé ou récupérer la racine |
| Appareil approuvé | Utiliser les droits attribués à cet appareil et sa session | Se promouvoir racine ou approuver d'autres appareils s'il est secondaire |
| Racine cryptographique | Prouver l'identité cryptographique et autoriser les cérémonies prévues | Être remplacée par un OTP, un support ou une simple récupération du compte |

La preuve de contrôle de l'e-mail, la preuve du mot de passe, la session active, la possession d'un appareil et la signature racine sont des preuves différentes. Une preuve ne doit jamais être implicitement élevée au niveau d'une autre.

## 4. Matrice des incidents

| Incident | Mesure possible selon les règles existantes | Limite / statut |
|---|---|---|
| Mot de passe oublié, appareil racine disponible | Réinitialisation du mot de passe via procédure e-mail renforcée à définir ; appareil racine inchangé | Facteurs exacts, réauthentification et révocation des sessions à arbitrer |
| Téléphone secondaire perdu, racine disponible | Révoquer l'appareil secondaire et ses sessions depuis un contexte sûr | Parcours UI/API non implémenté |
| Téléphone secondaire volé, potentiellement déverrouillé | Révocation serveur urgente ; les autres appareils restent actifs | Ne peut pas effacer les données locales hors ligne |
| Téléphone racine perdu, secondaire approuvé disponible | Le secondaire conserve uniquement ses droits existants ; bloquer les opérations exigeant la racine | Pas de promotion automatique ; limites précises du secondaire à spécifier |
| Téléphone racine volé/compromis | Mesure de confinement et révocation de la racine à concevoir | Autorité de preuve et procédure d'urgence non arbitrées ; racine non remplaçable en V1 |
| Tous les appareils approuvés perdus | Récupération de l'accès au compte éventuellement distincte, si les facteurs sont définis | Aucun nouvel appareil approuvé ni nouvelle racine en V1 |
| E-mail compromis ou inaccessible | Ne pas considérer la seule possession du téléphone/SIM comme preuve de remplacement | Procédure de changement d'e-mail et de récupération à définir |
| SIM swap / numéro détourné | Ne donne aucun droit de connexion, récupération ou approbation | Le téléphone reste une coordonnée déclarée/non vérifiée |
| Compte potentiellement compromis | Confinement, révocation de sessions et analyse des événements selon procédure à définir | Aucun verrouillage global ou notification ne doit être simulé |
| Ancienne sauvegarde restaurée | L'état serveur courant prévaut ; les révocations restent effectives | Une restauration ne réactive ni session, ni appareil, ni certificat révoqué |

## 5. Parcours de crise — règles de conception

### 5.1 Téléphone secondaire perdu ou volé

Parcours cible lorsque l'appareil racine sûr est encore disponible :
1. Le titulaire ouvre la gestion des appareils depuis un appareil de confiance.
2. Il identifie le terminal concerné avec des informations non sensibles : libellé, plateforme, dernière activité connue et date d'enrôlement.
3. Il confirme explicitement la révocation.
4. Le serveur effectue atomiquement la révocation de l'appareil, de ses sessions, renouvellements, certificats et abonnements push associés.
5. Toute requête ultérieure de l'appareil révoqué est refusée ; les autres appareils restent actifs.
6. Le titulaire reçoit une notification de sécurité sur les canaux déjà vérifiés, sans révéler de secret ni de détail sensible.

La notification n'est pas une preuve de révocation. Le succès ne peut être affiché qu'après confirmation serveur.

### 5.2 Téléphone racine perdu ou volé

Le cas est plus grave : l'appareil racine porte l'autorité cryptographique du compte.

- Si un appareil secondaire approuvé existe, il reste secondaire ; il ne peut pas remplacer la racine.
- Si la racine est seulement perdue, l'accès au compte et les fonctions dépendant de la racine doivent être traités séparément.
- Si la racine est possiblement compromise, une procédure de confinement d'urgence doit être conçue pour empêcher de nouvelles opérations signées par cette racine après le commit serveur de révocation.
- Le serveur ne peut pas effacer les clés ni les données déjà présentes sur un terminal volé et hors ligne.
- Aucun nouveau certificat racine, ré-ancrage des proches ou partage GPS ne doit être créé sur simple OTP ou réinitialisation de mot de passe.

**Point bloquant :** l'autorité de preuve, le mécanisme d'urgence et la concurrence entre révocation racine et opérations déjà engagées ne sont pas encore définis. Ne pas inventer une procédure opérante.

### 5.3 Tous les appareils approuvés perdus

Le titulaire peut éventuellement retrouver une capacité de connexion au compte après une procédure de récupération approuvée. Cela ne signifie pas qu'il retrouve l'identité cryptographique.

En V1, si aucune racine valide ne subsiste :
- aucun nouvel appareil ne peut être approuvé ;
- aucune nouvelle racine ne peut être créée ;
- les fonctions qui exigent une signature racine restent bloquées ;
- les proches ne peuvent pas voter, approuver, déléguer ou reconstruire la racine ;
- le support et le Super Admin ne peuvent pas contourner cette règle.

Le parcours exact de récupération du compte sans appareil fiable reste bloquant et doit être défini sans promettre la restauration des fonctions cryptographiques.

### 5.4 E-mail compromis ou perdu

- Un OTP envoyé à une boîte compromise ne constitue plus une preuve suffisante de contrôle par le titulaire légitime.
- Le téléphone déclaré, même s'il reçoit un SMS, ne remplace pas l'e-mail vérifié.
- Le support ne change pas l'adresse sur simple demande ou présentation d'informations faciles à deviner.
- Le changement d'adresse doit être conçu comme une opération sensible, avec réauthentification et preuve indépendante suffisante ; les facteurs et délais sont à arbitrer.
- Toute modification confirmée doit révoquer les défis OTP antérieurs et déclencher une notification de sécurité sans exposer de données privées.

### 5.5 Compte compromis sans perte physique du téléphone

La réponse doit distinguer la compromission du mot de passe, d'une session, d'un appareil et de la racine. Une réinitialisation du mot de passe ne suffit pas nécessairement à révoquer toutes les sessions déjà émises.

Proposition à arbitrer :
- offrir une commande « sécuriser mon compte » depuis une session encore fiable ;
- permettre une révocation de toutes les sessions, sauf la session de récupération explicitement retenue ;
- imposer une nouvelle authentification avant de rétablir les opérations sensibles ;
- notifier les canaux déjà vérifiés ;
- conserver un journal minimal des actions et résultats.

Cette commande, ses facteurs d'accès, son éventuel verrouillage temporaire et ses effets sur les appareils ne sont pas approuvés ni implémentés.

## 6. Gestion des sessions et révocations

Toute révocation doit être exécutée côté serveur, atomiquement et de façon idempotente.

Exigences cibles :
- vérifier compte, session, appareil, état et version d'autorisation depuis l'état serveur ;
- incrémenter/actualiser une version de révocation ou mécanisme équivalent pour invalider les capacités antérieures ;
- révoquer toutes les sessions, refresh tokens, certificats et abonnements associés à l'appareil ciblé ;
- refuser les requêtes dont l'autorisation a été révoquée avant leur commit final ;
- traiter les opérations concurrentes : une opération non validée avant le commit de révocation ne doit pas s'achever avec l'ancienne autorité ;
- empêcher une sauvegarde ou un client restauré de réactiver un ancien secret ;
- ne jamais lier exclusivement la session à l'adresse IP, qui peut changer sur les réseaux mobiles ;
- distinguer révocation d'un appareil, déconnexion d'une session, verrouillage de sécurité du compte et suspension administrative.

La révocation ne clôture pas les alertes, ne supprime pas les proches et n'efface pas l'historique métier.

## 7. Continuité des alertes SOS pendant une crise de compte

Les règles SOS déjà établies restent prioritaires :
- l'instantané initial des destinataires reste figé ;
- les rappels initiaux continuent toutes les cinq minutes jusqu'à la clôture explicite par l'auteur ;
- seul l'auteur clôture l'alerte selon le cycle validé ;
- une révocation d'appareil ou une récupération du compte ne doit pas clôturer automatiquement une alerte ;
- une perte de téléphone ne donne pas aux proches un droit de clôture ou d'administration du compte ;
- les règles particulières de suspension et de clôture exceptionnelle restent celles du contrat de suppression et du cycle SOS, sans extension implicite.

**Question bloquante :** si l'auteur perd tous ses appareils pendant une alerte active et ne peut plus revenir, le mécanisme de clôture de secours doit être spécifié séparément. Aucun proche, support ou Super Admin ne reçoit ce pouvoir par le présent document.

## 8. Appareil de remplacement et cérémonie multi-appareils

Un téléphone neuf n'est pas approuvé parce que :
- le titulaire connaît son mot de passe ;
- il reçoit un OTP e-mail ;
- il contrôle le numéro de téléphone déclaré ;
- il a récupéré l'accès applicatif au compte ;
- il présente une ancienne sauvegarde locale.

Tant qu'une racine valide reste disponible, le nouvel appareil doit suivre une cérémonie d'approbation cryptographique homologuée, avec :
- défi serveur frais et à usage unique ;
- preuve de possession des clés du nouvel appareil ;
- approbation signée par la racine existante ;
- transcript canonique liant compte, appareil, clés, nonces, défi, cérémonie, version et expiration ;
- consommation atomique du défi ;
- anti-rejeu, anti-course et révocation concurrente ;
- vérification indépendante des clés et de la signature ;
- revue cryptographique indépendante et tests adversariaux.

Le protocole actuel reste expérimental : format canonique, signatures, transcript et interopérabilité doivent être finalisés. Aucun endpoint d'approbation ne doit être créé avant homologation.

## 9. Notifications de sécurité

Les messages liés à une perte, un nouvel appareil, une connexion inhabituelle, une révocation ou un changement d'identité doivent :
- être envoyés uniquement vers les canaux déjà vérifiés et autorisés ;
- ne contenir aucun OTP, jeton, secret, clé privée, GPS ou détail SOS ;
- ne pas révéler l'existence d'un compte dans les réponses publiques ;
- ne jamais être considérés comme preuve d'identité ou d'exécution d'une révocation ;
- distinguer demande reçue, action confirmée par le serveur et notification acceptée/livrée ;
- ne pas permettre à un lien e-mail d'approuver un appareil ou de remplacer la racine.

Le téléphone étant déclaré/non vérifié, aucune notification SMS ne doit être considérée comme preuve de contrôle du compte.

## 10. Support et gouvernance

Le support peut expliquer les procédures et aider à comprendre les états. Il ne peut pas :
- changer l'adresse e-mail sans procédure de preuve approuvée ;
- réinitialiser ou remplacer une racine cryptographique ;
- approuver un nouvel appareil à la place de la racine ;
- rétablir un appareil révoqué depuis une sauvegarde ;
- ajouter un proche ou modifier les destinataires d'une alerte ;
- clôturer une alerte au nom du titulaire hors exception déjà formellement prévue ;
- contourner une suspension ou une règle de sécurité.

Le Super Admin ne peut pas être un mécanisme de récupération cryptographique universel. Toute intervention administrative doit rester limitée à une permission explicite, traçable, et ne pas permettre de prendre possession de l'identité cryptographique d'un utilisateur.

## 11. Tests obligatoires avant activation

1. Un OTP e-mail valide ne peut pas approuver un appareil secondaire.
2. Un SMS ou un SIM swap ne permet ni connexion, ni récupération, ni approbation.
3. La réinitialisation du mot de passe ne modifie pas la racine.
4. Un secondaire ne peut pas se promouvoir racine, même après perte du téléphone racine.
5. La révocation d'un secondaire invalide toutes ses sessions et abonnements, mais pas les autres appareils.
6. Un appareil révoqué ne peut pas renouveler une session avec un ancien jeton.
7. Une sauvegarde locale restaurée ne réactive pas un appareil ou certificat révoqué.
8. Une révocation concurrente avec une mutation produit un résultat atomique et déterministe.
9. Une révocation de racine bloque toute nouvelle signature acceptée après le commit serveur.
10. Une opération signée avant la révocation et encore en transit suit une règle de course explicite et testée.
11. La perte de tous les appareils ne crée aucune racine de remplacement en V1.
12. Le support ne peut pas approuver un appareil ou restaurer une racine.
13. Un e-mail compromis ne suffit pas à modifier l'identité ou approuver un appareil.
14. Une notification de sécurité ne contient aucun secret ni détail privé.
15. Une panne de notification n'annule pas la révocation.
16. Une panne réseau ne fait pas croire que le téléphone volé a été effacé.
17. Les changements IP/réseau ne bloquent pas seuls une session valide.
18. Une récupération de compte n'altère pas les relations de confiance ou l'instantané d'une alerte active.
19. Une récupération ou révocation ne clôture pas automatiquement un SOS.
20. Une restauration de base ou de sauvegarde ne réactive ni session, ni appareil, ni racine révoquée.
21. Les journaux ne contiennent aucun OTP, mot de passe, jeton brut, clé privée, secret de récupération ou GPS.
22. Les parcours web PWA et futurs parcours Capacitor sont testés séparément.

Tout échec critique maintient le NO-GO pour l'activation concernée.

## 12. Arbitrages restant ouverts

- procédure exacte de réinitialisation du mot de passe et facteurs renforcés ;
- récupération du compte sans appareil fiable, sans restauration de racine ;
- commande de sécurisation d'urgence et révocation de toutes les sessions ;
- autorité de preuve pour révocation urgente d'une racine volée/compromise ;
- traitement des opérations cryptographiques déjà engagées lors d'une révocation ;
- notification des événements de sécurité et canaux réellement vérifiés ;
- changement d'adresse e-mail en cas de compromission ;
- capacité éventuelle d'un appareil secondaire en mode dégradé ;
- clôture d'une alerte active si l'auteur a perdu tous ses appareils ;
- kit de récupération et cérémonie de nouvelle racine pour une version ultérieure ;
- limites du support et procédure d'escalade en cas de contestation d'identité.

Aucune valeur chiffrée, aucun facteur de récupération, aucun rôle de support et aucune procédure de remplacement de racine ne sont approuvés ici.

## 13. Conditions avant implémentation

Aucun parcours réel de récupération, de verrouillage d'urgence ou d'enrôlement de remplacement ne doit être activé avant :
1. arbitrage explicite des points bloquants ;
2. cohérence des contrats de compte, sessions, suppression, SOS et appareils ;
3. revue cryptographique indépendante du protocole multi-appareils et du kit de récupération ;
4. modèle transactionnel D1 et tests de concurrence/restauration ;
5. parcours distincts PWA et Capacitor documentés ;
6. tests adversariaux et revue de confidentialité ;
7. autorisation explicite distincte pour code, migration D1, route, secret, fournisseur, ressource Cloudflare ou déploiement.

**Conclusion :** SAC peut distinguer la récupération de l'accès applicatif et la récupération de l'identité cryptographique. En V1, retrouver l'accès au compte ne recrée jamais une racine perdue. Cette limite est volontaire : elle protège les proches et le titulaire contre une prise de contrôle frauduleuse.
