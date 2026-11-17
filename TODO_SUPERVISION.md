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
- [x] Premier déploiement Pages réussi avec Pages Functions et D1.
- [ ] Créer les comptes professionnels nominatifs.

## P0 sécurité
- [ ] Remplacer le secret admin partagé par identité nominative, rôles, sessions et révocation.\n- [ ] Examiner les 4 alertes HIGH restantes dans les dépendances de développement (Vite/fdir/picomatch/tinyglobby). Audit runtime : 0 vulnérabilité ; aucune CRITICAL après retrait de Vitest.
- [ ] Ajouter Turnstile/WAF et rate limiting distribué.\n- [x] Limitation de débit initiale côté D1 pour création de signalement et accès professionnel (à remplacer par une solution distribuée).
- [ ] Ajouter route média avec autorisation ; aucun accès public R2.\n- [x] Vérification des signatures réelles des fichiers JPEG/PNG/WebP/WebM/MP3/MP4 avant stockage.
- [ ] Définir rétention, purge, export et suppression des coordonnées/médias.
- [ ] Définir modération et escalade des signalements critiques.
- [ ] Valider cadre légal, responsabilités et messages d'urgence.

## P1 produit
- [ ] Géocodage inverse avec fournisseur validé.
- [ ] Affectation par organisation/zone.
- [ ] Notifications et suivi réel de livraison.
- [x] Tableau professionnel initial avec carte, filtres et mise à jour statut/modération (jeton temporaire).\n- [ ] Recherche, pagination et affectations par zone/organisation.
- [ ] Upload résumable pour réseau faible.
- [ ] Gestion des pièces jointes multiples et analyse de sécurité.

## P2 qualité/mobile
- [x] Écritures du signalement et de son historique regroupées dans un batch D1 atomique.\n- [ ] Tests API/D1/R2 et E2E.
- [x] Recentrage automatique de la carte après acquisition GPS.\n- [ ] Accessibilité et tests sur téléphones réels.
- [ ] Capacitor Android/iOS.
- [ ] Observabilité, sauvegardes et restauration testée.

## Critères
Build réussi ; soumission sans compte ; code unique vérifiable ; signalements non approuvés invisibles ; D1 côté serveur ; historique ; médias privés ; aucune fausse confirmation.

Dernière mise à jour : 2026-11-17.