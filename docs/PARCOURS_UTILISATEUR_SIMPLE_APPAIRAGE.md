# SAC — Parcours utilisateur simple d'appairage d'un téléphone

**Date :** 21 novembre 2026
**Statut :** proposition d'interface. **Aucun code, aucune API, aucune migration D1.**
**Portée :** parcours Q0 documenté pour la variante sécurisée. **Décision du 21 novembre 2026 : l'Option 2 est retenue** ; voir `DECISION_CONNEXION_MULTI_APPAREILS_OPTION_2.md`. Le parcours Q0 reste la référence si l'on revient à l'approbation par le téléphone principal.

## 1. Principe

L'utilisateur ne doit jamais voir :

- de clé cryptographique ;
- de transcript, hash, signature ou D1 ;
- de mot « racine », « secondaire » ou « SAS » ;
- de secret à recopier.

L'interface parle simplement :

- **« votre téléphone principal »** ;
- **« le nouvel appareil »** ;
- **« les mots de vérification »** ;
- **« Approuver »**, **« Annuler »**, **« Réessayer »**.

La clé WebAuthn est créée automatiquement par le téléphone. L'utilisateur confirme seulement avec Face ID, empreinte ou code du téléphone.

## 2. Parcours en 4 actions

1. Le nouvel appareil se connecte au compte.
2. Il affiche un QR code.
3. Le téléphone principal scanne le QR et affiche les mêmes mots de vérification.
4. L'utilisateur confirme que les mots sont identiques, puis approuve avec sa biométrie.

Aucun mot de passe supplémentaire, aucun code à recopier, aucune clé à fabriquer.

## 3. Écrans du nouvel appareil

### Écran N1 — Connexion normale

**Titre :** Bienvenue sur SAC

**Texte :** Connectez-vous à votre compte pour continuer.

**Actions :**

- Continuer avec Face ID / empreinte ;
- Recevoir un code par e-mail ;
- Utiliser mon mot de passe.

**Note :** le nouvel appareil doit d'abord être authentifié. Le QR ne remplace pas cette étape.

### Écran N2 — Appareil non approuvé

**Titre :** Cet appareil n'est pas encore approuvé

**Texte :** Pour utiliser SAC sur ce téléphone, ajoutez-le avec votre téléphone principal.

**Actions :**

- **Ajouter cet appareil** ;
- **Plus tard**.

**Texte secondaire :** Vous ne pourrez pas recevoir d'alertes ni accéder à vos proches avant l'approbation.

### Écran N3 — QR code

**Titre :** Scannez ce code avec votre téléphone principal

**Texte :** Ouvrez SAC sur votre téléphone principal, puis choisissez « Ajouter un appareil ».

**Élément central :** QR code.

**Texte sous le QR :** Ce code expire dans 10 minutes.

**Actions :**

- **Annuler** ;
- **Afficher un code à saisir** (accessibilité, si validé).

**Avertissement :** Ne partagez pas ce code. Il sert uniquement à ajouter cet appareil à votre compte.

### Écran N4 — En attente

**Titre :** En attente de votre téléphone principal

**Texte :** Gardez cette page ouverte. Votre téléphone principal doit confirmer l'ajout.

**Indicateur :** animation discrète, sans bloquer l'écran.

**Action :** **Annuler**.

**Si le réseau est perdu :** « Connexion interrompue. Vérifiez votre réseau. Ne recréez pas un code sans nécessité. »

### Écran N5 — Mots de vérification

**Titre :** Vérifiez que ces mots sont identiques sur votre téléphone principal

**Texte :** Les deux téléphones doivent afficher exactement les mêmes paires, dans le même ordre.

**Affichage :**

```text
maison – soleil
rivière – porte
orange – livre
```

**Actions :**

- **Elles sont identiques** ;
- **Elles sont différentes**.

**Si différentes :** annuler immédiatement et afficher : « N'approuvez pas. Recommencez depuis votre téléphone principal. »

### Écran N6 — Appareil ajouté

**Titre :** Appareil ajouté

**Texte :** Vous pouvez maintenant utiliser SAC sur ce téléphone.

**Actions :**

- **Continuer** ;
- **Voir mes appareils**.

**Note :** la session n'est créée qu'après la confirmation du serveur, jamais avant.

### Écran N7 — Ajout annulé ou expiré

**Titre :** Ajout non terminé

**Texte :** Le code a expiré, a déjà été utilisé ou l'ajout a été annulé.

**Actions :**

- **Recommencer** ;
- **Revenir à l'accueil**.

## 4. Écrans du téléphone principal

### Écran P1 — Ajouter un appareil

**Titre :** Ajouter un appareil

**Texte :** Utilisez cette option pour approuver un nouveau téléphone.

**Action :** **Scanner un QR code**.

**Texte secondaire :** Ne scannez que le code affiché par le téléphone que vous êtes en train d'ajouter.

### Écran P2 — Scanner

**Titre :** Scannez le QR affiché sur le nouvel appareil

**Élément :** caméra.

**Actions :**

- **Saisir un code** (accessibilité, si validé) ;
- **Annuler**.

**Aide :** Le code se trouve dans SAC, sur le nouvel appareil, à l'écran « Ajouter cet appareil ».

### Écran P3 — Nouvel appareil détecté

**Titre :** Nouvel appareil détecté

**Texte :** Vérifiez que les mots ci-dessous sont identiques sur les deux téléphones.

**Affichage :**

```text
maison – soleil
rivière – porte
orange – livre
```

**Actions :**

- **Identiques, continuer** ;
- **Différents, annuler**.

**Avertissement :** Si vous n'êtes pas en train d'ajouter un téléphone, appuyez sur « Différents, annuler ».

### Écran P4 — Confirmation biométrique

**Titre :** Confirmez que c'est bien vous

**Texte :** Utilisez Face ID, votre empreinte ou le code de votre téléphone.

**Action système :** WebAuthn / passkey.

**Annulation :** retour à l'écran précédent, sans approbation.

### Écran P5 — Appareil approuvé

**Titre :** Appareil approuvé

**Texte :** Le nouveau téléphone peut maintenant se connecter à votre compte.

**Actions :**

- **Terminer** ;
- **Voir mes appareils**.

### Écran P6 — Mots différents

**Titre :** N'approuvez pas cet appareil

**Texte :** Les mots ne sont pas identiques. L'ajout a été annulé.

**Actions :**

- **Fermer** ;
- **Voir mes appareils**.

**Texte secondaire :** Si vous n'êtes pas à l'origine de cette demande, vérifiez vos sessions et changez votre mot de passe.

## 5. Ce que l'utilisateur ne fait jamais

- créer une clé ;
- noter une clé ;
- copier un secret ;
- envoyer un code par SMS ;
- lire un hash ;
- comprendre un transcript ;
- confirmer une approbation sans avoir vu les mots.

## 6. Messages d'erreur simples

| Situation | Message utilisateur |
|---|---|
| QR expiré | Ce code a expiré. Recommencez depuis le nouvel appareil. |
| QR déjà utilisé | Ce code a déjà servi. Demandez un nouveau code. |
| Mauvais compte | Ce code ne correspond pas à votre compte. |
| Téléphone principal révoqué | Votre téléphone principal n'est plus autorisé. |
| Réseau perdu | Connexion interrompue. Vérifiez votre réseau et réessayez. |
| Trop de tentatives | Trop de tentatives. Réessayez dans quelques minutes. |
| Mots différents | N'approuvez pas. Les deux téléphones ne sont pas d'accord. |
| Appareil déjà ajouté | Cet appareil est déjà approuvé. |
| Caméra indisponible | Saisissez le code affiché sur le nouvel appareil. |

## 7. Accessibilité et langues

- Tous les textes visibles passent par `src/i18n/translations.ts`.
- Français, anglais et arabe.
- L'arabe utilise `dir="rtl"` réel, pas seulement une traduction.
- Le QR reste centré ; les mots et les chiffres restent lisibles en RTL.
- Le QR ne doit pas être le seul moyen : prévoir un code manuel accessible si validé.
- Les mots de vérification sont affichés en gros, avec contraste suffisant.
- Les boutons ne reposent jamais uniquement sur la couleur.
- Les messages d'erreur sont annoncés par les lecteurs d'écran.

## 8. Ce qui reste invisible mais obligatoire

Même si l'écran est simple, le serveur doit toujours :

- vérifier que le téléphone principal est actif ;
- vérifier que le nouvel appareil est `pending` ;
- vérifier que le QR n'est pas expiré ou rejoué ;
- vérifier les deux signatures ;
- comparer le transcript exact ;
- consommer le défi atomiquement ;
- refuser une approbation si la racine a été révoquée ;
- refuser toute session avant le commit ;
- refuser toute ressource si l'ancre anti-restauration est absente ou incohérente.

L'utilisateur ne voit pas ces contrôles. Ils ne doivent jamais être supprimés pour raccourcir l'écran.

## 9. Décisions encore ouvertes

1. Le QR est-il affiché par le nouvel appareil (Q0 strict) ou par le téléphone principal (variante à valider) ?
2. Les mots sont-ils affichés en 6 mots ou en 3 paires ?
3. Un code manuel de secours est-il autorisé, et avec quelle longueur ?
4. La biométrie est-elle obligatoire ou un code de téléphone suffit-il ?
5. Que faire si le téléphone principal est perdu ? Ce parcours ne le résout pas et ne doit pas inventer une auto-approbation.
6. Quels délais et quotas exacts pour les tentatives ?

## 10. Verdict

**Parcours simple : défini pour revue.**
**Aucune clé manuelle, aucun jargon et aucun secret à recopier.**
**QR seul : toujours interdit comme authentification.**
**Approbation du téléphone principal et comparaison des mots : obligatoires.**
**Aucun code, endpoint, D1 ou session : NON AUTORISÉS.**


## 11. Variante Option 2 — décidée le 21 novembre 2026

L'Option 2 supprime le QR et l'approbation par le téléphone principal.

### Écran N1 — Connexion

**Titre :** Se connecter

**Texte :** Utilisez l'adresse e-mail vérifiée de votre compte et votre mot de passe.

**Actions :**

- **Se connecter** ;
- **Recevoir un code par e-mail** si ce parcours est disponible.

### Écran N2 — Session ouverte

**Titre :** Bienvenue sur SAC

**Texte :** Votre session est ouverte sur cet appareil.

**Actions :**

- **Continuer**.

### Ce qui disparaît

- le QR d'appairage ;
- les 3 paires de mots ;
- l'approbation par le téléphone principal ;
- la session pending.

### Ce qui reste

- mot de passe vérifié ;
- compte actif ;
- e-mail principal vérifié ;
- limite de tentatives ;
- session liée à l'appareil ;
- une seule credential WebAuthn racine par compte ;
- révocation des sessions.

### Risque affiché à l'utilisateur

Un mot de passe volé suffit pour ouvrir une session sur un nouvel appareil. La révocation d'un appareil ne bloque pas une nouvelle connexion par mot de passe. Cette voie est donc moins forte que le parcours Q0.
