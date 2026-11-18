# SAC — Audit ciblé des dépendances et de la reproductibilité

**Date de vérification :** 18 novembre 2026  
**Portée :** audit des dépendances npm observé dans GitHub Actions ; ce document n'est pas un audit exhaustif de sécurité applicative.

## 1. Résultat observé dans la CI

Le journal du run GitHub Actions `44262859615` montre :

- `npm audit --omit=dev --audit-level=high` : **0 vulnérabilité** ;
- `npm audit --audit-level=high` : **11 alertes élevées**, toutes issues de la chaîne transitive de `picomatch` ;
- les 11 occurrences sont des chemins de dépendances, pas 11 vulnérabilités indépendantes ;
- la chaîne mentionnée comprend notamment `vite`, `tinyglobby`, `fdir`, `tailwindcss`, `chokidar`, `fast-glob`, `micromatch`, `anymatch` et `readdirp`.

L'avis référencé est GHSA-fc5q-39xc-vjpf / CVE-2026-112366. Il décrit un risque ReDoS dans picomatch jusqu'à la version 4.0.7, via des motifs extglob à branche unique. Au moment de la vérification, les sources consultées ne donnent pas de version corrigée publiée ; le statut de la vulnérabilité et les discussions amont doivent rester suivis. Références :
- https://github.com/advisories/GHSA-fc5q-39xc-vjpf
- https://osv.dev/vulnerability/GHSA-fc5q-39xc-vjpf
- https://github.com/micromatch/picomatch/pull/194

## 2. Interprétation du risque pour SAC

Les occurrences relevées sont dans les dépendances de développement / de construction, et l'audit de production est à zéro dans le run observé. Cela réduit le risque d'exposition directe dans le bundle/runtime de production, mais ne supprime pas le risque pour :
- les machines de développement qui exécutent Vite/Tailwind ;
- les runners CI qui installent et exécutent la chaîne de build ;
- toute fonctionnalité ou tout outil qui traiterait des motifs contrôlables par un utilisateur.

Il faut donc éviter de fournir à ces outils des motifs glob non fiables, et ne pas présenter le résultat « 0 vulnérabilité production » comme un audit de sécurité global de SAC.

## 3. Pourquoi aucune mise à niveau forcée n'a été appliquée

Le journal npm recommande `npm audit fix --force` et annonce qu'il installerait `vite@6.2.7`, alors que `package.json` déclare `vite: ^6.3.5`. Cette opération peut donc introduire une rétrogradation hors de la plage actuellement déclarée, en plus de modifier indirectement l'arbre des dépendances.

Les sources consultées n'identifient pas encore de version picomatch corrigée à épingler sans risque. Ajouter arbitrairement un override, ignorer l'avis ou forcer une rétrogradation ne constitue pas une correction démontrée.

**Décision technique provisoire :** ne pas lancer `npm audit fix --force`, ne pas ajouter d'override non vérifié et ne pas masquer l'avis. Refaire l'audit après publication d'une version corrigée ou d'une mitigation officielle, puis tester le nouvel arbre complet.

## 4. Reproductibilité — point à corriger séparément

Le dépôt contient `package.json`, mais aucun `package-lock.json` n'a été trouvé à la racine lors de la vérification GitHub. La CI utilise `npm install`, et non `npm ci`.

Conséquence : les versions transitives peuvent évoluer entre deux exécutions, même si `package.json` ne change pas. Une CI verte n'atteste donc pas nécessairement que deux builds successifs utilisent exactement le même arbre.

Action recommandée, à effectuer dans un environnement Node/npm contrôlé :
1. générer un `package-lock.json` avec la version Node/npm retenue ;
2. vérifier les changements et l'absence de paquets inattendus ;
3. exécuter typecheck, tous les tests, build et les deux audits ;
4. une fois le lockfile vérifié et commité, remplacer `npm install` par `npm ci` dans la CI ;
5. documenter la version Node et npm utilisées.

Ne pas remplacer la commande CI par `npm ci` avant que le lockfile existe et soit validé.

## 5. Suivi requis

- [ ] Vérifier périodiquement le statut de GHSA-fc5q-39xc-vjpf et l'existence d'une version corrigée.
- [ ] Examiner si un motif glob peut être contrôlé par un utilisateur dans les outils de build ou scripts SAC.
- [ ] Ajouter et valider un lockfile npm.
- [ ] Basculer vers `npm ci` après validation du lockfile.
- [ ] Réexécuter les audits production et complet après chaque mise à jour de la chaîne.
- [ ] Garder l'audit complet visible ; ne pas le considérer comme résolu tant que le risque n'a pas été traité ou explicitement accepté avec justification.

**Conclusion :** le runtime de production est propre selon l'audit npm observé, mais la chaîne de développement présente un avis élevé non résolu et le dépôt ne verrouille pas encore l'arbre transitif. Aucun correctif forcé n'a été appliqué.

## 6. Suivi amont du correctif picomatch — vérification du 18 novembre 2026

La veille du dépôt amont micromatch/picomatch a identifié plusieurs propositions, mais aucune n'est encore une version publiée et validée que SAC peut installer :

- **PR #238 — branche master / picomatch 4.x :** ouverte, non fusionnée au 18 novembre 2026. Elle cible précisément CVE-2026-112366 en traitant certains extglobs à branche unique commençant par un quantificateur nu. L'auteur rapporte 2 000 tests réussis, mais documente une limite connue : certains extglobs imbriqués non réductibles suivis de contenu ne sont pas couverts. Le PR ne fournit pas de release npm.
- **PR #246 — branche v2 :** ouverte, non fusionnée. Elle cible la branche 2.x ; elle ne constitue pas un correctif installable pour la dépendance picomatch 4.x potentiellement résolue par la chaîne Vite de SAC. Le PR indique aussi qu'aucune version n'est publiée.
- **PR #194 :** ouverte, non fusionnée et sans lien de résolution de CVE-2026-112366. Son auteur précise explicitement que ce n'est pas un correctif de sécurité et que le cas +(*a) reste exponentiel sur sa branche. Ne pas confondre cette PR avec le correctif de sécurité.

Sources amont vérifiées :
- Advisory GHSA-fc5q-39xc-vjpf : https://github.com/advisories/GHSA-fc5q-39xc-vjpf
- PR #238, proposition de correctif pour master : https://github.com/micromatch/picomatch/pull/238
- PR #246, adaptation de la branche v2 : https://github.com/micromatch/picomatch/pull/246
- PR #194, changement de parsing non correctif de sécurité : https://github.com/micromatch/picomatch/pull/194

**Décision maintenue :** ne pas ajouter d'override vers un commit Git non publié, ne pas appliquer un patch artisanal, ne pas ignorer l'avis npm et ne pas forcer une rétrogradation. Surveiller la fusion, les suites complètes des dépendants, la publication npm et l'avis GHSA mis à jour. Après publication, vérifier l'arbre réel et exécuter toute la CI avant d'accepter le correctif.
