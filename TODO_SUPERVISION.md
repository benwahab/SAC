# SAC — TODO de supervision multi-IA

## Règles
- Dépôt benwahab/SAC, branche main uniquement ; aucune branche secondaire.
- Travail directement sur GitHub, pas de Lovable.
- Séparation stricte de PCS et Coup Sûr.
- Audit avant modification, pas de suppression/refactorisation gratuite.
- Secrets et données personnelles hors Git.
- Aucun signalement non approuvé ni média associé dans le flux public.
- Ne jamais annoncer envoi/livraison/intervention sans preuve.

## Socle
- [x] Accès GitHub et branche main vérifiés.
- [x] Nouveau périmètre citoyen confirmé.
- [x] D1 sac-citoyen-db créé.
- [x] Tables initiales appliquées et vérifiées.
- [x] Pages créé, lié au dépôt, binding D1 DB configuré.
- [x] CI GitHub Actions : npm install et npm run build réussis le 17/11/2026.
- [ ] Activer R2 dans le dashboard puis créer sac-report-media privé.
- [ ] Ajouter binding R2 MEDIA à Pages.
- [ ] Vérifier la fin du premier déploiement Pages.
- [ ] Créer les comptes professionnels nominatifs.

## P0 sécurité
- [ ] Remplacer le secret admin partagé par identité nominative, rôles, sessions et révocation.
- [ ] Ajouter Turnstile/WAF et rate limiting distribué.
- [ ] Ajouter route média avec autorisation ; aucun accès public R2.
- [ ] Définir rétention, purge, export et suppression des coordonnées/médias.
- [ ] Définir modération et escalade des signalements critiques.
- [ ] Valider cadre légal, responsabilités et messages d'urgence.

## P1 produit
- [ ] Géocodage inverse avec fournisseur validé.
- [ ] Affectation par organisation/zone.
- [ ] Notifications et suivi réel de livraison.
- [ ] Tableau professionnel avec filtres, carte, recherche et pagination.
- [ ] Upload résumable pour réseau faible.
- [ ] Gestion des pièces jointes multiples et analyse de sécurité.

## P2 qualité/mobile
- [ ] Tests API/D1/R2 et E2E.
- [ ] Accessibilité et tests sur téléphones réels.
- [ ] Capacitor Android/iOS.
- [ ] Observabilité, sauvegardes et restauration testée.

## Critères
Build réussi ; soumission sans compte ; code unique vérifiable ; signalements non approuvés invisibles ; D1 côté serveur ; historique ; médias privés ; aucune fausse confirmation.

Dernière mise à jour : 2026-11-17.