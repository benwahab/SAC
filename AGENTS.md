# Instructions communes aux agents IA — SAC

Tu interviens sur **SAC — Sécurité, Alerte, Citoyenne**, application privée de sécurité personnelle et familiale. Ce projet n'est pas PCS et ne doit jamais devenir une plateforme publique de signalement.

## Lecture obligatoire
Avant toute tâche, lis :
1. `README.md`
2. `docs/CAHIER_DES_CHARGES_SAC.md`
3. `docs/ARCHITECTURE_ET_MODELE_DONNEES.md`
4. `docs/CONSIGNES_DE_TRAVAIL.md`
5. `docs/DECISIONS_ET_POINTS_A_VALIDER.md)
6. `docs/CLOUDFLARE_GITHUB_DEPLOYMENT.md)

## Stack verrouillée
- React
- Vite
- TypeScript
- Tailwind CSS
- Lucide React
- API REST séparée sur Cloudflare Workers
- PWA en premier
- Capacitor prévu pour Android/iOS ultérieurement, sans réécriture
- Adaptateurs des capacités du terminal dans `src/services/device/`

Ne remplace pas cette stack par Next.js, Vue, Angular, Svelte, JavaScript non typé ou une autre architecture. N'ajoute pas un second backend ou un second dépôt. Les changements de stack exigent une validation explicite de l'utilisateur.

## Collaboration
Claude, Qwen et les autres assistants autorisés travaillent sur les mêmes références et l'unique branche `main`. Avant chaque écriture, vérifie le dernier commit. Ne crée jamais de branche. Évite les modifications concurrentes et n'écrase jamais le travail d'un autre agent.

## Discipline
- Audit avant modification ; diff limité et expliqué.
- Pas de mock, données fictives ou succès simulé.
- Pas de suppression ou refactorisation non autorisée.
- Pas de secret ni donnée personnelle réelle dans Git.
- Respect absolu des règles de sécurité et de confidentialité du cahier des charges.
- Tests et CI seulement déclarés réussis après vérification réelle.
- En cas de contradiction entre le code et les décisions, ne tranche pas seul : documente et demande validation.
