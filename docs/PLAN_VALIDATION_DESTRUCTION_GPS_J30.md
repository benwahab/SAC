# SAC — Plan de validation de la destruction GPS à J+30

**Statut :** plan de test et analyse de faisabilité. Aucun test sur appareil n'a encore été exécuté.  
**But :** démontrer que les positions GPS précises conservées par SAC deviennent définitivement illisibles au plus tard à J+30, même si le téléphone est éteint à l'échéance, hors ligne, restauré depuis une sauvegarde ou réinstallé.

## 1. Critère de réussite non négociable

À partir de l'instant exact J+30 :
- aucune interface SAC, aucun autre appareil autorisé, aucune restauration, aucun export et aucun accès administrateur ne peut rendre la position lisible ;
- la clé permettant le déchiffrement est détruite ou rendue cryptographiquement inutilisable par un mécanisme dont l'expiration ne dépend pas d'un simple contrôle logiciel de l'heure ;
- une copie antérieure de l'application, de la base locale ou de la sauvegarde ne peut pas contourner l'expiration ;
- le système refuse par défaut si l'heure fiable, l'état de la clé ou la preuve de suppression ne peuvent pas être établis.

Le délai commence à la fin du partage ; pour une position ponctuelle, il commence à la collecte. L'heure de référence doit être authentifiée et l'échéance immuable.

## 2. Alerte de faisabilité : la suppression locale seule ne prouve pas J+30

La piste « archive locale + clé Android Keystore/iOS Keychain » améliore fortement la séparation et la non-migration des clés, mais les documentations officielles ne démontrent pas une destruction automatique à l'échéance lorsque le téléphone est éteint.

- Android indique que les contraintes temporelles des clés ne sont généralement pas appliquées par le matériel sécurisé, car celui-ci ne dispose normalement pas d'une horloge temps réel indépendante. Elles peuvent donc être appliquées dans la partie logicielle du Keystore.
- Apple documente que les éléments Keychain `ThisDeviceOnly` ne migrent pas vers un autre appareil et que certaines classes ne sont pas sauvegardées ; cela ne constitue pas une preuve d'expiration automatique à J+30.
- Si le téléphone est hors tension au moment de l'échéance, aucune application ne peut exécuter son code de purge à cet instant.
- Si l'application se fie à l'horloge système au redémarrage, le recul de l'horloge ou la restauration d'un état local antérieur doit être traité comme une tentative de contournement.

Sources officielles :
- Android Keystore : https://developer.android.com/privacy-and-security/keystore
- Android KeyMint / expiration et horloge : https://source.android.com/docs/security/features/keystore/features
- Apple Platform Security : https://support.apple.com/en-mk/guide/security/secb0694df1a/web

**Conclusion de faisabilité actuelle :** l'archive locale native reste une piste de stockage, mais elle n'est pas, à elle seule, une solution approuvée pour garantir une destruction stricte à J+30. Il faut démontrer une expiration cryptographique indépendante de l'exécution de l'application et résistante à la restauration. Si aucun mécanisme disponible ne satisfait ce test, la conservation historique GPS doit être désactivée plutôt que de promettre une garantie fausse.

## 3. Architecture à comparer au prototype local

Étudier deux modèles sans en choisir un prématurément :

### Modèle A — clé entièrement locale
- archive chiffrée sur le téléphone ;
- clé dédiée conservée dans le magasin sécurisé natif ;
- expiration et suppression locale ;
- aucune synchronisation de clé ou d'archive.

Blocage : l'expiration hors ligne et téléphone éteint n'est pas prouvée ; l'horloge et l'état logiciel peuvent être restaurés.

### Modèle B — clé de session à deux facteurs indépendants
- archive chiffrée localement ;
- une part de clé liée à l'appareil ;
- une seconde part fournie uniquement par un service externe indépendant pendant la période autorisée ;
- destruction individuelle et non restaurable de cette seconde part à J+30 ;
- le service externe ne reçoit ni coordonnées GPS en clair, ni historique, ni contenu de localisation.

Blocages : aucun fournisseur ni HSM n'est approuvé ; il faut prouver l'absence de sauvegarde/restauration de la part de clé expirée, la disponibilité du service, la gestion hors ligne et l'absence de récupération administrative. Cette option réintroduit une dépendance réseau pour consulter l'historique et doit être évaluée au regard de la fiabilité d'une application d'urgence.

Aucun des deux modèles n'est validé. Ne pas créer de ressource cloud ni de compte fournisseur pendant cette étude.

## 4. Matrice de tests obligatoires

| ID | Scénario | Résultat exigé |
|---|---|---|
| GPS-01 | Lecture avant J+30, appareil autorisé | lecture autorisée selon les droits |
| GPS-02 | Lecture à J+30 exactement | refus irréversible |
| GPS-03 | Lecture après J+30 | refus irréversible |
| GPS-04 | Téléphone éteint avant J+30, rallumé après J+30 | refus avant tout affichage ou export |
| GPS-05 | Téléphone hors ligne pendant toute la période | expiration toujours effective sans validation de l'horloge système seule |
| GPS-06 | Recul manuel de l'horloge avant/après échéance | aucun prolongement de la durée |
| GPS-07 | Avance manuelle de l'horloge | aucune purge prématurée non conforme à la politique |
| GPS-08 | Changement de fuseau et heure d'été | échéance UTC immuable |
| GPS-09 | Restauration complète d'une sauvegarde antérieure à J+30 après échéance | clé inutilisable et aucune position lisible |
| GPS-10 | Réinstallation de l'application | aucune récupération de clé/archives expirées |
| GPS-11 | Migration vers un nouveau téléphone | aucune migration de l'ancienne clé GPS |
| GPS-12 | Restauration sur le même téléphone | aucune réactivation de la clé expirée |
| GPS-13 | Restauration d'un snapshot/backup du magasin de clés, si possible | aucune récupération de la part de clé détruite |
| GPS-14 | Application forcée à l'arrêt / crash pendant la purge | l'expiration ne dépend pas du lancement réussi de l'application |
| GPS-15 | Deux appareils liés au même compte | aucun second appareil ne peut conserver une clé historique permettant de contourner J+30 |
| GPS-16 | Export, partage de fichier, cache, miniatures, rapports de crash | aucune coordonnée ou clé GPS récupérable après échéance |
| GPS-17 | Échec du service de temps ou heure non fiable | refus par défaut, pas de prolongation silencieuse |
| GPS-18 | Échec du service externe de clé (modèle B) | aucune récupération hors période ; erreur clairement signalée |

Chaque test doit être répété sur plusieurs versions Android, niveaux de sécurité matériels, appareils sans StrongBox, et versions iOS supportées. Les résultats doivent identifier le modèle, la version OS, le niveau matériel attesté, la configuration de sauvegarde et les étapes exactes de restauration.

## 5. Tests d'absence de fuite côté serveur

Créer des tests automatiques et des contrôles de configuration démontrant qu'aucun payload GPS précis ne peut être écrit dans :
- D1, R2, KV ou stockage Durable Objects ;
- files d'attente, tâches planifiées, outbox et tentatives de notification ;
- logs applicatifs, logs de plateforme, traces, analytics, crash reports et outils de support ;
- exports, sauvegardes, snapshots ou environnements Preview.

Les notifications push ne contiennent qu'une invitation neutre à ouvrir SAC. Le serveur ne déchiffre jamais les coordonnées. Les paquets de relais sont éphémères et leur durée de vie maximale doit être définie, testée et observée.

## 6. Preuves et livrables attendus

Pour chaque test :
- protocole reproductible ;
- appareil et version OS ;
- preuve de l'heure de référence et de l'échéance ;
- captures/logs expurgés ne contenant aucune coordonnée ;
- état de la clé avant et après ;
- preuve de l'échec de déchiffrement après J+30 ;
- test de restauration et comparaison des empreintes des artefacts ;
- résultat PASS / FAIL / NON TESTABLE ;
- limites et hypothèses restantes.

Une simple disparition de l'écran, une suppression de fichier ou un refus de l'interface ne vaut pas preuve cryptographique.

## 7. Règle de décision

- **GO** uniquement selon le critère renforcé de la section 10 : tous les scénarios critiques disponibles doivent être PASS sur chaque plateforme/configuration supportée, y compris les scénarios de restauration mobile GPS-27 à GPS-36, avec revue indépendante. Un scénario critique NON TESTABLE maintient le NO-GO.
- **NO-GO** si la garantie dépend du lancement de l'application, d'une horloge modifiable, d'une purge différée ou d'un administrateur qui promet de ne pas restaurer.
- **NO-GO PWA pour l'archive historique GPS** tant que la PWA ne peut pas démontrer les mêmes garanties ; le relais éphémère chiffré peut être évalué séparément.
- En cas de NO-GO, ne pas conserver d'historique GPS précis au-delà de la session de partage. Ne jamais afficher « supprimé définitivement » sans preuve.

## 8. État

- [x] Exigence J+30 et scénarios de restauration explicités.
- [x] Limite de l'expiration Android fondée sur la documentation officielle.
- [x] Différence entre non-migration iOS et destruction temporelle explicitée.
- [ ] Prototype natif Android.
- [ ] Prototype natif iOS.
- [ ] Tests appareils réels et restaurations.
- [ ] Évaluation d'un service externe de part de clé non restaurable.
- [ ] Revue cryptographique indépendante.
- [ ] Décision GO/NO-GO documentée avant toute connexion GPS réelle.


## 9. Modèle de menace et limites de la promesse J+30

La phrase « aucune restauration ne peut rendre les données lisibles » doit être interprétée avec un modèle de menace explicite. Sans cela, un test peut réussir sur un téléphone standard tout en laissant des chemins de récupération non testés.

### 9.1 Capacités adverses à couvrir

Les essais doivent considérer, au minimum :
- restauration Android Auto Backup / transfert d'appareil et restauration iCloud/Finder lorsque l'application ou sa configuration y est éligible ;
- copie de fichiers applicatifs, snapshots système accessibles, restauration d'une image locale et retour à une version antérieure de l'application ;
- réinstallation, effacement/réinitialisation de l'appareil, migration et réassociation d'un second appareil ;
- cache applicatif, base locale, fichiers temporaires, miniatures, index de recherche, presse-papiers et exports déclenchés par l'application ;
- crash reports, diagnostics, journaux, traces, sauvegardes de support et captures d'écran de diagnostic ;
- clés enveloppées, copies de DEK, clés de session, secrets de récupération, sauvegardes de HSM/KMS, réplication HA/DR et procédures de restauration administrateur ;
- restauration d'un ancien état serveur, d'un ancien état du service de clés ou d'un ancien état de l'appareil ;
- comptes de support et d'administration, y compris accès d'urgence (« break glass »), exports et opérations de récupération.

Pour chaque chemin, préciser s'il est techniquement impossible, désactivé par configuration, exclu par hypothèse ou simplement non testé. « Nous faisons confiance à l'administrateur » n'est pas une preuve cryptographique d'irréversibilité.

### 9.2 Limite fondamentale : compromission pendant la période autorisée

Tant que l'utilisateur ou l'application est autorisé à afficher une position avant J+30, un appareil totalement compromis au niveau du système d'exploitation peut potentiellement capturer l'écran, la mémoire du processus ou les données après déchiffrement. Aucun chiffrement au repos ne peut garantir qu'un contenu déjà rendu lisible ne sera jamais copié par un adversaire qui contrôle entièrement l'appareil au moment où l'accès est légitime.

La garantie J+30 doit donc distinguer :
- **garantie visée :** aucune archive, sauvegarde, clé ou restauration contrôlée par SAC ne permet de relire les données après l'échéance ;
- **limite à déclarer :** SAC ne peut pas effacer rétroactivement une copie plaintext déjà exfiltrée par un appareil entièrement compromis ou par un destinataire autorisé avant l'échéance.

Cette limite ne réduit pas l'obligation de minimiser les données et de sécuriser l'appareil ; elle empêche seulement de promettre une propriété techniquement impossible. Elle doit figurer dans l'analyse de risque et les informations produit.

### 9.3 Preuves de suppression du côté fournisseur

Pour tout fournisseur KMS/HSM éventuel, demander une réponse écrite couvrant précisément :
1. le sort de toutes les copies de clé, versions précédentes, réplicas, sauvegardes HA/DR et sauvegardes hors ligne ;
2. la possibilité et la durée d'une annulation de suppression, restauration ou récupération par un administrateur ;
3. les caches de clés de données et les durées de vie maximales des clés dérivées/session ;
4. les journaux et exports contenant du matériau de clé ou des métadonnées permettant une récupération ;
5. la preuve d'achèvement de destruction, son horodatage, son périmètre et les limites contractuelles ;
6. le comportement en cas de panne, région indisponible, compte suspendu ou procédure de récupération d'urgence.

Une réponse commerciale indiquant « HSM certifié », « clé supprimée » ou « zeroization » sans détailler ces chemins ne constitue pas une preuve suffisante.

### 9.4 Compléments à la matrice de test

Ajouter aux scénarios GPS-01 à GPS-18 les cas suivants :

| ID | Scénario complémentaire | Résultat exigé |
|---|---|---|
| GPS-19 | Restauration Auto Backup Android / sauvegarde iOS éligible | aucune clé ou archive expirée ne redevient lisible |
| GPS-20 | Retour à une ancienne version de l'application et de ses données | aucune prolongation ni réactivation de l'accès |
| GPS-21 | Copie de fichiers applicatifs et restauration sur un appareil de test | aucune récupération après J+30 |
| GPS-22 | Cache, miniatures, index, presse-papiers et fichiers temporaires | aucune coordonnée ou copie déchiffrée conservée après l'échéance |
| GPS-23 | Restauration d'une sauvegarde HSM/KMS, réplica HA/DR ou export administrateur | aucune part de clé expirée ne peut être réactivée |
| GPS-24 | Compte administrateur / procédure break-glass après J+30 | aucune capacité de récupération de la clé expirée |
| GPS-25 | Clés dérivées, copies de DEK et clés de session encore en mémoire/cache | aucune voie de déchiffrement après l'échéance ; sinon NO-GO |
| GPS-26 | Compromission complète de l'appareil pendant la période autorisée | documenter explicitement la limite ; ne pas prétendre effacer une copie plaintext déjà exfiltrée |

Les scénarios GPS-19 à GPS-26 doivent recevoir un résultat PASS / FAIL / NON TESTABLE et être inclus dans le rapport de revue indépendante. Aucun test destructif ne doit être exécuté sur un appareil personnel ou une ressource de production.

## 10. Critère GO renforcé

La décision GO exige désormais :
- PASS des scénarios GPS-02 à GPS-25 et GPS-27 à GPS-36 sur chaque plateforme et configuration effectivement supportées ;
- GPS-26 documenté comme limite de menace, avec mesures de réduction et information produit ;
- preuve fournisseur sur toutes les copies et voies de restauration si un KMS/HSM est utilisé ;
- revue cryptographique indépendante ;
- absence de données GPS précises dans D1, stockage objet, files, logs, analytics, sauvegardes et exports serveur ;
- décision explicite sur la disponibilité hors ligne, qui ne peut être annoncée sans preuve propre à chaque classe d'appareil.

Tout cas NON TESTABLE sur une voie de récupération critique maintient le statut NO-GO pour l'historique GPS.

## 11. Revue ciblée des sauvegardes natives — Android et iOS

**Sources officielles consultées le 18 novembre 2026.** Cette section définit des exigences pour un futur client natif ; elle ne signifie pas que SAC dispose déjà d'une application Android/iOS native ni que ces contrôles sont implémentés.

### 11.1 Android — Auto Backup et transfert appareil-à-appareil

La documentation Android indique que la sauvegarde Auto Backup inclut par défaut la plupart des données privées de l'application : préférences, fichiers internes, bases locales et fichiers externes applicatifs. Les répertoires cache, code cache et noBackupFilesDir() sont exclus par défaut, mais cela ne suffit pas à définir toute la politique de sauvegarde.

Points de contrôle obligatoires :
- Définir explicitement android:allowBackup dans le manifeste ; ne pas s'appuyer sur sa valeur par défaut.
- Pour les versions et configurations ciblées Android 12+ (API 31+), définir android:dataExtractionRules avec des exclusions explicites des données GPS, archives chiffrées, DEK, parts de clé et états de restauration dans chaque mode : cloud-backup, device-transfer et, lorsque disponible, cross-platform-transfer.
- Pour Android 11 et inférieur, maintenir également les règles android:fullBackupContent correspondantes. La documentation exige un jeu de règles distinct pour ces anciennes versions.
- Ne pas supposer que android:allowBackup="false" bloque tous les transferts : sur certains appareils de fabricants, Android 12+ peut encore permettre le transfert appareil-à-appareil même lorsque les sauvegardes cloud sont désactivées.
- Si une règle de mode de transfert est absente, Android peut considérer ce mode activé pour toutes les données sauf les répertoires explicitement exclus par défaut. Il faut donc tester les trois modes et les règles effectivement embarquées dans l'APK.
- noBackupFilesDir() est une mesure complémentaire utile pour les secrets et artefacts non sauvegardables, pas une preuve contre une copie manuelle, une extraction privilégiée ou un appareil compromis.
- Le chiffrement de la sauvegarde par Android ne résout pas le problème J+30 : une sauvegarde chiffrée peut rester restaurable dans son cycle de vie normal.

### 11.2 iOS — fichiers et éléments Keychain

Points de contrôle obligatoires :
- Les fichiers contenant une archive GPS ou un artefact cryptographique doivent être exclus des sauvegardes par le mécanisme documenté isExcludedFromBackup / NSURLIsExcludedFromBackupKey.
- Cette exclusion doit être appliquée à chaque création ou réécriture du fichier : Apple précise que certaines opérations courantes de fichiers peuvent remettre le drapeau à false.
- Un élément Keychain marqué ThisDeviceOnly n'est pas migré vers un autre appareil lors d'une restauration sur nouvel appareil ; cependant, la documentation précise qu'il peut être restauré sur le même appareil depuis une sauvegarde. Ce qualificatif ne suffit donc pas à prouver l'impossibilité de restauration sur le même appareil.
- Les secrets de clé SAC ne doivent pas être synchronisables via iCloud Keychain. Apple documente que les éléments synchronisables peuvent être répliqués entre appareils et que les modifications/suppressions s'appliquent aux copies synchronisées ; cela crée une surface de réplication à exclure de la conception J+30.
- Les attributs d'accessibilité Keychain et ThisDeviceOnly répondent à des questions d'accès et de migration ; ils ne constituent pas une minuterie de destruction à J+30.

### 11.3 Politique native provisoire à faire implémenter et vérifier

Pour toute future archive GPS locale :
1. Ne jamais inclure archive, clé, part de clé, DEK, clé dérivée, cache de déchiffrement ou état de restauration dans une sauvegarde ou un transfert d'appareil.
2. Désactiver les mécanismes de synchronisation inter-appareils pour tous les secrets GPS.
3. Traiter chaque restauration ou réinstallation comme une nouvelle installation : aucune archive GPS antérieure ne doit être importée ni réactivée.
4. Vérifier les exclusions dans les artefacts compilés et sur les versions réelles d'OS ; la seule présence d'un fichier de règles dans le dépôt n'est pas une preuve.
5. Si une copie GPS ou un secret réapparaît après restauration, le test est FAIL et l'historique GPS reste NO-GO.

### 11.4 Scénarios de validation ajoutés

| ID | Scénario | Résultat exigé |
|---|---|---|
| GPS-27 | Android 12+ : restauration cloud avec règles effectives | aucune archive GPS ni clé réimportée |
| GPS-28 | Android 12+ : transfert direct appareil-à-appareil OEM | aucune archive GPS ni clé transférée |
| GPS-29 | Android : appareil cible API 30 ou inférieur / règles legacy | aucune archive GPS ni clé restaurée |
| GPS-30 | Android 12+ : allowBackup=false sur plusieurs OEM | vérifier qu'aucun transfert D2D ne réintroduit les données |
| GPS-31 | Android 16 QPR2+ : transfert inter-plateforme vers iOS | aucune archive GPS ni clé transférée |
| GPS-32 | iOS : restauration d'une sauvegarde sur le même appareil avec Keychain ThisDeviceOnly | aucune clé/part GPS expirée ne redevient utilisable |
| GPS-33 | iOS : migration/restauration vers un nouvel appareil | aucune clé/part GPS n'est migrée |
| GPS-34 | iOS : vérification des éléments Keychain non synchronisables | aucun secret GPS répliqué via iCloud Keychain |
| GPS-35 | iOS : réécriture, remplacement ou déplacement d'un fichier exclu | l'exclusion de sauvegarde est réappliquée et vérifiée |
| GPS-36 | Inspection des APK/IPA et tests de sauvegarde/restauration réels | règles présentes, effectives et aucun artefact GPS restauré |

Aucun test GPS-27 à GPS-36 n'est déclaré exécuté. Le statut reste NON TESTÉ tant que les applications natives et les appareils de test ne sont pas disponibles.

Références officielles :
- Android Developers — Auto Backup, répertoires inclus par défaut, restauration, allowBackup, règles Android 11 et Android 12+, modes cloud/D2D/cross-platform : https://developer.android.com/identity/data/autobackup
- Apple Developer — isExcludedFromBackup et nécessité de réappliquer l'attribut après certaines opérations : https://developer.apple.com/documentation/foundation/urlresourcekey/isexcludedfrombackupkey
- Apple Developer — accessibilité Keychain et ThisDeviceOnly : https://developer.apple.com/documentation/security/restricting-keychain-item-accessibility
- Apple Developer — synchronisation Keychain et copies synchronisées : https://developer.apple.com/documentation/security/ksecattrsynchronizable
