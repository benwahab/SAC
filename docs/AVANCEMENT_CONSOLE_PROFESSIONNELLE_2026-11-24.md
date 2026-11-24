# SAC — Avancement de la console professionnelle

**Date :** 24 novembre 2026  
**Dépôt :** benwahab/SAC — branche main  
**Statut général :** développement progressif ; aucun déploiement de production effectué.

## Navigation et accès

La console Super Admin conserve les onze rubriques validées : Vue d'ensemble, Utilisateurs, Alertes, Finances, Assistance, Sécurité, Équipe et missions, Relations externes, Ressources, Pilotage et Paramètres. L'accès reste réservé au rôle Super Admin pour les vues globales ; les collaborateurs restent limités par leurs missions. L'interface est conçue pour ordinateur/tablette, dans l'identité vert clair et verre dépoli de SAC, avec traductions fr/en/ar.

## Fonctions implémentées dans le code

- **Vue d'ensemble :** six indicateurs réels agrégés via GET /api/admin/overview : comptes actifs, alertes actives, alertes des dernières 24 h, missions actives, délégués actifs et événements d'audit sur 24 h.
- **Utilisateurs :** répertoire en lecture seule des comptes actifs ayant une adresse e-mail principale vérifiée, alimenté par GET /api/admin/accounts et limité à 25 résultats.
- **Alertes :** supervision agrégée réservée au Super Admin via GET /api/admin/alerts : volumes actifs, créations et clôtures sur 24 h, répartitions par niveau/catégorie, réponses enregistrées et responsables actuels. Aucun nom, e-mail, message privé, identifiant citoyen, destinataire ou GPS n'est renvoyé.
- **Sécurité :** consultation du journal d'audit et export CSV protégé.
- **Équipe et missions :** fonctions existantes de création, modification, suspension, reprise et révocation des missions, avec permissions explicites et échéances.
- **Assistance :** premier flux de tickets dans le code. Les comptes connectés peuvent créer et consulter leurs tickets et répondre. La console Super Admin affiche les compteurs, la file, les détails, les échanges, permet de répondre et de changer les statuts avec contrôle de version. Les actions administratives sont journalisées. Le dépôt de demandes « accès au compte » sans session est possible après OTP e-mail ; ce flux ne réinitialise pas le mot de passe et ne réactive pas le compte. Les migrations 0021 et 0022 sont dans le dépôt, avec tests de schéma dédiés ; elles ne sont pas appliquées à la D1 distante.
- **Finances :** conception du modèle comptable, budgets, trésorerie, factures, paiements, partie double, approbations, permissions et contrôles documentée dans docs/CONCEPTION_FINANCES_COMPTABILITE_TRESORERIE_2026-11-24.md. La rubrique affiche l'état de conception sans inventer de soldes. Aucune table financière ni opération de paiement n'est activée.
- **Relations externes :** conception des partenaires, contacts, conventions, avenants, correspondances, échéances, permissions et confidentialité documentée dans `docs/CONCEPTION_RELATIONS_EXTERNES_PARTENAIRES_CONVENTIONS_2026-11-24.md`. Aucun partenaire fictif n’est affiché.
- **Ressources :** conception RH, logistique, stocks, équipements, maintenance et service documentaire commun documentée dans `docs/CONCEPTION_RESSOURCES_RH_LOGISTIQUE_DOCUMENTS_2026-11-24.md`. Les documents générés et imprimés devront être archivés avec référence, date, auteur, version et statut. Aucun registre fictif n’est affiché.
- **Pilotage :** conception des objectifs, KPI, projets, risques, décisions et rapports de direction documentée dans `docs/CONCEPTION_PILOTAGE_KPI_PROJETS_RAPPORTS_2026-11-24.md`. Les mesures devront provenir des modules sources, avec fraîcheur et état de validation ; aucune valeur fictive n’est affichée.
- **Paramètres :** conception de la gouvernance des réglages, langues, intégrations, fonctions, secrets Cloudflare, versions et maintenance documentée dans `docs/CONCEPTION_PARAMETRES_CONFIGURATION_INTEGRATIONS_2026-11-24.md`. Aucun secret n’est exposé et aucune activation globale n’est disponible depuis l’interface.

## Rubriques restantes

Les onze rubriques disposent maintenant d’un état dédié dans le dashboard. Relations externes, Ressources, Pilotage et Paramètres ont une conception documentée ; leurs registres et workflows métier restent à développer. Finances est également au stade de conception. Les services RH, logistique, documents, secrétariat, tâches, messagerie et calendrier doivent être harmonisés avec le modèle commun avant leur activation. La présence d'une entrée de navigation ne vaut pas livraison du module.

## Sécurité et données

- Les contrôles d'accès sont côté serveur ; le masquage UI seul n'est pas considéré comme une autorisation.
- Les données SOS privées et GPS précis sont exclus des vues générales de support et de direction.
- Les tickets et messages sont liés à un compte actif, les messages et événements de support sont append-only ; la création de tickets est limitée à cinq par compte et par heure au niveau D1.
- Le flux OTP sans session utilise un usage HMAC distinct, six tentatives, expiration de dix minutes, délais et limites par e-mail/IP, invalidation du code précédent et liaison à un seul ticket pour éviter le rejeu.
- Les montants financiers futurs devront utiliser une représentation exacte, une devise explicite, la partie double, des journaux immuables et une séparation des tâches.
- Aucune migration distante, aucun paiement réel et aucun déploiement de production ne sont réalisés sans autorisation explicite.

## Suite du développement

1. Finaliser les tests CI et la revue des flux Assistance ; préparer la migration locale 0021/0022 sans l'appliquer à la D1 distante.
2. Définir et implémenter les missions Support et leurs permissions serveur, notifications, conservation et réponses par e-mail.
3. Compléter la Vue d'ensemble avec des états de santé mesurés et tendances historiques contrôlées.
4. Construire Relations externes et Ressources, y compris RH et logistique cloisonnées.
5. Développer les services communs : documents/archivage, secrétariat, messagerie, tâches, réunions et calendrier.
6. Construire Pilotage à partir des sources de vérité existantes, sans ressaisie ni duplication.
7. Définir Paramètres, configuration et gestion des fournisseurs.
8. Pour chaque lot : schéma D1 harmonisé, migration locale isolée, API protégées, tests d'accès et de métier, interface, audit et vérification du déploiement.

## Validation

Les exécutions GitHub Actions des derniers commits Assistance sont en cours ou en attente au moment de cette mise à jour. Les exécutions antérieures ont signalé des erreurs TypeScript qui ont été corrigées dans les commits ultérieurs ; la validation du commit le plus récent doit encore être confirmée. Aucun succès CI final n'est revendiqué.
