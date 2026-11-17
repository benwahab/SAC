# SAC — Architecture de référence

Ce fichier est le point d'entrée architectural du dépôt. Le détail du modèle de données et des responsabilités est maintenu dans [docs/ARCHITECTURE_ET_MODELE_DONNEES.md](docs/ARCHITECTURE_ET_MODELE_DONNEES.md).

## Stack à respecter

- Frontend : React + Vite + TypeScript + Tailwind CSS + Lucide React.
- Backend : API REST TypeScript avec Cloudflare Pages Functions dans `functions/api/`.
- Hébergement PWA : Cloudflare Pages.
- Base relationnelle cible : Cloudflare D1.
- Stockage objet privé : Cloudflare R2 si activé et autorisé sur le compte.
- Première livraison : PWA mobile-first.
- Évolution mobile : préparation Capacitor pour Android/iOS, sans réécrire les écrans ni la logique métier.

## Règles structurantes

1. Le frontend ne décide jamais des droits, des destinataires, des paiements ou des transitions sensibles.
2. Les contrôles d'accès, règles métier et tâches sensibles sont exécutés côté serveur.
3. Les contrats API et les adaptateurs de plateforme sont séparés de l'interface.
4. Les capacités Web et natives sont isolées dans `src/services/device/`.
5. Les migrations D1 sont versionnées dans GitHub.
6. R2 reste privé par défaut et ne sera utilisé qu'après activation/autorisation.
7. Aucun second backend autonome sur Cloudflare Workers ne remplace Pages Functions sans validation explicite.
8. Toute décision non encore validée est signalée comme telle dans `docs/DECISIONS_ET_POINTS_A_VALIDER.md`.

## Dépôt

- Dépôt unique : `benwahab/SAC`.
- Branche unique : `main`.
- Tout travail directement sur GitHub.
- Claude et Qwen doivent lire `AGENTS.md` et respecter strictement la stack et les consignes.
