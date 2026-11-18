# SAC — Propositions d'arbitrage : SOS programmé et SOS discret

**Date :** 18 novembre 2026  
**Statut :** propositions de conception à arbitrer ; les règles déjà validées sont reprises comme invariants.  
**Périmètre :** programmation d'une alerte future et mécanisme de contrainte discret.  
**Aucune implémentation :** aucun code, endpoint, table D1, migration, notification réelle ou ressource Cloudflare n'est créé par ce document.

## 1. Invariants déjà validés

- Le SOS programmé et le SOS discret sont deux mécanismes distincts ; ils ne doivent pas être confondus dans l'interface, les états ou le modèle de données.
- Une alerte programmée n'est pas encore une alerte SOS déclenchée. Son annulation avant échéance empêche la création de l'alerte.
- Après déclenchement effectif, l'alerte suit le cycle SOS normal : destinataires figés, push initial, rappels push toutes les cinq minutes, seuil d'escalade SMS choisi de 1 à 5 rappels (2 par défaut), SMS seulement si aucun responsable principal n'est attribué, et clôture par l'auteur sauf exception administrative étroite déjà validée.
- Les destinataires ne sont jamais ajoutés automatiquement après création de l'alerte. L'instantané des destinataires est fixé côté serveur au moment de la création effective.
- La position GPS est facultative et ne doit jamais bloquer l'envoi d'une alerte. Le GPS réel reste NO-GO jusqu'à preuve de la suppression immédiate à la clôture et de la non-résurrection.
- L'écran neutre après déclenchement du SOS discret est une décision validée. SAC ne peut toutefois pas garantir qu'un système d'exploitation n'arrêtera jamais l'application.
- Aucun mécanisme discret ne doit promettre une intervention des services publics ou une transmission réussie sans confirmation technique.

## 2. SOS programmé — proposition de cycle

### 2.1 Création et configuration

Proposition : l'utilisateur actif prépare une alerte future en définissant une date et une heure locales, une catégorie, un niveau, les destinataires prévus et les paramètres d'escalade autorisés. L'écran doit présenter un récapitulatif clair avant validation.

Une programmation doit être explicitement confirmée et enregistrée par le serveur. L'application affiche son état réel : enregistrée, modification en cours, annulée, déclenchement en cours, déclenchée ou échec nécessitant une action.

### 2.2 Instantané des destinataires

Deux options sont possibles :

- **Option A — figer à la création :** les destinataires sont enregistrés au moment où l'utilisateur programme l'alerte. Une révocation ou un changement de relation avant l'échéance peut rendre un destinataire inéligible ; le système doit alors appliquer une règle déterministe et prévenir l'auteur avant l'échéance si possible.
- **Option B — revalider à l'échéance :** au moment du déclenchement, le serveur vérifie à nouveau les relations actives, les consentements et l'éligibilité, puis fige l'instantané effectif.

**Recommandation : Option B.** Elle évite d'envoyer une alerte future à une personne qui n'est plus un contact autorisé au moment où elle part. L'utilisateur doit néanmoins voir avant validation que la liste pourra être réévaluée à l'échéance. Aucun destinataire ne peut être ajouté par simple appartenance à un groupe.

### 2.3 Modification et annulation

Proposition : l'auteur peut modifier ou annuler une programmation tant qu'elle n'a pas été déclenchée. Toute modification importante (heure, catégorie, niveau ou destinataires) exige une confirmation explicite et produit une nouvelle version auditée.

Une annulation confirmée avant l'échéance empêche toute création d'alerte. Une requête d'annulation reçue en concurrence avec le déclenchement doit être arbitrée atomiquement côté serveur : un seul résultat gagne, et l'interface affiche le résultat confirmé. Aucun double SOS ne doit être créé.

### 2.4 Échéance, fuseau horaire et changement d'heure

Proposition : stocker l'instant de déclenchement en UTC et conserver le fuseau IANA choisi lors de la programmation, ainsi que l'heure locale saisie. L'interface affiche toujours la date, l'heure et le fuseau. Les heures locales inexistantes ou ambiguës lors d'un changement d'heure doivent être signalées et confirmées par l'utilisateur, plutôt que résolues silencieusement.

Le déclenchement repose sur l'heure serveur, pas sur l'horloge du téléphone. Une application fermée ou un téléphone hors ligne ne doit pas empêcher le serveur de traiter une programmation déjà enregistrée.

### 2.5 Panne, retard et absence de réseau

Proposition : le serveur conserve une échéance durable et un mécanisme de reprise idempotent. Si le service est indisponible à l'heure prévue, il déclenche au plus vite après reprise, sans créer de doublon, et enregistre l'heure prévue, l'heure réelle et le retard.

Si l'appareil est hors ligne au moment de la création ou de la modification, SAC ne doit jamais afficher « programmation enregistrée » sans accusé serveur. Une programmation uniquement locale n'est pas un SOS programmé fiable.

Si le compte est suspendu, en suppression ou si l'auteur perd l'accès avant l'échéance, la règle doit être déterminée avant activation : le système ne doit ni déclencher silencieusement une alerte potentiellement obsolète, ni annuler sans avertissement une protection attendue.

### 2.6 Proposition de notifications de rappel

Proposition : envoyer une confirmation à la création, une notification de rappel avant l'échéance et un résultat après l'échéance. Le délai du rappel et la possibilité de le désactiver restent à arbitrer. Ces notifications ne remplacent jamais l'état serveur.

## 3. SOS discret — proposition de modèle de sécurité

### 3.1 Nature du mécanisme

Le SOS discret doit être une action de contrainte distincte du SOS guidé. L'utilisateur déclenche le mécanisme via un code ou geste convenu à l'avance, puis l'application affiche un écran neutre. Le mécanisme ne doit pas révéler visuellement qu'une alerte a été déclenchée.

Le code discret n'est pas un mot de passe alternatif, ne donne pas accès au compte et ne doit jamais permettre de désactiver les protections de sécurité. Il sert uniquement à demander le déclenchement d'une alerte selon une configuration préalablement validée.

### 3.2 Code de contrainte

Proposition : permettre à l'utilisateur de configurer un code distinct du code de connexion, saisi et confirmé deux fois dans un parcours sécurisé. Le code n'est jamais stocké en clair, ni transmis dans les logs, analytics, notifications ou tickets de support.

Le stockage doit utiliser un vérificateur adapté à un secret humain, avec sel unique et paramètres de coût versionnés. Une limitation atomique des essais, des délais progressifs et une protection contre les essais distribués sont nécessaires. Les seuils et le parcours de remplacement restent à arbitrer.

Le code de contrainte ne doit pas être récupérable par le support ou le Super Admin. La réinitialisation doit exiger une authentification forte et une procédure dédiée ; elle ne doit pas permettre à un tiers de remplacer silencieusement le code.

### 3.3 Déclenchement et écran neutre

Proposition : lorsque le serveur confirme le déclenchement, l'application affiche immédiatement l'écran neutre déjà validé. L'écran neutre doit être crédible, stable, sans badge, vibration, notification locale ou texte qui trahit le SOS. Les notifications aux proches doivent être silencieuses dans la mesure réellement permise par les plateformes et les réglages des destinataires.

Le serveur ne doit pas considérer que l'écran neutre prouve la réussite de l'alerte. Si le réseau est indisponible, l'interface ne doit pas prétendre que les proches ont été alertés.

### 3.4 Configuration des destinataires

Proposition : le SOS discret utilise une liste de destinataires et une catégorie préconfigurées. La configuration est affichée et confirmée pendant une phase sûre, pas au moment de la contrainte. À l'activation, le serveur vérifie que les destinataires sont toujours éligibles et fige l'instantané.

Il faut arbitrer si le SOS discret utilise une catégorie dédiée ou une catégorie choisie lors de sa configuration. La description libre ne devrait pas être exigée au déclenchement, afin de ne pas retarder l'action ni obliger l'utilisateur à saisir du texte.

### 3.5 Appareil hors ligne

Proposition prudente : ne pas promettre un SOS discret garanti hors ligne tant qu'un mécanisme de transmission différée sûr n'a pas été conçu et audité. Une alerte stockée localement peut être perdue si l'application est arrêtée, le téléphone éteint ou les données effacées.

Une éventuelle file locale doit être chiffrée, liée à l'appareil, à durée de vie courte, résistante au rejeu et incapable d'exposer le secret. À la reconnexion, le serveur doit vérifier l'authenticité, l'ancienneté et l'unicité de la demande. Cette option est un sujet de recherche, pas une capacité promise.

### 3.6 Déclenchement accidentel, essais et abus

Proposition : le parcours de configuration doit inclure un mode de test clairement séparé qui ne notifie aucun proche et ne crée aucune alerte réelle. Le mode test ne doit jamais pouvoir être confondu avec un vrai déclenchement.

Les événements de tentative doivent être minimisés. Une alerte discrète déclenchée ne doit pas générer de message de confirmation visible à l'écran. Les protections anti-abus ne doivent toutefois pas retarder le déclenchement réel après validation du code.

## 4. Modèle conceptuel et séparation des données

Entités conceptuelles possibles, non validées comme schéma SQL :

| Objet | Rôle | Statut |
|---|---|---|
| `scheduled_alerts` | Programmation, échéance UTC, fuseau, version, état et paramètres | Déjà identifié dans le modèle global ; règles à arbitrer |
| `scheduled_alert_events` | Création, modification, annulation, échéance, déclenchement, échec | À détailler |
| `duress_credentials` | Vérificateur du code de contrainte, version et état | Déjà identifié ; protocole incomplet |
| `duress_events` | Trace minimale d'une demande de déclenchement discret | À définir |
| `alerts` | Alerte réelle créée après déclenchement effectif | Domaine existant, contrat SOS ordinaire |

Une programmation ne doit pas être enregistrée comme une alerte active avant son déclenchement. Un événement discret réussi doit créer une seule alerte SOS normale et réutiliser son cycle de vie, sans créer un second moteur de rappels ou de clôture.

## 5. Points bloquants avant réalisation

1. Choix de l'instantané des destinataires : figé à la programmation ou revalidé à l'échéance.
2. Politique en cas de suspension, suppression en attente ou perte d'accès du compte avant l'échéance.
3. Traitement des heures locales ambiguës/inexistantes et changement de fuseau du téléphone.
4. Délai de rappel avant une programmation et options de notification.
5. Définition de la catégorie et du niveau utilisés par le SOS discret.
6. Code discret : format, longueur minimale, procédure de remplacement et seuils anti-essais.
7. Politique de jumelage multi-appareils et révocation de l'appareil qui détient le code.
8. Comportement hors ligne et éventuelle transmission différée.
9. Limites de confidentialité des notifications silencieuses selon Android/iOS/PWA.
10. Règle de purge et de rétention des événements de programmation et de contrainte, distincte de la conservation de l'alerte SOS.

## 6. Tests obligatoires avant activation

- concurrence annulation/déclenchement à l'échéance : une seule transition ;
- reprise après panne, déclenchement en retard et absence de doublon ;
- fuseaux, changement d'heure, horloge du téléphone fausse et changement de fuseau ;
- relation révoquée ou compte destinataire devenu inéligible avant l'échéance ;
- compte auteur suspendu ou suppression en attente ;
- code de contrainte absent, erroné, rejoué, deviné, remplacé ou saisi simultanément ;
- absence de secret dans les logs, crash reports, analytics et support ;
- affichage neutre après déclenchement confirmé, y compris sur petits écrans ;
- application arrêtée, téléphone redémarré, permissions retirées et appareil secondaire révoqué ;
- réseau absent au déclenchement puis reconnexion ;
- notification push acceptée mais non livrée, SMS en échec et état serveur ambigu ;
- création d'une seule alerte normale et respect des rappels, escalade, destinataires et clôture déjà validés.

## 7. Sécurité et conditions de mise en service

- Pas de promesse de SOS programmé tant que l'échéance durable côté serveur, l'idempotence et les reprises après panne ne sont pas démontrées.
- Pas de promesse de SOS discret hors ligne tant que la transmission différée n'est pas conçue et auditée.
- Pas de code secret en clair, dans les journaux ou accessible au support.
- Pas de géolocalisation réelle tant que le contrat de suppression GPS à la clôture et de purge de l'historique à J+30 n'est pas démontré.
- Chaque capacité doit distinguer configuration enregistrée, déclenchement confirmé, notification tentée, acceptation fournisseur et action humaine.

## 8. Décision attendue

Les invariants de la section 1 sont déjà établis. Les règles proposées dans ce document ne deviennent pas des décisions validées sans confirmation explicite. Ce document n'autorise aucune implémentation, migration, activation GPS, intégration de notification ou changement d'infrastructure.
