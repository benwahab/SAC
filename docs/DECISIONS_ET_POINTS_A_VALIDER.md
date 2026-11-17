# SAC — Décisions et validations

## Décisions actées le 17/11/2026
- Plateforme citoyenne de signalement et suivi ; ancien concept d'alertes privées abandonné.
- Dépôt benwahab/SAC ; branche main uniquement.
- React/Vite/TypeScript/Tailwind/Lucide.
- Cloudflare Pages Functions, D1, R2 privé.
- Préparation Capacitor.
- Citoyen sans compte ; parcours trois étapes ; code unique.
- Catégories : danger, accident, urgence médicale, incendie/sinistre, infrastructure/panne.
- Statuts : reçu, en cours, résolu.
- Modération préalable ; seuls les approuvés sont publics.

## Ressources vérifiées
D1 sac-citoyen-db créé, tables initiales appliquées. Pages sac-citoyen créé, lié à GitHub main et binding D1 DB configuré ; CI GitHub Actions réussie. R2 non activé (erreur API 10042), aucun bucket créé. Déploiement Pages final à confirmer.

## À valider avant production
1. Autorité responsable et circuit d'escalade.
2. Rôles, organisations, zones et affectations.
3. Authentification professionnelle nominative.
4. Conservation/purge des coordonnées et médias.
5. Règles et motifs de modération.
6. Géocodage/cartographie.
7. Notifications et preuve de livraison.
8. Limites et formats de média.
9. Cadre légal et responsabilité au Niger.
10. Signalements abusifs, doublons et urgences vitales.