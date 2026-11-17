# SAC — TODO de supervision multi-IA

## Règles non négociables
- Dépôt benwahab/SAC, branche main uniquement ; jamais de branche secondaire.
- Travail directement sur GitHub, pas de Lovable.
- Ne jamais mélanger SAC, PCS et Coup Sûr.
- Audit avant modification, pas de suppression/refactorisation gratuite.
- Secrets et données personnelles hors Git.
- Aucun signalement non approuvé ni média associé dans le flux public.
- Ne jamais annoncer un envoi, une livraison ou une intervention sans preuve.

## Socle initial
- [x] Accès GitHub et branche main vérifiés.
- [x] Nouveau périmètre citoyen confirmé.
- [x] Base D1 sac-citoyen-db créée.
- [ ] Appliquer migration SQL.
- [ ] Activer R2 dans le dashboard puis créer sac-report-media privé.
- [ ] Configurer Pages Functions et bindings.
- [ ] Installer et compiler ; consulter CI.
- [ ] Définir les comptes professionnels nominatifs.

## P0 sécurité
- [ ] Remplacer le secret partagé admin par identité nominative, rôles, sessions et révocation.
- [ ] Ajouter Turnstile/WAF et rate limiting distribué.
- [ ] Ajouter route de média avec autorisation ; aucun accès public R2.
- [ ] Définir rétention/purge/export/suppression des coordonnées et médias.
- [ ] Définir modération et escalade des signalements critiques.
- [ ] Valider cadre légal, responsabilités et messages d'urgence.

## P1 produit
- [ ] Géocodage inverse avec fournisseur validé.
- [ ] Authentification et gestion des agents.
- [ ] Affectation par organisation/zone.
- [ ] Notifications avec suivi réel de livraison.
- [ ] Filtres, pagination, recherche et carte professionnelle.
- [ ] Upload résumable pour réseau faible.
- [ ] Gestion des pièces jointes et analyse de sécurité.

## P2 qualité/mobile
- [ ] Tests API/D1/R2 et E2E.
- [ ] Tests accessibilité et contraste.
- [ ] Capacitor Android/iOS sur appareils réels.
- [ ] Observabilité, sauvegardes et restauration testée.
- [ ] Idempotence et réseau instable.

## Validation
Build réussi ; soumission sans compte ; code de suivi vérifiable ; signalements non approuvés invisibles ; D1 préparé et autorisé côté serveur ; historique complet ; médias privés ; aucune fausse confirmation.

Dernière mise à jour : 2026-11-17 — socle initial, D1 créé, migration non appliquée, R2 à activer.