# Instructions communes aux agents IA — SAC

Tu interviens sur **SAC — Sécurité, Alerte, Citoyenne**, application privée de sécurité personnelle et familiale. Ce projet n'est pas PCS et ne doit jamais devenir une plateforme publique de signalement.

## Lecture obligatoire
Avant toute tâche, lis :
1. `README.md`
2. `ARCHITECTURE.md`
3. `TODO_SUPERVISION.md`
4. `docs/CAHIER_DES_CHARGES_SAC.md`
5. `docs/ARCHITECTURE_ET_MODELE_DONNEES.md`
6. `docs/CONSIGNES_DE_TRAVAIL.md`
7. `docs/DECISIONS_ET_POINTS_A_VALIDER.md`
8. `docs/CLOUDFLARE_GITHUB_DEPLOYMENT.md`
9. `docs/DECISIONS_PRODUIT_RESTANTES.md`
10. `docs/PLAN_VALIDATION_DESTRUCTION_GPS_J30.md`
11. `docs/SECURITE_GPS_DESTRUCTION_CRYPTO.md`
12. `docs/MISE_A_JOUR_JURIDIQUE_NIGER_NOV_2026.md`
13. `docs/CONFORMITE_DONNEES_NIGER.md`
14. `docs/AUDIT_DEPENDANCES_ET_REPRODUCTIBILITE.md`
15. `docs/CONSOLIDATION_GENERALE_SAC.md`
16. `docs/DECISIONS_COMPLEMENTAIRES_2026-11-18.md`
17. `docs/CONSOLE_PROFESSIONNELLE_ET_SERVICES.md`
18. `docs/PLAN_DIRECTEUR_REALISATION_SAC.md`
19. `docs/ANNEXE_MODELE_DONNEES_SERVICES_PROFESSIONNELS.md`
20. `docs/AUDIT_ETAT_REEL_CODE_2026-11-18.md`
21. `docs/PLAN_SOCLE_COMPTE_SESSIONS_APPAREILS.md`
22. `docs/ARBITRAGES_TECHNIQUES_COMPTES_OTP_SESSIONS.md`

Avant toute intervention, lis aussi les cinq documents de consolidation ajoutés à la liste obligatoire, dont l'audit de l'état réel du code. Pour les sujets qu'il couvre, `docs/DECISIONS_COMPLEMENTAIRES_2026-11-18.md` remplace les anciennes formulations relatives à l'identité visuelle, aux langues de lancement, à la console mobile, à la gouvernance des délégations et au kit de récupération. En cas de conflit non couvert ou ambigu, ne tranche pas seul : demande validation.

## Stack verrouillée
- React
- Vite
- TypeScript
- Tailwind CSS
- Lucide React
- API REST séparée via Cloudflare Pages Functions
- PWA en premier
- Capacitor prévu pour Android/iOS ultérieurement, sans réécriture
- Adaptateurs des capacités du terminal dans `src/services/device/`

Ne remplace pas cette stack par Next.js, Vue, Angular, Svelte, JavaScript non typé ou une autre architecture. N'ajoute pas un second backend ou un second dépôt. Les changements de stack exigent une validation explicite de l'utilisateur.

## Collaboration
Claude, Qwen et les autres assistants autorisés travaillent sur les mêmes références et l'unique branche `main`. Avant chaque écriture, vérifie le dernier commit. Ne crée jamais de branche. Évite les modifications concurrentes et n'écrase jamais le travail d'un autre agent.

## Discipline
- Audit avant modification ; diff limité et expliqué.
- Pas de mock, données fictives ou succès simulé.
- Pas de suppression ou refactorisation non autorisée.
- Pas de secret ni donnée personnelle réelle dans Git.
- Respect absolu des règles de sécurité et de confidentialité du cahier des charges.
- Tests et CI seulement déclarés réussis après vérification réelle.
- En cas de contradiction entre le code et les décisions, ne tranche pas seul : documente et demande validation.

## Points de vigilance obligatoires au 18 novembre 2026

- **GPS J+30 :** l'historique GPS précis est NO-GO. Aucune conservation durable, archive, API, migration, synchronisation ou connexion à un flux GPS réel ne doit être implémentée avant preuve des scénarios critiques et arbitrage produit explicite. Les primitives cryptographiques présentes sont expérimentales, non branchées à l'application et ne prouvent pas la destruction J+30.
- **Sauvegardes mobiles :** les exclusions Android/iOS sont des mesures de réduction du risque, pas une preuve d'effacement irréversible. Respecter le plan GPS-01 à GPS-36 ; aucun test natif ne doit être déclaré exécuté sans appareils et preuves réelles.
- **Droit nigérien :** l'ancienne HAPDP a été supprimée selon les informations publiées par l'ANP le 12 juin 2026. Ne pas la présenter comme autorité opérationnelle ni envoyer de formalité à son ancien contact. L'ordonnance 2026-30 et le décret de suppression doivent encore être authentifiés sur le Journal officiel ; ne pas extrapoler les obligations actuelles à partir des seuls textes historiques.
- **Picomatch :** GHSA-fc5q-39xc-vjpf / CVE-2026-112366 est toujours sans version corrigée publiée vérifiée. Les PR amont examinées sont ouvertes ; ne pas ajouter de commit non publié, override artisanal, ignorer l'audit ou forcer une rétrogradation.
- Les changements documentaires n'autorisent pas une modification de code, une migration D1, une ressource Cloudflare, une intégration fournisseur ou un déploiement.

- **Bundles ECDH :** avant d'accepter un bundle signé, vérifier la structure JWK, importer effectivement la clé publique ECDH P-256 avec WebCrypto pour faire valider le point de courbe, puis vérifier la signature sous une identité déjà ancrée indépendamment. Le test du point (0,0) doit rester dans la suite adversariale. Une signature auto-incluse ne prouve jamais l'identité du propriétaire.

- **Cérémonie multi-appareils :** le certificat secondaire expérimental actuel ne lie pas encore le défi serveur, le nonce du nouvel appareil, l'identifiant de cérémonie et l'expiration. Ne pas l'intégrer à une API d'approbation. Exiger un transcript canonique versionné signé par la racine et une consommation atomique du défi avant toute implémentation serveur.


## Interface, langues et direction visuelle

- Tous les textes visibles par l'utilisateur doivent être centralisés dans `src/i18n/translations.ts` ; ne pas ajouter de textes métier directement dans les composants.
- Langues de lancement : français, anglais et arabe. L'arabe exige une interface RTL réelle, pas uniquement une traduction des libellés.
- Toute nouvelle page ou tout nouveau composant doit utiliser les traductions et respecter `dir="rtl"` sans casser les parcours LTR.
- Conserver le vert clair effet verre dépoli, le blanc, le rouge d'alerte et un vert de confirmation distinct. Aucun violet ni bleu nuit comme couleur principale.
- Les codes hexadécimaux présents dans le thème sont des valeurs initiales de mise en œuvre ; ils ne doivent pas être présentés comme une charte définitive validée.


## Gouvernance administrative SAC — lecture obligatoire avant tout travail concerné

Avant de concevoir ou modifier des rôles, permissions, missions, comptes administratifs, sessions administratives, exports, journaux d'audit ou clôtures administratives, lire les documents suivants :

- `docs/PLAN_SOCLE_COMPTE_SESSIONS_APPAREILS.md`
- `docs/ARBITRAGES_TECHNIQUES_COMPTES_OTP_SESSIONS.md`
- `docs/CATALOGUE_RESSOURCES_MATRICE_PERMISSIONS.md`
- `docs/CLASSIFICATION_DONNEES_ET_ACCES_ADMIN.md`
- `docs/GOUVERNANCE_MISSIONS_ADMIN_ET_CYCLE_DE_VIE.md`

Règles pour les agents :
- Ne jamais considérer une proposition marquée « à valider » comme une décision approuvée.
- Ne pas créer de compte administratif, permission, mission, endpoint, middleware, table ou migration D1 sans autorisation explicite.
- Ne pas élargir les droits pour contourner un point non arbitré ; appliquer le refus par défaut.
- Toute implémentation future doit inclure des tests positifs et négatifs, une revue de sécurité et une vérification des effets de révocation côté serveur.
- Ne jamais exposer ou journaliser OTP, mots de passe, clés privées, jetons bruts, secrets de récupération ou GPS précis.


Complément obligatoire pour tout travail administratif ou de sécurité : lire également `docs/MODELE_MENACES_ET_PLAN_SECURITE_ADMIN.md`. Toute implémentation doit traiter les scénarios de menace, les frontières de confiance et les critères de passage en production qui y sont définis. Les exigences documentaires ne prouvent pas que les contrôles existent déjà.


Avant toute conception ou modification d'opérations administratives, lire également `docs/CONTRATS_OPERATIONS_ADMIN_ATOMIQUES.md`. Respecter ses préconditions, contrôles transactionnels, règles d'idempotence et tests de concurrence. Ne jamais considérer ce contrat documentaire comme une autorisation d'implémenter.


Avant toute évolution du schéma, des comptes administratifs, missions, permissions, sessions, audits, clôtures ou exports, lire `docs/MODELE_DONNEES_ADMIN_ET_INTEGRATION_SAC.md`. Vérifier les incohérences identifiées et ne pas figer les points « à arbitrer ». Ce document ne vaut pas autorisation de migration.


## Référentiel global des données

Avant toute évolution du modèle relationnel, lire `docs/MODELE_GLOBAL_DONNEES_SAC.md`, puis les contrats spécialisés qu'il référence. Le nom conceptuel canonique de l'identité est `accounts` ; ne pas créer une seconde table d'identité `users` pour l'administration. Les tables mentionnées comme « à ajouter » ou « conditionnelles » ne sont pas approuvées pour SQL. Le modèle reste NON PRÊT POUR MIGRATION.
