# SAC — État de configuration Web Push et livraison SOS

**Date de vérification :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`  
**Branche :** `main`  
**Projet Cloudflare Pages :** `sac`  
**Origine déclarée :** `https://sac-3xh.pages.dev`

## 1. Principe de fonctionnement

Cette configuration concerne exclusivement les notifications Push liées aux alertes SOS privées de SAC. Elle ne sert pas à envoyer des messages ordinaires à l'utilisateur.

Aucun compte destinataire n'a besoin d'exister pour préparer les composants techniques. En revanche, aucune notification ne peut être adressée à un proche tant qu'un compte actif, un appareil authentifié et un abonnement Push valide ne sont pas enregistrés.

Le code doit donc être prêt avant l'arrivée des premiers utilisateurs, sans inventer de comptes, d'appareils ou de destinataires.

## 2. État vérifié dans le dépôt

| Élément | État sur `main` |
|---|---|
| Service de chiffrement des abonnements Push | Présent |
| Route d'enregistrement/suppression d'abonnement | Présente ; exige une session d'appareil authentifiée |
| Route de lecture de la clé VAPID publique | Présente ; répond 503 tant que la clé publique n'est pas configurée |
| Interface de réglage Push dans l'espace privé | Présente |
| Service Worker et gestion du clic de notification | Présents |
| Chiffrement Web Push RFC 8291 / AES-128-GCM | Implémenté |
| Signature VAPID ES256 | Implémentée |
| Liste stricte d'hôtes Push autorisés et redirections désactivées | Implémentées |
| Worker planifié de livraison SOS | Code présent dans `workers/sos-notification-delivery/` |
| Tests unitaires du transport Web Push | Présents dans `tests/web-push-delivery.test.ts` |
| Configuration du typage Worker dans TypeScript | Présente |

## 3. État Cloudflare observé

La lecture du projet Pages confirme :

- le projet `sac` est relié au dépôt GitHub `benwahab/SAC` ;
- la branche de production configurée est `main` ;
- le binding D1 `DB` pointe vers la base `sac-db` (ID `892ce876-f279-409c-8f9e-06b1dca66e9d`) ;
- les déploiements de production Pages restent désactivés ;
- la configuration de production contient les entrées `PUSH_SUBSCRIPTION_ENCRYPTION_KEY`, `APP_BASE_URL` et les paramètres WebAuthn déjà documentés ;
- aucune entrée `PUSH_VAPID_PUBLIC_KEY` n'apparaît actuellement dans les variables Pages retournées par l'API.

Les valeurs des secrets de type `secret_text` sont masquées par Cloudflare. Leur présence dans la configuration ne permet donc pas de relire ni de vérifier leur contenu cryptographique. La clé de chiffrement précédemment configurée dans Pages ne peut pas être copiée en clair vers le Worker.

La lecture Cloudflare du script `sac-sos-notification-delivery` retourne « Worker does not exist ». Le Worker n'est donc pas créé sur le compte à la date de cet audit. Son Cron n'est pas actif.

Le dernier déploiement Pages visible est marqué `is_skipped=true` avec le motif `production_deployments_disabled`. Il ne constitue pas une preuve que les derniers changements du dépôt sont exécutés sur le site.

## 4. Configuration manquante

### Pages — variables et secrets

| Nom | Type | Rôle | État |
|---|---|---|---|
| `PUSH_SUBSCRIPTION_ENCRYPTION_KEY` | Secret | Chiffrement des endpoints et clés d'abonnement stockés dans D1 | Entrée présente ; valeur masquée ; validation de format/contenu non démontrée |
| `PUSH_VAPID_PUBLIC_KEY` | Texte public | Clé remise à la PWA pour créer un abonnement | Absente |
| `PUSH_VAPID_PRIVATE_JWK` | Secret | Signature VAPID côté serveur | Absente |
| `PUSH_VAPID_SUBJECT` | Texte | URI de contact VAPID | À ajouter ; valeur prévue : `https://sac-3xh.pages.dev` |

### Worker — secrets et liaison

Le Worker devra recevoir exactement la même clé `PUSH_SUBSCRIPTION_ENCRYPTION_KEY` que Pages, ainsi que la paire VAPID correspondante. Le binding D1 devra rester attaché à la base SAC ci-dessus.

La clé de chiffrement Pages étant non récupérable, la procédure propre est une rotation préparatoire vers une nouvelle clé commune de 32 octets, configurée simultanément dans Pages et dans le Worker. Cette rotation doit être faite avant tout abonnement utilisateur. Il ne faut jamais créer deux clés indépendantes pour Pages et Worker.

La paire VAPID doit être générée une seule fois pour l'environnement SAC, puis sa clé publique doit être identique dans Pages et dans le Worker ; la clé privée reste secrète et ne doit jamais être exposée à la PWA, au dépôt Git ou aux journaux.

## 5. Ordre de configuration requis

1. Générer une clé de chiffrement aléatoire de 32 octets encodée en base64url.
2. Générer une paire ECDSA P-256 dédiée à VAPID.
3. Valider localement la correspondance entre clé publique et clé privée.
4. Configurer la même clé de chiffrement dans Pages et le Worker.
5. Configurer la clé VAPID publique dans Pages et le Worker.
6. Configurer la clé privée VAPID uniquement comme secret dans Pages et le Worker.
7. Configurer le sujet VAPID HTTPS dans les deux environnements.
8. Créer le Worker avec le binding D1 SAC.
9. Vérifier le code, les variables, les secrets déclarés, la liaison D1 et le déclencheur planifié.
10. Garder le transport en mode inactif tant que l'environnement d'exécution n'a pas été vérifié et que le produit n'est pas prêt à recevoir ses premiers comptes.

Les clés ne doivent jamais être écrites dans GitHub, les fichiers `.toml`, les logs, les rapports d'erreur ou les réponses API. Les valeurs de secrets ne doivent jamais être imprimées dans une sortie d'outil.

## 6. Garde-fous de livraison

- Un abonnement Push ne peut être créé qu'après authentification d'un appareil.
- Les destinataires proviennent exclusivement de l'instantané des proches de confiance enregistré lors du déclenchement SOS.
- Le Worker doit revalider l'état du compte, de l'appareil et de l'abonnement juste avant l'envoi.
- Les payloads restent génériques et ne contiennent ni coordonnées GPS, ni description libre, ni nom de proche.
- Une réponse positive du fournisseur signifie « accepté par le fournisseur », pas « livré », « affiché » ou « lu ».
- Les réponses 404/410 rendent l'abonnement obsolète.
- Aucun SMS n'est envoyé par ce Worker.
- Aucun destinataire, compte ou appareil fictif ne doit être créé pour simuler une configuration.
- Les rappels planifiés toutes les cinq minutes restent une règle métier du service SOS ; la fréquence d'exécution du Cron n'est pas une garantie de réception sur le téléphone.
- L'absence de comptes signifie qu'aucun proche ne peut recevoir de Push aujourd'hui ; elle n'empêche pas de préparer l'infrastructure.

## 7. Déploiement et activation — statut

À la date de cet audit :

- aucun Worker de livraison n'est déployé ;
- aucun Cron de livraison n'est actif ;
- aucune paire VAPID n'est configurée ;
- la route publique de clé VAPID reste indisponible (503 attendu) ;
- aucun abonnement utilisateur n'est enregistré par ce mécanisme ;
- aucune notification Push n'a été envoyée par cette tranche ;
- aucun SMS n'est configuré ni envoyé ;
- aucun déploiement Pages de production n'a été déclenché par cette tranche.

Le dépôt est donc **préparé côté code, mais la configuration Cloudflare de livraison n'est pas terminée**. Il ne faut pas annoncer la fonctionnalité comme opérationnelle.

## 8. Vérifications bloquantes avant de déclarer « prêt »

- Vérifier que les deux environnements utilisent exactement la même clé de chiffrement.
- Vérifier que la clé privée VAPID correspond à la clé publique exposée par Pages.
- Vérifier que le Worker pointe uniquement vers la base D1 SAC.
- Vérifier que le Cron est actif uniquement sur l'environnement prévu.
- Vérifier la gestion des erreurs, les baux, la reprise et la clôture des alertes.
- Vérifier les tests du transport et les tests D1 concurrents.
- Vérifier qu'aucune donnée GPS ou donnée personnelle ne sort dans les payloads ou logs.
- Vérifier que les paramètres de déploiement Pages restent conformes à la décision de ne pas déclencher de déploiement de production.

**Conclusion :** l'absence actuelle de comptes destinataires n'est pas un obstacle à la préparation. Les vrais éléments encore manquants sont la configuration cryptographique Cloudflare, la création du Worker et la vérification complète de son environnement.