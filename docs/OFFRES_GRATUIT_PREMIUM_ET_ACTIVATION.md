# Offres SAC — gratuit, Premium et activation

Date de consolidation : 25 novembre 2026  
Dépôt : `benwahab/SAC` — branche `main`

## 1. Décision commerciale validée

SAC propose deux formules destinées au grand public :

| Formule | Prix | Cercle de confiance |
|---|---:|---:|
| Essentielle | 0 FCFA | Jusqu'à 2 contacts au total |
| Premium | 5 000 FCFA / mois | Jusqu'à 10 contacts au total |

La limite désigne le nombre total de relations de confiance actives d'un compte, et non 2 ou 10 contacts supplémentaires.

## 2. Ce qui reste gratuit

Les éléments suivants ne doivent jamais être verrouillés derrière Premium :

- Déclencher et suivre les fonctions SOS et alertes essentielles.
- Recevoir et traiter les alertes auxquelles le compte est autorisé à participer.
- Les fonctions fondamentales de protection des trajets.
- Les rappels personnels.
- Créer et gérer un cercle de confiance dans la limite gratuite de 2 contacts.
- Les fonctions normales du compte, du profil, de la confidentialité et de la sécurité.
- Les droits de consentement, de refus, de retrait et de révocation des relations.

Le SOS reste gratuit même si l'abonnement Premium expire, est annulé, échoue ou n'a jamais été souscrit. Aucun parcours de paiement ne doit ralentir ou bloquer une action d'urgence.

## 3. Ce que Premium apporte

Le seul avantage Premium actuellement validé est l'augmentation de la capacité du cercle de confiance de 2 à 10 contacts au total, au prix de 5 000 FCFA par mois.

Aucune autre fonctionnalité payante n'est annoncée ou promise à ce stade. Les rappels, le SOS, les alertes essentielles et la protection fondamentale des trajets ne doivent pas être présentés comme des avantages exclusifs Premium.

L'offre « Professionnel » est un produit distinct, non inclus dans Premium grand public. Son prix, ses conditions et ses fonctionnalités commerciales restent à définir séparément.

## 4. Règles de changement de formule

- Tout nouveau compte commence en formule gratuite.
- Un compte Premium dispose d'une limite de 10 contacts tant que sa période Premium est active et confirmée côté serveur.
- À l'expiration ou à la fin de Premium, le compte revient à la limite gratuite de 2 pour les nouvelles relations.
- Une rétrogradation ne supprime, ne révoque et ne masque aucun contact déjà établi.
- Une rétrogradation ne modifie jamais un SOS en cours ou historique, et ne désactive aucune fonction de sécurité gratuite.
- Tant que le compte possède plus de 2 relations actives après une rétrogradation, il peut conserver et utiliser ces relations existantes, mais ne peut pas en créer de nouvelles avant de repasser sous la limite applicable.
- Aucun paiement échoué, annulé, en attente ou simplement déclaré par le navigateur ne donne accès à Premium.

## 5. Parcours d'activation Premium attendu

1. L'utilisateur ouvre « Mon abonnement » depuis son avatar ou la rubrique Premium de l'accueil.
2. SAC affiche la formule actuelle, le nombre de contacts utilisés, la limite applicable et le prix Premium.
3. L'utilisateur choisit Premium à 5 000 FCFA par mois.
4. Le serveur crée une demande de paiement auprès du prestataire configuré et conserve une référence interne unique.
5. L'utilisateur effectue le paiement sur l'interface officielle du prestataire (Mobile Money ou carte, selon les moyens réellement pris en charge).
6. Le prestataire notifie le serveur. Le serveur vérifie l'authenticité de la notification, le montant, la devise, la référence, le bénéficiaire et l'état final de la transaction.
7. Le serveur traite l'événement de manière idempotente et active Premium uniquement après vérification positive.
8. L'application relit l'abonnement depuis le serveur et affiche le nouveau plafond de 10 contacts.

### États à distinguer

- `pending` : paiement commencé, aucune activation.
- `active` : paiement confirmé et période Premium valide.
- `failed` : paiement échoué, formule gratuite conservée.
- `cancelled` : paiement annulé ou abonnement arrêté ; la formule dépend de la fin de période effectivement payée.
- `expired` : période terminée, retour aux droits gratuits.

Le statut affiché par le navigateur, une URL de retour, une capture d'écran ou une réponse non signée ne constitue jamais une preuve de paiement.

## 6. Exigences techniques obligatoires

- La formule et le plafond sont déterminés côté serveur, jamais depuis un champ envoyé par le navigateur.
- Les routes d'envoi et d'acceptation d'invitations doivent vérifier le plafond du compte concerné.
- La vérification du plafond lors de l'acceptation doit être atomique pour éviter deux acceptations concurrentes qui dépasseraient la limite.
- Le serveur doit vérifier le statut et la période d'abonnement à chaque décision d'autorisation pertinente.
- Les événements du prestataire doivent être authentifiés, journalisés sans données sensibles et traités de façon idempotente.
- Les clés API et secrets de signature restent dans les secrets Cloudflare, jamais dans Git, D1 ou le navigateur.
- Les montants et la devise sont vérifiés côté serveur : 5 000 XOF pour une période mensuelle.
- Le renouvellement, l'annulation, l'expiration et les paiements tardifs doivent être testés.
- L'indisponibilité du prestataire ne doit jamais affecter le SOS ou les fonctions gratuites.

## 7. État actuel et éléments encore nécessaires

Les textes des offres publiques et l'espace privé ont été harmonisés avec les décisions commerciales ci-dessus. Le bouton « Découvrir Premium » mène à « Mon compte ». Cette page lit désormais la formule et le nombre de contacts depuis une API authentifiée.

Le contrôle de capacité est implémenté côté serveur dans les deux parcours d'invitation actuellement présents. Le nombre de contacts est calculé sur l'union dédupliquée des relations actives des deux systèmes, afin qu'un même proche ne soit pas compté deux fois et qu'un compte ne puisse pas contourner le plafond en utilisant les deux parcours :
- `proximity_invitations` / `close_relations` : le plafond du propriétaire et celui du destinataire sont vérifiés ; l'acceptation inclut des conditions SQL atomiques pour éviter les dépassements concurrents ;
- `contact_invitations` / `trusted_contacts` : le plafond du propriétaire est résolu côté serveur au moment de l'acceptation. Une invitation en attente ne réserve pas de place ; si le cercle est plein à l'acceptation, la relation n'est pas créée.

La formule est résolue par `functions/lib/billing/plan.ts`. En l'absence d'un abonnement Premium actif dont la période payée est valide, le compte est gratuit (2 contacts). `GET /api/billing/subscription` expose uniquement la formule, le plafond, le nombre de contacts et la fin de période. La migration `0028_account_subscriptions_and_billing_events.sql` a été appliquée à la D1 de production le 25 novembre 2026 ; le registre contient 28 migrations et `PRAGMA foreign_key_check` ne retourne aucune anomalie. `functions/lib/billing/activation.ts` contient le mécanisme serveur idempotent qui pourra activer Premium après validation cryptographique et métier du paiement par un adaptateur fournisseur.

**Le paiement réel et l'activation Premium après paiement ne sont pas encore disponibles.** Aucun prestataire n'a été choisi/configuré. Le schéma et le contrôle d'entitlement sont préparés, mais aucun endpoint de checkout ni webhook de paiement n'est encore branché. Il ne faut donc ni simuler une transaction ni présenter un compte comme Premium avant intégration et vérification du prestataire.

Avant d'activer la souscription réelle, il reste à :
1. choisir le prestataire de paiement et les moyens exacts disponibles au Niger ;
2. implémenter son adaptateur de création de paiement et de vérification webhook, puis activer l'abonnement uniquement après preuve serveur authentifiée ;
3. implémenter et tester les scénarios paiement réussi, échec, annulation, rejeu webhook, expiration, rétrogradation et dépassement concurrent de quota ;
4. tester le parcours complet sur l'environnement de test du prestataire avant activation en production.

Ne jamais activer une migration distante ou une intégration de paiement sans vérifier l'environnement et les secrets concernés.
