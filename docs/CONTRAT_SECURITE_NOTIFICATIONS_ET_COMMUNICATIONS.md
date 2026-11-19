# SAC — Contrat de sécurité des notifications et communications

**Date :** 18 novembre 2026  
**Statut :** consolidation documentaire. Les invariants déjà validés sont séparés des mécanismes proposés à arbitrage.  
**Portée :** push, e-mail, SMS de secours, abonnements d'appareils, fournisseurs, contenu, livraison, erreurs et révocation.  
**Limite :** aucun fournisseur, secret, endpoint, abonnement, stockage ou canal n'est activé par ce document.

## 1. Références et priorité

À lire avec :
- `CONTRAT_SECURITE_CYCLE_SOS_ET_INTEGRITE_ALERTES.md` ;
- `CONTRAT_CYCLE_VIE_PROCHES_ET_INVITATIONS.md` ;
- `CONTRAT_PROTECTION_DONNEES_ACCES_INTERNES_ET_AUDIT.md` ;
- `PROPOSITION_POLITIQUE_GENERALE_CONSERVATION_DONNEES.md` ;
- `PROPOSITION_SECURITE_CONNEXIONS_ET_SESSIONS.md` ;
- `CONTRATS_OPERATIONS_D1.md` ;
- `MACHINES_ETATS_ET_CONSERVATION.md`.

Les contrats spécialisés et décisions produit approuvées prévalent. Une proposition répétée ici n'est pas une approbation.

## 2. Invariants validés

1. Toute inscription SAC exige un e-mail et un téléphone avec indicatif international.
2. L'e-mail doit être vérifié par OTP e-mail avant activation du compte. Le téléphone est obligatoire mais reste déclaré/non vérifié.
3. Aucun SMS OTP ne remplace l'OTP e-mail, n'active un compte, ne restaure la racine cryptographique ou n'approuve un appareil secondaire.
4. Un proche actif possède un compte SAC actif et a explicitement accepté l'invitation.
5. Les destinataires d'une alerte sont sélectionnés et figés atomiquement au déclenchement ; aucun tiers ne peut s'ajouter ensuite.
6. Le push initial et les rappels sont distincts. Le lanceur choisit le nombre de rappels push (1 à 5), espacés de cinq minutes, avec deux par défaut selon la décision déjà consignée.
7. Les rappels vers les destinataires initiaux continuent toutes les cinq minutes jusqu'à clôture par l'auteur, y compris après prise en charge.
8. Le SMS de secours est une escalade distincte, non réputée opérationnelle tant que fournisseur, routage et essais réels ne sont pas validés.
9. L'acceptation d'un message par un fournisseur ne prouve ni sa livraison au terminal ni sa lecture humaine.
10. Seul l'auteur clôture l'alerte. Les échecs de communication ne clôturent, n'annulent ni ne modifient l'état métier.
11. Le GPS précis est NO-GO tant que la suppression immédiate à la clôture et la purge J+30 sans résurrection ne sont pas démontrées.
12. Les durées générales proposées pour les métadonnées et journaux restent non approuvées.

## 3. Classification des communications

| Niveau | Contenu | Règle |
|---|---|---|
| C0 | Santé technique publique, disponibilité générale | Aucune identité ni donnée d'alerte |
| C1 | Messages génériques d'information | Pas de détail privé |
| C2 | E-mail/téléphone, état de compte, appareil | Masquage et accès limités |
| C3 | Existence d'une alerte, catégorie, destinataires, prise en charge | Réservé aux acteurs autorisés et au canal nécessaire |
| C4 | OTP, jetons, secrets, clés privées, GPS précis | Jamais dans les messages ordinaires, logs ou consoles |

Les notifications externes sont considérées comme potentiellement visibles par des tiers : écran verrouillé, montre, historique opérateur, boîte e-mail partagée, sauvegarde de messagerie, aperçu système ou appareil prêté.

## 4. Contenu minimal et prévention des fuites

Règle par défaut : le message externe révèle le minimum nécessaire pour inciter le destinataire à ouvrir SAC. Il ne contient pas :
- coordonnées GPS, adresse ou itinéraire ;
- description libre, détail médical ou pièce jointe ;
- liste des autres destinataires ;
- code OTP, jeton d'accès, secret de récupération ou lien permanent ;
- détails de responsabilité ou de conversation qui ne sont pas nécessaires à l'alerte.

Le contenu visible doit rester neutre lorsque le canal ou l'appareil peut être partagé. Le texte exact des push, e-mails et SMS est à arbitrer avec des tests d'aperçu sur Android, iOS, montres et clients e-mail courants.

Ne jamais placer des données C3 dans les paramètres d'URL, titres de notification, noms de fichiers, sujets d'e-mail, journaux du fournisseur, outils d'analytique ou rapports d'erreur.

L'ouverture d'une notification ne confère aucun droit : l'API refait l'autorisation depuis la session et l'état actuels. Les liens d'ouverture, s'ils existent, ne doivent transporter aucun secret d'accès réutilisable. Un lien universel ne doit jamais remplacer l'authentification SAC.

## 5. Abonnements Push et appareils

Un abonnement push est une capacité de livraison vers un terminal, pas une preuve d'identité, de confiance ou de présence humaine.

Exigences cibles :
- créer l'abonnement uniquement depuis une session SAC authentifiée et un appareil enrôlé ;
- associer l'abonnement à un compte et à un appareil précis côté serveur ;
- ne jamais accepter un compte ou appareil cible déclaré librement par le client ;
- traiter l'endpoint et les clés de souscription comme des secrets opérationnels ;
- ne jamais les exposer dans une console, URL publique, export, analytics ou logs ;
- chiffrer les données sensibles au repos selon une architecture validée et restreindre les accès techniques ;
- renouveler/remplacer un abonnement sans créer de doublons actifs ;
- supprimer ou désactiver l'abonnement lors de la révocation de l'appareil, de la déconnexion définitive, de la suppression du compte ou d'un retour fournisseur indiquant un abonnement invalide ;
- contrôler à chaque envoi que compte, appareil, abonnement, alerte et destinataire restent éligibles ;
- ne jamais déduire qu'un terminal est actif ou que son propriétaire a lu le message d'un abonnement valide.

Avant toute livraison, le Worker devra aussi appliquer une politique anti-SSRF stricte aux endpoints enregistrés : HTTPS, destinations de fournisseurs Web Push explicitement autorisées, aucune adresse privée/locale, et aucun redirect non validé. Le stockage actuel n'effectue aucun appel réseau vers l'endpoint.

Les réponses 404/410 et autres erreurs fournisseur doivent être classées sans exposer l'endpoint. Les erreurs transitoires peuvent être réessayées avec une stratégie bornée et une déduplication ; les erreurs permanentes désactivent l'abonnement après vérification.

**État d'implémentation — première tranche sur main :** la migration `0008_push_subscriptions.sql` et `POST /api/push/subscriptions` existent. L'API exige une session d'appareil active et same-origin, lie chaque enregistrement au compte/appareil issus de la session, chiffre l'endpoint et les clés par AES-256-GCM avec une clé dérivée HKDF, et ne renvoie jamais l'endpoint. L'empreinte HMAC sert à l'unicité. La révocation de l'appareil supprime les enregistrements via trigger D1. L'action `remove` supprime les abonnements du seul appareil courant. Une seule souscription active est autorisée par appareil enrôlé ; son remplacement est réalisé dans un batch D1 atomique.

Le secret Cloudflare `PUSH_SUBSCRIPTION_ENCRYPTION_KEY` (32 octets base64url) n'est pas configuré. L'API échoue donc fermé tant qu'il manque. La migration n'est pas appliquée à une base distante et le client PWA n'appelle pas encore cette API. Aucun fournisseur VAPID ni worker de livraison n'est connecté. Cette implémentation ne signifie pas que les notifications push fonctionnent.

**À arbitrer :** nombre maximal d'abonnements par appareil, renouvellement, rotation des clés au-delà de la version v1, délais de retry, durée de conservation et comportement multi-appareils. Aucun seuil numérique n'est fixé ici.

## 6. E-mail : vérification, invitations et communications

L'e-mail vérifié est le canal obligatoire de preuve initiale d'adresse et de certaines opérations sensibles selon les décisions déjà validées.

Exigences :
- séparer strictement les modèles d'e-mail : OTP, invitation, sécurité du compte, notification d'alerte et support ;
- OTP à usage unique, durée bornée, invalidation après succès ou remplacement, limitation des tentatives et anti-rejeu ;
- ne jamais écrire le code OTP, son secret de vérification ou un lien de vérification réutilisable dans les logs ;
- ne jamais inclure mot de passe, clé privée, racine cryptographique ou GPS dans un e-mail ;
- les liens d'invitation sont opaques, à usage unique, liés à l'invitation et à l'adresse destinataire, stockés sous forme non réutilisable côté serveur ; l'acceptation nécessite une session SAC active et une confirmation explicite ;
- une adresse destinataire d'invitation doit correspondre à l'e-mail vérifié du compte qui accepte, selon le contrat des invitations ;
- un e-mail de notification ne prouve pas que son destinataire est le titulaire actuel de la boîte ou qu'il l'a lu ;
- éviter les champs CC/BCC révélant les autres proches ; envoi individuel ;
- SPF, DKIM et DMARC, alignement du domaine, gestion des rebonds et plaintes, surveillance de réputation et séparation des domaines transactionnels à définir avant choix fournisseur.

Les messages de sécurité doivent éviter de révéler si une adresse est inscrite à SAC. Les réponses d'inscription, de récupération et de réinitialisation ne doivent pas permettre l'énumération de comptes.

**À arbitrer :** fournisseur, région de traitement, sous-traitants, domaine, politique de rebonds, modèles et conservation des preuves de consentement/livraison. Aucun fournisseur n'est sélectionné.

## 7. SMS de secours — frontière de confiance

Le SMS de secours est différent de l'OTP e-mail et ne doit jamais devenir un moyen de connexion ou d'approbation de compte.

Point de vigilance : le numéro de téléphone SAC est obligatoire mais déclaré/non vérifié. Il ne faut donc pas supposer qu'un numéro est exact, actuel ou contrôlé simplement parce qu'il est enregistré.

Avant d'utiliser le SMS comme canal de secours vers un destinataire, il faut arbitrer une preuve de contrôle du numéro adaptée, sans transformer cette preuve en OTP de compte ni modifier l'exigence d'activation par e-mail. Tant que ce point n'est pas réglé, le système ne doit pas présenter le SMS à ce numéro comme une livraison fiable.

Le SMS éventuel :
- contient uniquement un texte minimal, sans GPS, adresse, catégorie sensible ou détail libre ;
- ne contient pas de code de connexion, OTP d'activation ou lien donnant accès à l'alerte ;
- est envoyé individuellement aux seuls destinataires prévus par la règle d'escalade approuvée ;
- est déclenché par l'état serveur et le seuil de rappels choisi, jamais par une minuterie locale seule ;
- est idempotent, dédupliqué et journalisé avec identifiants techniques minimaux ;
- ne transforme jamais un accusé opérateur en preuve de lecture ;
- tient compte des coûts, limites pays/opérateur, format E.164, filtrage, retard, portabilité et erreurs de routage.

**À arbitrer :** preuve de contrôle du numéro, fournisseurs et opérateurs, pays/routage, contenu, coût, nombre de tentatives, accusés disponibles et comportement si numéro invalide. Aucun fournisseur, tarif ou garantie n'est approuvé.

## 8. Fournisseurs et séparation des responsabilités

Les fournisseurs push, e-mail et SMS sont des transporteurs externes, jamais l'autorité métier de SAC.

Architecture cible :
- interface d'adaptation distincte par canal ;
- modèles de messages versionnés et validés côté serveur ;
- outbox durable comme source de travail ;
- identifiant déterministe de livraison par alerte, destinataire, canal et occurrence ;
- aucune donnée métier sensible dans les métadonnées non nécessaires ;
- secrets fournisseurs conservés dans un gestionnaire de secrets adapté, jamais dans Git, le navigateur, D1 en clair ou les journaux ;
- droits techniques minimaux, clés distinctes par environnement et rotation planifiée ;
- vérification de signature des webhooks entrants quand le fournisseur le permet, fenêtre anti-rejeu, authentification et limitation de débit ;
- aucune URL de callback, identité de destinataire ou statut métier accepté sur la seule base d'un champ fourni par le navigateur ;
- isolation des environnements développement, preview et production ; aucune notification réelle à un proche depuis un environnement de test.

Le choix fournisseur exige une revue de sécurité, disponibilité, localisation et transferts de données, sous-traitance, coûts, réversibilité, support, SLA et conformité applicable au Niger et aux pays destinataires.

## 9. Webhooks, statuts et preuve de livraison

Distinguer obligatoirement :
1. événement créé dans SAC ;
2. tâche mise en file ;
3. tentative effectuée ;
4. acceptation technique du fournisseur ;
5. livraison au terminal/opérateur confirmée si le canal fournit une preuve fiable ;
6. ouverture dans SAC confirmée par une action authentifiée ;
7. lecture humaine, qui ne peut généralement pas être prouvée.

Les webhooks doivent :
- vérifier la signature cryptographique selon le protocole documenté du fournisseur ;
- rejeter horodatages hors fenêtre et identifiants déjà consommés ;
- être idempotents et résistants aux événements dupliqués ou désordonnés ;
- ne jamais permettre à un événement tardif de faire régresser l'état métier ;
- limiter le corps stocké aux champs nécessaires, sans copie brute indéfinie ;
- ne jamais modifier l'état de l'alerte, les destinataires ou la responsabilité principale.

En cas de webhook non signé ou de preuve faible, classer le résultat comme non vérifié ; ne pas l'utiliser pour une décision de sécurité.

## 10. Révocation et changements de compte/appareil

À la révocation d'un appareil, toutes les sessions et tous les abonnements push associés doivent devenir inéligibles aux nouvelles livraisons, sous réserve de la continuité de l'alerte active déjà décidée pour les destinataires initiaux. La révocation d'un appareil ne doit pas effacer ni clôturer une alerte existante.

À la suppression du compte, les abonnements, jetons et liens de livraison doivent être désactivés/révoqués selon le contrat de suppression et la matrice de conservation validée. Les notifications déjà acceptées par un fournisseur peuvent rester en transit : SAC ne peut promettre leur rappel.

À la révocation d'une relation de confiance pendant une alerte, appliquer le contrat d'arbitrage spécifique ; ne pas inventer de nouveaux droits à partir de ce document. La notification initiale et les rappels vers l'instantané initial suivent les décisions validées, mais l'accès au détail après révocation reste à arbitrer.

## 11. Pannes, retards et réseau faible

Une panne push/e-mail/SMS ne doit jamais :
- annuler une alerte créée ;
- empêcher l'auteur de consulter l'état serveur ;
- clôturer automatiquement l'alerte ;
- afficher une livraison ou lecture non confirmée ;
- provoquer une création de doublons lors d'une reprise.

Le worker doit revalider l'éligibilité au moment de chaque envoi, utiliser des baux et une déduplication, classer les erreurs transitoires/permanentes et respecter une stratégie de retry bornée. Les envois doivent être ordonnés selon le cycle métier, sans garantir un ordre d'arrivée externe.

L'interface distingue « alerte créée », « notification en attente », « fournisseur a accepté », « livraison confirmée » et « échec/état inconnu ». Si la création serveur n'est pas confirmée, elle ne dit jamais que les proches sont prévenus.

La PWA ne promet pas l'envoi hors-ligne sans réception serveur. Une file locale ne peut être présentée que comme une commande non transmise, avec reprise idempotente à la reconnexion.

## 12. Journaux, confidentialité et conservation

Les journaux ne doivent jamais contenir :
- OTP, mot de passe, jeton d'accès ou de rafraîchissement brut ;
- clé privée, secret de récupération, clé push ou secret fournisseur ;
- corps complet des messages ;
- coordonnées GPS, adresse ou description libre d'alerte ;
- endpoints push complets ou numéros/e-mails complets si un identifiant pseudonyme suffit.

Préférer identifiants techniques pseudonymisés, empreintes non réversibles adaptées, codes d'erreur et références de corrélation. Ne pas conserver les corps bruts de webhook par défaut.

Les durées de conservation des tentatives, événements fournisseur, rebonds, plaintes, abonnements invalides et preuves de consentement restent celles à arbitrer dans la politique générale ; ce document n'en invente aucune. Les règles GPS/alerte validées restent prioritaires et ne peuvent être contournées par une copie dans les métadonnées de notification.

## 13. Tests obligatoires avant activation

1. Un utilisateur non authentifié ne peut créer, lier ou modifier un abonnement push.
2. Un abonnement ne peut être rattaché au compte d'un autre utilisateur par falsification d'identifiant.
3. Une révocation d'appareil empêche toute nouvelle livraison vers cet abonnement.
4. Un endpoint push et ses clés ne figurent ni dans l'API publique, ni dans les logs, exports ou consoles.
5. Un abonnement dupliqué ne produit pas des envois en double.
6. Un abonnement invalide est désactivé sans affecter l'état de l'alerte.
7. Le contenu des push sur écran verrouillé ne révèle aucun détail C3/C4.
8. Un lien de notification ne donne aucun accès sans authentification et autorisation actuelles.
9. Un OTP expiré, déjà consommé ou rejoué est refusé ; son secret n'apparaît dans aucun log.
10. Une invitation acceptée par un compte dont l'e-mail vérifié diffère de la destination est refusée.
11. Les e-mails sont envoyés individuellement sans exposer la liste des destinataires.
12. Les réponses d'inscription/récupération ne permettent pas l'énumération des comptes.
13. Un numéro déclaré mais non vérifié n'est pas présenté comme un canal SMS fiable.
14. Un SMS ne peut ni activer un compte, ni approuver un appareil, ni restaurer la racine cryptographique.
15. Un SMS de secours ne part qu'après le seuil serveur effectivement configuré et approuvé.
16. Une clé fournisseur absente/invalide ne fait pas apparaître un succès simulé.
17. Un webhook sans signature valide ou rejoué est refusé.
18. Un webhook dupliqué ou désordonné ne fait pas régresser les statuts.
19. Une acceptation fournisseur n'est jamais affichée comme lecture humaine.
20. Une panne fournisseur n'annule pas l'alerte et ne crée pas de doublon à la reprise.
21. La révocation de session/appareil coupe les futures livraisons non déjà acceptées.
22. Les logs ne contiennent aucun secret, GPS, contenu complet ou endpoint exploitable.
23. Les environnements Preview/test ne contactent jamais de vrais proches.
24. Une restauration ne réactive aucun abonnement, jeton ou destinataire révoqué.
25. Les métadonnées de communication ne permettent pas de reconstituer une alerte purgée à J+30.

## 14. Arbitrages requis

- fournisseur e-mail, push et SMS, régions, sous-traitants et contrats ;
- preuve de contrôle du numéro avant SMS de secours ;
- contenu exact et niveau de discrétion des messages ;
- nombre d'appareils, rotation et limites des abonnements push ;
- politique de retry, délais et gestion des résultats ambigus ;
- mécanisme de signature et protection anti-rejeu des webhooks ;
- gestion des rebonds, plaintes et numéros invalides ;
- durées de conservation des métadonnées de transport ;
- comportement après révocation d'un proche pendant une alerte active ;
- politique d'essai sans contacter de vrais proches.

## 15. Conditions d'implémentation

Aucun canal réel ne doit être activé avant :
1. arbitrage explicite des points produit pertinents ;
2. revue juridique et sécurité des fournisseurs et transferts ;
3. contrats de messages et données minimales approuvés ;
4. gestion des secrets et webhooks conçue et revue ;
5. tests de révocation, rejeu, concurrence, panne, restauration et non-fuite réussis ;
6. essais réels contrôlés et autorisés ;
7. autorisation explicite distincte pour code, endpoint, D1, stockage, secrets, fournisseur, ressource Cloudflare ou déploiement.

**Conclusion :** les communications sont des moyens de transport non fiables par nature. SAC reste l'autorité sur l'identité, les droits, le cycle SOS et la vérité des statuts ; aucun fournisseur ni canal ne peut créer ou élargir un droit métier.
