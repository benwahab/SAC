# SAC — Complément d'analyse juridique Niger : obligations de protection des données

**Date de vérification documentaire :** 18 novembre 2026  
**Statut :** analyse juridique documentaire préliminaire, non avis juridique et non validation de conformité.  
**Périmètre :** conséquences du texte nigérien de protection des données sur les traitements envisagés par SAC.  
**Règle de lecture :** les articles cités ci-dessous proviennent du texte de base de la loi n° 2022-59 et de sources officielles historiques. Leur maintien exact après les textes de 2024 et surtout l'ordonnance n° 2026-30 n'est pas certifié. Aucune formalité ne doit être déposée auprès de l'ancienne HAPDP sans confirmation écrite du service aujourd'hui compétent.

## 1. État des textes et de l'autorité compétente

La loi n° 2022-59 du 16 décembre 2022 est le texte de base consulté. Elle a été modifiée par la loi n° 2023-31 du 4 juillet 2023, puis par les ordonnances n° 2024-16 du 26 avril 2024 et n° 2024-29 du 24 juin 2024, que la page de législation de l'ancienne HAPDP répertorie. La loi 2023-31 a modifié les articles 6, 7, 14, 23, 24 et 111 ; elle ne suffit pas à établir le contenu des modifications de 2024 ou de 2026.

L'Agence Nigérienne de Presse a publié le 12 juin 2026 que le décret signé le 8 juin 2026 supprime la HAPDP et transfère ses missions au Ministère de la Justice et au Ministère de l'Intérieur, de la Sécurité Publique et de l'Administration du Territoire. L'ANP ne donne pas dans sa dépêche le numéro du décret ni le détail de la répartition des compétences.

Une ordonnance n° 2026-30 du 8 juin 2026 est citée dans des sources secondaires comme abrogeant certaines dispositions de la loi 2022-59. Son exemplaire authentique, ses articles abrogatoires et ses dispositions transitoires n'ont pas été authentifiés dans les sources institutionnelles numériques examinées. Le numéro du décret de suppression demeure également à confirmer sur le Journal officiel, en raison de reproductions/OCR contradictoires signalées dans le dossier juridique antérieur.

**Conclusion institutionnelle :** ne pas présenter la HAPDP comme l'autorité opérationnelle actuelle. Ne pas déduire que toutes les obligations matérielles ont disparu, ni que toutes les formalités historiques continuent à l'identique. La compétence des deux ministères, les services destinataires et les procédures actuelles restent à établir par les textes authentiques.

## 2. Champ d'application à SAC

Le texte de base de la loi 2022-59 couvre largement les collectes, traitements, transmissions, stockages et utilisations de données personnelles, par des personnes physiques ou morales publiques ou privées. Il vise aussi les responsables ou sous-traitants établis au Niger, ceux qui utilisent des moyens de traitement situés au Niger, et ceux qui ciblent des citoyens nigériens ou offrent des services à des personnes établies au Niger (articles 3 et 4 du texte de base).

SAC n'est pas une activité purement domestique : le service organise des comptes, invitations, alertes, destinataires, événements, notifications et potentiellement des localisations entre plusieurs personnes. L'exception relative aux activités personnelles/domestiques ne doit donc pas être présumée applicable à l'exploitant de la plateforme.

Le responsable du traitement doit être identifié juridiquement. Le rôle fonctionnel de Super Admin dans l'application ne suffit pas à établir la qualité de responsable du traitement. Avant toute activation réelle, il faut déterminer si SAC sera exploité par une personne physique ou une personne morale, où elle sera établie, qui décide des finalités et moyens, et quels fournisseurs agiront comme sous-traitants.

## 3. Formalités préalables et autorisations — lecture du texte de base uniquement

Dans la loi 2022-59 consultée :
- l'article 29 pose le principe d'une formalité préalable auprès de la HAPDP, sauf exception légale ;
- l'article 30 exige notamment la description du responsable, des finalités, interconnexions, catégories et origines des données, personnes concernées, durées de conservation, services et personnes ayant accès, destinataires, point de contact pour les droits, mesures de sécurité, sous-traitants et transferts vers des pays tiers ;
- l'article 31 soumet à autorisation préalable plusieurs catégories, notamment les traitements de données médicales, les interconnexions, les identifiants uniques ou de portée générale dont les numéros de téléphone, les données biométriques, les transferts vers un pays tiers, le profilage/analyse comportementale et certaines catégories sensibles.

Le formulaire officiel de demande d'autorisation encore publié par l'ancienne HAPDP reprend explicitement les numéros de téléphone et les transferts vers des pays tiers parmi les traitements visés par la demande d'autorisation.

**Conséquence majeure pour SAC :** le numéro de téléphone n'est pas un simple champ de contact à traiter sans analyse. Le texte de base et l'ancien formulaire le font entrer dans une catégorie soumise à autorisation préalable. De même, l'hébergement, les sauvegardes, l'accès support ou les sous-traitants situés dans un pays tiers peuvent soulever une question de transfert. Ces constats sont historiques et doivent être confrontés à l'ordonnance 2026-30 avant de déterminer le circuit administratif actuel.

Ne pas lancer de traitement réel, collecter des numéros, activer des invitations ou transmettre des données à un fournisseur étranger au seul motif qu'une ancienne page web décrit une procédure. Préparer le dossier, puis obtenir une réponse écrite de l'autorité ministérielle effectivement compétente.

## 4. Cartographie de qualification des données SAC

| Donnée ou fonction | Qualification de travail | Point de vigilance |
|---|---|---|
| E-mail, nom, identifiant de compte | Données personnelles | Information, finalité, durée, accès, droits |
| Numéro de téléphone déclaré | Donnée personnelle ; catégorie particulière visée par l'article 31 du texte de base | Autorisation historique spécifique à vérifier après 2026 |
| Mot de passe, sessions, appareil, jetons push | Données/personnels ou identifiants techniques liés à une personne | Stockage sécurisé, minimisation, révocation, aucune valeur secrète dans les journaux |
| Contacts invités | Données personnelles de tiers | Informer la personne, limiter l'usage à l'invitation et ne pas activer une relation sans acceptation |
| Nature/catégorie d'un SOS | Donnée personnelle pouvant révéler un état de santé selon le contenu | Éviter les diagnostics et champs médicaux libres non nécessaires |
| Données explicitement médicales | Données de santé/sensibles | Régime spécial du texte de base, nécessité et autorisation à vérifier |
| Coordonnées GPS et historique de déplacement | Données personnelles de localisation | Pas automatiquement classées comme « données sensibles » par l'énumération de l'article 42 ; risque élevé de vie privée et d'inférence |
| Profil ou analyse des déplacements | Peut constituer un profilage selon les traitements effectivement réalisés | L'article 31 du texte de base vise le profilage/analyse comportementale |
| Photos, vidéos, voix | Données personnelles si une personne est identifiable | Visages, tiers filmés, métadonnées, diffusion et droits des personnes |
| Logs et preuves d'audit | Données personnelles lorsqu'ils sont rattachables à un utilisateur | Contenu minimal, durée limitée, accès contrôlé |
| Sauvegardes, exports, support, télémétrie | Copies ou traitements de données personnelles | Même cartographie des lieux, accès, sous-traitants et suppressions |

Une donnée de localisation n'est pas automatiquement une donnée de santé ou une donnée sensible au sens de l'énumération de l'article 42 du texte de base. Cela ne la rend pas anodine : la loi définit les données de localisation et inclut la localisation et les déplacements dans la définition du profilage. SAC doit donc traiter le GPS comme une donnée à risque élevé, avec accès restreint, collecte limitée, information et suppression démontrable.

Le simple fait de permettre à un utilisateur de choisir une catégorie « urgence médicale » peut révéler une donnée de santé. La loi de base prévoit des exceptions limitées, notamment lorsque le traitement est nécessaire à la sauvegarde des intérêts vitaux et que la personne est physiquement ou juridiquement incapable de consentir. Il ne faut pas présumer que cette exception couvre automatiquement tous les SOS médicaux ou tous les traitements futurs de SAC.

Les images et vidéos de personnes identifiables relèvent de la définition générale des données personnelles. L'article 61 du texte de base vise spécifiquement les systèmes de vidéosurveillance et télésurveillance ; il ne faut pas assimiler automatiquement à un système de vidéosurveillance toute vidéo volontairement choisie par un utilisateur. La qualification dépend de la finalité, du dispositif et du fonctionnement réels.

## 5. Principes de traitement directement pertinents

Les articles 38 à 41 du texte de base prévoient notamment :
- finalités déterminées, explicites et légitimes ;
- conservation limitée à la période nécessaire ;
- données adéquates, pertinentes et non excessives ;
- exactitude et rectification ;
- information claire, licéité et loyauté ;
- confidentialité et sécurité, y compris lorsque les données transitent par un réseau.

Pour SAC, cela impose une fiche de finalité par fonction : compte, invitations, relation de confiance, SOS, réponse/prise en charge, localisation, trajets, notifications, support, sécurité, audit, sauvegardes et administration. Une formule générale « améliorer le service » ne suffit pas à justifier une collecte indéfinie ou un accès transversal.

Les données des proches ne doivent pas être considérées comme librement disponibles parce qu'un utilisateur saisit leur adresse e-mail ou leur numéro. L'invitation doit être limitée à sa finalité, comporter une information compréhensible et ne pas créer une relation active avant l'acceptation expresse prévue par le produit.

## 6. Sécurité, protection dès la conception et sous-traitance

Les articles 77, 81 et 82 du texte de base prévoient une responsabilité démontrable du responsable, la confidentialité et des mesures techniques et organisationnelles adaptées aux risques. L'article 82 cite notamment chiffrement, pseudonymisation, anonymisation, confidentialité, intégrité, disponibilité, résilience, tests réguliers, protection dès la conception et protection par défaut.

L'article 86 prévoit que le sous-traitant doit apporter des garanties suffisantes, être lié par un contrat écrit de confidentialité ou un acte juridique, et notifier au responsable toute violation de données dans les meilleurs délais et au plus tard 72 heures après en avoir pris connaissance (texte de base).

Pour SAC, chaque fournisseur doit être qualifié avant activation : base de données, stockage de fichiers, CDN, hébergement, e-mail, OTP, push, SMS futur, cartographie, support, sauvegarde, observabilité et gestion de clés. Le contrat doit préciser instructions, finalités, données, accès, lieux, sous-traitants ultérieurs, confidentialité, sécurité, incidents, assistance aux droits, restitution et suppression.

L'article 79 du texte de base impose à toute personne morale de droit privé responsable d'un traitement de désigner un correspondant à la protection des données ; la désignation était notifiée à la HAPDP. Le maintien exact de cette obligation, le destinataire de la notification et le régime du correspondant après l'ordonnance 2026-30 doivent être confirmés. La forme juridique porteuse de SAC n'étant pas encore établie, ne pas supposer que cette exigence ne s'applique pas.

## 7. Violations de données et incidents

Dans le texte de base :
- l'article 83 prévoit que le responsable notifie la violation à la HAPDP sans délai après en avoir pris connaissance ;
- lorsque la violation est susceptible d'engendrer un risque élevé pour les droits et libertés d'une personne, il en informe la personne concernée dans les meilleurs délais ;
- l'article 86 impose au sous-traitant d'informer le responsable dans les meilleurs délais et au plus tard 72 heures après en avoir pris connaissance.

Ces références ne permettent pas de déterminer le destinataire ni le délai réglementaire actuellement applicable après la suppression de la HAPDP et l'ordonnance 2026-30. La procédure interne SAC doit néanmoins détecter, contenir, documenter, évaluer et escalader les incidents rapidement. Le canal externe, le délai et le formulaire doivent être confirmés par écrit auprès du service ministériel compétent avant mise en production.

Les scénarios SAC à inclure dans le plan d'incident sont : accès non autorisé aux alertes, fuite des contacts, exposition d'une position GPS, accès abusif d'un administrateur, compromission de compte/appareil, fournisseur compromis, suppression non exécutée et restauration d'une donnée qui devait être irrécupérable.

## 8. Conservation, suppression et droits

L'article 84 du texte de base impose que les données ne soient pas conservées au-delà de la durée nécessaire à leur finalité. L'article 103 prévoit une sanction pour la conservation identifiable au-delà de la durée prévue par la loi, une décision d'autorisation ou la déclaration préalable.

Les articles 69 à 76 du texte de base reconnaissent notamment accès, rectification, opposition, suppression, oubli numérique, limitation et portabilité. Le droit de suppression n'est pas formulé comme un effacement automatique et sans exception de toute donnée à la première demande : l'article 73 prévoit des motifs de suppression et des exceptions, notamment lorsqu'une conservation est nécessaire à une obligation légale, à la justice ou à certaines finalités d'intérêt général.

Conséquences pour le cycle de compte SAC :
- distinguer fermeture du compte, demande d'effacement, suppression finale, effacement d'une donnée spécifique et obligations légales de conservation ;
- instruire les demandes de suppression avec une vérification d'identité proportionnée ;
- identifier les données de tiers contenues dans un compte ou une alerte ;
- ne conserver que les éléments nécessaires et autorisés pour une obligation ou la défense d'un droit ;
- ne pas promettre une suppression des copies autonomes déjà téléchargées par des tiers hors du contrôle de SAC ;
- documenter la suppression chez les sous-traitants et dans les systèmes de sauvegarde sous le contrôle de SAC.

La règle produit déjà validée pour les alertes demeure distincte : GPS précis supprimé à la clôture, catégorie seule pendant 30 jours, puis suppression totale à J+30, sans résurrection depuis une sauvegarde. Cette règle est une exigence produit de SAC, pas une durée légale générale déduite de la loi nigérienne.

## 9. Transferts internationaux et fournisseurs hors Niger

Les articles 62 et 63 du texte de base encadrent les transferts vers les pays tiers et les garanties/conditions dérogatoires. L'article 31 soumet les transferts à autorisation préalable dans le texte de base. L'ancien formulaire HAPDP demande également le lieu de stockage, les destinataires et les transferts.

Avant de sélectionner une région Cloudflare ou un fournisseur d'e-mail, de push, de stockage, de support ou de sauvegarde, SAC doit documenter :
- pays de traitement primaire et de stockage ;
- pays des sauvegardes et répliques ;
- lieux d'accès par les équipes support et sécurité ;
- sous-traitants ultérieurs ;
- métadonnées, journaux, télémétrie et données de facturation ;
- mécanismes contractuels et techniques ;
- autorité actuelle qui approuve ou reçoit les formalités.

Un datacenter annoncé dans un pays ne suffit pas à prouver que toutes les opérations et tous les accès restent dans ce pays. Aucun transfert ne doit être déclaré conforme avant une cartographie fournisseur complète et la confirmation du régime 2026.

## 10. Mineurs, personnes vulnérables et contenu utilisateur

La loi de base définit un mineur comme une personne de moins de 18 ans. Le périmètre d'âge de la V1 SAC n'est pas arbitré. Il faut donc empêcher toute ouverture aux mineurs avant analyse du consentement, de la représentation légale, des risques de coercition familiale, des droits et des obligations de protection de l'enfance.

SAC doit aussi traiter avec prudence les contenus saisis ou envoyés par les utilisateurs : une catégorie SOS, une photo, une vidéo, un enregistrement ou un commentaire peut révéler la santé, la vie privée ou des informations concernant un tiers. La minimisation, l'accès par destinataire, l'absence de diffusion publique et la modération adaptée restent des exigences de conception, sans préjuger du régime juridique précis applicable à chaque média.

La loi 2019-33 sur la cybercriminalité est également répertoriée par le Ministère chargé du numérique ; l'ANP a rapporté sa modification par l'ordonnance 2024-28 du 7 juin 2024. Les conditions d'utilisation, la prévention de l'usurpation, les contenus illicites, les demandes judiciaires et la conservation des preuves devront être examinés à partir des textes authentiques. SAC ne doit pas se présenter comme un service public de secours ni promettre une intervention physique.

## 11. Autres textes à examiner avant ouverture publique

Le Ministère chargé du numérique répertorie également :
- la loi n° 2019-03 du 30 avril 2019 relative aux transactions électroniques ;
- la loi n° 2018-45 relative à la réglementation des communications électroniques ;
- la loi n° 2019-33 relative à la répression de la cybercriminalité, modifiée par l'ordonnance n° 2024-28 du 7 juin 2024 selon le communiqué ministériel rapporté par Le Sahel.

Leur application exacte à SAC doit être qualifiée : SAC fournit-il uniquement une application de mise en relation et de notifications utilisant des opérateurs tiers, ou exerce-t-il une activité réglementée de fourniture de communications électroniques ? Aucune licence ou exemption ne doit être affirmée sans examen juridique de l'activité et des définitions légales.

## 12. Matrice des points juridiques bloquants

| Sujet | Ce qui est établi dans le texte de base | Ce qui bloque la conclusion actuelle |
|---|---|---|
| Champ d'application | Traitements publics/privés et champ territorial large | Identité et statut juridique de l'exploitant SAC |
| Formalité préalable | Article 29 prévoit une formalité préalable | Effet exact de l'ordonnance 2026-30 et service destinataire |
| Téléphone | Article 31 et ancien formulaire visent les numéros | Maintien du régime d'autorisation après juin 2026 |
| Données de santé | Régime spécifique aux articles 42-43 | Qualification des catégories SOS et formalité actuelle |
| GPS et trajets | Données personnelles/localisation ; profilage à examiner | Formalités actuelles et régime des traitements précis |
| Transferts | Articles 31, 62-63 et ancien formulaire | Texte actuel, pays, fournisseurs et service compétent |
| Correspondant données | Article 79 prévoit une désignation pour une personne morale privée | Maintien, modalités et notification post-2026 |
| Incidents | Articles 83 et 86 du texte de base | Destinataire et délais réglementaires actuels |
| Conservation | Articles 38, 84 et 103 du texte de base | Durées par finalité et règles applicables après 2026 |
| Droits | Articles 69-76 du texte de base | Délais et procédures en vigueur après les modifications |
| Mineurs | Définition de moins de 18 ans dans le texte de base | Périmètre V1, capacité, consentement et obligations connexes |
| Cybercriminalité/communications | Textes 2018-45, 2019-03, 2019-33 et ordonnance 2024-28 répertoriés | Qualification précise de SAC et versions authentiques |

## 13. Actions documentaires prioritaires

1. Obtenir auprès du Journal officiel un exemplaire authentique de l'ordonnance n° 2026-30 du 8 juin 2026 et du décret supprimant la HAPDP.
2. Faire établir un tableau article par article : dispositions de la loi 2022-59 maintenues, modifiées, abrogées et dispositions transitoires.
3. Obtenir les textes d'organisation des services ministériels auxquels les missions ont été transférées.
4. Demander par écrit quel service reçoit aujourd'hui les formalités, autorisations, avis, notifications d'incident et demandes des personnes.
5. Faire confirmer le régime des numéros de téléphone, données de santé, localisation, profilage, transferts et correspondant à la protection des données.
6. Identifier l'entité juridique porteuse, le responsable du traitement et les sous-traitants.
7. Finaliser le registre des traitements et la cartographie des flux, y compris sauvegardes, journaux, support et accès fournisseur.
8. Préparer l'analyse d'impact sur la vie privée et les risques de sécurité pour GPS, SOS médical, mineurs et relations de confiance.
9. Faire valider la matrice de conservation hors GPS, les droits et la procédure de violation par un juriste nigérien.
10. Réaliser une revue juridique des lois sur transactions électroniques, communications électroniques et cybercriminalité avant ouverture publique.

## 14. Références et limites de la recherche

**Sources institutionnelles**
- HAPDP, législation nationale et liste des modifications 2023/2024 (site institutionnel historique, consulté le 18 novembre 2026) : https://www.hapdp.ne/legislation-nationale
- HAPDP, loi n° 2022-59, texte PDF de base : https://www.hapdp.ne/uploads/files/Loi-N%C2%B02022-59HAPDP.pdf
- HAPDP, formulaire officiel de demande d'autorisation (historique) : https://www.hapdp.ne/uploads/files/formulairedautorisation.pdf
- HAPDP, formulaire de désignation du correspondant (historique) : https://www.hapdp.ne/uploads/files/formulairededesignationducorrespondant.pdf
- MCNTI, répertoire des textes législatifs et réglementaires : https://mcnti.gouv.ne/ova_doc/
- MCNTI, loi n° 2019-03 sur les transactions électroniques : https://mcnti.gouv.ne/ova_doc/loi-2019-03-du-30-avril-2019-portant-sur-les-transactions-electroniques-au-niger/
- MCNTI, loi n° 2018-45 sur les communications électroniques : https://mcnti.gouv.ne/ova_doc/loi-2018%E2%80%9145-reglementation-des-communications-electroniques-au-niger/
- MCNTI, loi n° 2019-33 sur la cybercriminalité : https://mcnti.gouv.ne/ova_doc/loi_2019-33_portant-repression-de-la-cybercriminalite-au-niger_-vf/
- ANP, 12 juin 2026, suppression de la HAPDP et transfert des missions : https://anp.ne/niger-plusieurs-services-rattaches-ou-sous-tutelle-de-la-presidence-de-la-primature-et-du-secretariat-general-du-gouvernement-supprimes/
- Le Sahel/communiqué du Ministère de la Justice, 13 juin 2024, ordonnance 2024-28 modifiant la loi sur la cybercriminalité : https://www.lesahel.org/communique-de-presse-du-ministere-de-la-justice-et-des-droits-de-lhomme-revision-de-la-loi-portant-repression-de-la-cybercriminalite-au-niger/

**Sources de recoupement**
- Loi 2023-31, copie PDF : https://www.dataguidance.com/sites/default/files/loi_ndeg_2023-31_modifiant_la_loi_ndeg_2022-59.pdf
- Africa Data Protection, veille sur la suppression de la HAPDP : https://www.africadataprotection.org/actualites/Niger-Suppression-de-la-Haute-Autorite-de-Protection-des-Donnees-a-caractere-Personnel-et-transfert-de-ses-competences.html

**Limite essentielle :** les textes de 2024 et l'ordonnance 2026-30 n'ont pas tous été obtenus sous forme de copies authentiques et consolidées. Le présent document ne certifie donc pas l'état actuel article par article du droit positif au 18 novembre 2026. Il identifie les exigences du texte de base à confronter aux actes modificatifs authentiques et les décisions à ne pas prendre avant cette vérification.

## 15. Verdict pour SAC

- La protection des données constitue un blocage juridique préalable à toute activation réelle.
- Le numéro de téléphone, les données médicales et les transferts internationaux sont des points particulièrement sensibles au regard du texte de base.
- Les données GPS ne sont pas automatiquement « données sensibles » au sens de l'article 42, mais leur caractère personnel et leur risque élevé justifient les protections strictes déjà prévues par SAC.
- Le responsable juridique, le correspondant de protection des données, les fournisseurs et les pays de traitement doivent être identifiés.
- Les obligations historiques de déclaration, autorisation et notification ne peuvent pas être mises en œuvre sans identifier le service actuel compétent.
- Les règles internes GPS J+30 restent plus strictes et distinctes des durées légales générales.
- Aucun traitement réel, transfert fournisseur, collecte de numéro, ouverture aux mineurs ou lancement public n'est autorisé par cette analyse.

**Aucune modification de code, de schéma D1, d'API, de ressource Cloudflare, de fournisseur ou de déploiement n'est effectuée par ce document.**
