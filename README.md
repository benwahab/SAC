# SAC — Sécurité, Alerte, Citoyenne

SAC est une application de sécurité personnelle et familiale. Elle permet à une personne de prévenir ses proches de confiance en cas de danger, d'urgence ou pendant un déplacement. Les alertes sont destinées aux contacts choisis et autorisés par l'utilisateur ; SAC n'est pas une plateforme publique de signalement ni un outil de dispatch institutionnel.

## Références obligatoires

- [Consolidation générale de l'architecture](docs/CONSOLIDATION_GENERALE_SAC.md)
- [Décisions complémentaires du 18 novembre 2026](docs/DECISIONS_COMPLEMENTAIRES_2026-11-18.md)
- [Console professionnelle et services](docs/CONSOLE_PROFESSIONNELLE_ET_SERVICES.md)
- [Plan directeur de réalisation](docs/PLAN_DIRECTEUR_REALISATION_SAC.md)
- [Annexe du modèle de données des services professionnels](docs/ANNEXE_MODELE_DONNEES_SERVICES_PROFESSIONNELS.md)
- [Audit de l'état réel du code — 18 novembre 2026](docs/AUDIT_ETAT_REEL_CODE_2026-11-18.md)
- [Arbitrages techniques comptes, OTP et sessions](docs/ARBITRAGES_TECHNIQUES_COMPTES_OTP_SESSIONS.md)
- [Architecture de référence](ARCHITECTURE.md)
- [Suivi et supervision](TODO_SUPERVISION.md)
- [Cahier des charges complet](docs/CAHIER_DES_CHARGES_SAC.md)
- [Architecture et modèle de données](docs/ARCHITECTURE_ET_MODELE_DONNEES.md)
- [Consignes permanentes](docs/CONSIGNES_DE_TRAVAIL.md)
- [Décisions et points à valider](docs/DECISIONS_ET_POINTS_A_VALIDER.md)
- [Connexion GitHub et préparation Cloudflare](docs/CLOUDFLARE_GITHUB_DEPLOYMENT.md)
- [Consignes communes aux assistants IA](AGENTS.md)

## Stack confirmée

- Frontend : React, Vite, TypeScript, Tailwind CSS et Lucide React.
- Backend : API REST séparée via Cloudflare Pages Functions.
- Première livraison : PWA mobile-first.
- Préparation native dès la conception : Capacitor pour Android/iOS, sans réécriture des écrans ni de la logique métier.
- Adaptateurs des capacités du terminal isolés dans `src/services/device/`.

Base relationnelle cible : Cloudflare D1. Stockage privé : Cloudflare R2 si activé et autorisé sur le compte. Les choix d'authentification, SMS/push et paiement restent soumis aux validations indiquées dans les documents de décisions.

## Règles du dépôt

- Dépôt unique : `benwahab/SAC`.
- Une seule branche : `main`. Tout travail directement sur GitHub.
- Aucun dépôt parallèle, aucune branche secondaire, aucun mélange avec PCS ou Coup Sûr.
- Claude et Qwen peuvent contribuer, mais doivent respecter exactement la stack et les conventions établies.
- Aucun code applicatif, migration ou déploiement ne doit être ajouté sans autorisation explicite.
- Aucun secret, OTP ou donnée personnelle réelle dans Git.

## État du projet

**Phase : socle technique initial en cours.** Le premier socle React/Vite/TypeScript, l'interface mobile de démarrage, le manifeste PWA, un service worker minimal, les contrats d'adaptateurs Web et une route Pages Functions de vérification D1 sont versionnés. Des contrats TypeScript purs et des tests existent également pour certains cycles métier.

Le SOS réel, l'authentification complète, les alertes métier, les notifications réelles, les paiements et les migrations métier D1 ne sont pas déclarés opérationnels. Le GPS précis reste bloqué par l'exigence de destruction irréversible J+30. La console professionnelle et les services administratifs sont documentés comme conception, pas comme fonctionnalités livrées.

Vérifier `TODO_SUPERVISION.md`, le code, les ressources Cloudflare et les résultats CI récents avant toute affirmation sur l'état d'une fonction.

## Identité visuelle et langues de l'interface

- La page citoyenne utilise désormais une première déclinaison vert clair Glassmorphism, avec rouge réservé à l'alerte et vert distinct pour la confirmation.
- Les textes de l'interface sont centralisés dans `src/i18n/translations.ts`.
- Langues disponibles sur la page actuelle : français, anglais et arabe ; la sélection est conservée localement et l'arabe active le sens RTL.
- Les codes couleur actuels sont des tokens initiaux d'implémentation, pas une charte graphique hexadécimale définitivement validée.
- Cette mise à jour concerne la page d'accueil et les métadonnées PWA ; elle ne signifie pas que tous les futurs écrans sont déjà traduits.


## Gouvernance administrative et sécurité

- [Catalogue des ressources et matrice des permissions](docs/CATALOGUE_RESSOURCES_MATRICE_PERMISSIONS.md)
- [Classification des données et limites d'accès administratif](docs/CLASSIFICATION_DONNEES_ET_ACCES_ADMIN.md)
- [Gouvernance des missions et cycle de vie administratif](docs/GOUVERNANCE_MISSIONS_ADMIN_ET_CYCLE_DE_VIE.md)

Ces documents décrivent l'architecture cible et les points restant à valider. Ils ne signifient pas que les mécanismes sont déjà implémentés.


- [Modèle de menaces et plan de sécurité de l'administration](docs/MODELE_MENACES_ET_PLAN_SECURITE_ADMIN.md)


- [Contrats atomiques des opérations administratives](docs/CONTRATS_OPERATIONS_ADMIN_ATOMIQUES.md)


- [Modèle de données administratif et intégration au modèle général](docs/MODELE_DONNEES_ADMIN_ET_INTEGRATION_SAC.md)
