# SAC — Proposition de politique de sécurité des connexions et des sessions

**Date :** 18 novembre 2026  
**Statut :** proposition de sécurité à arbitrer. Les règles explicitement déjà validées sont identifiées séparément. Aucune API, migration D1, politique d'authentification complète ou notification n'est implémentée par ce document.

## 1. Objet et documents de référence

Cette proposition complète :
- `CONSOLIDATION_APPAREILS_SESSIONS_ET_RECUPERATION.md` ;
- `AUDIT_CYCLE_VIE_SESSIONS_ET_RENOUVELLEMENT.md` ;
- `PROTOCOLE_MULTI_APPAREILS.md` ;
- `CONTRAT_SECURITE_D1.md` et `CONTRATS_OPERATIONS_ATOMIQUES_D1.md` ;
- les contrats OTP, comptes et cycle de vie.

Elle traite les tentatives frauduleuses, le vol ou rejeu d'un jeton, les connexions multi-appareils, les changements de mot de passe, la révocation et les notifications.

## 2. Règles déjà validées — ne pas rouvrir

- Authentification du compte par e-mail et mot de passe.
- E-mail obligatoire et vérifié par OTP avant activation du compte.
- Téléphone obligatoire comme coordonnée déclarée, mais non vérifiée ; aucun OTP SMS pour le compte.
- Mot de passe minimum de 12 caractères.
- OTP non exigé à chaque connexion normale par défaut ; il ne remplace jamais l'approbation cryptographique d'un appareil.
- Déconnexion après 30 jours consécutifs sans activité.
- Réauthentification obligatoire au plus tard après 90 jours, même avec activité régulière.
- Chaque session appartient à un compte et un appareil précis.
- Révocation d'un appareil : invalidation de ses sessions ; les autres appareils du compte restent actifs.
- Aucune promotion automatique d'un appareil secondaire au rang de racine.
- Une récupération du compte ne restaure pas la clé racine.

Ces règles ne signifient pas que les mécanismes correspondants sont déjà construits.

## 3. Modèle de menace

SAC doit résister notamment à :
1. essais massifs de mots de passe et credential stuffing ;
2. énumération des adresses e-mail inscrites ;
3. vol d'un jeton de session dans le navigateur, le terminal ou les journaux ;
4. rejeu d'un ancien jeton après rotation ou révocation ;
5. restauration d'une sauvegarde locale contenant un ancien jeton ;
6. appareil perdu ou volé encore connecté ;
7. requêtes simultanées de connexion, renouvellement et révocation ;
8. abus des formulaires de connexion, OTP ou récupération pour provoquer un déni de service ;
9. faux messages de sécurité destinés à hameçonner l'utilisateur ;
10. notifications retardées ou livrées après une révocation.

Un changement d'adresse IP, d'opérateur, de réseau mobile ou de localisation approximative n'est pas, isolément, une preuve de compromission.

## 4. Limitation des tentatives de connexion

### Recommandations à valider

Mettre en place une limitation combinée et progressive, sans dépendre d'un seul identifiant :
- par compte normalisé (adresse e-mail) ;
- par adresse IP ou préfixe réseau selon une politique respectueuse des réseaux mobiles partagés ;
- par empreinte technique limitée du client, sans en faire une identité fiable ;
- par fenêtre de temps et par endpoint.

Principes :
- ralentissement progressif après échecs répétés ;
- plafonds d'envoi OTP et de récupération indépendants des tentatives de mot de passe ;
- réponses publiques génériques, qu'un compte existe ou non ;
- ne jamais verrouiller définitivement un compte uniquement sur la base d'échecs provenant d'un tiers ;
- mécanisme de déblocage et de récupération contrôlé par le titulaire ;
- les limites doivent être évaluées côté serveur, atomiquement et à partir de l'état courant ;
- ne pas stocker le mot de passe en clair ni le journaliser.

**À arbitrer :** seuils exacts, fenêtres, délais, règles de réinitialisation, limites par IP/préfixe et éventuel challenge supplémentaire. Aucun chiffre arbitraire n'est fixé ici.

## 5. Politique de connexion et multi-appareils

### Principe recommandé

Autoriser plusieurs appareils déjà approuvés pour un même compte, sans imposer une déconnexion globale à chaque nouvelle connexion. Chaque appareil conserve sa propre session, son certificat et ses droits.

Une connexion depuis un appareil non approuvé ne doit pas devenir une session active simplement parce que le mot de passe est correct. Elle doit passer par le protocole d'enrôlement secondaire, qui demeure non homologué et bloqué tant que ses divergences cryptographiques ne sont pas résolues.

### Événements à distinguer

- connexion réussie sur un appareil déjà approuvé ;
- échec de connexion ;
- nouvelle demande d'enrôlement ;
- appareil approuvé puis révoqué ;
- session expirée ;
- changement de mot de passe ;
- récupération d'accès au compte ;
- suspicion de compromission.

Un changement de réseau ou d'adresse IP ne doit pas créer artificiellement un nouvel appareil.

## 6. Défense contre le vol et le rejeu de session

### Exigences minimales

- Jetons opaques, imprévisibles et générés par un générateur cryptographiquement sûr.
- Stockage serveur d'une empreinte/hash adapté, jamais du jeton brut.
- Liaison au compte, à l'appareil, à la session et à la version d'autorisation courante.
- Expiration vérifiée côté serveur à chaque requête protégée.
- État actif de l'appareil et de la session vérifié depuis D1 ; aucune confiance dans un état mémorisé uniquement côté client.
- Rejet d'une session révoquée, expirée, d'un appareil non actif ou d'une version `auth_version` obsolète.
- Aucun jeton dans URL, analytics, logs, rapports d'erreur ou notifications.
- Protection contre XSS, CSRF et extraction locale selon le transport finalement choisi.
- Les réponses d'erreur ne doivent pas révéler de secret ni confirmer l'existence d'un compte.

### Transport non arbitré

Ne pas choisir silencieusement entre cookie sécurisé et autre transport. L'analyse doit couvrir :
- PWA dans les navigateurs mobiles ;
- cookies `HttpOnly`, `Secure`, `SameSite` et protection CSRF si cookies ;
- XSS, CSP et stockage local si jeton accessible au JavaScript ;
- futur client Capacitor et stockage sécurisé natif ;
- renouvellement, rotation et restauration hors ligne.

Le choix du transport est un arbitrage d'architecture à part entière.

## 7. Renouvellement et détection de rejeu

Deux options restent ouvertes :
- sessions limitées sans refresh token ;
- refresh token distinct, opaque, hashé côté serveur, à usage unique et rotatif.

Si un refresh token est retenu, la proposition de sécurité est :
- chaque jeton appartient à une famille liée à une session et un appareil ;
- chaque rotation consomme une seule fois le jeton précédent ;
- deux renouvellements concurrents ne peuvent pas créer deux successeurs valides ;
- réutiliser un jeton déjà consommé déclenche une réponse de sécurité définie ;
- l'invalidation de la famille ne doit pas invalider les sessions d'autres appareils ;
- la perte de réponse après commit doit être idempotente et ne pas créer une seconde branche ;
- après révocation de l'appareil, aucun membre de sa famille ne peut renouveler.

**Point à arbitrer :** une réutilisation détectée doit-elle révoquer toute la famille de l'appareil, seulement la session, ou déclencher une vérification renforcée ? La recommandation est de révoquer au minimum la famille concernée et de demander une réauthentification sur cet appareil, sans pénaliser les autres appareils du compte. Cette recommandation n'est pas validée.

## 8. Changement de mot de passe et récupération d'accès

### Recommandations à valider

- Un changement de mot de passe initié depuis une session authentifiée doit demander une réauthentification récente.
- Une réinitialisation par e-mail doit utiliser un défi à usage unique, à durée limitée, lié à la finalité et consommé atomiquement.
- La réponse publique reste neutre afin d'empêcher l'énumération.
- Envoyer une notification de sécurité à l'adresse e-mail du compte après changement ou réinitialisation.
- Proposer au titulaire de révoquer les autres sessions après changement de mot de passe.
- Recommandation par défaut : après une réinitialisation suite à perte ou suspicion de compromission, révoquer toutes les sessions du compte et exiger une nouvelle connexion sur chaque appareil ; ne jamais approuver un appareil nouveau.
- Après un changement volontaire normal, l'utilisateur pourrait choisir de conserver ou révoquer les autres sessions ; ce choix doit être arbitré.
- Aucun de ces événements ne modifie la racine cryptographique, les certificats d'appareil ou les empreintes de confiance.

Les effets exacts sur les sessions déjà actives ne sont pas encore validés.

## 9. Gestion des sessions par le titulaire

### Fonction proposée dans l'espace privé

Une rubrique « Appareils et sessions » permettrait de voir :
- nom convivial de l'appareil ;
- type de client (navigateur/PWA ou application native) ;
- date de première approbation ;
- dernière activité connue ;
- état : actif, révoqué ou expiré ;
- session courante clairement identifiée.

Les informations de réseau éventuelles doivent rester minimales et ne pas exposer une géolocalisation précise. Ne pas afficher de données GPS.

Actions proposées :
- révoquer un appareil déterminé ;
- révoquer les autres sessions ;
- révoquer toutes les sessions, avec confirmation renforcée ;
- consulter les événements de sécurité récents.

La révocation doit être effective côté serveur au commit, même si l'appareil révoqué est hors ligne. L'interface ne doit jamais prétendre effacer ses données locales.

**À arbitrer :** conservation et affichage des sessions expirées, nommage des appareils, durée d'historique, et confirmation exacte pour la révocation globale.

## 10. Notifications de sécurité

### Événements proposés à notifier

- connexion réussie depuis un appareil déjà approuvé mais jamais utilisé auparavant ;
- changement ou réinitialisation du mot de passe ;
- révocation d'un appareil ;
- changement d'adresse e-mail ;
- récupération d'accès ;
- détection d'un rejeu de jeton ou d'une compromission probable.

Ne pas envoyer une notification pour chaque requête ou chaque changement d'IP.

### Contenu minimal

- événement et date/heure serveur ;
- nom convivial de l'appareil si connu ;
- indication qu'une action est terminée ou qu'une tentative a été refusée ;
- instruction d'ouvrir SAC directement si l'utilisateur ne reconnaît pas l'action.

Ne jamais inclure :
- mot de passe, OTP, jeton, lien de session ou secret ;
- coordonnées GPS ou détails d'une alerte ;
- clé privée, empreinte racine complète ou transcript de cérémonie ;
- adresse IP complète ou localisation précise par défaut.

Les notifications ne sont pas une preuve d'authentification, de livraison ou de lecture. Elles ne doivent jamais contenir un lien permettant de se connecter directement sans authentification.

**À arbitrer :** canal et fournisseur. L'e-mail est cohérent avec le canal de compte existant, mais sa délivrabilité et ses règles d'envoi doivent être évaluées avant décision. Aucun SMS de sécurité n'est ajouté par défaut.

## 11. Réponse à une suspicion de compromission

Parcours proposé :
1. permettre au titulaire, depuis une session encore fiable, de révoquer immédiatement l'appareil concerné ;
2. invalider ses sessions, capacités de renouvellement, certificats et abonnements push selon l'opération atomique finale ;
3. bloquer toute mutation ultérieure fondée sur l'ancienne session ;
4. conserver les autres appareils actifs, sauf décision explicite du titulaire ou preuve de compromission du compte entier ;
5. notifier le titulaire par un canal indépendant déjà vérifié ;
6. demander un changement de mot de passe si la compromission concerne les identifiants ;
7. ne jamais prétendre effacer un appareil hors ligne ;
8. si la racine est compromise, appliquer le verrou racine V1 : pas de remplacement automatique, pas de reprise GPS.

Un utilisateur qui n'a plus aucun appareil fiable ne doit pas être invité à contourner ces règles par un simple OTP ou une intervention du support.

## 12. Journal de sécurité et minimisation

Événements auditables proposés :
- connexion réussie/échouée, sans mot de passe ni jeton ;
- défi OTP créé, refusé, expiré ou consommé, sans code ;
- création, rotation, révocation et expiration de session ;
- approbation ou révocation d'appareil ;
- changement d'identité de compte ;
- action de récupération et résultat ;
- blocage par limite anti-abus.

Chaque événement doit être horodaté serveur, rattaché à un identifiant interne et à l'acteur authentifié si connu. Les journaux ne contiennent jamais de secret, OTP, jeton brut, clé privée, GPS, contenu d'alerte ou corps libre sensible.

La durée de conservation, l'accès aux journaux et la purge doivent suivre la politique générale de conservation après arbitrage ; ce document ne crée aucune nouvelle durée.

## 13. Atomicité et concurrence D1

Les protections doivent résister à :
- deux connexions concurrentes sur le même appareil ;
- deux rotations concurrentes du même refresh token ;
- révocation pendant une requête protégée ;
- révocation pendant un renouvellement ;
- changement de mot de passe et renouvellement simultanés ;
- rejeu après perte de réponse réseau ;
- restauration d'une sauvegarde locale ancienne ;
- reprise d'un appareil hors ligne après révocation.

Un batch D1 résolu ne prouve pas à lui seul que les préconditions métier ont été satisfaites. Les écritures finales doivent dépendre de l'état attendu et prouver l'absence d'effets partiels. Les tests doivent tourner sur D1 isolé avec concurrence réelle.

## 14. Matrice de tests avant activation

1. Réponse identique pour adresse inconnue et mot de passe incorrect.
2. Limites par compte, IP/préfixe et endpoint, avec réseaux mobiles partagés.
3. Les échecs d'un attaquant ne provoquent pas de verrouillage permanent du compte victime.
4. Jeton absent, altéré, expiré, révoqué ou appartenant à un autre appareil : refus.
5. Jeton volé puis révoqué : toute requête postérieure au commit est refusée.
6. Ancienne valeur de refresh token rejouée : aucune session successeur supplémentaire.
7. Deux rotations simultanées : un seul résultat autorisé.
8. Révocation d'un appareil : ses sessions expirent côté serveur, autres appareils inchangés.
9. Changement de mot de passe : effets exactement conformes à la politique validée.
10. Changement d'IP seul : pas de blocage arbitraire.
11. Restauration d'un ancien stockage client : aucun droit restauré.
12. Notification sans secret et sans lien de connexion direct.
13. Notification retardée après révocation : elle n'annule ni ne modifie l'état serveur.
14. Aucune fuite de jeton, OTP, clé, GPS ou détail SOS dans logs et erreurs.
15. Échecs D1 intermédiaires et timeout après commit : rollback complet ou reprise idempotente.
16. Appareil racine perdu/compromis : aucune promotion secondaire et aucune restauration de racine.

## 15. Arbitrages restant à décider

1. Seuils et fenêtres de limitation des tentatives.
2. Challenge adaptatif éventuel après plusieurs échecs.
3. Transport des sessions PWA et du futur client natif.
4. Sessions sans renouvellement ou refresh token rotatif.
5. Réponse exacte à un rejeu de refresh token.
6. Effet d'un changement volontaire de mot de passe sur les autres sessions.
7. Révocation globale accessible au titulaire et niveau de confirmation.
8. Liste des événements notifiés, canal, délai et rétention.
9. Historique affiché dans « Appareils et sessions ».
10. Durée de conservation des journaux de sécurité selon la politique générale.
11. Comportement du SOS sans GPS en cas de suspicion de compromission.

## 16. État de préparation

| Domaine | État |
|---|---|
| E-mail + mot de passe, OTP d'activation | Décision validée ; implémentation non démontrée |
| Durées de session 30/90 jours | Décision validée ; moteur de session complet non démontré |
| Autorisation par appareil et `auth_version` | Contrat de domaine partiel existant |
| Limitation anti-brute-force | Politique à arbitrer et implémenter |
| Transport et renouvellement de session | Non décidés |
| Détection du rejeu | Contrat à compléter |
| Gestion des sessions par le titulaire | Fonction non démontrée |
| Notifications de sécurité | Canal et événements non décidés |
| Réponse à compromission | Politique à arbitrer ; racine V1 verrouillée |

## 17. Garde-fous de réalisation

Ce document ne donne aucune autorisation pour :
- modifier les routes d'authentification ou le code de session ;
- créer des tables, migrations ou données D1 ;
- choisir ou connecter un fournisseur e-mail/SMS ;
- créer des secrets ou ressources Cloudflare ;
- activer des notifications, du renouvellement ou des connexions multi-appareils ;
- modifier la politique GPS ou les clés racines.

**Conclusion :** SAC doit viser une défense par session et appareil, pas une confiance fondée sur le seul mot de passe. Les règles de base sont établies, mais le transport, le renouvellement, les seuils anti-abus, les notifications et les réactions à un rejeu doivent encore être arbitrés avant tout développement.
