# SAC — Décision validée : connexions simultanées multi-appareils

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`  
**Statut :** décision produit validée explicitement par l'utilisateur.  
**Périmètre :** sessions simultanées d'un même compte sur plusieurs appareils et notifications Push par appareil.

## 1. Décision validée

Un même compte SAC peut rester connecté simultanément sur plusieurs appareils appartenant à la même personne (par exemple téléphone et tablette).

Cette règle signifie :
- un seul compte et une seule identité SAC ;
- une session distincte, liée à son compte et à son appareil, pour chaque appareil connecté ;
- les appareils actifs peuvent utiliser le compte simultanément ;
- chaque appareil possède son propre abonnement Push lorsqu'il active les notifications ;
- une notification destinée au compte peut être transmise aux abonnements actifs de ses appareils autorisés ;
- la déconnexion d'un appareil ferme uniquement sa session ;
- la révocation d'un appareil invalide ses propres sessions et abonnements, sans déconnecter ni révoquer les autres appareils du compte ;
- l'utilisateur doit pouvoir consulter les appareils connectés et révoquer individuellement un appareil perdu ou inutilisé.

## 2. Garanties de sécurité à préserver

1. Une session ne peut jamais être partagée entre deux appareils : elle reste liée à un seul appareil.
2. Le serveur revalide l'état du compte, de l'appareil et de la session à chaque requête protégée.
3. Un appareil révoqué ne retrouve pas ses droits en restaurant une ancienne session locale.
4. Un appareil secondaire ne devient pas racine et ne peut pas approuver d'autres appareils.
5. La racine active unique du compte et le protocole d'approbation secondaire restent soumis à leurs contrats cryptographiques propres.
6. La révocation d'un appareil ne doit pas provoquer la révocation des autres appareils encore autorisés.
7. Les abonnements Push restent propres à chaque appareil ; ils ne servent jamais de preuve d'identité ou de réception.
8. Les résultats de livraison doivent être suivis par appareil autant que possible. Une acceptation par un fournisseur ne prouve ni l'affichage ni la lecture sur l'appareil.

## 3. Limites et points qui ne sont PAS validés par cette décision

Cette décision ne choisit ni n'autorise :
- un mécanisme de renouvellement silencieux ou un refresh token ;
- une durée différente des durées déjà validées (30 jours d'inactivité, 90 jours maximum) ;
- un nouvel enrôlement secondaire sans la cérémonie cryptographique complète ;
- le remplacement ou la récupération d'une racine perdue, toujours interdit en V1 ;
- une migration D1, un endpoint, une interface de gestion d'appareils ou un déploiement ;
- l'activation des notifications réelles, des clés VAPID ou du Worker Cloudflare.

## 4. Conséquence technique à traiter avant livraison Push multi-appareils

L'outbox SOS actuelle est agrégée par destinataire, puis le transport parcourt les abonnements de tous ses appareils actifs. En cas d'acceptation par un fournisseur sur certains appareils et d'échec temporaire sur un autre, la reprise peut répéter un envoi déjà accepté.

Avant d'annoncer une livraison multi-appareils fiable, concevoir et tester une traçabilité d'envoi par couple tâche de rappel / abonnement d'appareil, avec :
- enregistrement durable de chaque résultat d'appareil avant de poursuivre ;
- reprise qui ignore les envois déjà confirmés comme acceptés ;
- traitement distinct des abonnements expirés ou révoqués ;
- état ambigu conservé comme ambigu lorsqu'une réponse fournisseur est perdue ;
- aucune promesse « exactement une fois » lorsque le fournisseur ne propose pas d'idempotence ou de réconciliation.

Aucun SMS n'est envoyé par cette décision. Aucun push réel n'est envoyé.

## 5. État de réalisation

Le schéma actuel lie déjà chaque abonnement Push à un compte et à un appareil. Le transport actuel parcourt les abonnements actifs de tous les appareils actifs du destinataire. Cela constitue une base technique, mais ne prouve pas que le parcours complet de sessions simultanées, d'enrôlement secondaire, de consultation/révocation des appareils et de reprise Push par appareil est opérationnel.

**Conclusion :** la connexion simultanée d'un compte sur plusieurs appareils est une règle produit validée. Les mécanismes d'enrôlement, de gestion des sessions et de livraison doivent rester conformes aux limites ci-dessus et faire l'objet de travaux séparés.
