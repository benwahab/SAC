# SAC — Architecture technique

## Produit
Plateforme citoyenne de signalement et de suivi. Ce document remplace l'ancien périmètre d'alertes privées aux proches. SAC est indépendant de PCS et Coup Sûr.

## Stack et séparation
- Frontend : React + Vite + TypeScript strict + Tailwind + Lucide React.
- Carte : Leaflet/OpenStreetMap.
- API : Cloudflare Pages Functions dans `functions/api/**`.
- Données : D1, uniquement côté serveur.
- Médias : R2 privé, aucune URL publique permanente.
- Mobile : adaptateurs TypeScript sous `src/services/device`, remplaçables par Capacitor Geolocation/Camera/Preferences.

Le navigateur appelle uniquement l'API REST. Il ne reçoit aucun binding, secret ou accès direct D1/R2. Réponse uniforme : `{ success, data, error }`.

## Parcours citoyen
Trois étapes : catégorie/urgence ; GPS facultatif, position ajustable sur carte, description et média facultatif ; envoi et code secret de suivi. Le signalement ne nécessite pas de compte. La position n'est jamais inventée. En danger immédiat, le citoyen doit contacter directement les secours : SAC ne les remplace pas.

## API prévue
- POST /api/reports : création multipart.
- GET /api/reports : liste approuvée seulement.
- GET /api/reports/track?code=... : suivi privé par code.
- GET/PUT /api/admin/reports : espace professionnel protégé par secret d'administration temporaire.

## Statuts et modération
Statut opérationnel : received, in_progress, resolved. Publication séparée : pending, approved, rejected. Seuls les dossiers approuvés peuvent être publics. Les médias restent privés et exigent une route d'accès contrôlée avant affichage.

## Données
Tables initiales : users, reports, report_updates, rate_limits. Le code de suivi est hashé. La référence R2 est une clé d'objet privée, pas une URL publique. Le seed de démonstration est synthétique et réservé au développement.

## Sécurité
Requêtes D1 préparées, validation stricte, limites de taille/MIME, rate limit basique, code de suivi hashé, secret admin stocké dans Cloudflare, historique des changements. Ajouter Turnstile/WAF, authentification nominative, sessions, rôles, audit complet, politique de rétention et purge avant production.

## Capacitor
Les écrans utilisent les services abstraits, pas directement les APIs du navigateur. Les adaptateurs web peuvent être remplacés par les plugins Capacitor. Les limites GPS en arrière-plan dépendent d'Android/iOS.

## Déploiement
Cloudflare Pages connecté à GitHub main, commande npm run build, sortie dist. Bindings D1 DB et R2 MEDIA dans wrangler.jsonc. Aucun déploiement de production n'est déclaré.

## Ressources et limites vérifiées
D1 sac-citoyen-db créé le 17/11/2026 en juridiction EU. R2 n'est pas activé (API Cloudflare erreur 10042), donc aucun bucket n'a été créé. Pages reste à configurer. L'adresse approximative/géocodage inverse est à intégrer avec un fournisseur validé.