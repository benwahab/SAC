# SAC — Contrat de gouvernance juridique, responsabilités et conformité

**Date de veille :** 18 novembre 2026  
**Statut :** cadre documentaire de conformité et registre des vérifications nécessaires ; ce document n'est ni un avis juridique ni une validation de lancement.  
**Périmètre :** Niger comme juridiction de départ, extension éventuelle à d'autres pays, gouvernance du responsable de traitement, droits des personnes, mineurs, données sensibles, transferts, sous-traitants, responsabilités, conditions d'utilisation, incidents et preuve de conformité.  
**Nature :** documentation uniquement. Aucune formalité administrative, collecte réelle, contractualisation fournisseur, publication de conditions juridiques ou mise en production n'est effectuée par ce document.

## 1. Objet et règle de lecture

Ce contrat complète, sans les remplacer :
- `MISE_A_JOUR_JURIDIQUE_NIGER_NOV_2026.md` ;
- `CONFORMITE_DONNEES_NIGER.md` ;
- `CONTRAT_PROTECTION_DONNEES_ACCES_INTERNES_ET_AUDIT.md` ;
- `CONTRAT_CONFIDENTIALITE_FAMILIALE_ET_ISOLATION_DONNEES.md` ;
- `CONTRAT_CONSERVATION_ALERTES_ET_PURGE.md` ;
- `PROPOSITION_POLITIQUE_GENERALE_CONSERVATION_DONNEES.md` ;
- `CONTRAT_SECURITE_NOTIFICATIONS_ET_COMMUNICATIONS.md` ;
- `CONTRAT_SECURITE_TRAJETS_ET_LOCALISATION.md` ;
- `CONTRAT_RESILIENCE_CONTINUITE_ET_REPRISE_INCIDENT.md` ;
- `CONTRAT_PREVENTION_ABUS_USURPATION_ET_SATURATION.md`.

Il faut distinguer :
1. **Fait documentaire :** ce qu'une source publique consultée indique.
2. **Règle produit validée :** ce que l'utilisateur a explicitement arrêté pour SAC.
3. **Mesure de prudence :** ce que SAC doit préparer pour limiter le risque.
4. **Question juridique ouverte :** ce qu'un texte authentique, un service compétent ou un conseil local doit confirmer.
5. **Proposition :** ce qui ne doit pas être présenté comme une obligation légale ni implémenté comme décision approuvée.

En cas de contradiction, les contrats métier déjà validés gouvernent le comportement produit ; le droit impératif applicable prévaut juridiquement. Toute contradiction doit être documentée et arbitrée, jamais résolue par une modification silencieuse.

## 2. État documentaire du droit nigérien au 18 novembre 2026

### 2.1 Protection des données personnelles

La loi n° 2022-59 du 16 décembre 2022 est le texte général de référence retrouvé pour la protection des données au Niger. Elle a été modifiée par la loi n° 2023-31 du 4 juillet 2023 et les ordonnances n° 2024-16 du 26 avril 2024 et n° 2024-29 du 24 juin 2024, selon la page de législation nationale publiée par l'ancien site HAPDP.

**Évolution institutionnelle majeure :** l'Agence Nigérienne de Presse a rapporté le 12 juin 2026 que le décret signé le 8 juin 2026 a supprimé la HAPDP et transféré ses missions au Ministère de la Justice et au Ministère de l'Intérieur, de la Sécurité Publique et de l'Administration du Territoire. Des sources secondaires identifient le décret comme n° 2026-310/PRN/PM et mentionnent l'ordonnance n° 2026-30 du 8 juin 2026, qui aurait abrogé certaines dispositions de la loi n° 2022-59 relatives à l'autorité.

**Limite déterminante :** au cours de la veille, le texte intégral authentifié de l'ordonnance n° 2026-30 et les dispositions transitoires organisant concrètement les formalités n'ont pas été retrouvés dans une publication gouvernementale numérique consultable. Les anciennes pages HAPDP affichent encore l'institution et ses formalités ; elles ne prouvent pas que ces procédures sont encore opérationnelles après juin 2026.

En conséquence :
- ne pas présenter la HAPDP comme autorité actuelle ;
- ne pas envoyer de déclaration, demande ou notification à l'ancienne HAPDP en prétendant que c'est la voie légale actuelle ;
- ne pas affirmer que les formalités historiques sont inchangées ;
- ne pas affirmer non plus que les obligations substantielles de protection des données ont disparu ;
- obtenir l'ordonnance authentique, le décret authentique et les textes d'organisation/transfert des missions ;
- faire identifier par écrit les services ministériels qui reçoivent désormais les formalités, plaintes, demandes d'avis et notifications de violation.

**Position prudente pour SAC :** continuer à appliquer par conception les protections fortes déjà définies (minimisation, finalité, sécurité, droits, limitation de conservation, confidentialité et responsabilité) sans prétendre que cela remplace les formalités légales. Ne pas activer les traitements réels tant que le circuit réglementaire applicable n'a pas été confirmé.

### 2.2 Autres textes nigériens à intégrer à l'analyse

- **Loi n° 2019-03 du 30 avril 2019 relative aux transactions électroniques :** le Ministère chargé du numérique la présente comme encadrant les transactions et services électroniques, la fiabilité juridique des échanges, la signature électronique, la conservation et les responsabilités. Son application précise aux parcours SAC, preuves de consentement, notifications et contrats doit être analysée par un juriste.
- **Loi n° 2019-33 du 3 juillet 2019 portant répression de la cybercriminalité :** elle concerne notamment les atteintes aux systèmes et données, accès frauduleux, usurpation et autres infractions numériques. Son texte consolidé et les modifications postérieures doivent être vérifiés avant toute procédure de coopération ou conservation de preuves.
- **Textes relatifs aux communications électroniques :** à examiner si SAC utilise SMS, numéros, services de communication ou fournisseurs opérant au Niger.
- **Droit pénal, civil, responsabilité, consommation, associations/sociétés, droit du travail et droit des enfants :** à examiner selon l'entité porteuse, les services réellement proposés et les pays de lancement.

Ne pas recopier des peines, délais ou formalités depuis un résumé secondaire dans les conditions d'utilisation. Citer les textes officiels authentifiés et leurs versions applicables.

### 2.3 Sources consultées et niveau de confiance

1. **ANP, 12 juin 2026 — suppression de plusieurs organismes et transfert des missions de la HAPDP :** source institutionnelle de presse, utile pour établir le fait rapporté, mais ne remplace pas le décret au Journal officiel.
2. **Site ministériel MCNTI — loi 2019-03 sur les transactions électroniques et loi 2019-33 sur la cybercriminalité :** source institutionnelle répertoriant ces textes ; obtenir les PDF complets et versions consolidées.
3. **Ancien site HAPDP — législation nationale et formalités :** utile pour retrouver les textes 2022/2023/2024, mais pages institutionnelles historiques non mises à jour après la suppression rapportée en juin 2026.
4. **Africa Data Protection et Data Landscapers :** sources secondaires de recoupement sur la suppression et l'incertitude institutionnelle ; ne pas les utiliser seules pour établir une obligation juridique.
5. **Journal officiel du Niger :** source primaire à obtenir pour authentifier l'ordonnance 2026-30, le décret de suppression et les textes de dévolution.

Les liens de veille sont rassemblés à la fin du document. Ils sont des pistes documentaires, pas une attestation que chaque texte a été authentifié dans sa version consolidée au 18 novembre 2026.

## 3. Gouvernance juridique de l'organisation qui portera SAC

Avant tout traitement réel, identifier et documenter :
- la personne physique ou morale qui exploite SAC ;
- son pays d'établissement, sa forme juridique et ses représentants habilités ;
- le responsable du traitement pour chaque finalité ;
- les éventuels responsables conjoints, s'il y a réellement détermination conjointe des finalités et moyens ;
- les sous-traitants et sous-traitants ultérieurs ;
- les personnes habilitées à traiter les demandes des utilisateurs ;
- le point de contact public pour confidentialité, sécurité et réclamations ;
- le responsable interne de conformité et son suppléant.

Le Super Admin fonctionnel n'est pas automatiquement le responsable juridique du traitement. Une permission dans l'application ne confère pas une qualité juridique. Les rôles de gouvernance doivent être attribués à une entité et à des personnes ayant une base légitime et un mandat documenté.

Avant lancement, constituer un dossier de gouvernance comprenant statuts/mandat de l'entité, registre des traitements, cartographie des flux, matrice de responsabilités, contrats fournisseurs, politiques publiées, analyse des risques et procédures d'incident.

## 4. Cartographie des traitements SAC à qualifier

Chaque finalité doit être examinée séparément, sans supposer qu'un consentement général couvre tout :

| Traitement | Données envisagées | Risques/qualification à examiner |
|---|---|---|
| Création de compte | e-mail, mot de passe, téléphone déclaré, identifiant | identité numérique, sécurité, OTP, formalités |
| Contacts de confiance | identités de compte, e-mail d'invitation, relation et consentement | données de tiers, invitation, preuve de consentement |
| SOS | catégorie, auteur, destinataires, événements, réponses | urgence, données potentiellement sensibles, confidentialité |
| Urgence médicale | catégorie ou information volontaire | données de santé ou données sensibles selon contenu et loi |
| Localisation/trajets | coordonnées GPS, horodatages, destinataires | localisation précise, surveillance, consentement spécifique, transferts |
| Notifications | endpoints push, e-mail, SMS futur, statuts techniques | sous-traitance, transferts, métadonnées |
| Support et plaintes | correspondance, preuve minimale, identité | confidentialité, accès restreint, durée |
| Sécurité/audit | événements, IP/appareil si nécessaire, accès et révocations | minimisation, preuve, conservation, contrôle interne |
| Administration/délégations | missions, permissions, actes, journaux | données professionnelles et privilèges |
| Sauvegardes/reprise | copies techniques des données | transferts, durée, non-résurrection, sous-traitants |

Pour chaque ligne, enregistrer : finalité, base juridique envisagée, nécessité, proportionnalité, catégories de personnes, champs, destinataires, lieu de traitement, accès, sous-traitants, durée, droits, risques et formalité applicable. La base juridique exacte reste à confirmer au regard du texte consolidé et des modifications 2026.

## 5. Données sensibles et localisation

- Les données d'urgence médicale ne doivent pas être collectées par défaut si la fonction n'en a pas besoin.
- Les utilisateurs ne doivent pas être incités à saisir un diagnostic ou un dossier médical complet dans un champ libre.
- Les catégories d'alerte doivent être limitées à ce qui est nécessaire à l'assistance.
- Le GPS précis doit rester désactivé tant que le verrou technique J+30 n'est pas levé.
- Aucun GPS précis dans analytics, logs, notifications, URL, exports non nécessaires, caches ou supports.
- Le partage de position doit être distinct, explicite, limité à une alerte/un trajet et révocable selon les contrats.
- Une relation de confiance, un groupe ou un statut familial ne donne aucun droit automatique à la localisation.
- Une preuve de consentement doit préciser le but, le périmètre, les destinataires, le moment, la durée et la révocation.
- Le consentement ne doit pas être utilisé comme justification universelle lorsque le traitement repose sur une autre base ou lorsque la personne ne peut pas librement consentir.

La suppression immédiate du GPS à la clôture du SOS, la conservation de la catégorie seule pendant 30 jours et la purge totale à J+30 restent des décisions produit impératives. Elles ne constituent pas une règle légale générale applicable à toutes les autres données.

## 6. Mineurs, tutelle et personnes vulnérables

Aucun parcours mineur, tutelle, représentant légal, dépendance ou incapacité à consentir n'est validé à ce stade.

Avant toute ouverture aux mineurs, il faut une analyse spécifique portant sur :
- âge minimal et méthode de détermination de l'âge ;
- capacité juridique et consentement du mineur ;
- rôle et vérification d'un représentant légal, si applicable ;
- risque de violence familiale, coercition, contrôle ou représailles ;
- confidentialité du mineur vis-à-vis du parent ou tuteur ;
- prévention des faux représentants ;
- droits d'accès, rectification, suppression et opposition ;
- protection des alertes et de la localisation ;
- obligations de signalement et de protection de l'enfance ;
- règles spécifiques de chaque pays.

**Aucune autorité parentale ne doit être traduite automatiquement en accès global au compte, aux alertes, aux contacts ou à la localisation.** Le droit applicable peut exiger des traitements particuliers, mais ceux-ci doivent être conçus et validés séparément.

Pour la V1, le périmètre d'âge autorisé doit être arrêté juridiquement avant inscription publique. Ne pas inventer un âge minimal en l'absence d'analyse des lois applicables et de la stratégie produit.

## 7. Consentement, information et preuve

Préparer des informations courtes et complètes, accessibles avant l'action concernée :
- qui exploite SAC et comment contacter le responsable ;
- pourquoi les données sont traitées ;
- quelles données sont nécessaires et lesquelles sont facultatives ;
- à qui elles sont transmises ;
- quels fournisseurs et pays peuvent intervenir ;
- combien de temps elles sont conservées et comment elles sont supprimées ;
- quels droits peuvent être exercés et auprès de qui ;
- ce que SAC peut et ne peut pas garantir en cas de panne, réseau absent ou fournisseur indisponible ;
- comment signaler un abus, une faille ou une violation.

Le consentement doit être granulaire lorsque la base juridique retenue l'exige et lorsque des fonctions facultatives sont activées. Le refus d'une fonction facultative ne doit pas entraîner une collecte cachée ou un consentement groupé.

Pour les proches :
- l'invitation n'est pas une relation active ;
- l'acceptation explicite est obligatoire ;
- le compte actif et l'e-mail vérifié sont requis ;
- l'acceptation ne vaut pas consentement à tous les partages futurs ;
- le partage GPS exige une autorisation distincte ;
- le groupe privé n'accorde pas de droit SOS ou GPS.

La preuve de consentement doit être minimisée, horodatée côté serveur, versionnée et liée au texte présenté. Sa durée de conservation doit être justifiée et arbitrée ; elle ne peut être illimitée par simple souci de preuve.

## 8. Droits des personnes et traitement des demandes

Préparer un guichet unique et un processus traçable pour les demandes :
- accès et copie des données ;
- rectification ;
- opposition ou retrait de consentement lorsque pertinent ;
- limitation ;
- suppression/effacement ;
- portabilité si applicable ;
- contestation d'une décision automatisée si de telles décisions sont introduites ;
- plainte ou demande relative à un incident.

Pour chaque demande : vérifier l'identité de manière proportionnée sans exiger des données excessives, définir le périmètre, rechercher les données dans tous les systèmes contrôlés, vérifier les exceptions légales, répondre dans le délai légal confirmé, tracer l'action et informer de tout refus motivé.

Ne pas publier un délai de réponse juridique tant que le texte applicable après les modifications 2026 n'a pas été authentifié. Ne pas promettre la suppression de copies indépendantes téléchargées ou capturées par des tiers hors du contrôle de SAC.

## 9. Mineurs et urgence : pas de fausse promesse de service public

SAC est un outil privé de mise en relation avec des proches choisis. Sauf convention, agrément et intégration officiellement établis, SAC ne doit pas se présenter comme :
- un service public de secours ;
- une centrale de police, ambulance, pompier ou protection civile ;
- un service garantissant une intervention physique ;
- un dispositif de géolocalisation permanente ;
- un service qui garantit la réception ou la lecture d'une notification ;
- un substitut aux numéros et services d'urgence officiels du pays.

Les écrans et conditions doivent expliquer sobrement :
- SAC transmet une alerte à des contacts sélectionnés selon la disponibilité technique ;
- la création serveur confirmée n'est pas une preuve de lecture par les proches ;
- réseau absent, téléphone éteint ou panne peuvent empêcher la transmission ;
- l'utilisateur doit contacter les services d'urgence publics compétents lorsqu'il en a besoin et qu'ils sont accessibles ;
- aucun délai d'intervention ni résultat de secours n'est garanti par SAC.

Les numéros officiels d'urgence ne doivent pas être inventés ni généralisés à plusieurs pays ; ils devront être vérifiés pays par pays avant affichage.

## 10. Responsabilités et limites contractuelles

Les conditions d'utilisation devront définir après revue juridique :
- identité de l'exploitant et coordonnées ;
- objet et périmètre du service ;
- conditions d'accès et âge admissible ;
- responsabilités respectives de l'exploitant et de l'utilisateur ;
- règles d'utilisation acceptable et interdiction du harcèlement/usurpation ;
- fonctionnement et limites des notifications ;
- fonctionnement hors ligne et réseau faible ;
- suspension et fermeture de compte, avec recours ;
- propriété intellectuelle et licences ;
- sous-traitants et transferts ;
- réclamations et règlement des litiges ;
- droit applicable et juridiction, selon règles impératives ;
- date/version et mécanisme d'information des changements.

Aucune clause ne doit prétendre exclure toute responsabilité de SAC, couvrir une faute intentionnelle ou écarter un droit impératif. Les limitations de responsabilité doivent être rédigées par un juriste local et ne peuvent pas masquer les limites techniques ni les obligations légales.

Ne pas faire accepter des conditions par une case précochée, un écran ambigu ou une action qui n'est pas clairement consentie. Les conditions, la politique de confidentialité et les autorisations de localisation sont des objets distincts.

## 11. Fournisseurs, hébergement et transferts transfrontaliers

Avant sélection d'un fournisseur ou d'une région :
1. inventorier chaque flux et chaque sous-traitant ultérieur ;
2. identifier pays d'hébergement, sauvegarde, support, télémétrie et accès administrateur ;
3. déterminer si le flux est un transfert international au sens du droit applicable ;
4. authentifier le régime d'autorisation ou de garantie après l'ordonnance 2026-30 ;
5. signer un contrat de sous-traitance définissant instructions, confidentialité, sécurité, sous-traitance ultérieure, assistance aux droits, incident, audit, suppression et restitution ;
6. vérifier chiffrement, gestion de clés, réversibilité, disponibilité et lieux de support ;
7. limiter les données transmises à chaque fournisseur ;
8. interdire l'utilisation secondaire pour publicité, profilage ou entraînement sans base juridique et arbitrage distinct ;
9. documenter les transferts et leur fondement ;
10. prévoir la fin de contrat, récupération des données et certificat de suppression.

Cloudflare, e-mail, push, SMS, analytique, cartographie, sauvegarde et support ne sont pas présumés conformes par leur réputation ou par le choix d'une région. Aucun fournisseur ni pays de transfert n'est approuvé ici.

## 12. Incidents, violations de données et coopération

Préparer une procédure qui distingue :
- incident technique sans exposition de données ;
- accès non autorisé ou divulgation ;
- perte, altération, indisponibilité ou destruction ;
- compromission de compte, appareil, clé ou fournisseur ;
- résurrection de données qui auraient dû être purgées ;
- incident affectant mineurs ou personnes vulnérables.

Pour chaque incident : détecter, contenir, préserver les preuves minimales, évaluer les données/personnes touchées, déterminer les obligations de notification, informer les personnes si requis, documenter les décisions, corriger et tester.

Le destinataire, le délai et la forme des notifications réglementaires au Niger après la suppression de la HAPDP restent à confirmer auprès des services ministériels compétents. Ne pas réutiliser automatiquement les anciens formulaires ou délais de l'ancienne autorité.

La coopération avec une autorité judiciaire ou administrative doit être vérifiée, authentifiée, limitée à la compétence et au périmètre requis, journalisée et revue juridiquement. Ne pas promettre une confidentialité absolue face à une obligation légale valide ; ne pas remettre des données sur simple demande informelle.

## 13. Pays de déploiement : conformité pays par pays

Le Niger est la juridiction de départ de cette analyse. Aucun autre pays n'est réputé autorisé par cette documentation.

Avant d'ouvrir SAC dans un pays, constituer une fiche pays vérifiée comprenant :
- loi générale sur les données et ses amendements ;
- autorité de contrôle actuelle et coordonnées officielles ;
- formalités préalables, autorisations ou déclarations ;
- règles sur données sensibles, santé, GPS et communications ;
- âge et capacité des mineurs ;
- droit de la consommation et contrats numériques ;
- cybercriminalité et conservation légale ;
- notifications de violation et délais ;
- transferts transfrontaliers et localisation ;
- services publics d'urgence et numéros officiels, si affichés ;
- règles de responsabilité, assurance et partenariats éventuels ;
- langue obligatoire et information des utilisateurs ;
- avis juridique local et date de vérification.

Un pays ne peut être ajouté à la liste de disponibilité que si la fiche est complète, les services tiers nécessaires sont disponibles, les formalités sont satisfaites et le responsable de SAC a approuvé l'ouverture.

## 14. Registre des blocages juridiques avant lancement

| Blocage | Preuve attendue | État |
|---|---|---|
| Ordonnance n° 2026-30 | Copie authentique et analyse article par article | Bloquant |
| Décret de suppression/transfert HAPDP | Journal officiel et textes d'organisation | Bloquant |
| Service compétent actuel | Confirmation écrite Justice/Intérieur | Bloquant |
| Formalités SAC | Avis écrit sur les traitements prévus | Bloquant |
| Entité porteuse | Identité juridique et responsable de traitement | Bloquant |
| Données de santé et GPS | Qualification et formalités confirmées | Bloquant |
| Hébergement et transferts | Cartographie fournisseurs/pays + garanties | Bloquant |
| Mineurs | Périmètre d'âge et parcours juridiquement validés | Bloquant avant ouverture aux mineurs |
| Conditions d'utilisation | Revue par juriste nigérien | Bloquant |
| Politique de confidentialité | Revue juridique et cohérence avec les traitements réels | Bloquant |
| Incidents et violations | Circuit, destinataire, délai et modèle de notification confirmés | Bloquant |
| Conservation hors GPS | Matrice légale validée catégorie par catégorie | Bloquant |
| Pays additionnels | Fiche pays et avis local pour chaque juridiction | Bloquant avant disponibilité dans le pays |

## 15. Plan d'action documentaire

1. Obtenir les exemplaires authentiques du Journal officiel contenant l'ordonnance 2026-30 et le décret de suppression.
2. Obtenir les textes qui organisent la dévolution des missions et identifier les bureaux opérationnels.
3. Demander un avis écrit sur les formalités de SAC, en présentant la cartographie des traitements.
4. Identifier l'entité juridique porteuse et le responsable de traitement.
5. Réaliser une analyse d'impact vie privée/sécurité proportionnée aux risques, notamment GPS, urgence médicale, mineurs et relations familiales.
6. Finaliser la cartographie des fournisseurs et transferts avant contrat.
7. Faire valider les conditions d'utilisation, la politique de confidentialité, l'information de consentement et la procédure de droits.
8. Définir les procédures de plainte, violation, demandes judiciaires et réponse aux personnes.
9. Valider la conservation hors GPS et les preuves de consentement.
10. Créer les fiches des pays additionnels seulement lorsque leur lancement est envisagé.
11. Faire une revue indépendante avant activation réelle des traitements.
12. Ne pas considérer une documentation rédigée comme une autorisation d'implémentation ou de lancement.

## 16. Références documentaires consultées

**Sources institutionnelles nigériennes**
- HAPDP, page législation nationale (ancienne page institutionnelle, à traiter comme historique après juin 2026) : https://www.hapdp.ne/legislation-nationale
- HAPDP, présentation et missions publiées (statut institutionnel historique ; la page n'intègre pas la suppression de juin 2026) : https://www.hapdp.ne/presentation
- HAPDP, formalités historiques : https://www.hapdp.ne/formalites
- HAPDP, loi n° 2022-59, PDF : https://www.hapdp.ne/uploads/files/Loi-N%C2%B02022-59HAPDP.pdf
- HAPDP, loi n° 2023-31, PDF : https://www.dataguidance.com/sites/default/files/loi_ndeg_2023-31_modifiant_la_loi_ndeg_2022-59.pdf
- ANP, 12 juin 2026, suppression de plusieurs services dont HAPDP et transfert des missions : https://anp.ne/niger-plusieurs-services-rattaches-ou-sous-tutelle-de-la-presidence-de-la-primature-et-du-secretariat-general-du-gouvernement-supprimes/
- Ministère de la Communication et des Nouvelles Technologies de l'Information, loi n° 2019-03 sur les transactions électroniques : https://mcnti.gouv.ne/ova_doc/loi-2019-03-du-30-avril-2019-portant-sur-les-transactions-electroniques-au-niger/
- MCNTI, répertoire de documents législatifs incluant la loi n° 2019-33 sur la cybercriminalité : https://mcnti.gouv.ne/ova_doc/

**Sources secondaires de recoupement — ne remplacent pas le Journal officiel**
- Africa Data Protection, suppression de la HAPDP et transfert des compétences : https://www.africadataprotection.org/actualites/Niger-Suppression-de-la-Haute-Autorite-de-Protection-des-Donnees-a-caractere-Personnel-et-transfert-de-ses-competences.html
- Data Landscapers, état du cadre nigérien : https://corpus.data-landscapers.io/maturity/countries/ner/
- Cybersecurity Database, loi n° 2019-33 sur la cybercriminalité : https://www.cybersecuritydatabase.org/fr/documents/ne-loi-2019-33-cybercriminalite/

**Réserve finale :** les liens ci-dessus servent à retracer la recherche. La conformité légale définitive dépend des textes authentiques et consolidés, des faits exacts de l'entité porteuse, des flux réels et d'un avis juridique qualifié au Niger et dans chaque pays de déploiement.

**Conclusion :** SAC doit être juridiquement gouvernable avant d'être opérationnel : une entité responsable, des finalités définies, des personnes informées, des fournisseurs maîtrisés, des droits exerçables, des incidents traités et des formalités confirmées. Les incertitudes institutionnelles de 2026 sont un blocage à résoudre, pas une raison de supposer que les obligations de protection ont disparu.
