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

La documentation Android confirme que StrongBox dispose d'un minuteur sécurisé et d'une broche de notification de redémarrage (ou équivalent). Le document de compatibilité Android décrit toutefois l'horloge interne StrongBox avec une précision raisonnable de ±10 %. Cette tolérance ne permet pas de promettre une échéance civile exacte à J+30.

Plus important encore, Android précise que les autorisations temporelles de validité d'une clé ne sont généralement pas appliquées par le matériel sécurisé, car celui-ci ne dispose normalement pas d'une horloge temps réel indépendante et sécurisée. Les autorisations peuvent alors être appliquées par le système Android non sécurisé. L'API permet bien de définir une date de fin de validité, mais cette possibilité API ne prouve pas que la date sera imposée matériellement sur chaque appareil.

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
