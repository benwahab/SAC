# SAC — Contrat de sécurité des trajets et de la localisation

**Date :** 18 novembre 2026  
**Statut :** consolidation des invariants existants et des exigences de sécurité ; les paramètres nouveaux restent des propositions à arbitrer.  
**Portée :** vérification d'arrivée, accompagnement, protection complète, partage de position, fraîcheur, révocation, réseau faible et cycle de vie des données de trajet.  
**Nature :** documentation uniquement. Aucun GPS réel, permission terminal, collecte, stockage, API, fournisseur ou partage n'est activé par ce contrat.

## 1. Références et priorité

À lire avec :
- `PROPOSITIONS_ARBITRAGE_TRAJETS_ET_ALERTES_ORPHELINES.md` ;
- `CONTRAT_CONSERVATION_ALERTES_ET_PURGE.md` ;
- `PLAN_VALIDATION_DESTRUCTION_GPS_J30.md` ;
- `SECURITE_GPS_DESTRUCTION_CRYPTO.md` ;
- `CONTRAT_SECURITE_CYCLE_SOS_ET_INTEGRITE_ALERTES.md` ;
- `CONTRAT_SECURITE_NOTIFICATIONS_ET_COMMUNICATIONS.md` ;
- `CONTRAT_PROTECTION_DONNEES_ACCES_INTERNES_ET_AUDIT.md` ;
- `CONTRAT_CYCLE_VIE_PROCHES_ET_INVITATIONS.md` ;
- `PROPOSITION_POLITIQUE_GENERALE_CONSERVATION_DONNEES.md`.

Les décisions produit approuvées et le contrat spécialisé de conservation des alertes/GPS prévalent. Ce contrat ne valide aucune valeur de la proposition trajets.

## 2. Invariants et limites déjà établis

1. SAC est un outil privé de sécurité personnelle/familiale, pas un dispositif de surveillance continue ni un service public de secours.
2. Les trois modes de protection sont distincts : vérification d'arrivée, accompagnement et protection complète.
3. Une absence de confirmation d'arrivée, un retard, une perte de réseau ou une position ancienne ne déclenche pas automatiquement un SOS.
4. Un SOS reste indépendant de la disponibilité GPS. L'absence de localisation ne doit jamais empêcher sa création.
5. Un partage de position exige une autorisation explicite et ne découle ni d'une relation de confiance, ni d'un groupe, ni d'une invitation, ni d'une alerte en cours.
6. Les proches autorisés sont sélectionnés explicitement. Les droits d'un proche ne s'étendent pas aux autres membres d'un groupe ou aux proches de ce proche.
7. La révocation d'une relation de confiance doit empêcher les nouveaux partages ; les effets sur une alerte déjà active restent soumis au contrat SOS et aux arbitrages dédiés.
8. Le silence, une panne, une déconnexion, une session expirée ou l'expiration d'un partage ne prouvent jamais que la personne est arrivée ou hors de danger.
9. Le système ne doit jamais présenter une dernière position connue comme une position actuelle.
10. Le GPS réel reste NO-GO tant que la suppression irréversible et la non-résurrection exigées ne sont pas démontrées sur toutes les plateformes et copies contrôlées par SAC.
11. Pour les positions GPS associées à une alerte SOS : suppression immédiate à la clôture ; seule la catégorie/nature de l'alerte reste 30 jours ; purge définitive de l'entrée à J+30, sans restauration possible.
12. La règle de rétention GPS de l'alerte ne définit pas la durée de conservation des positions de trajet. Cette durée reste à arbitrer ; aucune durée ne doit être inventée ou déduite.

## 3. Modèle de menace spécifique aux trajets

Couvrir au minimum :
- un compte ou terminal compromis, prêté ou partagé ;
- un proche qui tente d'accéder à un trajet sans avoir été sélectionné ;
- un ancien proche révoqué qui réutilise une ancienne URL, session ou notification ;
- un identifiant de trajet deviné, énuméré ou obtenu depuis un lien ;
- une application qui continue la collecte après arrêt, révocation ou expiration ;
- une position ancienne présentée comme actuelle après perte de réseau ;
- une horloge locale manipulée pour prolonger un partage ou antidater une position ;
- des positions rejouées ou réordonnées après reconnexion ;
- des coordonnées qui fuitent dans logs, analytics, crash reports, notifications, caches, exports ou sauvegardes ;
- une tâche serveur concurrente avec l'arrêt, l'expiration, la révocation ou la suppression du compte ;
- une restauration qui réactive un ancien droit ou fait réapparaître une position supprimée ;
- une utilisation coercitive : un proche exige un partage permanent, détourne un appareil ou utilise l'historique pour surveiller une personne.

## 4. Consentement et contrôle du partage

Le partage doit être inactif par défaut. Avant son activation, l'interface doit indiquer clairement :
- le mode de protection choisi ;
- les proches destinataires, nommément ;
- les données partagées (position, heure de réception, état de fraîcheur) ;
- le moment de début et la durée/échéance ;
- les conditions d'arrêt automatique et d'arrêt manuel ;
- ce qui se passe si le réseau ou le GPS devient indisponible ;
- la limite : les copies déjà vues ou enregistrées par un destinataire hors SAC ne peuvent pas être effacées à distance.

Le consentement est une action explicite, spécifique au trajet et révocable. Aucun consentement général permanent ne doit être déduit de l'inscription, de l'acceptation d'une invitation, d'une relation de confiance, d'une préférence de catégorie ou d'un trajet précédent.

Le partage ne doit pas être activé automatiquement au démarrage de l'application, à la connexion, à l'entrée dans une zone, à la réception d'une notification ou à la création d'un groupe. Le renouvellement ou la prolongation doit être une nouvelle action consciente si cette option est ultérieurement approuvée.

Prévoir une commande d'arrêt clairement accessible pendant le trajet. L'arrêt doit être confirmé par le serveur lorsque la connexion existe ; hors ligne, l'interface indique honnêtement que la demande d'arrêt attend sa confirmation et prend localement les mesures de réduction possibles sans prétendre que le serveur a déjà révoqué l'accès.

## 5. Séparation des trois modes

### 5.1 Vérification d'arrivée

Ce mode porte d'abord sur une échéance et une confirmation volontaire d'arrivée. Il n'exige pas nécessairement un partage GPS continu.

Le parcours proposé dans le document d'arbitrage prévoit destination, heure estimée, rappel au titulaire, délai de grâce et message factuel « arrivée non confirmée ». Les valeurs numériques, le nombre de rappels et le contenu des notifications restent non approuvés.

Exigences de sécurité :
- destination et heure visibles uniquement par le titulaire et les proches expressément sélectionnés ;
- pas de recherche publique d'une destination ou d'un trajet ;
- une échéance dépassée ne vaut ni SOS ni preuve d'incident ;
- une confirmation tardive est horodatée par le serveur et ne réécrit pas les événements précédents ;
- ne pas demander le GPS si le mode peut fonctionner avec une destination déclarée et une confirmation manuelle.

### 5.2 Accompagnement

Ce mode peut inclure un partage temporaire de position, uniquement si le titulaire l'a explicitement activé et si le verrou GPS global est levé.

Exigences :
- liste des destinataires figée au début du partage ;
- accès serveur vérifié à chaque lecture et chaque livraison ;
- affichage de l'heure de dernière réception et de la fraîcheur réelle ;
- aucun affichage « en direct » sans preuve récente de réception ;
- arrêt à l'échéance ou à la révocation ; pas de prolongation implicite ;
- pas de rejeu en rafale d'anciennes positions après reconnexion ;
- aucune donnée d'un trajet passé accessible par une nouvelle relation de confiance.

Les durées 15/30/60 minutes, l'option « jusqu'à la fin » et son plafond de deux heures sont des propositions existantes, pas des décisions validées.

### 5.3 Protection complète

Ce mode combine les mécanismes d'arrivée et d'accompagnement, mais ne doit pas créer une logique de sécurité distincte ou un déclenchement automatique de SOS.

Il réutilise les contrôles et limites des deux modes. L'absence de confirmation, un retard, un GPS indisponible ou une perte de réseau n'entraîne jamais une alerte SOS automatique.

## 6. Autorisation, destinataires et révocation

À la création du trajet, le serveur doit vérifier l'identité, le compte, la session, l'appareil et l'éligibilité de chaque destinataire. Il ne fait pas confiance à la liste fournie par le client sans revalidation.

Le partage doit être lié à :
- un identifiant de trajet opaque ;
- un compte auteur et un appareil actif ;
- un instantané explicite des destinataires ;
- un consentement/version de paramètres ;
- une échéance serveur ;
- un état de partage et une version de révocation.

À chaque lecture, le serveur vérifie l'autorisation actuelle, l'appartenance à l'instantané, l'état du trajet et du partage, la relation applicable et la non-révocation. Un identifiant ou un ancien lien ne suffit jamais.

La révocation doit être atomiquement ordonnée avec les tâches d'émission :
- aucune nouvelle position ne doit être envoyée au proche révoqué après le point de révocation effectif ;
- les tâches en attente sont neutralisées ;
- les envois en vol sont traités selon un protocole de course explicite et auditable ;
- les autres proches explicitement autorisés ne sont pas affectés ;
- le trajet de l'auteur n'est pas automatiquement clôturé ;
- une nouvelle invitation ne donne aucun accès rétroactif.

La révocation d'un appareil invalide les sessions et capacités de partage associées à cet appareil. Elle ne doit pas réactiver les données locales d'un appareil révoqué à la reconnexion.

Les effets d'une révocation de relation pendant une alerte SOS active restent régis par les contrats SOS et les propositions d'arbitrage correspondantes ; ne pas transposer automatiquement les règles de trajet à l'alerte.

## 7. Fraîcheur, horodatage et réseau faible

Chaque position, si la collecte est ultérieurement autorisée, doit porter un horodatage de réception serveur et un identifiant/numéro de séquence empêchant le rejeu. L'heure du terminal est informative, jamais l'autorité de chronologie.

États d'affichage à distinguer :
- partage non démarré ;
- attente de confirmation serveur ;
- position reçue récemment ;
- dernière position connue (avec heure explicite) ;
- position ancienne ;
- GPS indisponible ;
- réseau indisponible ;
- partage arrêté ;
- partage expiré ;
- accès révoqué.

Les seuils numériques de fraîcheur restent à définir et ne sont pas approuvés. Ne pas afficher de cercle, flèche, vitesse ou animation laissant croire à une position actuelle si les données sont anciennes.

Après reconnexion :
- ne pas transmettre un historique accumulé comme un flux en direct ;
- ne pas antidater les événements métier ;
- n'envoyer que les commandes encore valides, idempotentes et non expirées ;
- invalider les positions dont la finalité/autorisation a expiré ;
- afficher le statut réel de la dernière réception serveur.

Si le GPS ou le réseau ne fonctionne pas, le trajet peut rester actif sans localisation ; l'utilisateur doit voir une explication claire. Aucun écran ne doit inventer une position ou déduire la sécurité de l'utilisateur d'un silence réseau.

## 8. Durée, arrêt et cycle de vie des données

Il faut distinguer :
1. la durée du trajet métier ;
2. la durée du partage de position ;
3. la durée de disponibilité d'une position pour un destinataire ;
4. la durée de conservation des événements non géographiques ;
5. la durée de conservation des coordonnées GPS précises.

Ces durées ne sont pas interchangeables. Le partage doit avoir une échéance indépendante du trajet et ne doit jamais être illimité par défaut. Les paramètres exacts restent à arbitrer.

À la fin du trajet, à l'arrêt manuel, à l'expiration, à la révocation ou à la suppression du compte, toute nouvelle collecte et transmission doit cesser selon une transition serveur atomique. L'état métier ne doit pas être déclaré terminé avant que les droits de partage soient effectivement coupés.

**Règle GPS J+30 :** le contrat validé des alertes impose suppression immédiate à la clôture de toutes les positions GPS qui leur sont associées, puis conservation de la seule catégorie pendant 30 jours et purge de l'alerte à J+30. Cette règle ne doit pas être affaiblie par des copies dans le trajet, les notifications, journaux ou caches.

**Trajets :** aucune durée de conservation de positions GPS de trajet n'est validée dans les documents consultés. Aucune position de trajet ne peut être stockée en historique ou conservée après le partage sans un arbitrage séparé, une architecture de destruction vérifiable et une preuve de non-résurrection. Tant que ce point et le verrou global J+30 ne sont pas résolus, GPS réel NO-GO.

Les données déjà consultées ou enregistrées hors SAC par un proche ne peuvent pas être effacées à distance. SAC doit réduire les possibilités d'export et avertir clairement de cette limite.

## 9. Alertes orphelines et suppression de compte

Une alerte SOS ne se clôture pas automatiquement parce que le partage GPS du trajet ou de l'alerte expire. Les rappels SOS continuent selon les règles validées jusqu'à la clôture autorisée par l'auteur, même si le partage de position s'est arrêté.

La proposition d'un plafond de deux heures pour le partage GPS d'une alerte orpheline reste non approuvée. Elle ne doit pas être implémentée ou présentée comme une règle.

Une demande de suppression de compte pendant un trajet ou une alerte doit suivre le contrat de suppression du compte et les arbitrages spécifiques. Elle ne donne pas le droit de clôturer automatiquement une activité, de prolonger un partage ou de conserver du GPS sans limite.

## 10. Journaux et données dérivées

Ne jamais enregistrer les coordonnées GPS précises, destinations libres, itinéraires ou positions dans :
- logs applicatifs, traces, analytics et crash reports ;
- titres, corps ou métadonnées de notifications ;
- URL, paramètres de requête, noms de fichiers et identifiants lisibles ;
- journaux de support ou consoles administratives ordinaires ;
- copies de debug, captures ou rapports de diagnostic.

Les événements techniques doivent se limiter à des identifiants pseudonymisés, horodatages serveur, codes de résultat et références de corrélation minimales. Une empreinte ou un géohash dérivé peut rester une donnée de localisation ; il ne constitue pas une anonymisation automatique.

Les durées de conservation des métadonnées de trajet, événements et traces restent à arbitrer dans la politique générale. Ne pas copier une coordonnée dans un journal « pour preuve » ni conserver une position sous forme transformée pour contourner la purge.

## 11. Tests obligatoires avant tout GO

1. Aucun trajet ne démarre un partage GPS sans consentement explicite.
2. Aucun groupe ou relation seule n'accorde un droit de localisation.
3. Un proche non sélectionné ne peut consulter un trajet, même avec un identifiant deviné.
4. Une révocation bloque les nouvelles lectures et émissions après le point de bascule serveur.
5. Une révocation concurrente à une émission a un résultat déterministe et auditable.
6. L'arrêt et l'expiration sont idempotents et résistent à deux requêtes concurrentes.
7. Un appareil révoqué ne peut reprendre le partage ni réactiver un abonnement.
8. Une position ancienne n'est jamais affichée comme actuelle.
9. Une horloge locale manipulée ne prolonge pas le partage et ne modifie pas l'ordre serveur.
10. Une reconnexion ne rejoue pas les anciennes positions comme un flux temps réel.
11. Les états réseau/GPS indisponibles sont distincts de l'état « arrivée confirmée ».
12. Aucun retard ou absence de confirmation ne déclenche un SOS.
13. Les notifications n'incluent ni coordonnées, ni adresse, ni itinéraire.
14. Les logs, analytics, traces, crash reports et supports ne contiennent aucune coordonnée.
15. Aucun endpoint ou identifiant de trajet ne contourne l'authentification.
16. Les exports et sauvegardes ne recréent pas une position supprimée.
17. La suppression du compte ou la révocation ne réactive aucun partage après restauration.
18. Les positions GPS liées à une alerte sont supprimées immédiatement à la clôture.
19. L'entrée d'alerte et sa catégorie disparaissent à J+30 sans restauration possible.
20. Les positions de trajet ne sont pas conservées au-delà de la durée expressément approuvée.
21. Une panne de tâche de purge bloque le GO et déclenche une alerte technique sans réexposer les données.
22. Les tests sont répétés sur toutes les plateformes/configurations réellement supportées.

Tout test critique non exécuté, non testable ou échoué maintient le NO-GO.

## 12. Arbitrages restant ouverts

- valeurs et parcours précis des délais de vérification d'arrivée ;
- durées d'accompagnement et plafond d'un partage ;
- seuils de fraîcheur et cadence adaptative ;
- comportement d'arrêt en mode hors ligne et confirmation serveur ;
- preuve de consentement et version des paramètres ;
- politique de conservation des données de trajet, en particulier GPS ;
- traitement des demandes de suppression pendant un trajet ;
- durée/portée d'un partage lié à une alerte orpheline ;
- droits après révocation pendant une alerte active ;
- restrictions d'export et information sur les copies externes ;
- mécanisme technique et preuve indépendante de destruction/non-résurrection J+30.

Les nombres déjà présents dans le document de propositions trajets (5/10/15/30 minutes, 15/30/60 minutes, 2 heures) restent des propositions et ne deviennent pas des décisions par leur reprise ici.

## 13. Conditions avant implémentation

Aucun GPS réel ou partage de position ne doit être activé avant :
1. arbitrage explicite des paramètres produit et de la politique de conservation ;
2. résolution du NO-GO GPS J+30 et preuve de non-résurrection après sauvegardes/restaurations ;
3. revue indépendante cryptographique, sécurité et confidentialité ;
4. autorisations serveur, révocations atomiques, anti-rejeu et état de fraîcheur spécifiés ;
5. tests hors ligne, reconnexion, horloge, batterie, multi-appareils, révocation et suppression réussis ;
6. validation juridique applicable aux pays de lancement et aux pays des destinataires ;
7. autorisation distincte pour toute modification de code, permission terminal, API, D1, stockage, fournisseur, ressource Cloudflare ou déploiement.

**Conclusion :** la localisation est une capacité sensible, ponctuelle et contrôlée par le titulaire. Elle ne doit jamais devenir une surveillance par défaut. Tant que les garanties de suppression et de non-résurrection ne sont pas prouvées, SAC doit rester sans collecte GPS réelle.
