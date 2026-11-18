# SAC — Gouvernance administrative, missions et cycle de vie

Date : 18 novembre 2026  
Statut : spécification consolidée ; les éléments marqués « proposition à valider » ne sont pas des décisions approuvées.

## 1. Principes non négociables

- Le Super Admin est l'unique autorité qui crée, attribue, modifie, suspend, reprend, révoque et termine les délégations et missions.
- Un délégataire ne peut jamais déléguer, inviter un administrateur, attribuer une tâche avec privilèges, modifier ses droits ou étendre son périmètre.
- Le rôle, la permission et la mission sont trois objets distincts.
- Toute action est autorisée côté serveur, à chaque requête, à partir de l'état courant du compte, de la session, de la mission, de la permission et de la ressource.
- Refus par défaut ; aucune permission implicite ni héritage automatique.
- La révocation doit être effective côté serveur immédiatement, sans attendre le rafraîchissement de l'interface.
- L'espace d'administration est réservé à l'ordinateur et à la tablette.
- Les actions administratives et consultations sensibles sont tracées ; aucune trace historique ne peut être réécrite ou effacée par un administrateur.

## 2. Cycle de vie d'une mission

États conceptuels :
1. **Brouillon** : préparée par le Super Admin, aucun droit actif.
2. **Active** : attribuée, acceptée si ce mécanisme est retenu, dans ses dates et limites.
3. **Suspendue** : neutralisée temporairement ; aucune action métier permise.
4. **Reprise** : réactivation explicite par le Super Admin après contrôle ; elle ne se fait jamais automatiquement à l'échéance d'une suspension.
5. **Expirée** : date de fin atteinte ; aucun droit actif.
6. **Révoquée** : retirée définitivement avant ou à son terme.
7. **Terminée** : objectif achevé et mission fermée ; aucun droit résiduel.

Une transition doit être explicite et auditée. Une mission révoquée ou terminée ne peut pas être réactivée ; le Super Admin crée une nouvelle mission si nécessaire. Une mission suspendue peut être reprise par le Super Admin après réévaluation. Une modification de permission ou de périmètre prend effet pour les requêtes futures et ne réécrit jamais les actions passées.

## 3. Contenu obligatoire d'une mission

Chaque mission doit contenir :
- identifiant unique et état ;
- identité du bénéficiaire et rôle fonctionnel ;
- objectif métier, description et motif ;
- créateur/autorité ayant décidé l'attribution ;
- permissions atomiques (ressource + action) ;
- périmètre précis et exclusions ;
- date/heure de début et de fin en UTC ;
- date de dernière revue ;
- conditions particulières et niveau de sensibilité ;
- événements d'attribution, modification, suspension, reprise, expiration, révocation et clôture.

Aucune mission active sans date de fin. Aucun périmètre « tous les utilisateurs » ou « toutes les alertes » par commodité : il doit être justifié et exceptionnellement explicite. Une mission d'accès à une alerte unique ne donne accès à aucune autre alerte du compte.

## 4. Durée et revue des missions

**Proposition à valider :**
- mission standard : durée initiale maximale de 30 jours ;
- mission sensible (sécurité, données C3, export) : durée initiale maximale de 7 jours ;
- échéance exceptionnelle plus longue : justification écrite et revue explicite par le Super Admin ;
- notification au Super Admin avant échéance, par exemple 72 h avant, sans prolongation automatique ;
- renouvellement uniquement par une nouvelle décision explicite du Super Admin, avec revue des droits et du besoin.

Ces durées sont des recommandations de prudence, non des décisions utilisateur déjà approuvées. Elles ne modifient pas la politique de session utilisateur de 30 jours d'inactivité et 90 jours maximum.

## 5. Suspension d'urgence et révocation

Le Super Admin peut suspendre immédiatement une mission lorsqu'un doute sérieux apparaît : appareil perdu/compromis, comportement anormal, suspicion d'accès non autorisé, erreur de périmètre, changement de fonction ou incident de sécurité.

Effets attendus :
1. le serveur marque la mission comme suspendue ou révoquée ;
2. toutes les nouvelles requêtes couvertes par cette mission sont refusées ;
3. les opérations longues doivent vérifier à nouveau l'autorisation avant leur validation finale ;
4. les autorisations temporaires, liens d'export et tâches différées issus de la mission sont annulés ou rendus inutilisables ;
5. les sessions administratives du bénéficiaire sont réévaluées à chaque requête ; les droits de cette mission disparaissent immédiatement, sans nécessairement fermer les autres missions valides ;
6. les événements déjà réalisés et les traces restent conservés ;
7. le bénéficiaire est informé de la suspension selon un canal approprié, sans révéler d'informations sensibles sur l'incident.

La suspension d'une mission ne suspend pas automatiquement le compte personnel du délégataire. Une suspension du compte est une décision distincte, prise selon les règles du cycle de vie des comptes.

## 6. Conflits, chevauchements et demandes d'extension

- Chaque action doit être rattachée à une mission active déterminée.
- Si plusieurs missions semblent couvrir la même action, le serveur ne fusionne pas leurs périmètres ; il vérifie la mission invoquée et ses propres limites.
- Si les règles ou périmètres se contredisent ou sont ambigus, l'action est refusée et transmise au Super Admin.
- Aucun cumul de missions ne permet d'élargir indirectement l'accès à une ressource non prévue.
- Le délégataire peut soumettre une demande motivée d'extension ; cette demande ne crée aucun droit tant que le Super Admin ne l'a pas approuvée et matérialisée dans une nouvelle version ou mission.
- L'historique conserve les anciennes permissions et leur période de validité.

## 7. Authentification et sessions administratives

Les règles générales de compte restent : 30 jours consécutifs d'inactivité entraînent la déconnexion ; 90 jours constituent la durée absolue maximale d'une session, même avec activité. Le compte utilise e-mail + mot de passe, avec OTP e-mail pour vérification initiale et opérations sensibles selon les règles approuvées. Aucun SMS OTP.

**Propositions à valider pour les comptes administratifs :**
- durée d'inactivité administrative plus courte que 30 jours ;
- réauthentification par mot de passe et OTP e-mail récent avant attribution/retrait d'une délégation, changement d'une permission critique, export sensible et clôture administrative ;
- notification au Super Admin de toute modification de délégation et de tout export sensible ;
- révocation centralisée des sessions en cas de compromission du compte administratif.

L'OTP ne remplace jamais l'autorisation côté serveur, et ne donne aucun droit supplémentaire. L'administration reste inaccessible depuis un téléphone.

## 8. Export et accès exceptionnel

- Export désactivé par défaut pour tous les délégataires.
- Un droit d'export est distinct du droit de consultation et doit nommer les catégories de données, le périmètre, le motif et l'échéance.
- Les exports sensibles sont journalisés avant et après génération ; les fichiers doivent avoir une durée de vie courte et un accès contrôlé.
- Aucun export de secrets, OTP, clés privées, jetons bruts ou GPS précis.
- Toute consultation exceptionnelle de données C3 exige une mission et un motif précis, et ne crée pas de privilège permanent.
- Les mécanismes techniques de protection des fichiers exportés et leur durée de conservation restent à définir après étude de sécurité.

## 9. Contrôle, alertes et revue périodique

Le futur système devra permettre au Super Admin de voir :
- missions actives, suspendues, expirant bientôt, expirées et révoquées ;
- bénéficiaire, permissions, périmètre, motif et échéance ;
- dernières utilisations et refus d'autorisation ;
- exports et consultations sensibles ;
- demandes d'extension en attente.

**Proposition à valider :** revue mensuelle des missions actives et revue immédiate après incident, changement de fonction ou suspicion de compromission. Les missions sans usage récent doivent être réexaminées, pas prolongées automatiquement.

## 10. Journal d'audit associé

Chaque transition de mission et chaque opération sensible produit un événement append-only comportant au minimum : acteur, rôle effectif, mission, permission, ressource et périmètre, action, résultat, heure UTC serveur, identifiant de corrélation, motif et référence de l'événement précédent si nécessaire. Les valeurs sensibles sont omises ou empreintées ; aucun secret brut n'est stocké.

Une correction est un nouvel événement lié à l'ancien. Aucune suppression ou réécriture. Le mécanisme concret d'intégrité, la durée de conservation, la purge légale et le stockage verrouillé restent à concevoir et à faire auditer.

## 11. Tests de sécurité et critères d'acceptation

Avant mise en production, les tests doivent démontrer :
1. brouillon, expirée, suspendue, révoquée et terminée ne donnent aucun accès ;
2. une mission active ne permet que les actions et ressources explicitement listées ;
3. un changement de permission est effectif côté serveur dès sa validation ;
4. une mission suspendue invalide les autorisations déjà mises en cache ;
5. une tâche longue ou un export ne peut pas terminer après révocation sans nouvelle vérification ;
6. un délégataire ne peut pas créer ou modifier une mission, ni s'auto-augmenter ;
7. une demande d'extension ne change aucun droit avant décision du Super Admin ;
8. deux missions ne se combinent pas pour ouvrir un périmètre plus large ;
9. un export exige un droit spécifique et une traçabilité dédiée ;
10. une session compromise peut être révoquée centralement ;
11. les opérations critiques exigent le niveau d'authentification renforcé si cette proposition est approuvée ;
12. toutes les transitions et tous les refus pertinents sont audités ;
13. aucune trace antérieure n'est altérable par un rôle administratif.

## 12. Points qui restent soumis à arbitrage

- Valider ou ajuster les durées proposées de 30 jours et 7 jours, ainsi que les alertes d'échéance.
- Valider la durée d'inactivité spécifique des sessions administratives.
- Valider les opérations imposant un OTP e-mail récent.
- Définir le périmètre exact des exports et les protections des fichiers.
- Définir la durée de conservation et le mécanisme de preuve d'intégrité des journaux.
- Valider les règles de revue périodique et les notifications administratives.
- Faire réaliser une revue indépendante de sécurité et de conformité.

## 13. Portée

Document de conception uniquement. Il ne crée aucun rôle, compte, permission, mission, notification, endpoint, middleware, mécanisme de session, export, table, migration D1, ressource Cloudflare ou déploiement. Une autorisation explicite distincte, une conception technique, une revue indépendante et des tests sont obligatoires avant toute implémentation.
