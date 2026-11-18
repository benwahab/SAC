# SAC — Recherche complémentaire : destruction GPS J+30 et textes nigériens

**Date de recherche : 18 novembre 2026**  
**Statut : recherche documentaire complémentaire ; aucune architecture de destruction J+30 ni analyse juridique finale approuvée.**

## 1. Résultat principal sur la destruction GPS

La recherche confirme qu'une suppression dans la base principale ou une programmation de suppression ne suffit pas à établir une destruction irréversible.

Le NIST précise que la destruction des clés n'est complète qu'une fois toutes les copies détruites, y compris les copies de sauvegarde et d'archive. L'OWASP rappelle également qu'une copie de clé conservée en mémoire, dans un backup, un escrow ou une archive peut maintenir la possibilité de déchiffrement. Une simple suppression du matériel enveloppé ou de sa référence ne suffit donc pas.

Références :
- NIST SP 800-57 Part 2 Rev. 1, section 6.2.12 — destruction de clés et copies de sauvegarde : https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-57pt2r1.pdf
- NIST SP 800-57 Part 1 Rev. 5 — sauvegarde, archivage et récupération de clés : https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-57pt1r5.pdf
- OWASP Key Management Cheat Sheet — destruction et effacement cryptographique : https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html

Une étude sur les appareils hors tension relève explicitement qu'une tâche programmée ne garantit pas l'effacement si l'appareil est éteint à l'échéance. Elle conclut que la clé ne doit pas être conservée uniquement sur l'appareil ni uniquement sur le serveur destinataire ; elle doit être gérée par un mécanisme externe. Cette recherche académique est une piste de conception, pas une preuve d'implémentation sûre pour SAC :
- Keeping Data Secret under Full Compromise Using Porter Devices : https://www.researchgate.net/publication/221046447_Keeping_data_secret_under_full_compromise_using_porter_devices

## 2. Conséquence pour SAC : incompatibilité à résoudre

La règle SAC est que les positions GPS historiques sous contrôle de SAC ne puissent plus être rendues lisibles après 30 jours, y compris après restauration de sauvegarde, restauration D1/Time Travel, réinstallation ou retour d'horloge.

Deux objectifs entrent en tension :
- permettre de lire l'historique GPS hors ligne pendant les 30 jours ;
- garantir qu'aucune copie de clé conservée sur l'appareil ne permette une lecture après J+30, même si l'appareil est resté éteint.

Si une clé de déchiffrement utilisable est disponible durablement sur l'appareil, une copie de cette clé pourrait être restaurée ou réutilisée après l'échéance. Si l'accès à la clé dépend d'un service externe, une connexion à ce service peut être nécessaire pour relire l'historique ; le mode hors ligne n'est alors pas garanti.

**Aucune décision produit ne doit être déduite de cette tension.** Elle doit être soumise à un arbitrage explicite. Tant qu'une preuve technique ne démontre pas les deux propriétés, l'archive historique GPS ne doit pas être activée. La solution de repli sûre reste de ne conserver aucun historique GPS précis : uniquement le partage en direct éphémère jusqu'à sa fin.

Le périmètre de la garantie reste les données sous contrôle de SAC. Les copies éventuellement conservées par les destinataires ne sont pas effaçables par SAC et ne doivent pas être présentées comme couvertes par la garantie.

## 3. Architecture candidate à tester — sans validation

Une architecture à deux composantes de clé peut être étudiée :
1. le téléphone conserve le ciphertext GPS et une composante locale non exportable ;
2. un service de clés indépendant conserve une seconde composante, sans recevoir ni stocker les coordonnées GPS en clair ;
3. la reconstruction de la clé nécessite les deux composantes et une autorisation serveur vérifiée à chaque accès ;
4. après J+30, la seconde composante doit être détruite dans toutes ses copies récupérables, y compris sauvegardes, archives, répliques, export et procédures de reprise ;
5. aucune composante complète ne doit avoir été mise en cache ou exportée vers le téléphone avant l'échéance.

Risques à traiter avant toute expérimentation :
- le cache ou la copie mémoire d'une clé complète ;
- la restauration d'une sauvegarde ou d'un snapshot du service de clés ;
- la restauration administrative ou l'annulation d'une destruction ;
- les copies internes du fournisseur, les délais de purge et la reprise après sinistre ;
- l'indisponibilité réseau avant J+30 ;
- les accès concurrents à la limite exacte J+30 ;
- les copies en mémoire, fichiers temporaires, journaux, crash reports et exports ;
- la possibilité pour un administrateur ou un opérateur de restaurer une clé échue.

Le service externe ne doit jamais recevoir de latitude, longitude, itinéraire ou payload GPS en clair. Le choix d'un fournisseur, la création d'un compte cloud, d'un KMS, d'une ressource ou d'une API restent interdits sans autorisation explicite.

## 4. Conditions de validation renforcées

Le test de destruction doit distinguer :
- **refus d'accès après expiration** par les interfaces normales ;
- **non-récupérabilité cryptographique** malgré une sauvegarde ancienne ;
- **destruction des copies de clé** chez le fournisseur et dans ses procédures de reprise ;
- **suppression du ciphertext** sur l'appareil et dans toutes les copies sous contrôle de SAC ;
- **limites hors périmètre** : captures d'écran, copie manuelle ou extraction de données par un destinataire avant expiration.

Un statut « supprimé » dans une API, un tableau de bord ou un journal n'est pas une preuve suffisante. Il faut une documentation contractuelle du fournisseur et des essais adversariaux indépendants. Les essais doivent couvrir le téléphone éteint, le mode avion, l'horloge reculée/avancée, la restauration de sauvegarde, la réinstallation, le changement d'appareil, la restauration du service de clés et les accès juste avant/à/après l'échéance.

## 5. État de la recherche juridique — Niger

### 5.1 Éléments confirmés par des sources consultées

- La loi n° 2023-31 du 4 juillet 2023 modifie les articles 6, 7, 14, 23, 24 et 111 de la loi n° 2022-59. Une copie PDF de la loi est accessible sur le site historique de la HAPDP et sur DataGuidance :
  - https://www.hapdp.ne/uploads/files/Loi%20N%C2%B0%202023-31%20Modifiant%20la%20Loi%20N%C2%B0%202022-59.pdf
  - https://www.dataguidance.com/sites/default/files/loi_ndeg_2023-31_modifiant_la_loi_ndeg_2022-59.pdf
- L'Agence Nigérienne de Presse a rapporté la suppression de plusieurs organismes le 8 juin 2026 et le transfert des missions de la HAPDP vers les ministères de la Justice et de l'Intérieur. Cette source confirme le fait institutionnel rapporté, mais ne suffit pas à authentifier le numéro du décret ni le texte intégral :
  - https://anp.ne/niger-plusieurs-services-rattaches-ou-sous-tutelle-de-la-presidence-de-la-primature-et-du-secretariat-general-du-gouvernement-supprimes/
- Des sources secondaires citent le décret n° 2026-310/PRN/PM du 8 juin 2026.
- Des sources secondaires citent une ordonnance n° 2026-30 du 8 juin 2026 portant abrogation de certaines lois portant création d'autorités de régulation et de certaines dispositions de la loi n° 2022-59.

### 5.2 Éléments qui restent non authentifiés

- Le texte intégral officiel de l'ordonnance n° 2026-30 n'a pas été retrouvé dans les sources officielles consultées. Les articles précis de la loi n° 2022-59 qui seraient abrogés ou modifiés ne doivent donc pas être affirmés.
- Une copie numérisée secondaire du décret présente une incohérence : son intitulé de fichier/page évoque le n° 2026-310, tandis que le corps OCR du document affiche le n° 2026-340/PRN/PM. Cette copie n'est pas une authentification officielle. Le numéro exact doit être vérifié dans le Journal officiel.
- Le transfert institutionnel annoncé ne permet pas, à lui seul, d'identifier les services opérationnels, les formulaires, les procédures, les délais ou les interlocuteurs compétents pour les formalités de SAC.
- Il n'est pas établi, à partir des documents authentifiés consultés, que toutes les garanties substantielles de la loi n° 2022-59 demeurent inchangées, ni que l'ensemble de cette loi aurait disparu.

Sources de contexte, à ne pas substituer au Journal officiel :
- ANP : https://anp.ne/niger-plusieurs-services-rattaches-ou-sous-tutelle-de-la-presidence-de-la-primature-et-du-secretariat-general-du-gouvernement-supprimes/
- Africa Data Protection : https://www.africadataprotection.org/niger-suppression-de-la-haute-autorite-de-protection-des-donnees-a-caractere-personnel.html
- Copie secondaire du décret (transcription incohérente) : https://www.scribd.com/document/1058080703/Decret-2026-310-Du-08-Juin-Pourtant-Suppression-de-Certains-Services

## 6. Actions toujours bloquantes

- Obtenir une copie authentique du Journal officiel contenant l'ordonnance n° 2026-30 et relever exactement ses articles.
- Obtenir la copie authentique du décret du 8 juin 2026 et confirmer son numéro, son contenu et les transferts de missions.
- Identifier les services réellement opérationnels au sein des ministères concernés et faire confirmer les formalités applicables à SAC.
- Arbitrer explicitement la compatibilité entre historique GPS consultable hors ligne et expiration stricte J+30.
- Ne pas connecter de GPS réel, ne créer aucune migration D1, aucune API GPS et aucune ressource cloud avant validation des critères.
- Maintenir le statut **NON PRÊT POUR PRODUCTION** pour l'historique GPS tant que la preuve de destruction n'existe pas.


## 7. Comparaison de mécanismes KMS documentés — aucun validé pour SAC

La recherche a identifié deux mécanismes de destruction planifiée réels. Ils sont plus sérieux qu'une expiration KV, mais aucun ne démontre à lui seul la garantie SAC complète.

### 7.1 Google Cloud KMS — destruction différée des versions de clé

La documentation Google indique :
- la destruction d'une version de clé est planifiée avec une période de restauration ;
- la période par défaut est de 30 jours et peut être configurée à la création de la clé, de 24 heures à 120 jours ;
- pendant l'état « scheduled for destruction », la clé ne peut plus être utilisée pour les opérations cryptographiques, mais elle peut être restaurée en état désactivé par un acteur autorisé ;
- une fois l'état « destroyed » atteint, la matière cryptographique n'est plus conservée dans les systèmes actifs ;
- Google indique que la suppression de la matière de clé de toute son infrastructure, y compris les sauvegardes de centres de données, intervient dans les 45 jours suivant l'heure de destruction planifiée.

Documentation officielle :
- https://docs.cloud.google.com/kms/docs/destroy-restore
- https://docs.cloud.google.com/kms/docs/key-states

**Évaluation SAC :**
- Si la destruction est planifiée dès la collecte, la clé devient immédiatement inutilisable : l'historique ne reste pas consultable pendant les 30 jours.
- Si la destruction est planifiée à J+30, la clé devient immédiatement inutilisable à cette date, mais la période de restauration crée une possibilité de réactivation par un acteur autorisé.
- La documentation prévoit jusqu'à 45 jours après l'heure planifiée pour la suppression de la matière de clé de toute l'infrastructure, y compris les sauvegardes. Cela ne prouve donc pas une purge physique/infra de toutes les copies exactement à J+30.
- Une politique IAM restrictive peut réduire le risque de restauration, mais ne doit pas être confondue avec une preuve indépendante de destruction irréversible.

Conclusion : piste de recherche utile pour une coupure d'accès à J+30, mais **non conforme en l'état à l'exigence stricte de non-récupérabilité à J+30**.

### 7.2 AWS KMS — suppression planifiée d'une clé gérée par le client

La documentation AWS indique :
- la période d'attente est obligatoire et comprise entre 7 et 30 jours ;
- une clé en état « Pending deletion » ne peut pas être utilisée pour des opérations cryptographiques ;
- la suppression peut être annulée avant la fin de la période d'attente ;
- après expiration de cette période, la clé et sa matière cryptographique sont supprimées de façon irréversible ;
- la date réelle de suppression peut être jusqu'à 24 heures plus tard que la période programmée ;
- les clés d'External Key Store et de CloudHSM ont des limites particulières : la suppression de la clé KMS ne supprime pas nécessairement la clé externe, et les sauvegardes CloudHSM peuvent contenir encore la matière de clé.

Documentation officielle :
- https://docs.aws.amazon.com/kms/latest/developerguide/deleting-keys.html
- https://docs.aws.amazon.com/kms/latest/developerguide/deleting-keys-scheduling-key-deletion.html

**Évaluation SAC :**
- La clé devient inutilisable dès la programmation de la suppression, et non à la fin de la période d'attente.
- La suppression planifiée est annulable pendant 7 à 30 jours : une gouvernance IAM sans droit de récupération pour les opérateurs SAC serait indispensable, mais ne prouve pas à elle seule l'absence de toute voie de restauration.
- La suppression finale survient après le délai d'attente, avec une marge pouvant atteindre 24 heures ; elle ne constitue donc pas une destruction finale exactement à J+30 si elle est déclenchée à cette date.
- Les variantes CloudHSM et External Key Store introduisent des copies ou clés externes qui doivent être traitées séparément.

Conclusion : piste de recherche utile, mais **non conforme en l'état à la double exigence de disponibilité pendant 30 jours et de destruction irréversible exactement à J+30**.

### 7.3 Comparaison

| Critère SAC | Google Cloud KMS | AWS KMS |
|---|---|---|
| Coupure d'usage dès la programmation | Oui | Oui |
| Restauration pendant une période d'attente | Oui | Oui, annulation possible |
| Suppression finale exactement à J+30 | Non démontrée | Non, délai 7–30 jours et marge possible de 24 h |
| Traitement des sauvegardes | Suppression de toute l'infrastructure annoncée sous 45 jours après l'heure planifiée | Cas particuliers CloudHSM / External Key Store ; autres copies à vérifier contractuellement |
| Lecture historique hors ligne sans clé locale | Non | Non |
| Validé pour SAC | **Non** | **Non** |

### 7.4 Décision technique provisoire

Aucun des mécanismes étudiés (clé locale, Cloudflare KV, Google Cloud KMS, AWS KMS) n'est approuvé pour promettre simultanément :
1. la lecture hors ligne de l'historique GPS jusqu'à la fin des 30 jours ;
2. l'impossibilité de restaurer ou de rendre lisible cet historique après J+30, même par restauration d'une sauvegarde ou d'un système de clés.

Le seul comportement qui peut être retenu sans cette preuve est l'absence d'archive GPS historique persistante : position transmise en direct uniquement pendant la durée autorisée, sans conservation ultérieure sous contrôle de SAC.

Cette décision provisoire ne supprime pas l'objectif produit de J+30 ; elle interdit seulement de prétendre que l'objectif est déjà techniquement garanti. Une nouvelle proposition devra être évaluée par un spécialiste indépendant en cryptographie appliquée et testée sur les copies de clés et les chemins de restauration réels.


## 8. Horloge sécurisée embarquée — Android StrongBox et Apple Secure Enclave

La piste d'une expiration entièrement locale a été confrontée aux documentations officielles des plateformes. Le résultat ne permet pas de valider une destruction à J+30.

### 8.1 Android Keystore / StrongBox

La documentation Android confirme que StrongBox dispose d'une horloge interne protégée contre la manipulation par le processeur principal. Le document de compatibilité Android lui impose toutefois une précision raisonnable de ±10 %. Cette tolérance est incompatible avec une promesse d'expiration civile exacte à J+30.

Nuance importante : Android n'affirme pas que toute expiration est toujours logicielle. Certains matériels peuvent appliquer les autorisations temporelles dans le composant sécurisé. L'attestation distingue les autorisations « hardwareEnforced » des autorisations « softwareEnforced ». Mais Android précise que les autorisations temporelles ne sont généralement pas imposées par le matériel, car celui-ci ne dispose normalement pas d'une horloge temps réel indépendante et sécurisée. L'API permettant de définir une date de fin ne prouve donc pas, à elle seule, que l'appareil l'impose matériellement. Même lorsque l'attestation prouve une application matérielle, la tolérance StrongBox publiée de ±10 % ne démontre pas une échéance exacte à J+30.

Références officielles :
- Android Keystore : https://developer.android.com/privacy-and-security/keystore
- API KeyGenParameterSpec.Builder / setKeyValidityEnd : https://developer.android.com/reference/android/security/keystore/KeyGenParameterSpec.Builder
- Android Compatibility Definition Document, section StrongBox (horloge interne ±10 %) : https://source.android.com/docs/compatibility/android-cdd
- Android KeyMint/Keymaster, autorisations temporelles et horloge fournie par le monde non sécurisé : https://android.googlesource.com/platform/docs/source.android.com/+/f8cc3333edbe85cb7cf5e4ac8ef8a54b6fb4fb5f/en/security/keystore/features.html

Android documente également la résistance au retour arrière des clés : lorsqu'elle est effectivement prise en charge et attestée, le matériel peut garantir qu'une clé supprimée ne sera plus utilisable après restauration d'un ancien blob. Mais cette protection n'est pas garantie pour chaque clé/appareil ; la documentation indique qu'une clé peut être créée sans cette propriété lorsque le stockage anti-rollback n'est pas disponible. La résistance au rollback ne résout donc pas à elle seule le problème de l'heure exacte J+30.

Référence : https://android.googlesource.com/platform/docs/source.android.com/+/04426e67ca3ee557a0083f9b3c6ba789021bd7a0/en/security/keystore/implementer-ref.html

**Évaluation SAC :** StrongBox est une brique de protection intéressante, mais ni sa présence ni la configuration d'une date d'expiration Android ne prouvent l'application matérielle d'une échéance exacte J+30 sur l'ensemble des téléphones. Une validation appareil par appareil, avec attestation de l'application effective des autorisations matérielles, serait nécessaire ; même cela ne résout pas la tolérance de l'horloge décrite dans le CDD.

### 8.2 Apple Secure Enclave / Keychain

Apple documente des clés protégées par Secure Enclave qui restent liées au matériel et ne sont pas exportées en clair. L'attribut Keychain « ThisDeviceOnly » empêche également la migration de l'élément vers un autre appareil. Ces propriétés réduisent certains risques de copie et de restauration inter-appareils.

Les documentations consultées ne décrivent toutefois pas de mécanisme public permettant à une application de programmer la destruction cryptographique d'une clé Secure Enclave à une date absolue exacte, garantie même lorsque l'appareil reste éteint. « ThisDeviceOnly » signifie non migrable ; cela ne signifie pas « expire à J+30 ». Une restriction d'accès ou une suppression de l'élément Keychain par l'application ne doit pas être présentée comme une destruction temporelle matériellement garantie.

Références officielles :
- Apple — Protecting keys with the Secure Enclave : https://developer.apple.com/documentation/Security/protecting-keys-with-the-secure-enclave
- Apple — kSecAttrAccessibleWhenUnlockedThisDeviceOnly : https://developer.apple.com/documentation/security/ksecattraccessiblewhenunlockedthisdeviceonly

**Évaluation SAC :** excellente protection de certaines clés liées à l'appareil, mais preuve insuffisante pour l'expiration irréversible à J+30 en cas d'arrêt prolongé, de restauration ou de manipulation de l'heure.

### 8.3 Conclusion comparative

| Mécanisme | Propriété documentée | Limite pour SAC |
|---|---|---|
| Android StrongBox | Élément sécurisé, minuteur interne, stockage sécurisé | Horloge ±10 % dans le CDD ; expiration de clé généralement non imposée matériellement |
| Android Keystore expiration | Date de validité configurable | L'API seule ne prouve pas l'application matérielle ; dépend du matériel et de l'implémentation |
| Android anti-rollback | Une clé réellement protégée contre rollback ne doit pas redevenir utilisable après suppression | Propriété non garantie pour chaque clé/appareil ; ne fournit pas l'heure exacte |
| Apple Secure Enclave | Clés matérielles non exportables | Pas de mécanisme public documenté de destruction automatique à date absolue J+30 |
| Apple Keychain ThisDeviceOnly | Non-migration vers un autre appareil | N'est pas une expiration temporelle |

**Conclusion : aucune solution locale Android/iOS ne peut actuellement être approuvée pour la promesse SAC stricte.** La compatibilité offline pendant 30 jours et la destruction irréversible exactement à J+30 restent non démontrées. Ne pas transformer ces capacités matérielles réelles mais partielles en garantie de sécurité produit.


## 9. Gestionnaire de clés externe (HYOK/XKS) — piste de crypto-effacement centralisé

Une piste distincte des KMS classiques est l'utilisation d'un gestionnaire de clés externe contrôlé séparément du stockage des données. AWS documente les External Key Stores (XKS) : le matériel de clé externe reste dans le gestionnaire du client ; AWS KMS ne peut ni créer, ni consulter, ni gérer, ni supprimer cette clé externe. Si l'accès à cette clé est définitivement révoqué, les ciphertexts correspondants deviennent irrécupérables.

Références officielles :
- AWS — External key stores : https://docs.aws.amazon.com/kms/latest/developerguide/keystore-external.html
- AWS — How unusable KMS keys affect data keys : https://docs.aws.amazon.com/kms/latest/developerguide/unusable-kms-keys.html

### 9.1 Ce que cette piste apporte

- La clé racine ou clé externe peut rester hors du fournisseur qui héberge les données.
- La révocation définitive de la clé externe peut rendre les sauvegardes chiffrées inutilisables, même si les blocs chiffrés subsistent.
- La destruction peut être opérée par le gestionnaire externe, sans demander au stockage de supprimer toutes les copies de ciphertext.
- Cette séparation peut réduire le risque qu'une restauration du stockage de données restaure aussi le secret qui permet de lire ces données.

### 9.2 Les limites à résoudre

AWS signale explicitement une exception : les services qui ont déjà mis en cache des clés de données peuvent continuer à les utiliser jusqu'à désactivation de la ressource ou expiration du cache. La simple révocation de la clé externe ne suffit donc pas si une clé de données en clair est déjà présente dans un cache ou dans un processus.

Pour SAC, toute architecture candidate devrait interdire :
- la conservation d'une clé de données en clair sur le téléphone ou dans un stockage local ;
- les caches persistants de clés de données sur le serveur ;
- les copies de clés dans les journaux, traces, files d'attente, rapports d'erreur ou outils d'observabilité ;
- les sauvegardes ou exports du gestionnaire externe qui permettraient de restaurer une clé supprimée ;
- tout chemin de restauration permettant de réimporter la clé ou son secret source.

Le serveur ne pourrait obtenir une capacité de déchiffrement qu'au moment d'une consultation autorisée, avec la clé en mémoire volatile pendant l'opération. Même cette approche nécessite une analyse de la mémoire, des crash dumps, des copies temporaires et des garanties de destruction du fournisseur d'exécution.

### 9.3 Pourquoi cela ne résout pas encore J+30

XKS est une interface de délégation cryptographique, pas une promesse de destruction programmée à une date absolue. AWS ne gère pas la suppression des clés externes : cette responsabilité revient au gestionnaire externe. Il faudrait identifier un gestionnaire dont le contrat garantit la destruction automatique à l'échéance, l'absence de restauration par sauvegarde, la suppression des réplicas et la preuve d'exécution. Aucun fournisseur répondant à l'ensemble de ces critères n'a été validé dans cette recherche.

L'indisponibilité du gestionnaire externe bloque aussi le déchiffrement. Cette dépendance peut convenir à un historique consultable uniquement en ligne, mais elle ne permet pas l'accès hors ligne si aucune clé n'est conservée sur l'appareil. Conserver une clé locale pour permettre l'accès hors ligne réintroduirait précisément le risque de copie/restauration qui motive l'exigence J+30.

### 9.4 Décision de recherche

**XKS/HYOK devient une piste à approfondir, pas une architecture approuvée.** Elle pourrait servir à une conservation chiffrée consultable en ligne, si un gestionnaire externe et ses engagements de destruction sont validés. Elle ne satisfait pas à ce stade la combinaison « accès hors ligne pendant 30 jours + destruction irréversible exactement à J+30 ». Aucun service, compte, HSM ou secret n'a été créé ou connecté pour cette étude.

## 10. État juridique nigérien — pièces consultées et limites de preuve

### 10.1 Éléments établis par des sources consultées

- Le texte officiel de la loi n° 2022-59 du 16 décembre 2022 est consultable sur l'ancien site de la HAPDP. Il définit expressément les données de localisation (article premier) et prévoit notamment des obligations de sécurité et de conservation (articles 82 et 84), ainsi que des droits d'effacement (articles 73 et 74).
- La page de législation de l'ancien site HAPDP présente la loi 2022-59 consolidée avec ses textes modificatifs, la loi 2023-31 et les ordonnances 2024-16 et 2024-29. Cette page est manifestement ancienne sur la situation institutionnelle et ne constitue pas une preuve de l'état juridique après juin 2026.
- L'Agence Nigérienne de Presse rapporte que le décret signé le 8 juin 2026 supprime la HAPDP et transfère ses missions au ministère de la Justice et au ministère de l'Intérieur.

Références :
- Loi 2022-59 publiée sur l'ancien site HAPDP : https://www.hapdp.ne/uploads/files/Loi-N%C2%B02022-59HAPDP.pdf
- Page législation HAPDP : https://www.hapdp.ne/legislation-nationale
- ANP, 12 juin 2026 : https://anp.ne/niger-plusieurs-services-rattaches-ou-sous-tutelle-de-la-presidence-de-la-primature-et-du-secretariat-general-du-gouvernement-supprimes/

### 10.2 Pièces qui restent non authentifiées

Le préambule d'une copie diffusée sur Scribd du décret de suppression cite une ordonnance n° 2026-30 du 8 juin 2026 portant abrogation de certaines lois de création d'autorités et de certaines dispositions de la loi 2022-59. Toutefois, la copie disponible n'est pas une publication officielle authentifiée ; son en-tête comporte une divergence de numéro entre 2026-310 et 2026-340. Des sources secondaires reprennent le numéro 2026-310, mais cela ne remplace pas le Journal officiel.

À la date de cette recherche, le texte intégral authentifié de l'ordonnance 2026-30 et la copie officielle du Journal officiel contenant le décret n'ont pas été retrouvés. Il est donc impossible de déterminer précisément quels articles de la loi 2022-59 ont été abrogés, quelles dispositions ont été conservées, ou comment les pouvoirs transférés sont désormais exercés.

Ne pas écrire dans les documents SAC que la loi 2022-59 a été entièrement abrogée, ni que toutes ses dispositions restent inchangées. Toute conclusion juridique opérationnelle doit attendre la publication officielle et une revue par un juriste nigérien.



## 11. Évaluation de deux gestionnaires HSM/KMS supplémentaires

### 11.1 Fortanix DSM — expiration vs destruction

La documentation Fortanix distingue clairement trois opérations :

- **Expiration/désactivation** : à la date configurée, l'objet passe en état « Deactivated ». Une clé désactivée ne peut plus servir à créer de nouvelles protections, mais elle peut encore être utilisée pour traiter des données déjà protégées, notamment pour déchiffrer ou déballer une clé. Cela ne satisfait pas l'objectif de rendre les anciennes positions illisibles.
- **Destroy** : la matière de clé est supprimée ; les données chiffrées ne peuvent alors plus être utilisées. Si une Key Undo Policy est activée, cette destruction reste toutefois réversible pendant la période configurée.
- **Delete** : supprime aussi les métadonnées de l'objet, selon le workflow et la politique appliqués.

La Key Undo Policy documentée impose une fenêtre réversible minimale de 7 jours et maximale de 180 jours. Elle ne permet donc pas une destruction irréversible au même instant que J+30 si l'opération de destruction n'est déclenchée qu'à J+30. Le fournisseur documente par ailleurs des procédures de sauvegarde, de restauration et de réplication ; la suppression doit donc être testée contre les sauvegardes et réplicas réellement activés.

Références du fournisseur :
- Expiration d'un objet : https://support.fortanix.com/docs/is-there-an-option-to-expire-a-security-object-at-a-specific-date-or-after-a-certain-time-period
- Key Undo Policy : https://support.fortanix.com/docs/fortanix-dsm-key-undo-policy
- Sauvegarde et restauration : https://support.fortanix.com/docs/introduction-to-fortanix-dsm-backup-and-restore
- Réplication de compte : https://support.fortanix.com/docs/fortanix-dsm-account-replication

**Décision : Fortanix DSM n'est pas approuvé à ce stade.** La date d'expiration documentée n'est pas une destruction cryptographique, la fenêtre de réversibilité et les chemins de restauration exigent une analyse contractuelle et expérimentale. Une destruction manuelle/API sans période réversible pourrait être étudiée, mais elle ne prouve pas à elle seule une destruction automatique et ponctuelle à J+30.

### 11.2 Azure Managed HSM — suppression réversible

Azure Managed HSM impose le soft-delete : une clé supprimée reste récupérable pendant une période configurable de 7 à 90 jours. La purge de protection empêche la suppression définitive avant la fin de cette période. Cette protection est utile contre une suppression accidentelle ou malveillante, mais ne correspond pas à l'exigence SAC :
- si la clé est supprimée au début de la période, elle devient indisponible trop tôt ;
- si elle est supprimée à J+30, elle reste récupérable après J+30 pendant la période de rétention ;
- la documentation ne permet donc pas de promettre à la fois accès jusqu'à J+30 et irréversibilité exacte à J+30.

Références Microsoft :
- https://learn.microsoft.com/en-us/azure/key-vault/managed-hsm/soft-delete-overview
- https://learn.microsoft.com/en-us/azure/reliability/reliability-managed-hsm

**Décision : Azure Managed HSM est écarté pour la promesse stricte J+30 avec les mécanismes de suppression documentés.**

### 11.3 Synthèse actualisée des fournisseurs

| Solution | Fonction utile | Motif de non-approbation |
|---|---|---|
| AWS KMS standard | Destruction définitive après attente | Attente 7–30 jours, jusqu'à 24 h supplémentaires ; copies et caches de data keys à contrôler |
| AWS XKS/HYOK | Clé externe révocable, ciphertext potentiellement irrécupérable | Pas de destruction automatique J+30 fournie par XKS ; cache de data keys et disponibilité externe à traiter |
| Google Cloud KMS | Destruction programmée | Restauration possible pendant l'attente ; suppression de toutes les copies annoncée jusqu'à 45 jours après l'échéance programmée |
| Azure Managed HSM | Purge protégée | Récupération obligatoire 7–90 jours ; ne fournit pas l'accès 30 jours puis destruction immédiate |
| Fortanix DSM | Expiration, destruction, politiques de réversibilité | Expiration autorise encore le déchiffrement ; destruction et sauvegardes/réplication à qualifier |
| Android StrongBox | Horloge interne résistante à la manipulation AP, autorisations parfois matériellement imposées | ±10 % annoncé pour l'horloge ; support et enforcement variables selon appareil |
| Apple Secure Enclave/Keychain | Clés liées au matériel | Pas de mécanisme public validé pour destruction automatique à date absolue J+30 |

Aucun des fournisseurs examinés ne reçoit le statut « approuvé pour SAC ». La recherche doit privilégier un mécanisme de destruction automatique contrôlé par un HSM externe, dont la documentation contractuelle précise les délais, les réplicas, les sauvegardes, les restaurations et les caches. La preuve doit être faite par test de restauration, et pas seulement par une réponse API « clé supprimée ».

## 12. Conséquence juridique et hébergement des données

La loi 2022-59 publiée sur l'ancien site HAPDP définit les données de localisation dans son article premier. Elle contient aussi des dispositions sur les transferts vers des États tiers (articles 62 et 63), les droits de suppression (article 73), la sécurité (article 82) et la conservation limitée à la durée nécessaire (article 84). Ces références doivent être considérées comme le texte de base historiquement publié, pas comme une confirmation de leur rédaction actuelle après l'ordonnance 2026-30 non authentifiée.

**Point de vigilance SAC :** l'hébergement de données personnelles ou de clés hors du Niger peut soulever une question de transfert transfrontalier. Le choix d'un fournisseur Cloudflare, AWS, Google, Azure ou Fortanix ne doit pas être arrêté sur le seul critère cryptographique. Il faudra faire vérifier par un juriste nigérien le texte consolidé applicable, les dispositions de transfert encore en vigueur, les obligations du responsable et du sous-traitant, et les autorités désormais compétentes.

Référence au texte historique consulté : https://www.hapdp.ne/uploads/files/Loi-N%C2%B02022-59HAPDP.pdf


## 13. Recherche des publications officielles nigériennes — complément

La recherche a été étendue aux domaines officiels consultables du ministère de la Justice, du ministère chargé des technologies de l'information et des sites gouvernementaux. Aucun exemplaire authentifié de l'ordonnance n° 2026-30 du 8 juin 2026 n'a été retrouvé dans les résultats consultés.

Le ministère nigérien de la Justice rappelle lui-même que le Journal officiel de la République du Niger constitue la référence officielle attestant de l'entrée en vigueur des textes législatifs et réglementaires. Il indique également que des numéros spéciaux du Journal officiel ont été remis aux juridictions pour des ordonnances de 2026. Cette indication renforce la nécessité d'obtenir le numéro exact du Journal officiel plutôt que de s'appuyer sur une copie secondaire ou sur un préambule.

Référence institutionnelle :
- Ministère de la Justice, « Mission Ministérielle de visites des Juridictions du pays : Renforcement des capacités documentaires des Magistrats » : https://justice.gouv.ne/index.php/les-actualites-1/353-mission-ministerielle-de-visites-des-juridictions-du-pays-renforcement-des-capacites-documentaires-des-magistrats

**Statut de recherche :** le texte officiel n'est toujours pas authentifié. La prochaine étape juridique est d'obtenir directement le numéro spécial du Journal officiel du 8 juin 2026 auprès du Secrétariat général du Gouvernement ou du ministère de la Justice, puis de faire analyser l'ordonnance article par article. Aucune hypothèse sur les articles supprimés ne doit être convertie en règle de conception SAC.


## 14. Trois pistes supplémentaires — Thales CipherTrust, Oracle OCI Vault et HashiCorp Vault

### 14.1 Thales CipherTrust Manager — sauvegardes et clé racine HSM

La documentation Thales consultée indique que les sauvegardes CipherTrust Manager sont chiffrées avec une clé de sauvegarde, puis peuvent être téléchargées et restaurées sur la même appliance ou une autre. Les sauvegardes peuvent être planifiées périodiquement. Dans le cas d'une sauvegarde liée au HSM (« tied-to-HSM »), la clé Root of Trust du HSM est nécessaire pour déchiffrer et restaurer la sauvegarde. Thales avertit que supprimer la dernière clé Root of Trust rend les sauvegardes concernées définitivement irrécupérables.

Cela décrit un mécanisme puissant de destruction par perte contrôlée de la clé de restauration, mais ne prouve pas une destruction automatique de la clé GPS à une échéance J+30. Supprimer la Root of Trust est en outre une opération de décommissionnement global, pas une expiration sélective et planifiée d'une clé de dossier. Les sauvegardes ordinaires et leur clé de sauvegarde doivent être inventoriées ; les sauvegardes liées au HSM, les nœuds du cluster et les copies exportées doivent être testés séparément.

Références officielles :
- Thales — Backups : https://www.thalesdocs.com/ctp/cm/2.18/admin/cm_admin/backups/index.html
- Thales — Root of Trust Hardware Security Module : https://thalesdocs.com/ctp/cm/2.19/admin/cm_admin/hardware-security-module/index.html
- Thales — Scheduling Backups : https://thalesdocs.com/ctp/cm/2.14/admin/cm_admin/scheduling-backups/index.html

**Décision : non approuvé.** La documentation étudiée expose la protection et la restauration des sauvegardes, mais pas un contrat de destruction sélective, automatique, irréversible et datée à J+30 pour une clé individuelle.

### 14.2 Oracle Cloud Infrastructure Vault — suppression planifiée mais annulable

La documentation OCI décrit une suppression de clé planifiée à une date comprise entre 7 et 30 jours après la demande. Pendant l'état « Pending Deletion », l'opération peut être annulée ; l'annulation rétablit l'utilisation de la clé et l'accès aux données chiffrées. Le délai de 30 jours par défaut ne constitue donc pas une preuve que la suppression est irréversible à J+30 : un administrateur autorisé peut annuler l'opération avant son terme.

Références officielles :
- Oracle CLI — schedule-deletion : https://docs.oracle.com/en-us/iaas/tools/oci-cli/latest/oci_cli_docs/cmdref/kms/management/key/schedule-deletion.html
- Oracle CLI — cancel-deletion : https://docs.oracle.com/en-us/iaas/tools/oci-cli/latest/oci_cli_docs/cmdref/kms/management/vault/cancel-deletion.html

**Décision : non approuvé pour la garantie SAC.** Le délai est intéressant, mais la possibilité d'annulation durant la période est incompatible avec l'exigence d'une irréversibilité garantie à l'instant J+30. Il faudrait également qualifier les sauvegardes et clés exportées.

### 14.3 HashiCorp Vault Transit — destruction de versions et restauration par sauvegarde

Vault Transit permet de supprimer définitivement des versions anciennes d'une clé via l'opération « trim ». La documentation indique également qu'une sauvegarde Transit contient les configurations et toutes les versions de clé et qu'elle peut être restaurée par l'API de restauration. La sauvegarde de clé est renvoyée en clair par l'API ; elle constitue donc elle-même un secret extrêmement sensible.

Vault Transit ne fournit pas de délai de suppression différée intégré. Le contrôle de la date J+30 devrait être construit par l'application ou un orchestrateur externe. Une sauvegarde exportée avant le trim pourrait réintroduire les anciennes versions si elle est conservée et accessible. Il faudrait donc interdire les exports de sauvegarde, ou disposer d'une preuve de destruction de toutes les copies et de tous les accès de restauration, ce qui n'est pas démontré ici.

Références officielles :
- HashiCorp — Transit API (backup, restore et trim) : https://developer.hashicorp.com/vault/api-docs/secret/transit
- HashiCorp — Transit secrets engine : https://developer.hashicorp.com/vault/docs/secrets/transit
- HashiCorp — Protect your keys : https://developer.hashicorp.com/terraform/cloud-docs/hold-your-own-key/protect

**Décision : non approuvé.** La suppression de versions est techniquement utile, mais la présence d'un mécanisme de sauvegarde/restauration et l'absence de destruction différée native ne permettent pas de garantir J+30 sans une architecture externe supplémentaire.

### 14.4 Synthèse de cette vague

| Solution | Fonction observée | Limite décisive pour SAC |
|---|---|---|
| Thales CipherTrust Manager | Sauvegardes chiffrées, restauration, clé Root of Trust HSM | Pas de preuve de destruction sélective automatique J+30 ; suppression de la Root of Trust trop globale |
| Oracle OCI Vault | Suppression planifiée entre 7 et 30 jours | Suppression annulable avant échéance |
| HashiCorp Vault Transit | Trim irréversible des versions et API de sauvegarde/restauration | Pas de planification J+30 native ; sauvegarde exportée restaurable |

Cette vague ne fait émerger aucun fournisseur approuvé. Elle confirme que la fonction « delete/destroy » isolée ne suffit jamais : le critère est l'impossibilité démontrée de restaurer la matière de clé après J+30, depuis chaque sauvegarde, réplica, export, cache, compte administrateur et procédure de reprise. Une promesse commerciale ou un état API terminal ne remplace pas les essais de restauration négatifs et les engagements contractuels.


## 15. Précision supplémentaire sur Thales CipherTrust — Root of Trust et restauration HSM

Une lecture complémentaire de la documentation Thales sur la Root of Trust (RoT) permet de préciser le risque identifié à la section 14.1.

Thales documente la possibilité de supprimer une clé RoT par son identifiant. La documentation avertit que la suppression de la dernière clé RoT rend CipherTrust Manager inutilisable et rend irrécupérables les clés gérées par l'appliance. Elle précise également qu'une sauvegarde système créée avec l'option « tied-to-HSM » est chiffrée avec la clé RoT HSM active : si cette clé est supprimée, cette sauvegarde ne peut plus être déchiffrée ni restaurée.

Cette propriété est intéressante comme mécanisme de destruction cryptographique d'une sauvegarde, mais elle ne valide pas l'architecture SAC :

- la suppression de la dernière RoT est documentée comme une opération de décommissionnement, pas comme une suppression ciblée d'une clé GPS individuelle ;
- la perte de la RoT peut rendre l'ensemble de l'appliance et de ses clés inutilisables, avec un impact disproportionné ;
- il faut établir si une partition HSM, une autre appliance, un cluster, un export de clé ou une procédure de récupération conserve une copie ou une capacité équivalente ;
- il n'existe pas dans les éléments examinés de preuve d'un déclenchement automatique, autonome et non annulable à J+30 pour une clé propre à une alerte ou à un utilisateur.

La documentation des sauvegardes confirme par ailleurs qu'elles sont chiffrées avec une clé de sauvegarde, qu'elles peuvent être téléchargées puis restaurées sur la même appliance ou une autre, et que les clés de sauvegarde ne sont pas automatiquement copiées sur les autres nœuds. Ce dernier point ne signifie pas qu'une restauration est impossible : les copies et transferts de la clé de sauvegarde doivent être inventoriés explicitement.

**Décision mise à jour :** Thales CipherTrust reste non approuvé pour SAC à ce stade. Une démonstration en environnement isolé pourrait être pertinente uniquement après confirmation écrite de Thales sur la destruction sélective, les sauvegardes « tied-to-HSM », la topologie HA/cluster, les copies de clés, les exports, la reprise après sinistre et l'absence de restauration après J+30. Aucun achat, compte, appliance ou test destructif n'est autorisé par cette analyse.

Références officielles consultées :
- Thales — Root of Trust Hardware Security Module (documentation v2.17) : https://thalesdocs.com/ctp/cm/2.17/admin/cm_admin/hardware-security-module/index.html
- Thales — Backups (documentation v2.18) : https://www.thalesdocs.com/ctp/cm/2.18/admin/cm_admin/backups/index.html
- NIST SP 800-88 Rev. 2, publiée en septembre 2025 : https://csrc.nist.gov/pubs/sp/800/88/r2/final

### 15.1 Référence méthodologique NIST

Le NIST SP 800-88 Rev. 2 est la version finale publiée en septembre 2025 et remplace la révision 1. Elle traite explicitement de l'effacement cryptographique parmi les méthodes de sanitisation des supports. Elle constitue une référence méthodologique utile pour cadrer les preuves et le programme de sanitisation, mais sa seule citation ne certifie ni un fournisseur ni le respect de l'échéance J+30 par SAC. Le plan de validation SAC doit donc rester fondé sur les scénarios concrets de restauration, de copies et de récupération.


## 16. Luna HSM — destruction d'objet, purge mémoire et zeroization

La documentation Thales Luna consultée montre qu'il faut distinguer plusieurs niveaux souvent regroupés à tort sous le mot « destruction ».

Dans une politique de sécurité publiée pour un module Luna, la fonction PKCS #11 `C_DestroyObject` invalide l'objet ; la matière chiffrée peut rester dans la mémoire flash ou RAM jusqu'à la réallocation de ses emplacements, moment auquel ils sont purgés/zeroisés avant réutilisation. La documentation distingue ce comportement d'une destruction provoquée par une réinitialisation de token ou par certains événements d'authentification, qui peuvent déclencher une zeroization plus large.

La documentation Thales sur les rôles HSM indique par ailleurs que les opérations de zeroization du module sont des fonctions privilégiées du Security Officer. Les recommandations de sauvegarde et de reprise après sinistre prévoient des HSM de sauvegarde hors ligne : ces copies sont utiles pour la continuité d'activité, mais deviennent précisément un risque à traiter lorsqu'une clé doit être irrécupérable après J+30.

**Conséquence pour SAC :** un journal indiquant qu'un objet PKCS #11 a été détruit ne suffit pas à démontrer que ses octets ont déjà été physiquement purgés, ni que des copies de sauvegarde, HA ou DR ne peuvent pas le restaurer. Pour notre garantie, le critère de sécurité principal est l'impossibilité de déchiffrer dès la première reprise après J+30, même si la mémoire physique n'a pas encore été réallouée ; la preuve de sanitisation physique doit être documentée séparément selon le modèle et la certification du module.

Questions à poser au fabricant pour chaque modèle et firmware :
- Après `C_DestroyObject`, la clé est-elle seulement invalidée, ou sa matière est-elle immédiatement zeroisée ? Quelles différences selon mémoire volatile, flash et type d'objet ?
- Existe-t-il une opération de zeroization ciblée par partition, distincte de l'effacement complet du token ou du module ?
- Les sauvegardes HSM, HSM HA, Backup HSM, exports chiffrés et procédures DR conservent-ils une copie restaurable de la clé ?
- La destruction d'une clé peut-elle être programmée pour une date absolue, exécutée même si le système applicatif est hors ligne, et rendue non annulable par tous les rôles administratifs ?
- Quels journaux signés, attestations ou rapports de sanitisation prouvent l'opération, et quelles limites sont explicitement exclues ?

**Décision : non approuvé.** Les documents établissent des mécanismes de destruction et de zeroization, mais pas une fonction démontrée de destruction sélective, autonome, non restaurable et planifiée à J+30 pour SAC.

Références officielles :
- Thales Luna — Best Practices for HSMs, rôles, partitions, sauvegarde et reprise : https://thalesdocs.com/gphsm/luna/7/docs/network/Content/Product_Overview/best_practices_hsms_partitions_clients.htm
- NIST CMVP — Security Policy d'un module Luna Backup HSM, section 3.6 « Cryptographic Material Management » (décrit le comportement de `C_DestroyObject`) : https://csrc.nist.gov/csrc/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp2429.pdf
- Thales CipherTrust Manager — Root of Trust HSM, suppression de clés RoT et sauvegardes liées au HSM : https://thalesdocs.com/ctp/cm/2.17/admin/cm_admin/hardware-security-module/index.html


## 17. Architecture à deux composants — limites de l'accès hors ligne et restauration D1

### 17.1 Principe de sécurité

Une architecture de chiffrement par enveloppe peut séparer :
- une clé de données (DEK) qui chiffre le contenu GPS ;
- une clé d'enveloppement (KEK), ou un composant indispensable à sa dérivation, conservé dans un domaine de confiance distinct.

La séparation n'apporte une garantie J+30 que si aucune copie locale, sauvegarde, cache, export ou appareil associé ne permet de reconstituer le composant externe après l'échéance. Une clé locale non exportable protège contre certains vols de secrets, mais ne prouve pas à elle seule une expiration temporelle irréversible.

### 17.2 Contradiction à traiter explicitement : accès hors ligne

Si l'appareil doit pouvoir déchiffrer l'historique GPS pendant 30 jours sans réseau, il doit conserver localement tout le matériel cryptographique nécessaire, ou disposer d'un mécanisme matériel autonome qui l'autorise. Un adversaire contrôlant l'appareil peut chercher à copier l'état chiffré, les clés exportables, les données déjà déchiffrées ou une image de sauvegarde avant J+30.

Une partie de clé conservée uniquement sur un service externe, sans cache ni clé de données locale persistante, permet au service de refuser le déchiffrement à l'échéance ; en contrepartie, le déchiffrement à la demande devient impossible hors ligne. Les caches de clés de données ou les clés de session persistantes réintroduisent un chemin de contournement et doivent être absents ou bornés par un mécanisme matériel réellement vérifiable.

**Conclusion :** l'exigence « historique consultable hors ligne pendant 30 jours » et l'exigence « aucune restauration locale ne peut rendre les données lisibles après J+30 » ne sont pas garanties ensemble par une simple architecture à deux clés. Toute exception exige un matériel certifié, une horloge fiable, un état anti-retour arrière et des preuves spécifiques à chaque modèle d'appareil. Android documente StrongBox avec minuterie sécurisée, mais précise que les autorisations temporelles du Keystore ne sont généralement pas appliquées par le matériel faute d'horloge temps réel indépendante. Il faut donc tester et attester le comportement de chaque appareil ; la présence de StrongBox ne suffit pas.

### 17.3 Cloudflare D1 Time Travel : frontière de conservation

La documentation Cloudflare indique que D1 Time Travel est activé automatiquement. Les bookmarks de restauration sont disponibles jusqu'à 30 jours (Workers Paid) ou 7 jours (Workers Free) et une restauration peut remettre la base à un état antérieur ; la restauration peut elle-même être annulée en restaurant le bookmark précédent.

Il ne faut donc jamais utiliser D1 Time Travel comme mécanisme d'effacement J+30. Les coordonnées GPS précises et les clés ou composants permettant de les déchiffrer doivent être exclus de D1, de ses journaux, de ses exports et de tout autre stockage serveur si notre exigence demeure qu'une restauration ne puisse pas les faire réapparaître lisibles. D1 peut contenir des métadonnées non sensibles nécessaires au fonctionnement, selon la matrice de conservation validée.

### 17.4 Options de produit à arbitrer avant architecture

- **Option A — disponibilité hors ligne :** historique consultable hors ligne pendant la période autorisée ; nécessite une preuve de sécurité matérielle et anti-rollback par appareil. Aucun modèle n'est actuellement validé pour J+30 strict.
- **Option B — priorité à l'irréversibilité :** déchiffrement via un service externe sans cache de DEK ; pas de consultation de l'historique GPS hors ligne. Piste techniquement plus contrôlable, mais disponibilité réseau nécessaire.
- **Option C — compromis limité :** seules les positions nouvelles sont visibles en direct pendant l'alerte ; l'historique détaillé n'est pas conservé localement hors ligne. À étudier comme alternative produit, sans la considérer comme déjà approuvée.

Aucune de ces options n'est adoptée par cette note. L'arbitrage doit rester explicite et être validé avec les tests de restauration, les contraintes de connectivité au Niger et une revue cryptographique indépendante.

Références officielles :
- Android Keystore — StrongBox, secure timer et limites d'application des autorisations temporelles : https://developer.android.com/privacy-and-security/keystore
- Cloudflare D1 — Time Travel and backups, rétention des bookmarks, restauration et annulation : https://developers.cloudflare.com/d1/reference/time-travel/
- NIST SP 800-57 Part 1 Rev. 5 — gestion des clés, sauvegarde, récupération et cycle de vie : https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final


## 18. Précision documentaire D1 et séparation « position en direct » / « historique GPS »

### 18.1 Rétention D1 à retenir

La documentation Cloudflare D1 consultée le 18 novembre 2026 précise que Time Travel est toujours activé et que les bookmarks permettent une restauration jusqu'à 30 jours sur Workers Paid et 7 jours sur Workers Free. La page décrit aussi la conservation des bookmarks antérieurs après une restauration et la possibilité d'annuler une restauration en revenant au bookmark précédent.

Conséquence : ne jamais déduire que la limite de rétention de Time Travel constitue une politique de suppression des données applicatives. La suppression des coordonnées GPS doit être indépendante de D1 et résistante à la restauration de tous les états de base accessibles. Toute copie/export D1 vers R2 ou autre support doit être analysée comme une sauvegarde distincte, avec sa propre politique de conservation ; aucune exportation D1 n'est autorisée par cette note.

### 18.2 Distinguer trois objets de données

Pour éviter qu'un choix sur l'historique bloque les alertes elles-mêmes, le modèle doit distinguer :
1. **Position ponctuelle actuelle** : position fournie volontairement pour une alerte active, avec horodatage et statut de fraîcheur. Elle ne doit jamais être affichée comme « en direct » si elle est ancienne ou si le partage a cessé.
2. **Flux temporaire pendant une alerte ou un trajet** : positions nécessaires au partage explicitement activé, avec destinataires et durée autorisés, et sans conservation plus longue que la finalité approuvée.
3. **Historique GPS précis** : trace consultable après coup. C'est cet historique qui est soumis à l'exigence de destruction irréversible au plus tard à J+30 et au NO-GO actuel.

Cette distinction est une proposition d'architecture à confirmer avec la matrice de conservation existante ; elle ne crée pas une autorisation de conserver une position côté serveur, dans les journaux, dans une file de notifications ou dans des sauvegardes. Les messages et notifications ne doivent pas recopier de coordonnées précises.

### 18.3 Conséquence sur le choix technique

La voie la plus prudente pour la première version est de ne pas promettre la consultation hors ligne de l'historique GPS. Une alerte peut continuer à transmettre une nouvelle position ponctuelle lorsque l'appareil et le réseau le permettent ; si la connexion manque, l'interface doit signaler explicitement l'absence de mise à jour et ne pas transformer une ancienne coordonnée en position actuelle. Le repli SMS, s'il est implémenté plus tard, doit être conçu et validé séparément.

L'historique GPS précis reste désactivé tant que l'équipe n'a pas démontré : destruction de toutes les clés/copies de récupération, absence de copie plaintext, résistance aux restaurations, comportement appareil hors ligne/éteint, et vérification indépendante. Ce choix provisoire protège l'exigence de sécurité sans prétendre que l'alerte SOS ou la localisation ponctuelle sont déjà implémentées.

Références officielles vérifiées le 18 novembre 2026 :
- Cloudflare D1 — Time Travel and backups : https://developers.cloudflare.com/d1/reference/time-travel/
- Android Keystore — temporal validity intervals et enforcement matériel : https://developer.android.com/privacy-and-security/keystore
- Android Open Source Project — distinction hardwareEnforced / softwareEnforced : https://source.android.com/docs/security/features/keystore/features

## 19. Sauvegardes natives Android/iOS — constat officiel (18 novembre 2026)

### Android Auto Backup
La documentation Android confirme que, par défaut, Auto Backup inclut la plupart des préférences, fichiers privés internes, bases de données et fichiers du stockage externe applicatif. Les sauvegardes peuvent être restaurées à l'installation de l'application, avant son premier lancement. Les répertoires cache, code cache et noBackupFilesDir sont exclus par défaut, mais cette exclusion ne couvre pas les copies manuelles ou les transferts non maîtrisés.

Pour Android 12+ ciblant API 31+, les règles dataExtractionRules séparent cloud-backup et device-transfer ; cross-platform-transfer vers iOS est disponible à partir d'Android 16 QPR2. Si une section de transfert est absente, ce mode peut rester activé par défaut. Les applications ciblant API 30 ou inférieur doivent aussi garder le jeu de règles fullBackupContent legacy. Point critique : sur certains appareils de fabricants, allowBackup=false peut désactiver la sauvegarde cloud sans empêcher le transfert direct appareil-à-appareil.

Conséquence SAC : les archives GPS, clés, parts de clés, DEK, clés dérivées et états de restauration doivent être explicitement exclus de chaque mode applicable et vérifiés dans l'APK puis sur appareils réels. Le chiffrement de la sauvegarde Android ne suffit pas à prouver une destruction J+30.

### iOS Keychain et fichiers
Apple documente que l'attribut ThisDeviceOnly empêche la migration d'un élément Keychain vers un autre appareil, mais qu'un élément peut être restauré sur le même appareil depuis une sauvegarde. ThisDeviceOnly n'est donc pas une protection contre la restauration sur le même appareil. Les secrets GPS ne doivent pas être synchronisables via iCloud Keychain ; les éléments synchronisables peuvent être répliqués et les opérations de mise à jour/suppression affectent les copies synchronisées.

Apple documente aussi l'exclusion des fichiers via isExcludedFromBackup. Certaines opérations de fichiers peuvent remettre le drapeau à false : il doit être réappliqué et vérifié après chaque écriture/remplacement/déplacement pertinent.

### Conclusion
Ces contrôles sont des prérequis de réduction de surface, non une preuve d'effacement cryptographique à J+30. Aucun test natif n'a été exécuté, car SAC ne possède pas encore d'application native et aucun appareil de test dédié n'a été autorisé. Les scénarios GPS-27 à GPS-36 ont été ajoutés au plan de validation. La conservation de l'historique GPS reste NO-GO.

Sources officielles :
- Android Auto Backup : https://developer.android.com/identity/data/autobackup
- Apple isExcludedFromBackup : https://developer.apple.com/documentation/foundation/urlresourcekey/isexcludedfrombackupkey
- Apple Keychain accessibility / ThisDeviceOnly : https://developer.apple.com/documentation/security/restricting-keychain-item-accessibility
- Apple Keychain synchronizable : https://developer.apple.com/documentation/security/ksecattrsynchronizable
