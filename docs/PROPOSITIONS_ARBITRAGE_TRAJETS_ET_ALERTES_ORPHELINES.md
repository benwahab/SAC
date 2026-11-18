# SAC — Propositions d'arbitrage : trajets et alertes orphelines

**Statut : PROPOSITIONS À VALIDER — aucune règle nouvelle n'est approuvée par ce document.**  
**Portée :** modes de protection des trajets, retard, partage de position, indisponibilité durable de l'auteur et suppression de compte liée à une activité en cours.  
**Règle de priorité :** les règles SOS déjà approuvées restent prioritaires et ne sont pas modifiées ici.

## 1. Invariants déjà établis

- Les trois modes de trajet sont distincts : vérification d'arrivée, accompagnement et protection complète.
- L'absence de confirmation d'arrivée ne déclenche pas automatiquement un SOS.
- Une perte de réseau ne doit jamais être présentée comme une preuve de danger ni comme une position actuelle.
- Les rappels SOS sont distincts des rappels de trajet.
- Pour une alerte SOS déclenchée, les rappels initiaux continuent toutes les cinq minutes jusqu'à la clôture explicite par l'auteur, conformément à la décision existante.
- Un proche ne clôture pas une alerte à la place de l'auteur.
- La règle de destruction irréversible des GPS précis à J+30 reste un verrou absolu avant toute activation de collecte GPS persistante.

## 2. Mode « Vérification d'arrivée »

### Proposition de parcours
1. L'auteur renseigne une destination sous forme de libellé, une heure estimée d'arrivée et les proches concernés.
2. SAC rappelle à l'auteur de confirmer son arrivée à l'heure prévue.
3. Si aucune confirmation n'est reçue, SAC applique un délai de grâce.
4. À l'expiration de ce délai, SAC informe les proches avec le statut exact « Arrivée non confirmée ».
5. L'auteur peut confirmer tardivement ; les proches reçoivent alors une mise à jour « Arrivée confirmée après le délai ».
6. Le trajet se termine par confirmation ou annulation explicite de l'auteur.

### Valeurs proposées
- Délai de grâce par défaut : **10 minutes** après l'heure estimée.
- Choix utilisateur : 5, 10, 15 ou 30 minutes.
- Un rappel à l'auteur à l'heure estimée, puis un seul rappel à la fin du délai de grâce.
- Une notification initiale aux proches à la fin du délai ; pas de relance répétitive aux proches pour un simple retard.
- Pas de déclenchement SOS automatique, même après plusieurs retards.

### Pourquoi
Un retard peut être banal. Une notification unique et factuelle prévient les proches sans transformer automatiquement une absence de confirmation en urgence.

## 3. Mode « Accompagnement »

### Proposition de parcours
1. L'auteur sélectionne les proches qui auront accès au partage.
2. Il voit clairement quelles données sont partagées : position, heure de dernière réception et état de fraîcheur.
3. Il choisit une durée déterminée ou « jusqu'à la fin du trajet ».
4. À l'échéance, le partage s'arrête automatiquement, même si le trajet n'a pas été clôturé.
5. L'auteur peut arrêter le partage plus tôt.
6. Une perte de réseau affiche la dernière position connue avec son heure ; aucune position fictive ou supposée n'est affichée.

### Valeurs proposées
- Durées simples : 15, 30 ou 60 minutes, ou jusqu'à la fin du trajet.
- Pour « jusqu'à la fin du trajet », demander une durée maximale explicite avant le départ ; proposition de plafond initial : **2 heures**, renouvelable uniquement par action consciente de l'auteur.
- Le partage est désactivé par défaut tant que l'auteur n'a pas choisi les proches et confirmé la durée.
- L'interface distingue toujours « position actuelle », « dernière position reçue » et « partage interrompu ».

### Fraîcheur et réseau
- Le client et le serveur ne doivent jamais afficher « en direct » sans preuve d'une réception récente.
- Définir un seuil de fraîcheur à partir de l'intervalle réel d'émission configuré ; si plusieurs intervalles attendus sont manqués, afficher « position ancienne ».
- La fréquence d'émission doit être adaptative au réseau et à la batterie, sans promettre une cadence fixe non garantie.
- Une reconnexion ne doit pas rejouer en rafale des positions anciennes comme si elles étaient actuelles.

## 4. Mode « Protection complète »

Ce mode combine :
- le partage d'accompagnement avec durée maximale explicite ;
- l'heure estimée d'arrivée ;
- la confirmation d'arrivée ;
- le délai de grâce et les notifications « arrivée non confirmée ».

Il réutilise les mêmes paramètres de délai et de fraîcheur que les deux modes précédents. Il ne crée pas une troisième logique de retard.

**Limite ferme proposée :** un retard, une position ancienne, une perte de réseau ou une absence de confirmation ne déclenche pas automatiquement un SOS. L'auteur doit déclencher le SOS, ou utiliser séparément une fonctionnalité programmée qu'il a configurée et confirmée selon son propre contrat.

## 5. Révocation d'un proche pendant un trajet

### Proposition
- La révocation bloque immédiatement toute nouvelle transmission de position à ce proche.
- Elle ne ferme pas le trajet de l'auteur et ne révoque pas les droits des autres proches.
- Les données déjà reçues par le proche ne peuvent pas être effacées à distance.
- La révocation et l'autorisation d'émission doivent être ordonnées atomiquement côté serveur.
- Une réinvitation ultérieure ne donne aucun accès rétroactif aux positions du trajet passé.

Cette proposition doit être cohérente avec l'arbitrage séparé sur la révocation pendant une alerte SOS.

## 6. Alerte SOS dont l'auteur ne revient jamais

### Invariants à préserver
- Pas de clôture automatique présentée comme une résolution.
- Pas de clôture par un proche dans le parcours ordinaire.
- Le silence de l'auteur ou des proches ne prouve pas que le danger a cessé.
- Les rappels SOS initiaux continuent selon la règle déjà approuvée jusqu'à la clôture explicite par l'auteur.
- Une éventuelle procédure administrative exceptionnelle déjà définie pour un compte suspendu dans un scénario d'abus reste limitée à ce scénario précis ; elle ne devient pas un pouvoir général de clôture.

### Recommandation prudente
Séparer trois durées qui ne doivent pas être confondues :
1. **Durée de l'alerte :** l'alerte reste ouverte jusqu'à une clôture autorisée selon les règles applicables.
2. **Durée du partage de position :** le partage de position doit avoir une échéance propre et ne doit pas être illimité simplement parce que l'alerte reste ouverte.
3. **Durée de conservation des preuves :** les événements nécessaires à la chronologie restent soumis à une politique de conservation distincte ; les coordonnées GPS précises restent soumises à J+30 irréversible.

### Option proposée pour le partage de position
- Plafond initial proposé : **2 heures** de partage continu par alerte.
- À l'échéance, arrêter toute nouvelle collecte/transmission de position, sans clôturer l'alerte et sans arrêter les rappels SOS déjà approuvés.
- Aucune prolongation automatique.
- Une prolongation éventuelle exige une action explicite de l'auteur et une vérification de son autorisation ; si l'auteur est hors ligne ou incapable d'agir, le partage ne se prolonge pas.
- L'interface des proches indique « alerte toujours active — partage de position expiré », sans suggérer que la situation est résolue.

Cette option limite une exposition GPS prolongée tout en conservant l'alerte ouverte. Elle ne peut être retenue qu'après validation produit, revue de sécurité et preuve du mécanisme J+30.

## 7. Suppression de compte pendant un trajet ou une alerte

### Proposition de cycle
- La demande de suppression bloque les nouvelles activités : nouvelles alertes, invitations, trajets et nouveaux partages.
- Elle ne détruit pas immédiatement les éléments nécessaires à une alerte ou un trajet déjà actif.
- L'auteur conserve un accès minimal et fortement contrôlé aux seules actions nécessaires pour terminer ou clôturer ses activités en cours, selon les règles de sécurité.
- Le compte ne passe à l'état « deleted » qu'après traitement des activités en cours et des obligations de conservation applicables.
- Si l'auteur ne revient jamais, la demande reste en attente jusqu'à une procédure de secours explicitement décidée ; le système ne déduit jamais une clôture du silence.

### Point à ne pas confondre
La suspension administrative d'un compte et la demande volontaire de suppression sont deux situations différentes. Les permissions de secours approuvées pour un compte suspendu ne doivent pas être automatiquement accordées à un compte en suppression.

## 8. Résumé des valeurs proposées à arbitrer

| Sujet | Valeur proposée | Statut |
|---|---:|---|
| Délai de grâce arrivée | 10 min par défaut ; choix 5/10/15/30 min | À valider |
| Rappel à l'auteur | À l'heure estimée, puis une fois à la fin du délai de grâce | À valider |
| Notification aux proches | Une notification « arrivée non confirmée », sans relances répétées | À valider |
| Durées accompagnement | 15/30/60 min ou jusqu'à fin du trajet | À valider |
| Plafond accompagnement « jusqu'à fin » | 2 h, renouvellement manuel | À valider |
| Retard / perte réseau | Jamais de SOS automatique | Cohérent avec l'invariant existant ; confirmer la formulation dans l'interface |
| Partage GPS d'une alerte orpheline | 2 h maximum, puis arrêt du partage sans clôture de l'alerte | À valider |
| Suppression pendant activité | Blocage des nouvelles activités, accès minimal pour terminer les activités existantes | À valider |

## 9. Conditions avant toute implémentation

1. Valider les valeurs et parcours avec le propriétaire produit.
2. Définir les transitions des machines d'état trajet, partage de position, alerte et suppression.
3. Aligner les contrats TypeScript existants avant toute migration.
4. Définir les transactions D1 et les autorisations serveur pour les expirations, prolongations et révocations concurrentes.
5. Tester hors ligne, reconnexion, horloge incorrecte, changement de fuseau, batterie faible, retard, confirmation tardive, révocation pendant émission et auteur injoignable.
6. Vérifier qu'aucune tâche planifiée ne clôture ou ne déclare résolue une alerte par simple expiration.
7. Prouver la destruction GPS J+30 sur sauvegardes, restauration, exports, journaux et toutes copies avant d'activer le GPS.

**Aucune proposition de ce document n'autorise une modification du code, une migration D1, une ressource Cloudflare, un fournisseur ou un déploiement.**
