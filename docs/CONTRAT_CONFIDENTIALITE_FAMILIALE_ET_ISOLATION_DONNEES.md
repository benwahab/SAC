# SAC — Contrat de confidentialité familiale et d'isolation des données personnelles

**Date :** 18 novembre 2026  
**Statut :** consolidation des invariants existants et formalisation de garde-fous ; les choix UX et les droits détaillés proposés restent à arbitrer.  
**Portée :** vie privée entre membres d'une famille, proches de confiance, groupes privés, téléphones partagés, données de compte, alertes SOS, trajets, notifications, historique, pièces jointes et exports.  
**Nature :** documentation uniquement. Aucun contrôle d'accès, cache, chiffrement local, écran, endpoint, stockage ou mécanisme n'est activé par ce contrat.

## 1. Références à lire ensemble

- `CONTRAT_PROTECTION_DONNEES_ACCES_INTERNES_ET_AUDIT.md`
- `CONTRAT_CYCLE_VIE_PROCHES_ET_INVITATIONS.md`
- `PROPOSITIONS_ARBITRAGE_GROUPES_PRIVES.md`
- `CONTRAT_SECURITE_COMPTES_ET_APPAREILS_EN_URGENCE.md`
- `CONTRAT_SECURITE_NOTIFICATIONS_ET_COMMUNICATIONS.md`
- `CONTRAT_SECURITE_TRAJETS_ET_LOCALISATION.md`
- `CONTRAT_SECURITE_CYCLE_SOS_ET_INTEGRITE_ALERTES.md`
- `CONTRAT_CONSERVATION_ALERTES_ET_PURGE.md`
- `PROPOSITION_POLITIQUE_GENERALE_CONSERVATION_DONNEES.md`
- `MODELE_GLOBAL_DONNEES_SAC.md`

Ce document complète ces contrats et ne les remplace pas. Les invariants validés priment sur les propositions. Les éléments marqués « à arbitrer » ne sont pas des décisions approuvées.

## 2. Principe fondamental : la confiance n'est pas un accès général

Une relation familiale, une relation de confiance, une invitation acceptée, une adhésion à un groupe ou le partage d'un appareil ne confère aucun droit général sur les données d'une autre personne.

Chaque compte est une sphère privée distincte. Un membre ne peut consulter que les informations explicitement partagées avec lui pour une finalité déterminée, dans le périmètre et la durée autorisés.

En conséquence :
- un proche ne devient pas administrateur du compte ;
- un parent, conjoint, enfant adulte, frère, sœur ou responsable de groupe ne reçoit aucun privilège automatique ;
- l'organisateur d'un groupe ne peut pas consulter les comptes, alertes, trajets, contacts ou historiques privés de ses membres ;
- le titulaire d'un téléphone partagé ne peut pas consulter les données SAC d'un autre titulaire simplement parce que le terminal lui appartient ;
- l'accès d'urgence n'est jamais une porte dérobée vers le compte complet.

## 3. Invariants déjà établis

1. Chaque personne possède son compte SAC actif, avec e-mail vérifié par OTP avant activation.
2. Une relation de confiance est directionnelle : A choisit B ne signifie pas que B choisit A.
3. Une invitation en attente ne donne aucun accès. L'acceptation explicite du destinataire est obligatoire.
4. Un groupe privé organise des membres ; son appartenance ne donne aucun droit sur une alerte, un trajet, un compte ou le GPS.
5. Les destinataires d'une alerte SOS sont explicitement sélectionnés et figés au déclenchement.
6. Les droits d'alerte, accusé de réception, candidature, responsabilité principale, clôture et partage de position sont distincts ; aucun ne découle automatiquement d'un autre.
7. Aucun droit GPS ne découle du simple statut de proche.
8. Une révocation bloque les nouveaux accès et partages fondés sur la relation selon les contrats concernés ; elle n'efface pas rétroactivement les copies déjà reçues ou enregistrées sur un appareil.
9. Les accès sont vérifiés côté serveur à chaque requête. Masquer un bouton ou un écran ne constitue pas un contrôle d'accès.
10. Les données C3 sont nominatives et sensibles ; les secrets C4 ne sont jamais exposés dans les consoles ordinaires.
11. Le GPS précis reste NO-GO jusqu'à preuve de destruction irréversible et de non-résurrection.
12. Les durées générales de conservation non approuvées ne doivent pas être inventées dans une implémentation.

## 4. Sphères de données : qui possède quoi ?

| Domaine | Règle de confidentialité |
|---|---|
| Identité, e-mail, téléphone, profil | Privés au titulaire ; aucune visibilité familiale automatique |
| Mot de passe, OTP, sessions, clés et récupération | Secrets du titulaire ; jamais visibles par les proches ou le support |
| Liste de proches et invitations | Visible uniquement dans les vues autorisées du titulaire ; aucune liste globale de famille |
| Relations de confiance | Chaque partie voit les éléments nécessaires à sa relation ; aucune relation réciproque implicite |
| Groupes privés | Informations d'organisation du groupe seulement ; pas de données de compte ou d'alerte des membres |
| Alertes SOS | Accès strictement limité aux personnes incluses dans l'instantané et aux droits spécifiques de l'alerte |
| Trajets et positions | Partage ponctuel, explicite, limité aux destinataires et à la durée autorisés ; GPS réel toujours NO-GO |
| Historique | Historique personnel du titulaire ; aucun accès familial global |
| Notifications | Contenu minimal ; elles ne confèrent jamais un droit d'accès |
| Exports et téléchargements | Permission distincte, bénéficiaire et périmètre explicites ; jamais inclus implicitement dans la lecture |

Le fait d'être désigné proche ne donne pas le droit de parcourir l'historique complet de l'auteur, ses autres contacts, ses trajets antérieurs ou ses futures alertes.

## 5. Accès à une alerte : cloisonnement par dossier

L'accès à une alerte doit être calculé pour cette alerte précise, pas déduit du compte ou du lien familial.

Garde-fous :
- seuls les destinataires figés au déclenchement peuvent recevoir les communications prévues pour cette alerte ;
- une personne non incluse ne peut pas rechercher l'alerte, deviner son identifiant, voir son existence dans un compteur ou obtenir des métadonnées par erreur ;
- le droit de recevoir une notification ne vaut pas droit de consulter le dossier ;
- le droit d'accuser réception ne vaut pas droit de devenir responsable principal ;
- une candidature volontaire ne donne pas accès aux opérations réservées au responsable ;
- le statut de responsable principal ne donne pas accès au compte complet de l'auteur ;
- aucune personne ne peut modifier les destinataires historiques ou ajouter un proche après coup par simple appartenance à la famille ;
- les droits exacts sur le contenu, les pièces jointes, la chronologie et l'accès après révocation doivent être explicitement définis dans la matrice d'autorisation.

Les règles de continuité SOS déjà validées restent prioritaires : l'instantané initial demeure figé, les rappels continuent toutes les cinq minutes jusqu'à la clôture par l'auteur, et aucune révocation de relation ou d'appareil ne clôture automatiquement l'alerte. Les cas de perte de tous les appareils et de contact révoqué pendant une alerte restent soumis à leurs arbitrages dédiés.

## 6. Groupes familiaux : aucune surveillance par le propriétaire

Le groupe est une structure d'organisation, pas une hiérarchie d'accès aux données personnelles.

Règles de confidentialité à préserver :
- le propriétaire voit la liste des membres et les informations strictement nécessaires à la gestion du groupe ;
- il ne voit pas les alertes, trajets, positions, contacts, appareils, sessions ou historiques personnels des membres ;
- un membre ne voit pas les autres données privées d'un membre au motif qu'ils partagent un groupe ;
- les groupes ne deviennent pas des destinataires SOS par défaut ;
- une alerte n'est jamais diffusée à tout le groupe sans sélection explicite et autorisation correspondante ;
- quitter un groupe ne révoque pas automatiquement une relation de confiance distincte ; réciproquement, révoquer un proche ne doit pas être interprété comme quitter un groupe ;
- le transfert de propriété d'un groupe ne transfère aucun droit sur les comptes ou données personnelles des membres ;
- les notifications de groupe ne révèlent pas l'existence d'une alerte privée.

Le cycle de vie des groupes reste une proposition distincte. Les limites, invitations, rôles, transferts, visibilité avant acceptation et durées de conservation doivent être arbitrés avant modèle D1.

## 7. Téléphones familiaux ou partagés

SAC ne doit jamais considérer qu'un téléphone, une tablette, une adresse IP, une carte SIM ou un foyer correspond à une seule personne.

### 7.1 Isolation des comptes

Propositions techniques à intégrer à la conception :
- toutes les données locales, caches, fichiers temporaires, états de navigation et clés de stockage sont cloisonnés par compte ET par appareil ;
- à la déconnexion ou au changement de compte, l'application détruit les données privées temporaires du compte précédent avant d'afficher le suivant ;
- aucun écran ne préremplit le nom, l'e-mail, la photo ou l'état SOS du compte précédent sur un écran de connexion partagé ;
- aucun historique privé n'est affiché sur l'écran d'accueil sans authentification ;
- le sélecteur de compte, les notifications et les aperçus d'applications n'exposent pas de contenu privé ;
- le changement de compte ne transfère ni session, ni autorisation, ni cache, ni clé entre personnes ;
- les fichiers téléchargés et captures d'écran déjà enregistrés hors du contrôle de SAC ne peuvent pas être effacés à distance ; SAC doit limiter leur création et avertir l'utilisateur.

### 7.2 Verrouillage et absence

Proposition UX à arbitrer :
- verrouiller rapidement les écrans privés après passage en arrière-plan ou période d'inactivité ;
- demander une réauthentification pour rouvrir les informations les plus sensibles ;
- ne pas afficher de contenu d'alerte sur l'écran verrouillé du téléphone ;
- permettre une déconnexion claire de chaque compte, sans bouton ambigu « quitter la famille » ;
- expliquer qu'une déconnexion SAC ne verrouille pas le téléphone et n'efface pas les copies exportées.

Aucun délai de verrouillage n'est fixé ici. Les valeurs doivent être testées sur Android à faible mémoire et réseau faible, sans rendre le déclenchement SOS inutilement difficile.

### 7.3 Limite de sécurité incontournable

Si deux personnes utilisent le même profil Android, connaissent le code de déverrouillage du téléphone ou partagent le même compte système, SAC ne peut pas garantir une séparation physique absolue. La sécurité doit être expliquée honnêtement : compte SAC distinct, mot de passe non partagé, verrouillage de l'appareil et absence de partage volontaire des sessions sont nécessaires.

## 8. Notifications et aperçus visibles par la famille

Les notifications push, e-mails et futurs SMS doivent respecter le principe de divulgation minimale.

Par défaut, sur l'écran verrouillé :
- ne pas afficher le nom d'un proche, le détail d'une alerte, une description, une adresse, une position, une catégorie sensible ou une liste de destinataires ;
- utiliser un message neutre qui ne révèle pas la nature de l'événement ;
- ne pas inclure de lien donnant accès au dossier sans authentification et contrôle d'autorisation serveur ;
- ne pas révéler à un autre membre de la famille qu'un compte a reçu une alerte ou une invitation ;
- ne pas considérer la livraison d'une notification comme une preuve de lecture ou de consentement.

Les préférences de confidentialité des aperçus doivent être conçues sans affaiblir les exigences d'envoi SOS déjà validées. Aucun canal réel ou fournisseur n'est activé par ce contrat.

## 9. Recherche, listes, compteurs et métadonnées

Une fuite peut survenir sans afficher le contenu d'une alerte. Les interfaces et API doivent donc empêcher :
- les recherches de comptes ou d'alertes hors périmètre ;
- les suggestions automatiques révélant les contacts privés d'un autre compte ;
- les compteurs du type « 1 alerte en cours » visibles à un membre non autorisé ;
- les noms de fichiers, miniatures, URL ou métadonnées révélant une catégorie sensible ;
- les résultats d'erreur distinguant « ressource existante mais interdite » de « ressource inexistante » lorsque cela permet l'énumération ;
- les statistiques de groupe trop précises permettant d'identifier un membre ;
- les caches partagés entre sessions ou comptes.

Les contrôles doivent s'appliquer aux requêtes, filtres, facettes, recherches, exports, téléchargements, pièces jointes et aperçus, pas seulement à la page principale.

## 10. Révocation, séparation et copies déjà reçues

La révocation d'une relation, le retrait d'un groupe, la révocation d'un appareil et la déconnexion sont quatre opérations différentes.

- Révoquer une relation bloque les nouveaux droits fondés sur cette relation selon le contrat dédié.
- Quitter un groupe ne révoque pas une relation de confiance distincte.
- Révoquer un appareil invalide ses sessions côté serveur, sans effacer à distance les fichiers déjà copiés hors ligne.
- Se déconnecter met fin à la session courante, sans supprimer le compte.
- Aucune de ces opérations ne clôture automatiquement un SOS.
- Une révocation ne peut pas annuler une capture d'écran, une photo d'écran ou une copie déjà sortie des systèmes SAC.

SAC doit éviter les exports et copies superflus, afficher leur portée avant autorisation et ne jamais promettre un effacement à distance impossible.

## 11. Accès exceptionnel et urgence

Une situation d'urgence ne crée pas automatiquement un accès familial étendu.

- Un proche n'obtient pas le mot de passe, la session, les clés, les appareils ou la racine cryptographique du titulaire.
- Le Super Admin n'est pas un administrateur universel des données personnelles.
- Le support ne peut pas ouvrir un compte, contourner un verrou ou reconstruire une identité cryptographique.
- Aucun mode « urgence familiale » ou « parent/tuteur » ne doit être créé sans périmètre, preuve d'autorité, finalité, durée, journalisation et revue indépendante.
- Le droit exceptionnel déjà prévu dans le contrat de suppression/suspension reste limité à son cas précis et ne devient pas un accès général au compte.

Les cas d'un mineur, d'une personne dépendante, d'une tutelle ou d'une incapacité à consentir ne sont pas définis par le présent contrat. Ne pas inventer de statut légal ni accorder automatiquement un accès à un parent ou accompagnant. Ils nécessitent une analyse produit, sécurité et juridique distincte avant toute fonctionnalité.

## 12. Données locales, sauvegardes et conservation

- Les données personnelles ne doivent pas être écrites dans des caches ou journaux partagés entre comptes.
- Les secrets C4 ne sont jamais enregistrés en clair dans les journaux, exports ou diagnostics.
- Les données GPS précises restent NO-GO tant que la destruction irréversible et la non-résurrection ne sont pas démontrées.
- Pour une alerte clôturée, les positions GPS associées sont supprimées immédiatement ; seule la nature/catégorie demeure 30 jours ; puis l'entrée entière est supprimée définitivement à J+30, sans résurrection après restauration.
- Aucune durée de conservation générale supplémentaire n'est créée ici. La politique générale hors GPS reste à arbitrer.
- Les sauvegardes et restaurations doivent préserver les suppressions, révocations et expirations ; une restauration ne doit pas réintroduire un accès révoqué.
- La sécurité locale Android/iOS et l'isolation de profils doivent être testées séparément ; une exclusion de sauvegarde n'est pas une preuve de suppression irréversible.

## 13. Tests d'acceptation indispensables

1. Un proche ne peut lire aucun profil privé sans permission spécifique.
2. Une relation directionnelle n'accorde aucun accès réciproque.
3. Une invitation en attente ne révèle aucune alerte, aucun trajet et aucun historique.
4. Un membre d'un groupe ne peut lire les données privées des autres membres.
5. Le propriétaire d'un groupe ne peut pas consulter les alertes, contacts, appareils ou positions des membres.
6. Une appartenance de groupe n'ajoute jamais un destinataire SOS automatiquement.
7. Un destinataire d'une alerte ne peut pas consulter les autres alertes de l'auteur.
8. Un accusé de réception ne donne pas le droit de clôturer.
9. Un responsable principal ne peut pas accéder au compte complet de l'auteur.
10. Une personne non destinataire ne peut pas deviner l'existence d'une alerte via recherche, compteur, erreur ou métadonnée.
11. Les pièces jointes sont contrôlées individuellement côté serveur.
12. Les exports exigent une permission distincte et un périmètre explicite.
13. Une notification sur écran verrouillé ne révèle aucune donnée sensible.
14. Le lien d'une notification ne contourne jamais l'authentification.
15. Deux comptes sur le même téléphone ne partagent ni cache, ni fichier temporaire, ni session, ni clé.
16. Après déconnexion, le compte suivant ne voit aucun aperçu du compte précédent.
17. Le retour de l'application depuis l'arrière-plan respecte le verrouillage retenu.
18. Un changement de compte ne conserve aucun état SOS privé de l'utilisateur précédent.
19. Une révocation bloque les nouveaux accès côté serveur sans promettre d'effacer les copies déjà reçues.
20. La sortie d'un groupe n'altère pas une relation de confiance indépendante.
21. La révocation d'une relation n'est pas assimilée à une suppression de compte ou à une clôture SOS.
22. Les caches, recherches, compteurs, miniatures et erreurs ne permettent pas l'énumération inter-comptes.
23. Une restauration ne réactive ni session, ni appareil, ni relation ou permission révoquée.
24. Les parcours PWA et Android natif/Capacitor sont testés séparément sur appareils partagés.
25. Les tests vérifient les accès autorisés et refusés pour chaque type d'acteur et chaque ressource.

## 14. Arbitrages restant ouverts

- matrice exacte des champs visibles par l'auteur, chaque destinataire et le responsable principal ;
- contenu autorisé des notifications et préférences d'aperçu sur écran verrouillé ;
- verrouillage après arrière-plan/inactivité et réauthentification sensible ;
- stratégie de cache local et stockage chiffré par compte/appareil ;
- règles de téléchargement, capture, export et pièces jointes ;
- droits après révocation pendant une alerte active ;
- confidentialité des groupes, limites, rôles et visibilité avant acceptation ;
- parcours pour mineurs, tutelle et personnes dépendantes ;
- politique de conservation hors GPS ;
- mécanisme indépendant de contrôle des accès privilégiés et audit.

Aucun délai, nouveau rôle, accès familial, droit d'export ou mécanisme de contrôle parental n'est approuvé ici.

## 15. Conditions avant implémentation

Aucune fonctionnalité de partage familial, d'accès aux données d'un membre, de verrouillage local, de cache partagé, d'export ou de notification détaillée ne doit être activée avant :
1. validation de la matrice acteur × ressource × action × finalité ;
2. cohérence avec les contrats de proches, groupes, SOS, trajets, comptes et appareils ;
3. conception de l'isolation par compte et appareil pour PWA et Android ;
4. tests d'accès inter-comptes, de restauration, de révocation et d'appareils partagés ;
5. revue indépendante sécurité/confidentialité ;
6. arbitrage juridique distinct pour mineurs, tutelle et dépendance ;
7. autorisation explicite distincte pour code, D1, stockage, notification, fournisseur ou déploiement.

**Conclusion :** dans SAC, être de la même famille ne signifie pas partager un compte. Être un proche de confiance ne signifie pas tout voir. Le partage est ciblé, explicite, limité et révocable ; le compte personnel reste privé.
