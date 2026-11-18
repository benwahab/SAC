# SAC — Écarts de cohérence du protocole multi-appareils

**Date :** 18 novembre 2026  
**Statut :** constat d'audit documentaire — aucune décision cryptographique nouvelle, aucune implémentation autorisée.

Ce relevé compare `docs/PROTOCOLE_MULTI_APPAREILS.md`, `docs/TRANSCRIPT_CEREMONIE_MULTI_APPAREILS.md` et le prototype `src/services/device/device-certificate.ts`. Il vise à empêcher que deux propositions incompatibles soient implémentées par des agents différents.

## 1. Format canonique : divergence à résoudre

- La section 13.2 de `PROTOCOLE_MULTI_APPAREILS.md` désigne JSON Canonicalization Scheme (RFC 8785).
- `TRANSCRIPT_CEREMONIE_MULTI_APPAREILS.md` cite CBOR déterministe comme exemple et précise que le choix final n'est pas fait.
- Le prototype de certificat utilise actuellement un tableau JSON construit avec `JSON.stringify`, ce qui n'est pas à lui seul une implémentation générale de RFC 8785.

**Risque :** clients, serveur et certificats pourraient signer des octets différents ou croire à tort qu'ils appliquent le même encodage.

**À faire avant code :** décider d'un seul format/version, définir le schéma exact, les règles de rejet et les vecteurs de test communs. Tant que ce choix n'est pas arbitré, aucun format ne doit être déclaré canonique pour l'ensemble du protocole.

## 2. Preuve du nouvel appareil : divergence sur les signatures

- La section 13.3 du protocole décrit la signature du transcript par l'appareil racine, puis la signature d'un certificat par la racine.
- Le nouveau document de transcript propose en plus une signature du transcript par la clé d'identité du nouvel appareil.
- Le prototype actuel de certificat secondaire est signé uniquement par la clé racine ; il ne vérifie pas de signature de transcript du nouvel appareil.

**Risque :** les implémenteurs pourraient considérer qu'une preuve de possession de la clé du nouvel appareil est déjà incluse alors que le prototype ne la réalise pas sous cette forme.

**À faire avant code :** spécifier précisément les preuves de possession nécessaires, leur ordre, les octets signés, les clés utilisées et les vérifications côté serveur et côté nouvel appareil. Ne pas confondre possession d'une clé publique importée, signature racine et approbation utilisateur.

## 3. Nonces et défis : propriétaire et liaison à clarifier

Le nouveau document attribue un nonce au nouvel appareil et un défi au serveur, tandis que la section 13.3 mentionne également un nonce de la racine. Les sources d'aléa, les tailles, la durée de vie et la liaison exacte entre ces valeurs et l'état serveur doivent être uniformisées.

**À faire avant code :** fixer pour chaque valeur son générateur, son propriétaire, sa taille, son encodage, son usage unique, sa liaison au compte/racine/nouvel appareil et sa politique de consommation atomique.

## 4. Valeur de comparaison indépendante (SAS)

La section 13.3 propose six mots et une cible d'au moins 66 bits ; le nouveau document parle d'une courte valeur de comparaison sans fixer d'algorithme ni de représentation.

**Risque :** les interfaces pourraient afficher des valeurs calculées différemment ou avec une sécurité réelle inférieure à la cible annoncée.

**À faire avant code :** figer une seule construction SAS versionnée, les octets d'entrée exacts, la liste de mots et sa version, le calcul de bits effectif, l'ordre d'affichage et des vecteurs de test interopérables.

## 5. Certificat expérimental : limites confirmées

Le module `src/services/device/device-certificate.ts` vérifie actuellement une signature racine, un compte et un identifiant d'appareil attendus, l'empreinte de la racine et les clés publiques P-256. Son interface de certificat ne porte pas encore tous les champs du transcript candidat (défi, nonce, cérémonie, expiration, version de clé racine et usages explicites).

Il ne réalise pas à lui seul :
- l'approbation utilisateur sur les deux appareils ;
- la consommation atomique d'un défi côté serveur ;
- la vérification de l'état actif/non révoqué de la racine au commit ;
- la révocation et l'invalidation des sessions ;
- l'idempotence d'une activation après perte réseau.

**Conclusion :** ce module est un prototype local de vérification de certificat, pas un mécanisme d'enrôlement multi-appareils complet.

## 6. Décision de travail

Avant toute API, migration D1 ou raccordement de clés au GPS :
1. fusionner les deux documents en une spécification normative unique, après arbitrage des divergences ci-dessus ;
2. faire relire indépendamment le format, les signatures, le SAS et le modèle de menace ;
3. produire des vecteurs de test identiques pour Web, Android, iOS et serveur ;
4. démontrer la sérialisation atomique entre approbation, révocation et consommation de défi ;
5. vérifier récupération et rotation de la racine.

Aucune modification de code, API, migration, ressource Cloudflare ou donnée GPS réelle n'est autorisée par ce relevé. La règle NO-GO sur l'historique GPS et la destruction irréversible J+30 reste inchangée.

## Référence de décision transversale

Consulter également `CONSOLIDATION_APPAREILS_SESSIONS_ET_RECUPERATION.md` pour la matrice des scénarios et les blocages V1. Les divergences du format canonique, des signatures, nonces et SAS recensées ici restent ouvertes ; ce lien ne choisit aucun protocole.
