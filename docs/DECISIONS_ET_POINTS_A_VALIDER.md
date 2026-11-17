# SAC — Décisions et validations

## Décisions actées le 17/11/2026
- Produit : plateforme citoyenne de signalement et suivi ; ancien concept d'alertes privées abandonné.
- Dépôt benwahab/SAC ; branche main uniquement.
- React/Vite/TypeScript/Tailwind/Lucide.
- Cloudflare Pages Functions, D1, R2 privé.
- Préparation Capacitor.
- Citoyen sans compte ; trois étapes ; code unique.
- Catégories : danger, accident, urgence médicale, incendie/sinistre, infrastructure/panne.
- Statuts : reçu, en cours, résolu.
- Modération préalable ; seuls les approuvés sont publics.

## Vérifications
D1 sac-citoyen-db créé. R2 non activé (erreur API 10042), bucket non créé. Dépôt privé et branche main confirmés. Aucun déploiement applicatif vérifié.

## À décider avant production
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

Ne jamais présenter une notification comme une intervention garantie.