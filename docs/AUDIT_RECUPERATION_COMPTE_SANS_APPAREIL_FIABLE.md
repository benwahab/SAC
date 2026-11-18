# SAC — Audit de récupération du compte sans appareil de confiance

**Date :** 18 novembre 2026  
**Statut :** analyse de sécurité et scénarios ; aucune méthode de récupération approuvée, aucun fournisseur, endpoint ou flux activé.

## 1. Question traitée

Que peut faire une personne qui a perdu tous ses appareils approuvés, mais souhaite retrouver l'accès à son compte SAC ?

Il faut distinguer trois résultats qui ne sont pas équivalents :

1. **Récupérer l'accès au compte** : prouver suffisamment le contrôle du compte applicatif.
2. **Enregistrer un appareil** : autoriser un nouveau terminal à participer au compte.
3. **Rétablir la confiance cryptographique** : remplacer une racine perdue et faire vérifier la nouvelle identité par les contacts.

Une preuve qui suffit pour le premier résultat ne suffit pas automatiquement pour les deux suivants.

## 2. Comportement sûr en V1

Tant que la procédure de récupération de racine n'est pas spécifiée et validée :

- Une récupération du compte ne modifie pas la racine, sa génération ou son empreinte.
- Un nouvel appareil ne devient pas approuvé simplement parce que l'utilisateur a réussi un OTP, un e-mail ou une réinitialisation de mot de passe.
- Aucun appareil secondaire n'est promu automatiquement racine.
- Une ancienne sauvegarde, un ancien certificat ou un ancien jeton ne rétablit pas une autorisation révoquée.
- Les fonctions qui exigent la racine restent bloquées si aucune racine approuvée n'est disponible.
- Le partage GPS reste bloqué tant que la confiance cryptographique requise n'est pas rétablie selon une procédure ultérieure validée.
- Le SOS sans GPS ne doit pas être annoncé comme disponible tant que son propre mécanisme d'authentification, de limitation d'abus et de transmission n'est pas spécifié et testé.

Ce comportement peut laisser un utilisateur sans accès à certaines fonctions après perte de tous ses appareils. Il est préférable de rendre cette limite explicite plutôt que de créer un contournement qui permettrait à un attaquant ayant seulement détourné un numéro ou une boîte mail de prendre le contrôle cryptographique.

## 3. Scénarios et réponse attendue

| Situation | Accès au compte | Appareil / racine | GPS |
|---|---|---|---|
| Mot de passe oublié, appareil racine disponible | Récupération compte selon facteurs à définir | Preuve locale de possession de la racine requise | Bloqué jusqu'à authentification et vérification normales |
| Téléphone perdu, autre appareil approuvé disponible | Parcours depuis l'appareil restant selon politique | Révocation de l'appareil perdu ; pas de promotion automatique | Selon la politique de racine et les droits actifs |
| Tous les appareils perdus, canal de récupération accessible | Récupération compte éventuellement possible après facteurs à définir | Aucun nouvel appareil approuvé en V1 ; racine non remplacée | Bloqué |
| Numéro SIM détourné | OTP seul insuffisant | Aucun enrôlement ou remplacement de racine | Bloqué |
| E-mail compromis | E-mail seul insuffisant | Aucun enrôlement ou remplacement de racine | Bloqué |
| Ancienne sauvegarde restaurée | Ne prouve pas l'identité actuelle | L'état D1 courant prévaut ; appareil révoqué refusé | Bloqué si autorisation absente |
| Téléphone racine volé et possiblement déverrouillé | Récupération et sécurisation selon procédure dédiée | Révocation urgente selon autorité prouvée ; pas de nouvelle racine automatique | Bloqué pour l'ancienne identité dès révocation serveur |

La ligne « autre appareil approuvé disponible » dépend de la politique d'approbation racine : un appareil secondaire ne peut pas devenir racine par simple choix de l'utilisateur. Une cérémonie d'enrôlement valide reste obligatoire.

## 4. Le SOS non-GPS : dépendance à résoudre

Les documents produit demandent que le SOS sans GPS reste possible pendant une récupération. Cependant, ils ne définissent pas encore :

- comment l'utilisateur est authentifié lorsqu'il n'a plus aucun appareil approuvé ;
- si une alerte non-GPS peut être envoyée depuis un appareil neuf avant son enrôlement ;
- comment empêcher un attaquant de déclencher des alertes au nom d'un compte récupéré frauduleusement ;
- comment distinguer une alerte non-GPS authentifiée d'une alerte dont l'identité cryptographique n'est pas vérifiée ;
- comment fonctionne le repli SMS si l'utilisateur n'a plus de session approuvée ;
- quelle information minimale est transmise aux contacts pour signaler le niveau de confiance de l'origine.

**Conséquence :** « SOS non-GPS toujours disponible pendant la récupération » est actuellement un objectif produit, pas une garantie technique démontrée. Il ne faut pas l'implémenter en contournant la vérification du compte ou en réutilisant une ancienne session.

Options à arbitrer avant développement :
1. Exiger une réauthentification renforcée via un canal de récupération indépendant, puis autoriser un SOS non-GPS explicitement marqué comme provenant d'une session de récupération limitée.
2. Exiger un appareil déjà approuvé pour tout SOS authentifié, et afficher clairement l'indisponibilité si tous les appareils sont perdus.
3. Concevoir un canal d'urgence distinct, avec identité et limites d'abus spécifiques, sans lui donner de pouvoir sur les appareils, la racine ou le GPS.

Aucune option n'est sélectionnée par cet audit.

## 5. Exigences de sécurité pour une future récupération du compte

Avant de choisir un fournisseur ou une méthode, la spécification devra couvrir :

- facteurs indépendants et résistance au SIM swap, à la compromission de la boîte mail et à l'ingénierie sociale ;
- limitation des tentatives, temporisation progressive et protection contre l'énumération des comptes ;
- notifications de sécurité vers les canaux préexistants, sans divulguer de secrets ;
- délai de sécurité éventuel avant les opérations sensibles ;
- procédure si tous les facteurs sont perdus ;
- révocation des sessions existantes et traitement des appareils hors ligne ;
- idempotence des demandes répétées et comportement après perte de réponse ;
- séparation stricte entre récupération d'accès, enrôlement d'appareil et récupération de racine ;
- journalisation minimale, sans OTP, jetons, clés privées ou coordonnées GPS.

Un facteur de récupération ajouté uniquement après la perte des appareils ne doit pas pouvoir devenir immédiatement un facteur de confiance sans validation préalable.

## 6. Autorité serveur et limites du prototype existant

`src/domain/account-lifecycle.ts` est un contrat métier pur. Il reçoit `actorAccountId` comme donnée d'entrée et ne vérifie pas l'authentification. Le serveur devra établir l'identité de l'acteur à partir de la session vérifiée et de l'état courant de D1 ; il ne doit jamais considérer un identifiant envoyé par le client comme preuve de propriété.

De même, les tests de ce module vérifient les transitions pures mais ne prouvent ni l'authentification, ni l'autorisation D1, ni l'anti-rejeu, ni la sécurité d'un fournisseur OTP.

Aucune méthode de récupération ne peut être considérée prête à la production sur la base de ce prototype.

## 7. Tests adversariaux à prévoir

1. OTP seul après SIM swap : aucun nouvel appareil approuvé et aucune racine remplacée.
2. E-mail seul après compromission : aucun enrôlement de confiance.
3. Récupération réussie du compte : l'empreinte et la génération de racine restent inchangées.
4. Ancien appareil révoqué qui revient en ligne : refus avant toute lecture de données privées.
5. Ancienne sauvegarde avec session valide historiquement : refus si l'état serveur est révoqué ou expiré.
6. Deux demandes de récupération concurrentes : un seul état de récupération cohérent.
7. Réponse réseau perdue après commit : répétition idempotente.
8. Client qui forge `actorAccountId` : refus par l'autorité serveur.
9. Appareil neuf qui tente d'approuver un autre appareil sans racine : refus.
10. Tentative de partage GPS pendant récupération : refus.
11. Tentative SOS non-GPS pendant récupération : résultat conforme à une politique explicitement choisie, jamais à un contournement implicite.
12. Journaux et notifications : aucun OTP, jeton, secret, clé privée ou GPS précis.

Les tests d'authentification et de concurrence devront ensuite être exécutés sur un environnement isolé avec le fournisseur et le runtime D1 réellement retenus.

## 8. Décisions produit qui restent ouvertes

- Quels facteurs de récupération du compte seront acceptés et lesquels sont indépendants ?
- Quelle procédure est possible si l'utilisateur a perdu tous ses facteurs ?
- Quel niveau d'accès au compte est accordé après récupération sans appareil approuvé ?
- Le SOS non-GPS doit-il être accessible depuis une session de récupération limitée ou uniquement depuis un appareil approuvé ?
- Quels messages les contacts reçoivent-ils et comment l'origine non vérifiée est-elle indiquée ?
- Quels délais, notifications et voies de contestation s'appliquent ?
- La récupération de racine sera-t-elle conçue dans une version ultérieure, avec quelle vérification indépendante ?

## 9. Garde-fous

Aucun endpoint, migration D1, fournisseur SMS/e-mail, nouveau facteur de récupération, appareil approuvé ou racine de remplacement n'est créé par cet audit. Aucun GPS réel ou historique GPS n'est activé. Le verrou de destruction irréversible J+30 reste inchangé.

**Conclusion :** SAC doit pouvoir distinguer clairement « compte récupéré » de « identité cryptographique de confiance ». En V1, la première opération ne doit jamais accorder silencieusement les pouvoirs des deux autres. Le SOS sans GPS reste un objectif à concevoir, pas une exception qui autorise à affaiblir la sécurité.

## Consolidation transversale

La matrice consolidée des scénarios et la frontière entre récupération du compte, enrôlement d'appareil et récupération de racine sont désormais centralisées dans `CONSOLIDATION_APPAREILS_SESSIONS_ET_RECUPERATION.md`. Le SOS sans GPS pendant récupération demeure un objectif non démontré, et non une garantie disponible. La récupération de racine reste interdite en V1.
