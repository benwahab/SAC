# SAC — Consignes permanentes de travail

Ces règles s'appliquent à toute personne ou assistant intervenant sur le projet SAC. Elles priment sur les habitudes générales de développement lorsqu'elles sont plus strictes.

## 1. Dépôt et branche

- Dépôt officiel unique : `benwahab/SAC`.
- **Une seule branche de travail : `main`.**
- Tout travail doit être effectué directement sur GitHub dans ce dépôt.
- Ne jamais créer de branche secondaire, branche temporaire, branche de fonctionnalité ou branche de correction.
- Ne pas créer de dépôt miroir ou de nouveau dépôt pour contourner cette règle.
- Ne pas transférer le travail vers un autre dépôt.
- Avant une modification, vérifier le dépôt et la branche ciblés.

## 2. Séparation des projets

SAC est totalement distinct de :
- PCS — Plateforme citoyenne de signalement ;
- Coup Sûr.

Ne jamais réutiliser par erreur leurs dépôts, bases de données, clés, secrets, configurations, comptes, fonctions ou règles métier. Toute intégration commune devra être demandée et validée explicitement.

## 3. Autorisation et périmètre

- Le développement initial du socle technique a été explicitement autorisé et commencé sur `main`.
- Poursuivre les tâches déjà autorisées dans le périmètre validé, après audit et vérification du dernier commit.
- Toute nouvelle fonctionnalité métier, migration D1, intégration fournisseur, création de ressource Cloudflare ou déploiement non déjà autorisé exige une validation explicite.
- Ne pas transformer une proposition technique en décision produit.
- Ne pas ajouter une fonctionnalité non demandée.
- Ne pas supprimer, désactiver ou réduire une fonctionnalité sans autorisation explicite.
- Ne pas modifier les règles métier validées sous prétexte de simplification.
- Si une consigne est incomplète ou contradictoire, demander une clarification avant une action irréversible.

## 4. Méthode de travail sur un projet existant

Avant toute modification de code :
1. examiner le dépôt, les fichiers concernés et leur historique utile ;
2. comprendre le fonctionnement actuel ;
3. identifier les dépendances et impacts ;
4. vérifier si une fonction existe déjà ;
5. proposer un périmètre précis ;
6. ne modifier que ce qui est nécessaire et autorisé.

Ne jamais remplacer un fichier entier sans avoir vérifié son contenu et les éléments à préserver.

## 5. Qualité et intégrité

- Pas de données fictives, comptes de démonstration, statistiques inventées ou fonctionnalités simulées présentées comme réelles.
- Pas de fausses confirmations d'envoi, de livraison, de paiement, de localisation ou de résolution.
- Pas de code mort, de doublons ou d'anciennes versions conservées sans raison.
- Pas de refactorisation générale non demandée.
- Préserver les fonctionnalités déjà validées.
- Utiliser des noms explicites et une structure cohérente.
- Documenter les décisions et changements qui affectent le comportement.
- Ne jamais exposer de secret, clé privée, jeton, OTP ou donnée personnelle dans GitHub.

## 6. Sécurité SAC

- Toute autorisation sensible doit être vérifiée côté serveur.
- Ne jamais exposer les données d'un autre utilisateur.
- Ne jamais partager la position sans autorisation explicite et limitée.
- Seul l'auteur d'une alerte peut la clôturer.
- L'expiration des rappels ne clôture pas l'alerte.
- Les contacts destinataires sont figés lors du déclenchement.
- Les paiements sont vérifiés côté serveur.
- Les codes de sécurité ne sont jamais stockés en clair.
- Les limites de PWA, GPS en arrière-plan, SMS et notifications doivent être expliquées honnêtement.

## 7. Vérification avant validation

Après chaque modification autorisée :
- vérifier le diff complet ;
- contrôler qu'aucun fichier non concerné n'a été modifié ;
- exécuter les contrôles et tests pertinents lorsqu'un code existe ;
- vérifier les erreurs de build et les contrôles automatiques disponibles ;
- confirmer le résultat réel sur GitHub ;
- signaler clairement les contrôles non exécutés ou impossibles.

Ne jamais affirmer que les tests, la CI, le déploiement ou une synchronisation GitHub/Cloudflare sont réussis sans preuve vérifiée.

## 8. Communication

- Expliquer en français, clairement et sans jargon inutile.
- Avancer étape par étape.
- Distinguer ce qui est fait, ce qui est vérifié et ce qui reste à faire.
- Ne pas demander à l'utilisateur de répéter une décision déjà documentée.
- En cas de doute sur une règle importante, poser une seule question précise.

## 9. Traçabilité

- Chaque changement GitHub doit avoir un message de commit explicite.
- Les décisions produit sont consignées dans `DECISIONS_ET_POINTS_A_VALIDER.md`.
- Le cahier des charges et l'architecture doivent rester cohérents.
- Toute modification d'une règle validée doit être répercutée dans les documents concernés.
- Ne pas réécrire l'historique Git ni effectuer de force-push sans autorisation expresse.

## 10. Collaboration Claude, Qwen et autres assistants

- Claude, Qwen et tout autre assistant explicitement autorisé peuvent auditer, documenter et contribuer au même dépôt.
- Avant toute intervention, chaque assistant doit lire `AGENTS.md`, `README.md`, le cahier des charges, l'architecture, les décisions et les présentes consignes.
- La stack est verrouillée : React, Vite, TypeScript, Tailwind CSS, Lucide React, API REST Cloudflare Pages Functions, PWA d'abord et préparation Capacitor.
- Aucun assistant ne peut remplacer TypeScript par un autre langage applicatif, migrer vers Next.js/Vue/Angular/Svelte ou changer de framework, de gestionnaire de dépendances ou d'architecture sans validation explicite de l'utilisateur.
- Les migrations de versions et changements de dépendances doivent être justifiés, limités et documentés ; ne jamais réécrire le projet pour les préférences d'un assistant.
- Les assistants partagent les mêmes fichiers de référence et la même branche `main`. Aucun travail sur une branche parallèle ou un dépôt miroir.
- Avant chaque écriture, vérifier le dernier commit de `main` pour éviter d'écraser le travail d'un autre intervenant. Ne pas effectuer des écritures concurrentes.
- Un assistant doit signaler les changements proposés, les fichiers touchés, les tests exécutés et les limites restantes. Il ne doit jamais présenter une proposition comme une décision utilisateur.

## 11. Règle finale

**Un seul dépôt, une seule branche `main`, tout le travail directement sur GitHub, aucun développement non autorisé, aucune suppression non autorisée, aucune fonctionnalité fictive.**
