# SAC — Audit des dépendances

## État initial du socle (17 novembre 2026)

Le premier audit GitHub Actions a révélé des alertes npm de sévérité élevée dans la chaîne de développement, avec des chemins transitifs qui remontent notamment à picomatch utilisé par Vite/Tailwind et leurs dépendances de construction.

- CVE-2026-112366 / GHSA-fc5q-39xc-vjpf : ReDoS dans picomatch jusqu'à 4.0.7. Au moment de cet audit, les sources consultées ne donnent pas de version corrigée publiée.
- Les dépendances concernées sont dans la chaîne d'outillage de développement/build, pas dans les dépendances applicatives déclarées pour l'exécution du navigateur.
- Le projet ne transmet aucun motif glob fourni par un utilisateur à picomatch.
- Ne pas contourner l'alerte avec un fork non vérifié, une mise à niveau majeure improvisée ou un downgrade forcé qui dégrade la chaîne de build.

## Politique CI

1. L'audit des dépendances de production (npm audit --omit=dev --audit-level=high) est bloquant.
2. L'audit complet reste visible dans GitHub Actions mais non bloquant tant que l'avis upstream ne propose pas de version corrigée vérifiable.
3. Recontrôler cet avis avant chaque mise en production et mettre à jour les dépendances dès qu'un correctif upstream fiable est disponible.
4. Ne jamais déclarer le projet exempt de vulnérabilités tant que l'audit complet remonte cette alerte.

Sources :
- https://github.com/advisories/GHSA-fc5q-39xc-vjpf
- https://nvd.nist.gov/vuln/detail/CVE-2026-112366
