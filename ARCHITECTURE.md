# SAC — Architecture technique

SAC est une plateforme citoyenne de signalement et de suivi. Ce périmètre remplace l'ancien concept d'alertes privées aux proches et reste indépendant de PCS et Coup Sûr.

## Stack et flux
React + Vite + TypeScript strict + Tailwind + Lucide React ; Leaflet/OpenStreetMap ; Cloudflare Pages Functions pour l'API REST ; D1 pour les données ; R2 privé pour les médias. Les écrans utilisent des adaptateurs sous `src/services/device`, remplaçables par Capacitor Geolocation/Camera/Preferences.

Navigateur/Capacitor → API Pages Functions → validation et autorisation serveur → D1/R2. Le frontend ne contacte jamais directement la base et ne reçoit aucun secret Cloudflare. Réponse standard : `{ success, data, error }`.

## Parcours
1. Catégorie et niveau d'urgence.
2. GPS facultatif, ajustement sur carte, description et média facultatif.
3. Envoi et code secret de suivi. Aucun compte citoyen requis. La position n'est jamais inventée. En danger immédiat, contacter directement les secours ; SAC ne les remplace pas.

## API
- POST /api/reports : création multipart.
- GET /api/reports : liste approuvée uniquement.
- GET /api/reports/track?code=... : suivi par code.
- GET/PUT /api/admin/reports : API professionnelle protégée par secret temporaire.

## Statuts et modération
Statut : received, in_progress, resolved. Publication : pending, approved, rejected. Seuls les dossiers approuvés sont publics. Médias R2 privés ; aucune URL publique permanente.

## Données
Tables : users, reports, report_updates, rate_limits. Code de suivi hashé. Référence média stockée comme clé R2 privée. Seed synthétique réservé à la démo locale.

## Sécurité et limites
Requêtes D1 préparées et batch atomique, validation stricte, limite média 8 Mo, allowlist MIME + signatures binaires, rate limit basique, secret admin Cloudflare, historique. L'authentification admin par secret partagé est transitoire ; avant production, la remplacer par comptes nominatifs, sessions, rôles et révocation. Ajouter Turnstile/WAF, audit, rétention et purge. Pas de route d'accès média autorisée encore.

## Capacitor
Les écrans utilisent les adaptateurs abstraits. Les implémentations web pourront être remplacées par les plugins natifs. Les permissions GPS en arrière-plan dépendent des limites Android/iOS.

## Déploiement et ressources
Pages `sac-citoyen` relié à GitHub main, build `npm run build`, sortie `dist`, binding D1 `DB`. D1 `sac-citoyen-db` créé le 17/11/2026 en juridiction EU ; tables initiales appliquées et vérifiées. R2 non activé (erreur API 10042), bucket/binding MEDIA en attente. Le build GitHub Actions et le premier déploiement Pages sont réussis ; Pages Functions et le binding D1 DB sont actifs. R2 reste à activer.