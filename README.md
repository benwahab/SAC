# SAC — Sécurité, Alerte, Citoyenne

SAC est une application de sécurité personnelle et familiale. Elle permet à une personne de prévenir ses proches de confiance en cas de danger, d'urgence ou pendant un déplacement. Les alertes sont destinées aux contacts choisis et autorisés par l'utilisateur ; SAC n'est pas une plateforme publique de signalement ni un outil de dispatch institutionnel.

## Références obligatoires

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

**Phase : cadrage et documentation.** Le code de signalement public ajouté par erreur a été retiré. Le développement de la véritable application SAC n'est pas commencé.
