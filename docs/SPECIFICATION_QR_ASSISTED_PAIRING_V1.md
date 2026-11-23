# SAC — Spécification de l'appairage assisté par QR code V1

**Date :** 21 novembre 2026
**Statut :** proposition de conception. **Aucun code, aucune API, aucune migration D1 et aucune activation réelle.**
**Dépendances :** `HOMOLOGATION_ENROLEMENT_SECOND_APPAREIL_V1.md`, `SPECIFICATION_CANDIDATE_ENROLEMENT_MULTI_APPAREILS_V1.md`, `SCHEMA_CANDIDAT_TRANSCRIPT_ENROLEMENT_V1.md`, `MODELE_D1_ATOMIQUE_ENROLEMENT_SECOND_APPAREIL_V1.md`, `ANTI_RESTAURATION_D1_CHOIX_AUTORITE.md`.

## 1. Objet

Répondre à la question : peut-on générer un code ou un QR code pour permettre à un second appareil de se connecter ?

**Réponse courte :** un QR code peut être un **canal de transport d'appairage**. Il ne doit jamais être une authentification complète, ni créer une session à lui seul.

La présente spécification distingue trois usages :

- **Q0 — récupération assistée** : le nouvel appareil s'authentifie normalement, puis affiche un QR pour que la racine retrouve et approuve la demande. **Compatible avec les décisions actuelles ; recommandé.**
- **Q1 — amorçage d'appairage** : la racine affiche un QR, le nouvel appareil le scanne sans mot de passe et obtient seulement un état *pending*. **Nouvelle voie d'authentification ; non approuvée.**
- **Q2 — connexion directe par QR** : le QR crée une session ou remplace l'approbation racine. **Interdit.**

## 2. Invariants non négociables

Même avec un QR code :

- une seule racine WebAuthn active ;
- seule la racine active approuve un secondaire ;
- un secondaire ne peut ni s'auto-approuver, ni approuver un autre appareil, ni devenir racine ;
- aucune récupération ou promotion de racine en V1 ;
- aucune session, aucun accès aux données et aucune capacité privée avant le commit atomique ;
- les deux appareils signent le même transcript canonique avec des domaines séparés ;
- le SAS six mots est comparé par un canal indépendant du serveur et du QR ;
- le QR ne contient jamais de clé privée, mot de passe, OTP, jeton de session, secret de récupération ou donnée GPS ;
- la restauration D1 reste fail-closed tant que l'autorité anti-restauration de production n'est pas choisie.

## 3. Modèle de menace

Le QR code est visible, photographiable et partageable. Il faut considérer :

- un attaquant qui photographie le QR à distance ;
- un attaquant qui remplace le QR affiché par un autre ;
- un attaquant qui rejoue un QR expiré ou déjà consommé ;
- un attaquant qui crée sa propre cérémonie et demande à la victime de scanner ;
- un attaquant qui obtient un accès temporaire au téléphone racine ;
- un attaquant qui restaure une sauvegarde D1 antérieure ;
- un secondaire compromis qui tente d'approuver un autre appareil ;
- une collision ou une devinette de code court ;
- une course entre approbation et révocation de la racine.

Le QR ne réduit aucune de ces menaces à lui seul. Il déplace seulement le problème vers un secret d'appairage à courte durée de vie, une approbation racine WebAuthn et une comparaison SAS.

## 4. Format du QR code

### 4.1 URI candidate

```text
sac-pair://v1?m=<mode>&id=<identifiant>&s=<secret>&e=<expiration>
```

Champs :

| Champ | Rôle | Règle |
|---|---|---|
| `v` | version du format | constante `1` |
| `m` | mode | `retrieve` (Q0) ou `bootstrap` (Q1) |
| `id` | identifiant opaque | 16 octets base64url sans padding |
| `s` | secret d'appairage | 32 octets CSPRNG, base64url sans padding |
| `e` | expiration | epoch Unix en millisecondes, indicatif pour l'UI ; le serveur reste autoritaire |

Le QR ne contient ni compte, ni e-mail, ni nom, ni clé publique complète, ni rôle, ni permission. L'identifiant et le secret sont opaques.

### 4.2 Génération

- Secret généré par un CSPRNG côté serveur ou côté client selon le mode, avec au moins 256 bits.
- Le serveur ne stocke que le hash SHA-256 du secret, jamais le secret brut.
- Comparaison en temps constant.
- QR dynamique uniquement ; aucun QR statique imprimé ou réutilisable.
- Taille visuelle suffisante, correction d'erreur standard, pas de logo masquant les modules.
- Le QR expire et est annulé par l'UI à la fin de la cérémonie.

### 4.3 Ce que le QR ne doit jamais contenir

- un mot de passe, un OTP ou un code de récupération ;
- un jeton de session brut ;
- une clé privée ou un secret de signature ;
- une approbation racine pré-signée ;
- des données personnelles, GPS ou de santé ;
- une URL de fournisseur ou un secret d'infrastructure.

## 5. Mode Q0 — récupération assistée

### 5.1 Principe

Le nouvel appareil suit le parcours de compte normal. Le QR sert uniquement à éviter la saisie manuelle de l'identifiant de cérémonie sur la racine.

### 5.2 Séquence

1. Le nouvel appareil s'authentifie normalement et crée une demande d'enrôlement.
2. Le serveur crée une cérémonie `pending`, un défi et un `retrievalSecret` à durée courte.
3. Le nouvel appareil affiche le QR `retrieve`.
4. La racine scanne le QR depuis une session racine active.
5. Le serveur vérifie : compte identique, racine active, cérémonie pending, secret valide, non expiré, non consommé.
6. La racine récupère le transcript et affiche le SAS.
7. Les deux appareils comparent le SAS par présence physique ou appel déjà connu.
8. La racine approuve avec WebAuthn ; le nouvel appareil signe le transcript.
9. Le serveur vérifie les deux signatures et commit atomiquement.
10. Le nouvel appareil reçoit une session seulement après le commit.

### 5.3 Propriétés

- Aucune nouvelle voie d'authentification.
- Le QR ne donne aucune session.
- Le secret de récupération est un bearer token de lecture ; il ne permet pas l'approbation.
- Le vol du QR permet au maximum de lire les métadonnées de la cérémonie avec une session racine valide, pas d'activer un appareil.
- Le QR peut être à usage unique ou réutilisable jusqu'à l'expiration de la cérémonie ; ce point doit être arbitré.

## 6. Mode Q1 — amorçage d'appairage

### 6.1 Principe

La racine authentifiée génère un ticket d'appairage et l'affiche. Le nouvel appareil le scanne sans mot de passe, mais n'obtient qu'un état **pending**. Il ne reçoit aucune session et aucune donnée privée avant l'approbation racine.

Ce mode est une **nouvelle voie d'authentification**. Il ne doit pas être implémenté sans décision explicite.

### 6.2 Séquence candidate

1. La racine authentifiée demande un ticket d'appairage.
2. Le serveur crée un ticket `active`, lié au compte, à la racine et à une expiration courte, et renvoie le QR `bootstrap`.
3. Le nouvel appareil scanne le QR et résout le ticket.
4. Le serveur vérifie le hash du secret, l'expiration, l'état de la racine et l'unicité du ticket.
5. Le serveur consomme le ticket atomiquement et crée une cérémonie `pending` avec un défi WebAuthn.
6. Le nouvel appareil crée sa credential WebAuthn et envoie sa clé publique et son attestation.
7. La racine voit la demande, le type d'appareil déclaré et le SAS.
8. Les deux appareils comparent le SAS.
9. La racine approuve avec WebAuthn ; le nouvel appareil signe le transcript.
10. Le serveur commit atomiquement et le nouvel appareil reçoit une session.

### 6.3 Contraintes Q1

- Un seul ticket actif par compte.
- Ticket à usage unique, expiration proposée : 2 minutes.
- Cérémonie : 10 minutes, conformément à la décision validée.
- Aucune session pending.
- Aucun accès aux alertes, proches, trajets ou données privées.
- La racine doit voir explicitement « nouvel appareil inconnu » et le SAS ; aucun auto-approve au scan.
- Si la racine n'a pas initié l'ajout, elle doit pouvoir rejeter et révoquer le ticket.
- Le ticket volé ne doit pas pouvoir être utilisé après consommation.
- Le taux de création de tickets et de résolutions doit être limité.
- Le nom d'appareil déclaré par le client n'est jamais une preuve.

### 6.4 Risque résiduel

Un attaquant qui photographie le QR avant le nouvel appareil légitime peut consommer le ticket et créer sa propre cérémonie. La racine verra une demande inattendue et un SAS différent. La sécurité repose alors sur le rejet explicite et la comparaison SAS, pas sur le secret du QR.

## 7. Mode Q2 — interdit

Est interdit :

- un QR qui ouvre directement une session ;
- un QR qui remplace l'approbation WebAuthn de la racine ;
- un QR qui permet à un secondaire de s'auto-approuver ;
- un QR qui permet à un secondaire d'approuver un autre appareil ;
- un QR qui promeut un secondaire en racine ;
- un QR de récupération ou de remplacement de racine en V1 ;
- un QR statique ou réutilisable indéfiniment.

## 8. Codes courts

Un code à 6 chiffres ne contient qu'environ 20 bits. Il est insuffisant comme authentification et peut être deviné ou observé.

Règles proposées :

- un code court ne remplace jamais le QR et l'approbation racine ;
- il sert uniquement de **référence de ticket** à faible sensibilité ;
- il est à usage unique, expire en 2 minutes et est limité en tentatives ;
- il ne doit jamais être un OTP de connexion ;
- un code de secours sans caméra doit contenir au moins 12 caractères base32, soit environ 60 bits, et rester soumis à l'approbation racine ;
- aucun code court ne doit être envoyé par SMS comme preuve d'identité.

## 9. Liaison cryptographique

### 9.1 Q0

Le QR ne modifie pas le transcript validé. Le secret de récupération n'est pas signé : il sert seulement à retrouver la cérémonie. L'approbation racine signe le transcript complet, qui contient déjà l'identifiant de cérémonie, le défi, les nonces, les clés et les dates.

### 9.2 Q1

Le ticket est stocké hors du transcript, avec son hash et son état dans D1. La cérémonie créée est liée au ticket consommé. Le transcript existant reste inchangé.

Une liaison cryptographique plus forte consisterait à ajouter un champ `pairingSecretHash` au transcript. Cela créerait une **version 2 du schéma**, avec de nouveaux vecteurs et une nouvelle revue. Cette option n'est pas approuvée et ne doit pas être ajoutée à la version 1 à 19 champs.

### 9.3 Pourquoi ne pas mettre le secret dans le transcript maintenant

Le schéma V1 est déjà candidat, testé et limité à 19 champs. L'ajout d'un champ changerait les octets canoniques, les signatures, le SAS et les vecteurs de test. Une telle évolution exige une décision distincte et une revue indépendante.

## 10. SAS et indépendance du canal

Le SAS six mots reste obligatoire dans Q0 et Q1.

- Il est calculé à partir du transcript canonique et de la signature racine selon la spécification validée.
- Il est affiché sur le nouvel appareil et sur la racine.
- Il est comparé physiquement ou par un canal déjà connu, jamais par le QR lui-même.
- Un SAS différent, illisible ou non comparable annule la cérémonie.
- Le scan du QR ne vaut jamais confirmation du SAS.
- La racine doit confirmer explicitement, avec WebAuthn, après avoir vu le SAS.

## 11. Exigences serveur et atomicité

Aucun SQL de production n'est défini ici. Le modèle doit respecter les contrats D1 déjà éprouvés localement :

- consommation atomique du ticket ou du secret de récupération ;
- création de cérémonie et consommation du ticket dans le même commit ;
- une seule cérémonie `pending` par compte ;
- une seule racine active ;
- idempotence par clé et hash de contenu ;
- rollback complet si une précondition échoue ;
- sérialisation avec la révocation de la racine ;
- refus fail-closed si l'ancre anti-restauration est absente ou incohérente ;
- aucune session avant le commit final ;
- audit append-only des créations, résolutions, approbations, rejets et révocations.

Le ticket et le secret ne doivent jamais apparaître en clair dans les logs, les traces, les erreurs ou les URLs de fournisseur.

## 12. Anti-abus

Les valeurs suivantes sont des propositions, pas des décisions validées :

- ticket : 2 minutes ;
- cérémonie : 10 minutes ;
- un seul ticket actif par compte ;
- limitation par compte, appareil et adresse réseau ;
- nombre maximal de résolutions et d'échecs ;
- pas de CAPTCHA dans le chemin SOS ;
- pas de dépendance fournisseur dans le chemin critique ;
- notification à la racine lors d'une demande inattendue ;
- possibilité de révoquer un ticket ou une cérémonie pending.

## 13. UX et accessibilité

### Racine

- bouton « Ajouter un appareil » ;
- QR plein écran avec expiration visible ;
- avertissement : ne scanner que le QR affiché par l'appareil à ajouter ;
- après scan : type d'appareil déclaré, clé/empreinte, SAS six mots ;
- boutons explicites « Approuver » et « Rejeter » ;
- jamais d'approbation automatique après scan ;
- en cas de doute : annuler et révoquer le ticket.

### Nouvel appareil

- Q0 : authentification normale, puis affichage du QR ;
- Q1 : scan, puis écran « En attente d'approbation » ;
- affichage du SAS et de l'état pending ;
- aucune donnée privée avant activation ;
- message clair si le ticket est expiré, consommé ou rejeté.

### Langues et RTL

Tous les textes doivent être centralisés dans `src/i18n/translations.ts`, avec français, anglais et arabe, et une mise en page RTL réelle. Aucun texte métier directement dans les composants.

## 14. Tests prévus avant toute implémentation

- parseur QR strict : schéma, version, longueurs, base64url, champs inconnus ;
- secret de 256 bits, hash serveur, comparaison en temps constant ;
- expiration et usage unique ;
- QR rejoué, consommé, expiré, malformé ;
- mauvais compte, mauvaise racine, secondaire qui tente d'approuver ;
- course entre deux résolutions ;
- course entre approbation et révocation de la racine ;
- restauration D1 antérieure et tête d'ancre stale ;
- SAS différent, illisible ou non comparé ;
- appareil déjà actif ou révoqué ;
- idempotence de la résolution et de l'approbation ;
- absence de session avant commit ;
- absence de secret dans les logs ;
- UI FR/EN/AR et RTL ;
- tests réels Android/iOS et navigateurs cibles.

## 15. Décisions requises

1. Choisir **Q0 seul** ou **Q0 + Q1**.
2. Si Q1 est retenu, l'approuver comme nouvelle voie d'authentification, avec revue de sécurité distincte.
3. Fixer la durée du ticket (proposition : 2 minutes).
4. Fixer le caractère réutilisable ou unique du secret de récupération Q0.
5. Fixer le format définitif de l'URI QR.
6. Décider si un code court de secours est autorisé, et avec quelle longueur.
7. Décider si `pairingSecretHash` doit entrer dans un transcript V2.
8. Choisir l'autorité anti-restauration de production.
9. Faire la revue indépendante du protocole et des vecteurs.

## 16. Verdict

**Q0 : compatible avec les décisions actuelles, mais non implémenté.**
**Q1 : nouvelle voie d'authentification, NON APPROUVÉE.**
**Q2 : INTERDIT.**
**Code court seul : INTERDIT comme authentification.**
**API, D1, session et activation : NON AUTORISÉES.**
**Enrôlement secondaire réel : NON HOMOLOGUÉ POUR LA PRODUCTION.**
