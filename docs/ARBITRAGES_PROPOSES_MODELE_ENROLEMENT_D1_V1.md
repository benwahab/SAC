# SAC — Arbitrages techniques proposés avant le schéma D1 V1

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`  
**Statut :** recommandations d'architecture à valider — aucune décision utilisateur nouvelle n'est présumée.  
**Périmètre :** les trois premiers blocages du modèle relationnel : autorité racine/appareil, cérémonies concurrentes et défi cryptographique.

Ce document avance des choix concrets pour réduire les ambiguïtés et simplifier les invariants D1. Les propositions marquées « recommandation » ne sont pas des décisions déjà approuvées. Elles ne doivent pas être transformées en migration ou en code sans validation.

## 1. Arbitrage A — représentation de la racine et des appareils

### Problème

Le modèle conceptuel envisage un registre `device_roots` et un registre `devices`. Si les deux stockent chacun la clé publique, l'empreinte, le rôle et l'état, ils peuvent diverger. Si la racine n'est qu'un appareil avec un rôle spécial, il faut tout de même un moyen robuste d'exprimer la génération d'autorité du compte et d'empêcher sa substitution.

### Recommandation

Conserver deux responsabilités distinctes, avec une seule source de vérité pour chaque donnée :

**`devices`**
- registre de tous les appareils effectivement approuvés ;
- `device_id`, `account_id`, plateforme, rôle immuable (`root` ou `secondary`), clé publique d'authentification, empreinte de clé, état et dates ;
- les clés publiques de l'appareil résident ici, une seule fois ;
- un appareil n'est inséré comme approuvé qu'au commit réussi de l'enrôlement ; une cérémonie en attente ne crée pas un appareil actif ni une session.

**`device_roots`**
- registre de l'autorité racine courante du compte ;
- une ligne au plus par compte ;
- référence vers le `device_id` racine déjà présent dans `devices` ;
- `root_key_version`, empreinte de la clé d'autorité et dates/état de l'autorité ;
- ne duplique pas la clé publique complète si celle-ci est déjà stockée dans `devices`.

**Contraintes relationnelles à exiger**
- unicité de `device_roots.account_id` ;
- unicité de `device_roots.root_device_id` ;
- clé étrangère composite garantissant que le `root_device_id` appartient au même `account_id` ;
- le device référencé doit avoir le rôle `root` ;
- aucun device secondaire ne peut être référencé comme racine ;
- aucune mise à jour ordinaire ne peut changer le `root_device_id` ou diminuer/réutiliser `root_key_version` ;
- révocation de la racine : autorité désactivée de façon terminale, sans procédure de remplacement V1.

Les mécanismes SQLite exacts (index partiels, triggers, contraintes composites et ordre des écritures) seront établis dans le schéma SQL et prouvés par tests. Une contrainte déclarative seule ne suffit pas si elle ne couvre pas les transitions.

### Conséquence

Le registre de racine ne devient pas une deuxième copie du device : il représente la génération d'autorité et pointe vers l'appareil racine. Le registre appareil conserve les clés publiques propres à l'appareil.

## 2. Arbitrage B — nombre de cérémonies en attente

### Problème

Plusieurs cérémonies ouvertes simultanément pour un même compte compliquent la révocation, la consommation de défis et les courses d'approbation. Deux demandes pourraient tenter d'activer des appareils avec la même génération racine en parallèle.

### Recommandation

Autoriser **une seule cérémonie d'enrôlement en état pending par compte** en V1.

- Une seconde demande est refusée tant que la première est pending et non expirée.
- Le titulaire de la racine peut annuler la cérémonie en attente, puis en ouvrir une autre.
- Une cérémonie expirée ou annulée reste terminale et consultable selon la politique de conservation.
- Une nouvelle tentative reçoit de nouveaux identifiants et un nouveau défi ; aucune valeur ou preuve n'est réutilisée.
- L'index partiel unique D1 sur `account_id` pour l'état pending, si la syntaxe et les transitions retenues le permettent, doit être accompagné d'une logique serveur atomique.
- Les contrôles de création et d'approbation doivent être réévalués au commit, et pas seulement lors de la lecture préalable.

### Pourquoi ce choix

C'est un compromis volontaire de simplicité et de sûreté pour V1. Il évite les approbations concurrentes inutiles. Le coût est qu'un compte ne peut pas préparer deux nouveaux appareils en même temps. Une évolution ultérieure pourra lever cette limite avec une stratégie de sérialisation testée.

## 3. Arbitrage C — stockage et consommation du défi

### Problème

Le serveur doit reconstruire exactement le transcript signé pour vérifier les preuves. Stocker uniquement le hash du défi ne permet pas de reconstituer sa valeur originale. Le défi ne doit toutefois jamais apparaître dans les logs ou les messages d'erreur.

### Recommandation

- générer le défi avec un CSPRNG serveur sur 32 octets ;
- le conserver en binaire (BLOB) dans le stockage de la cérémonie, avec identifiant, émission, expiration et état ;
- le traiter comme une valeur anti-rejeu imprévisible, pas comme un secret d'authentification autonome ;
- le lier à une seule cérémonie, donc à un seul compte, une seule racine et un seul nouvel appareil ;
- ne jamais le retourner dans les journaux, analytics, URLs, traces ou erreurs ;
- le consommer dans le même commit atomique que l'approbation et la création du nouvel appareil ;
- toute expiration ou consommation est terminale ; aucune réémission sous le même identifiant ;
- une nouvelle tentative crée un nouveau défi.

Le défi brut doit rester accessible uniquement au code serveur qui construit/vérifie le transcript. Son accès doit être limité et sa conservation après expiration/consommation réduite au minimum nécessaire pour l'anti-rejeu et l'audit. La durée exacte de conservation et la politique de purge restent à fixer.

### Durée de validité

Ne pas reprendre automatiquement les 10 minutes de l'OTP e-mail : ce sont deux protocoles différents.

**Proposition à évaluer :** une validité courte, de l'ordre de quelques minutes, avec expiration contrôlée à la fois à la vérification et au commit final. La valeur exacte doit être déterminée après test du parcours multi-appareils réel et ne doit pas être codée à ce stade.

## 4. Conséquence sur la cérémonie et l'appareil en attente

Recommandation de séparation stricte :

- `enrollment_ceremonies` conserve l'identité réservée du nouvel appareil, sa plateforme, les paramètres publics nécessaires au transcript, l'identité/version de racine observée, l'empreinte du transcript et l'état de la tentative ;
- aucun enregistrement `devices` approuvé n'est créé pendant la phase pending ;
- les deux signatures sont vérifiées avant le commit ;
- le commit atomique consomme le défi, passe la cérémonie à approved et insère le nouvel appareil avec l'état active ;
- en cas de refus, expiration ou annulation, la cérémonie passe à un état terminal sans créer de device approuvé ni de session ;
- la session est créée dans une opération distincte après le commit d'activation, avec relecture de l'état courant du compte et de l'appareil.

Cette approche évite qu'un appareil pending puisse être confondu avec un appareil authentifié. Le `newDeviceId` reste réservé dans la cérémonie et n'est jamais réutilisé.

## 5. Ce que ces recommandations ne tranchent pas

Les points suivants restent bloquants et ne doivent pas être déduits de ce document :

1. profil final JCS, limites du transcript et schéma strict des clés publiques ;
2. choix définitif entre `agreementPublicKey` et tout autre nom/contrat, ainsi que la nécessité réelle de cette clé ;
3. usages exacts de chaque clé et séparation identité / accord de clé ;
4. ECDSA P-256, représentation raw/DER et politique low-S ;
5. domaines exacts des deux signatures et fixture cryptographique interopérable ;
6. algorithme SAS, liste de mots, entropie et procédure de comparaison ;
7. format et conservation des preuves cryptographiques ;
8. durée exacte du défi et politique de limitation des tentatives ;
9. modèle de session, transport, renouvellement et refresh token ;
10. atomicité réelle D1, rollback, concurrence, idempotence et restauration après révocation ;
11. conservation des cérémonies, preuves et journaux d'audit.

## 6. Tests obligatoires si les recommandations sont retenues

- impossible d'avoir deux racines pour un même compte ;
- impossible de référencer comme racine un appareil d'un autre compte ;
- impossible de promouvoir un secondaire en racine ;
- impossible de remplacer ou réactiver une racine révoquée en V1 ;
- deuxième cérémonie pending du même compte refusée atomiquement ;
- ouverture d'une nouvelle cérémonie après annulation/expiration avec nouveaux identifiants et défi ;
- défi lié à une autre cérémonie refusé ;
- défi expiré refusé au contrôle initial et au commit ;
- deux consommations concurrentes du même défi : une seule réussite ;
- approbation concurrente à révocation racine : résultat cohérent, sans activation après révocation ;
- échec de toute étape du commit : aucune activation partielle ;
- perte de réponse après commit : retry idempotent, un seul appareil créé ;
- aucun device approuvé et aucune session avant les deux preuves validées.

Les tests doivent utiliser le vrai moteur SQLite/D1 de test isolé dans la CI, pas seulement des mocks ou des tests unitaires de fonctions pures.

## 7. Suite

Ordre proposé :
1. valider ou modifier ces trois arbitrages ;
2. traiter séparément le profil des clés et des signatures avec la revue cryptographique ;
3. définir le contrat de session indépendamment de l'enrôlement ;
4. consolider les décisions retenues dans le modèle conceptuel ;
5. rédiger le schéma SQL final seulement lorsque tous les blocages nécessaires sont levés.

**Verdict :** ces recommandations rendent le futur schéma plus simple à raisonner et à tester, mais ne valent pas validation. Aucun SQL, endpoint, appareil, session ou service Cloudflare n'est créé par ce document.
