# SAC — Sécurité, Alerte, Citoyenne

SAC est un projet d'application de sécurité et d'alerte citoyenne. Le dépôt contient d'abord la documentation de référence : le projet n'est pas encore en phase de développement logiciel.

## Règles impératives du dépôt

- Une seule branche de travail : `main`.
- Tout le travail est réalisé directement sur GitHub, dans ce dépôt.
- Ne créer aucune branche secondaire.
- Ne pas créer de dépôt parallèle et ne pas mélanger SAC avec PCS ou Coup Sûr.
- Ne pas commencer le développement de l'application avant une demande explicite.
- Les décisions confirmées et les points encore à valider sont distingués dans la documentation.

## Documents de référence

| Document | Contenu |
|---|---|
| [Cahier des charges complet](docs/CAHIER_DES_CHARGES_SAC.md) | Besoins fonctionnels, parcours, écrans, règles métier, notifications, exigences non fonctionnelles et critères de validation. |
| [Architecture et modèle de données](docs/ARCHITECTURE_ET_MODELE_DONNEES.md) | Architecture cible, domaines backend, modèle relationnel conceptuel, sécurité, API et traitements planifiés. |
| [Consignes permanentes de travail](docs/CONSIGNES_DE_TRAVAIL.md) | Règles à respecter pour toute intervention future sur SAC. |
| [Décisions et points à valider](docs/DECISIONS_ET_POINTS_A_VALIDER.md) | Décisions actées, propositions techniques et sujets non tranchés. |

## Identité produit

- Nom : **SAC — Sécurité, Alerte, Citoyenne**
- Aucun logo n'est défini à ce stade.
- Interface mobile-first, claire et professionnelle.
- Palette sans violet : bleu nuit `#142B45`, rouge SOS `#D9273F`, blanc `#FFFFFF`, vert `#15966B`, gris clair `#E9EEF3`.
- Orientation produit : PWA en premier, avec possibilité d'applications Android et iOS ultérieures.

## État actuel

**Phase : cadrage et documentation.** Aucun code applicatif, aucune migration de base de données et aucune intégration de paiement ou de messagerie ne doivent être ajoutés sans autorisation explicite.
