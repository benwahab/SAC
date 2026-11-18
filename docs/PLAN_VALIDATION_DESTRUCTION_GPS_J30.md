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

- **GO** uniquement si les tests GPS-02 à GPS-18 sont PASS sur chaque plateforme supportée et si une revue indépendante confirme que la restauration ne peut pas récupérer la clé.
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
