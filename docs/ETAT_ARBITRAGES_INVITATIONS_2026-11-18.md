# SAC — État des arbitrages sur les invitations et la révocation

**Date : 18 novembre 2026**  
**Statut général : propositions consignées, aucune nouvelle validation produit enregistrée.**

Ce document sert de relevé compact. Il complète sans les remplacer :
- `CONTRAT_CYCLE_VIE_PROCHES_ET_INVITATIONS.md` ;
- `PROPOSITIONS_ARBITRAGE_INVITATIONS_ET_REVOCATION.md`.

## 1. Règles déjà validées — à ne pas rouvrir

- Un compte SAC actif exige une adresse e-mail obligatoire vérifiée par OTP.
- Le téléphone est obligatoire à l'inscription, mais sa simple déclaration ne vaut pas vérification.
- Une personne ne devient proche actif qu'avec un compte SAC actif et après acceptation explicite de l'invitation.
- Une relation est directionnelle : désigner quelqu'un ne crée pas automatiquement la relation inverse.
- L'appartenance à un groupe ne donne aucun droit implicite sur une alerte ou une position GPS.
- Les rappels SOS initiaux restent adressés aux destinataires initiaux selon le cycle déjà approuvé ; la révocation d'un proche ne clôture pas l'alerte.
- Les règles de conservation et de suppression irréversible du GPS précis restent un verrou préalable à toute activation GPS.

## 2. Propositions toujours en attente

| Sujet | Proposition documentée | Statut |
|---|---|---|
| Durée d'invitation | Expiration après 7 jours | À valider |
| Relances | Une relance automatique à 48 h et une relance manuelle maximum, sans prolonger l'échéance | À valider |
| Anti-abus | 3 invitations par adresse sur 30 jours ; 10 par invitant sur 24 h ; une invitation en attente par couple invitant/destination | À valider |
| Après refus | Refroidissement de 30 jours avant une nouvelle invitation du même invitant | À valider |
| Après retrait volontaire | Blocage de 90 jours pour une nouvelle invitation par l'ancien propriétaire ; le destinataire peut initier une nouvelle demande | À valider |
| E-mail transactionnel | Couche fournisseur interchangeable ; sélection du fournisseur après revue régionale, juridique, sécurité et délivrabilité | À valider |
| Révocation | Droit symétrique : le propriétaire retire le proche et le proche peut quitter la relation | À valider |
| Alerte en cours | Rappels opaques maintenus aux destinataires initiaux, mais coupure immédiate du détail, des nouvelles positions et des nouvelles actions du contact révoqué | À valider |
| Responsable principal | Fin immédiate de son rôle s'il est révoqué ; promotion atomique du prochain volontaire encore admissible, sinon alerte sans principal | À valider |
| Historique | Pas d'accès du contact révoqué aux détails ou à l'historique après révocation ; une réinvitation ne rouvre pas les anciennes alertes | À valider |

Les seuils anti-abus sont des valeurs initiales proposées, pas des garanties définitives. Ils devront être calibrés et contrôlés côté serveur.

## 3. Points de vigilance à conserver

- Un rappel opaque ne doit contenir ni position, ni description de l'urgence, ni identité de tiers, ni détail d'intervention.
- L'arrêt d'une nouvelle émission GPS ne peut pas effacer les données déjà reçues par un destinataire.
- Toute révocation et toute promotion de responsable doivent être atomiques côté serveur afin d'éviter les courses concurrentes.
- Une notification e-mail « délivrée » ne prouve ni lecture ni consentement.
- Une invitation expirée, refusée ou révoquée ne doit jamais redevenir utilisable ; une nouvelle invitation nécessite un nouveau jeton et une nouvelle acceptation.
- Les limites et messages anti-abus ne doivent pas révéler si une adresse possède déjà un compte SAC.

## 4. Ce que « Vas-y » autorise ici

La poursuite de la consolidation documentaire et la préparation des arbitrages sont autorisées. En revanche, aucune des propositions de la section 2 n'est considérée comme approuvée par le présent relevé.

Aucune implémentation applicative, migration D1, configuration Cloudflare, activation GPS, intégration d'un fournisseur e-mail ou déploiement n'est autorisé par ce document.

## 5. Conditions avant implémentation

Après validation produit explicite : harmoniser les contrats TypeScript, définir les transactions et contraintes D1, écrire les tests de concurrence et d'anti-rejeu, revoir les permissions serveur, puis soumettre les flux sensibles à une revue de sécurité indépendante. Le GPS reste bloqué tant que la suppression irréversible à J+30 n'est pas démontrée sur toutes les copies et sauvegardes.
