# SAC — Pré-analyse de conformité des données au Niger

**Statut :** pré-analyse documentaire, non avis juridique et non validation de la HAPDP.  
**Périmètre :** conception de SAC avant tout traitement réel de données personnelles.  
**Règle :** aucune durée de conservation hors GPS, aucun transfert international et aucun traitement sensible ne sont considérés comme autorisés sur la seule base de ce document.

## 1. Texte de référence à jour

Le cadre de référence est la loi nigérienne n° 2022-59 du 16 décembre 2022 relative à la protection des données à caractère personnel. Le site officiel de la HAPDP indique que cette loi a été modifiée par la loi n° 2023-31 du 4 juillet 2023 et par les ordonnances n° 2024-16 du 26 avril 2024 et n° 2024-29 du 24 juin 2024.

La version PDF de la loi n° 2022-59 consultée pour cette pré-analyse est le texte de base publié par la HAPDP. Avant toute déclaration, demande d'autorisation ou mise en production, il faut obtenir et examiner la version consolidée intégrant toutes les modifications de 2023 et 2024, ainsi que les délibérations et procédures actuelles de la HAPDP.

Références officielles :
- HAPDP — [Législation nationale](https://www.hapdp.ne/legislation-nationale)
- HAPDP — [Loi n° 2022-59, texte PDF](https://www.hapdp.ne/uploads/files/Loi-N%C2%B02022-59HAPDP.pdf)
- HAPDP — [Formalités](https://www.hapdp.ne/formalites)
- HAPDP — [Droits des personnes concernées](https://www.hapdp.ne/les-droits-des-personnes-concernees-par-le-traitement)

## 2. Conséquences importantes pour SAC

### 2.1 SAC est concerné par la loi

Le texte de base couvre les traitements de données réalisés par des personnes morales privées et les traitements visant des citoyens nigériens ou des personnes établies au Niger, y compris lorsque le responsable ou le sous-traitant n'est pas établi au Niger. Le fait que SAC soit une application privée ne l'exclut donc pas du cadre.

### 2.2 Formalités préalables

L'article 29 prévoit une formalité préalable auprès de la HAPDP, sauf exception prévue par la loi. L'article 30 demande notamment de décrire :
- les finalités et fonctions du traitement ;
- les catégories de données et les personnes concernées ;
- les durées de conservation ;
- les services et catégories de personnes qui ont accès aux données ;
- les destinataires ;
- les mesures de sécurité ;
- les sous-traitants et les transferts vers des pays tiers.

Le dossier de conformité de SAC devra donc être préparé avant l'activation du traitement réel. Il faut demander à la HAPDP quelle formalité précise s'applique à chaque traitement de SAC et si plusieurs finalités peuvent être déclarées ensemble.

### 2.3 Traitements nécessitant une autorisation préalable selon le texte de base

L'article 31 du texte de base énumère notamment :
- les traitements portant sur les données de santé ;
- les traitements portant sur des identifiants uniques ou de portée générale, notamment un numéro de téléphone ;
- les interconnexions de fichiers ;
- les transferts de données vers un pays tiers ;
- certains traitements de profilage et catégories sensibles.

SAC prévoit l'utilisation de numéros de téléphone pour les invitations et les contacts de confiance, ainsi qu'une catégorie d'urgence médicale. Il faut donc obtenir une position écrite de la HAPDP sur la qualification exacte de ces traitements, les formalités applicables et les éventuelles autorisations préalables. Ne pas déduire qu'un simple consentement utilisateur remplace ces formalités.

### 2.4 Hébergement et transferts internationaux

L'article 31 du texte de base vise les transferts de données vers un pays tiers et l'article 15 confie à la HAPDP un rôle d'autorisation des transferts transfrontaliers dans les conditions prévues par les textes.

Avant de choisir définitivement les régions Cloudflare, les services d'e-mail, OTP, push, SMS, paiement ou analyse, il faut établir :
- où chaque donnée est collectée, transmise, traitée, sauvegardée et supportée ;
- quelles entités peuvent y accéder ;
- si le fournisseur agit comme sous-traitant ;
- si le flux constitue un transfert vers un pays tiers ;
- quelles autorisations, garanties contractuelles et clauses sont nécessaires.

Aucune localisation d'hébergement ne doit être supposée conforme uniquement parce que le fournisseur propose une région européenne ou une option de résidence des données.

### 2.5 Conservation et suppression

L'article 84 du texte de base impose une conservation qui ne dépasse pas la durée nécessaire aux finalités. Au-delà, la conservation n'est possible que pour les finalités prévues par le texte et avec des garanties appropriées.

L'article 103 prévoit une sanction pénale pour la conservation identifiable au-delà de la durée prévue par la législation, la délibération de la HAPDP ou la déclaration préalable.

Conséquence pour SAC :
- aucune durée hors GPS ne doit être inventée ou appliquée globalement ;
- chaque catégorie doit avoir une finalité, un point de départ, une durée justifiée et une méthode de suppression ;
- les journaux, sauvegardes, exports, tickets de support et identifiants fournisseurs doivent être inclus dans l'analyse ;
- la règle GPS J+30 reste une exigence produit et technique distincte ; elle ne dispense pas de vérifier les obligations légales spécifiques ni ne doit être affaiblie par ce document.

### 2.6 Droits des personnes et suppression de compte

Les articles 71 à 76 du texte de base prévoient notamment des droits de rectification, d'opposition, de suppression/effacement, d'oubli numérique, de limitation et de portabilité, avec des exceptions encadrées lorsque certaines conservations sont légalement nécessaires.

La suppression de compte en deux phases envisagée par SAC devra donc être conçue pour :
- empêcher les nouveaux traitements non nécessaires après la demande ;
- terminer ou traiter de manière juridiquement fondée les alertes et trajets déjà actifs ;
- effacer ou anonymiser les données qui n'ont plus de finalité ;
- documenter toute conservation résiduelle, son fondement, son accès et son échéance ;
- permettre de répondre aux demandes d'effacement et de justifier les opérations.

Aucune conservation résiduelle ne doit être décidée uniquement pour des raisons de confort technique.

### 2.7 Sécurité, sous-traitants et incidents

Les articles 81 et 82 imposent confidentialité et mesures de sécurité adaptées au risque. L'article 83 prévoit une notification des violations à la HAPDP sans délai après leur connaissance, et une communication aux personnes concernées lorsqu'un risque élevé existe. L'article 86 impose des garanties suffisantes pour les sous-traitants et prévoit notamment une notification au responsable dans les meilleurs délais et au plus tard sous 72 heures après connaissance d'une violation.

SAC devra donc tenir un registre des fournisseurs, contrats de sous-traitance, accès, flux, incidents, délais de notification et mesures de sécurité.

## 3. Conséquences opérationnelles immédiates

1. Ne pas activer la collecte réelle de numéros, données de santé ou localisation avant clarification des formalités applicables.
2. Ne pas sélectionner un fournisseur international sur la seule base du prix ou de la disponibilité technique.
3. Préparer une cartographie des données et des flux avant de fixer les durées hors GPS.
4. Préparer une matrice de conservation par catégorie, sans durée arbitraire.
5. Préparer la documentation de sécurité, la procédure de violation de données et les contrats de sous-traitance.
6. Vérifier les obligations de désignation d'un correspondant à la protection des données pour la structure juridique qui portera SAC, au regard de l'article 79 et des textes modificatifs.
7. Demander un avis écrit à la HAPDP sur les traitements de SAC, en particulier numéros de téléphone, données liées aux urgences médicales, localisation, hébergement hors Niger et transferts transfrontaliers.

## 4. Questions à adresser à la HAPDP

- Quel régime de formalité s'applique à l'application SAC et à chacune de ses finalités ?
- Le traitement des numéros de téléphone pour invitations et contacts de confiance requiert-il une autorisation préalable dans le cas précis de SAC ?
- Comment qualifier les données d'urgence médicale saisies volontairement par un utilisateur ?
- Quelles formalités s'appliquent au traitement de données de localisation précises ?
- Quelles autorisations et garanties sont nécessaires si les sous-traitants techniques traitent ou sauvegardent des données hors du Niger ?
- Quelles exigences s'appliquent à la désignation du correspondant à la protection des données pour la personne morale porteuse du service ?
- Quelles durées ou règles sectorielles spécifiques doivent être prises en compte pour les journaux de sécurité et les historiques d'alertes ?

Contact officiel publié par la HAPDP : contact@hapdp.ne — +227 20 33 12 03.

## 5. Limites de cette pré-analyse

- Le PDF de base n'est pas présenté comme une version consolidée à jour.
- Les ordonnances 2024-16 et 2024-29 doivent être lues intégralement avant de conclure.
- Les faits précis de l'organisation porteuse de SAC, des fournisseurs et des régions d'hébergement ne sont pas encore arrêtés.
- Ce document ne remplace pas un avis juridique nigérien ni une réponse écrite de la HAPDP.
- Aucune durée de conservation hors GPS n'est validée ici.

**Conclusion :** le chantier de conservation hors GPS ne doit plus être traité comme une simple décision de produit. Il dépend d'une cartographie de traitement, de la version consolidée du droit nigérien et des formalités à confirmer auprès de la HAPDP.
