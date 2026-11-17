# Migrations D1

Les migrations SQL versionnées seront ajoutées ici après validation du schéma détaillé et des règles de conservation des données dans le document d'architecture.

La base Cloudflare D1 sac-db existe, mais aucune table métier n'a été créée à ce stade. Ne pas improviser de schéma à partir des seuls noms d'entités indicatifs du document d'architecture.

Commandes prévues après validation d'une première migration :
- npx wrangler d1 migrations list sac-db
- npx wrangler d1 migrations apply sac-db --local
- npx wrangler d1 migrations apply sac-db --remote

Toute migration distante doit être relue, testée localement et explicitement tracée.
