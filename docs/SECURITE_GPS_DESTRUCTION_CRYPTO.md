# SAC — Étude de conception : destruction cryptographique des positions GPS

**Statut : étude technique, aucun fournisseur ni mécanisme de production validé.**  
**Objectif impératif :** à l'expiration des 30 jours suivant la fin du partage (ou la collecte pour une position ponctuelle), aucune restauration de D1, d'un export, d'une sauvegarde ou du service de clés ne doit pouvoir rendre les coordonnées GPS lisibles.

## 1. Conclusion provisoire

La solution ne doit pas reposer sur la suppression des lignes GPS dans D1, ni sur une clé stockée dans un autre stockage Cloudflare qui possède lui-même une restauration temporelle.

La piste à approfondir est un **chiffrement enveloppe** :
1. Chaque groupe de positions ayant la même échéance reçoit une clé de données aléatoire (DEK).
2. Les coordonnées sont chiffrées côté serveur avant toute écriture dans D1 ou R2.
3. La DEK est chiffrée (enveloppée) par une clé de chiffrement gérée par un KMS indépendant de D1.
4. Seul le texte chiffré de la DEK, jamais la DEK en clair, peut être conservé avec les données SAC.
5. À l'échéance, le KMS doit rendre la clé d'enveloppement définitivement inutilisable et non restaurable par le client. Les anciennes copies de D1 ne contiennent alors que du texte chiffré inutilisable.

Le regroupement par date d'expiration peut réduire le nombre de clés, mais il faut impérativement détruire une clé seulement lorsque toutes les positions qu'elle protège ont atteint leur échéance. Une clé par partage offre une séparation plus fine, au prix d'un volume et d'un coût KMS potentiellement supérieurs.

## 2. Solutions examinées

### 2.1 Cloudflare D1 — non adapté comme coffre de clés

D1 Time Travel peut restaurer un état antérieur de la base jusqu'à 30 jours (selon l'offre, 7 jours sur Free). Une restauration peut donc réintroduire les anciennes lignes supprimées. D1 ne doit contenir ni clé de déchiffrement ni coordonnées en clair.

Source : [Cloudflare — D1 Time Travel et sauvegardes](https://developers.cloudflare.com/d1/reference/time-travel/).

### 2.2 Cloudflare Durable Objects — écarté comme coffre indépendant

Les Durable Objects SQLite disposent eux aussi d'une API de restauration temporelle pouvant restaurer le contenu de leur base embarquée sur les 30 derniers jours. Un Durable Object qui conserverait les clés pourrait donc restaurer une ancienne copie de ces clés. Le fait que son stockage soit privé, transactionnel et fortement cohérent ne supprime pas ce risque de restauration.

Source : [Cloudflare — Accéder au stockage des Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/).

### 2.3 Google Cloud KMS — candidat à approfondir, pas encore validé

La documentation officielle indique :
- une version de clé programmée pour destruction ne peut plus être utilisée pour les opérations cryptographiques ;
- pendant la période de destruction programmée, elle peut encore être restaurée ;
- la durée par défaut est de 30 jours et peut être configurée dès la création, avec un minimum de 24 heures ;
- une fois l'état `DESTROYED` atteint, le matériel de clé n'est plus disponible pour les opérations cryptographiques ;
- les clés importées constituent une exception importante : leur matériel pourrait être réimporté si une copie externe existe ;
- Google annonce une suppression du matériel de clé de son infrastructure dans les 45 jours suivant la programmation ; les copies de sauvegarde restantes sont décrites comme utilisables pour la reprise régionale, et non pour restaurer individuellement une clé.

Conséquence : Google Cloud KMS est une piste sérieuse pour un test de preuve de destruction, mais la période réversible de destruction programmée et le délai de suppression des copies internes doivent être pris en compte. Il est interdit de considérer la programmation de destruction comme une destruction déjà irréversible. Les clés importées sont exclues de la conception.

Sources :
- [Google Cloud KMS — Détruire et restaurer des versions de clés](https://docs.cloud.google.com/kms/docs/destroy-restore)
- [Google Cloud KMS — États des versions de clés](https://docs.cloud.google.com/kms/docs/key-states)
- [Google Cloud KMS — Bonnes pratiques de gestion des clés](https://docs.cloud.google.com/kms/docs/cmek-recommended-practices)

### 2.4 AWS KMS — candidat secondaire, contrainte de délai

AWS KMS impose une période d'attente de 7 à 30 jours. Pendant cette période, la clé est désactivée et ne peut plus être utilisée, mais la suppression peut être annulée. La suppression effective intervient à la fin de la période.

Conséquence : une programmation à J+30 ne suffit pas pour garantir la destruction irréversible à J+30. Il faudrait démontrer par test qu'une programmation anticipée atteint l'état supprimé au plus tard à l'échéance, sans permettre de restauration après celle-ci. Aucun engagement n'est pris sur AWS à ce stade.

Sources :
- [AWS KMS — Suppression des clés](https://docs.aws.amazon.com/kms/latest/developerguide/deleting-keys.html)
- [AWS KMS — Détails de la suppression des clés](https://docs.aws.amazon.com/kms/latest/cryptographic-details/key-deletion.html)

## 3. Contrat technique cible, indépendant du fournisseur

L'application ne doit pas appeler directement un SDK KMS depuis les écrans ou les règles métier. Une interface serveur isolée devra exposer au minimum les opérations suivantes :

- créer ou obtenir une clé liée à une échéance GPS précise ;
- chiffrer/envelopper une DEK et vérifier son identifiant de version ;
- déchiffrer/désenvelopper uniquement si l'échéance n'est pas dépassée et si les autorisations SAC sont valides ;
- désactiver l'utilisation d'une clé à l'échéance ;
- demander sa destruction irréversible selon le cycle du fournisseur ;
- vérifier l'état final de destruction et conserver une preuve technique sans secret ni coordonnées.

Le contrôle de l'échéance doit être appliqué côté serveur avant chaque tentative de déchiffrement. Une panne, un timeout, une indisponibilité du KMS ou un état de clé inconnu doit provoquer un refus de lecture GPS (échec fermé), jamais un recours à une copie locale ou à une clé de secours restaurable.

## 4. Conditions obligatoires avant de choisir un KMS

Aucun fournisseur ne sera retenu avant d'avoir prouvé les points suivants :

1. Les clés sont créées et conservées hors de D1, R2 et Durable Objects.
2. Les clés sont générées par le KMS ou son HSM ; aucun matériel importé ni copie externe réutilisable.
3. Une restauration D1 antérieure à J+30 ne permet pas de déchiffrer les coordonnées après échéance.
4. Une restauration ou récupération administrative du service de clés ne permet pas de réactiver une clé arrivée à échéance.
5. La période réversible éventuelle de destruction est entièrement terminée au plus tard à J+30, ou le fournisseur garantit une révocation immédiate, définitive et non restaurable à l'échéance.
6. Les sauvegardes internes du KMS ne peuvent pas être utilisées par le client pour restaurer individuellement une clé détruite.
7. Les droits IAM séparent l'exploitation normale, la lecture GPS, l'administration des clés et la destruction ; aucune personne ou fonction applicative ne doit pouvoir annuler discrètement une destruction échue.
8. Les opérations de création, désactivation, destruction et échec sont auditées sans enregistrer les clés ni les coordonnées.
9. Les quotas, coûts, latences, limites de débit et procédures de reprise sont compatibles avec le volume réel de SAC.
10. Des tests adverses automatisés démontrent la non-récupérabilité à J+30, y compris avec une copie de D1 prise avant la purge.

## 5. Scénarios de test obligatoires

- Chiffrer une position, sauvegarder/restaurer D1 avant J+30, puis vérifier qu'après échéance le KMS refuse définitivement le déchiffrement.
- Restaurer une sauvegarde contenant une ancienne DEK enveloppée : la DEK doit rester inutilisable après destruction de la clé KMS.
- Tenter un déchiffrement juste avant, à l'instant de l'échéance et juste après.
- Tenter une restauration administrative ou une annulation de destruction après l'échéance.
- Simuler une panne KMS : aucune position ne doit être fournie depuis un cache ou une sauvegarde.
- Vérifier les groupes de positions ayant des échéances différentes afin qu'une clé ne soit jamais détruite trop tôt ni conservée au-delà de la dernière échéance.
- Vérifier que les journaux, traces, erreurs, analytics, exports et fichiers temporaires ne contiennent aucune coordonnée en clair.
- Vérifier que la purge des lignes et des ciphertexts reste exécutée, même si la destruction cryptographique rend déjà les données illisibles.

## 6. Interdictions maintenues

Tant que tous les critères ci-dessus ne sont pas démontrés :
- aucune migration GPS ;
- aucun stockage de coordonnées GPS en clair dans D1 ou R2 ;
- aucune clé GPS dans D1, R2, KV, Durable Objects ou dans le dépôt ;
- aucun export ou backup externe contenant des coordonnées en clair ;
- aucune déclaration selon laquelle la destruction J+30 est déjà implémentée.

**Décision en attente :** choix d'un fournisseur KMS et validation du calendrier de destruction permettant de respecter exactement la règle J+30. Cette étude ne sélectionne pas un fournisseur à la place de l'utilisateur.


## 7. Résultats complémentaires — critères stricts J+30

Les vérifications documentaires complémentaires conduisent à ne retenir aucun des candidats évalués pour une garantie stricte « irréversible au plus tard à J+30 » dans leur configuration standard.

### Google Cloud KMS : non retenu pour le délai strict actuel

La durée minimale de l'état réversible `DESTROY_SCHEDULED` est de 24 heures. Pendant cet état, la clé ne peut plus effectuer d'opérations cryptographiques, mais un administrateur autorisé peut encore restaurer la version. Une fois l'état `DESTROYED` atteint, la clé ne peut plus être restaurée par le client ; toutefois Google indique que le matériel peut rester dans ses systèmes jusqu'à 45 jours après la programmation de destruction. Ce fournisseur n'est donc pas accepté comme preuve suffisante de l'effacement physique de toutes copies au jour J+30. Il pourrait être réévalué uniquement si l'exigence est définie comme non-récupérabilité par les interfaces client après état DESTROYED, et si cette interprétation est explicitement acceptée. Cette exception n'est pas validée.

Sources officielles : [destruction/restauration Cloud KMS](https://docs.cloud.google.com/kms/docs/destroy-restore), [états des versions](https://docs.cloud.google.com/kms/docs/key-states).

### AWS KMS : non retenu pour le délai strict actuel

La suppression impose une attente de 7 à 30 jours, annulable avant son terme, et la date réelle peut être jusqu'à 24 heures plus tard que la durée configurée. Une programmation à l'échéance ne garantit donc pas la suppression irréversible à l'instant J+30 ; programmer avant l'échéance rendrait la clé inutilisable avant la fin de la période d'accès attendue.

Source officielle : [suppression des clés AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/deleting-keys.html).

### AWS CloudHSM : non retenu comme solution simple

AWS CloudHSM effectue des sauvegardes périodiques au moins toutes les 24 heures, contenant le matériel des clés. La documentation AWS précise qu'il faut supprimer les clés du HSM puis supprimer toutes les sauvegardes existantes pour éviter de restaurer les clés supprimées. Or une sauvegarde marquée pour suppression reste restaurable pendant sept jours ; la politique de rétention ne supprime pas la dernière sauvegarde du cluster. Cette piste ne fournit donc pas, sans mécanisme supplémentaire démontré, une destruction irréversible à J+30.

Sources officielles : [sauvegardes CloudHSM](https://docs.aws.amazon.com/cloudhsm/latest/userguide/manage-backups.html), [suppression des sauvegardes](https://docs.aws.amazon.com/cloudhsm/latest/userguide/delete-restore-backup.html), [rétention des sauvegardes](https://docs.aws.amazon.com/cloudhsm/latest/userguide/manage-backup-retention.html).

### Cloudflare Secrets et versions : pas un coffre de clés GPS démontré

Les secrets Cloudflare sont des valeurs de configuration de Workers et leur suppression crée une nouvelle version ; les Workers permettent par ailleurs de revenir à d'anciennes versions. La documentation consultée ne démontre pas que cette combinaison constitue un mécanisme de destruction cryptographique individuel, horodaté et non restaurable. Les secrets de déploiement ne seront donc pas utilisés comme coffre de clés GPS.

Sources officielles : [Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [Versions et déploiements](https://developers.cloudflare.com/workers/versions-and-deployments/), [Rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).

## 8. Décision technique actuelle

**Aucun fournisseur n'est validé.** Il serait trompeur de présenter Google KMS, AWS KMS, CloudHSM, Cloudflare KV, Durable Objects ou les secrets Workers comme garantissant actuellement la destruction irréversible demandée au jour J+30.

Le prochain travail est une étude ciblée de gestion de clés avec effacement immédiat/non restaurable ou d'un service externe de gestion de clés dont le contrat, les sauvegardes, les administrateurs et les procédures de reprise démontrent cette propriété. Il faudra également décider si « aucune restauration » signifie : (a) aucune lecture possible par l'application après J+30, même si des copies chiffrées existent ; ou (b) aucune possibilité de rétablir le matériel de clé par quelque sauvegarde, compte administrateur ou mécanisme fournisseur que ce soit. SAC vise le niveau (b) tant que l'utilisateur n'a pas explicitement accepté une définition plus limitée.

En attendant, l'accès GPS doit être bloqué à l'expiration côté serveur, même si la destruction physique/cryptographique complète reste à démontrer. Ce verrou d'accès n'est pas présenté comme équivalent à l'effacement irréversible.


## 9. Évaluation complémentaire — Fortanix DSM, HashiCorp Vault et AWS External Key Store

Cette section complète l'étude documentaire. Elle ne constitue ni un test réel de service, ni une validation contractuelle, ni une autorisation de créer un compte ou une ressource.

### 9.1 Fortanix DSM — non validé contre la restauration d'un état antérieur

Fortanix DSM propose une destruction directe lorsque la Key Undo Policy n'est pas activée. Mais si cette politique est activée, la destruction reste annulable pendant la période configurée (de 7 à 180 jours). Plus important pour SAC, sa documentation de reprise après sinistre décrit la restauration du cluster depuis une sauvegarde Cassandra antérieure. Cette restauration ramène le cluster à l'état de cette sauvegarde ; elle peut donc réintroduire des objets/états qui existaient avant la destruction.

La documentation ne fournit pas une preuve suffisante qu'une clé détruite à J+30 est exclue de toutes les sauvegardes antérieures et ne peut jamais être réintroduite par restauration complète. Fortanix DSM est donc **non retenu à ce stade** pour la garantie stricte SAC, même si la destruction de clé individuelle est proposée.

Sources officielles :
- [Fortanix DSM — Key Undo Policy](https://support.fortanix.com/docs/fortanix-dsm-key-undo-policy)
- [Fortanix DSM — Backup and Restore](https://support.fortanix.com/docs/introduction-to-fortanix-dsm-backup-and-restore)
- [Fortanix DSM — Key Lifecycle Management](https://support.fortanix.com/docs/fortanix-data-security-manager-key-lifecycle-management)

### 9.2 HashiCorp Vault Transit — non validé contre sauvegardes et snapshots

Vault Transit fournit une opération de suppression d'une clé nommée, mais sa documentation expose aussi une opération de sauvegarde/restauration de clé Transit. En outre, le stockage Raft de Vault permet de prendre et restaurer un snapshot qui réinstalle l'état du cluster défini par ce snapshot.

Par conséquent, supprimer une clé Transit dans l'état courant ne prouve pas qu'une sauvegarde antérieure contenant cette clé a été détruite, ni qu'un administrateur ne peut restaurer un snapshot antérieur. Vault ne sera pas retenu comme coffre GPS SAC sans une architecture externe et des preuves qui neutralisent ces chemins de restauration, ce qui n'est pas démontré ici.

Sources officielles :
- [HashiCorp Vault — Transit API](https://docs.hashicorp.com/vault/api-docs/secret/transit)
- [HashiCorp Vault — Raft snapshot and restore](https://docs.hashicorp.com/vault/api-docs/system/storage/raft)

### 9.3 AWS External Key Store (XKS) — piste conditionnelle, non validée

AWS indique qu'avec un External Key Store, les opérations cryptographiques sont exécutées par le gestionnaire de clés externe et que le matériel de clé ne quitte pas ce gestionnaire. AWS précise également que si la clé externe est perdue ou supprimée, le ciphertext associé devient irrécupérable.

Cette séparation est intéressante : SAC pourrait conserver uniquement des DEK enveloppées par une clé externe, tandis que le service externe contrôlerait le matériel qui permet de les désenvelopper. Toutefois, AWS KMS ne crée, ne supprime ni ne gère les clés externes. La garantie dépend donc entièrement du fournisseur XKS choisi, de ses sauvegardes, snapshots, mécanismes de réplication, comptes administrateurs et procédures de reprise.

Aucune preuve consultée ne permet d'affirmer qu'un fournisseur XKS précis garantit l'absence de toute restauration de la clé externe à J+30. XKS est donc une **piste de recherche prioritaire, pas un choix validé**. Il faudra auditer séparément le gestionnaire externe et obtenir des preuves écrites sur la destruction de toutes les copies réutilisables.

Source officielle :
- [AWS KMS — External key stores](https://docs.aws.amazon.com/kms/latest/developerguide/keystore-external.html)

### 9.4 Conclusion de cette passe

Les trois pistes supplémentaires ne valident pas encore l'exigence stricte :
- Fortanix DSM : chemin de restauration de cluster documenté ;
- HashiCorp Vault : sauvegarde/restauration de clés et snapshots Raft documentés ;
- AWS XKS : séparation de la clé externe intéressante, mais garanties de destruction et de non-restauration laissées au gestionnaire externe.

Le prochain travail doit porter sur des gestionnaires externes XKS précis et sur la preuve de leur politique de sauvegarde/destruction. Le critère reste inchangé : aucune sauvegarde, réplication, restauration administrateur ou copie fournisseur ne doit pouvoir rendre la clé expirée à nouveau utilisable. Tant que cette preuve n'est pas disponible, aucune migration GPS ni intégration de clés n'est autorisée.


## 10. Évaluation ciblée des implémentations AWS XKS : Entrust nShield et Thales CipherTrust

### 10.1 AWS XKS : avantages et contraintes propres à l'architecture

AWS confirme que la clé externe reste dans le gestionnaire externe et qu'une clé externe perdue ou supprimée rend le ciphertext associé irrécupérable. AWS KMS ne crée, ne supprime ni ne gère cette clé externe. Cette propriété peut fournir une séparation utile entre les sauvegardes SAC et le matériel de clé.

Cependant, AWS indique aussi que :
- le gestionnaire externe doit être accessible par un proxy XKS exploité par le client ou un tiers ;
- la disponibilité, la durabilité, la capacité et les performances du gestionnaire/proxy relèvent de cette infrastructure externe ;
- AWS recommande au moins deux instances liées du gestionnaire partageant les mêmes clés pour la redondance ;
- la latence et le débit XKS sont moins favorables que les autres types de magasins de clés AWS ; AWS ne recommande pas XKS pour les charges à haut débit et indique l'absence de couverture SLA AWS pour le chemin externe.

Pour SAC, cela crée un compromis réel : la redondance qui améliore la disponibilité multiplie les copies ou les chemins d'accès au matériel de clé qu'il faudra tous neutraliser à l'échéance. Une seule instance sans redondance ne serait pas acceptable pour un service d'urgence sans étude de disponibilité. XKS ne doit donc pas être adopté sur la seule base de sa propriété de double chiffrement.

Sources officielles :
- [AWS — External key stores](https://docs.aws.amazon.com/kms/latest/developerguide/keystore-external.html)
- [AWS — Key store overview et limites de disponibilité/performance](https://docs.aws.amazon.com/kms/latest/developerguide/key-store-overview.html)
- [AWS — Création d'un XKS et exigences de redondance](https://docs.aws.amazon.com/kms/latest/developerguide/create-xks-keystore.html)

### 10.2 Entrust nShield — destruction possible, mais portée et copies à maîtriser

La documentation nShield indique qu'écarter (« discard ») une clé supprime ses informations du disque hôte, mais qu'une sauvegarde de l'environnement Security World peut restaurer cette clé. Elle précise que la destruction permanente nécessite de détruire l'Operator Card Set (OCS) qui protège la clé ou de supprimer le Security World entier.

La documentation avertit aussi qu'une sauvegarde hebdomadaire du Security World, combinée aux cartes opérateur appropriées et à un HSM, peut permettre de retrouver les anciennes clés. Supprimer les fichiers sur un seul serveur ne supprime pas les copies des autres machines, du Remote File System ou des supports de sauvegarde.

**Conclusion SAC :** nShield démontre un mécanisme de destruction cryptographique matériel, mais pas encore un service de destruction indépendante par position GPS avec toutes les copies de secours neutralisées. Une conception avec un OCS distinct par clé pourrait être étudiée sur le papier, mais sa faisabilité opérationnelle, la gestion physique des cartes, la redondance XKS et la destruction vérifiable de chaque copie ne sont pas démontrées. Détruire un Security World partagé détruirait potentiellement les clés d'autres utilisateurs : cette approche globale est rejetée pour la granularité attendue par SAC.

Sources officielles :
- [Entrust nShield — Discarding and restoring keys](https://nshielddocs.entrust.com/security-world-docs/v13.6.15/key-mgmt/working-with-keys.html)
- [Entrust nShield — Deleting a Security World](https://nshielddocs.entrust.com/security-world-docs/v13.9.0/secworld-admin/delete-secworld.html)
- [Entrust nShield — Key backup](https://nshielddocs.entrust.com/security-world-docs/v13.3/security-manual/key-management.html)

### 10.3 Thales CipherTrust Manager / CCKM — non validé pour l'effacement individuel à J+30

La documentation CipherTrust indique que les sauvegardes système sont des instantanés de la base de l'appliance et peuvent être restaurées sur une appliance identique ou une autre appliance. Ces sauvegardes contiennent notamment les clés, leurs attributs et leurs liens. Les sauvegardes sont chiffrées par une clé de sauvegarde nécessaire à leur restauration.

Thales décrit aussi une possibilité de lier une sauvegarde à une clé HSM Root of Trust : sans le même RoT actif, la sauvegarde liée ne peut pas être restaurée. La documentation avertit toutefois que les copies des fichiers de sauvegarde peuvent être stockées ailleurs et que la perte ou suppression du RoT entraîne une perte de restauration. Cette propriété concerne la restauration de sauvegarde et ne démontre pas, à elle seule, la destruction sélective et non restaurable d'une clé GPS au sein d'un environnement partagé.

La documentation CCKM XKS confirme que les clés HYOK peuvent pointer vers des matériaux source stockés dans Luna Network HSM ou CipherTrust Manager. Il faut donc examiner séparément les sauvegardes du gestionnaire source et les clés de sauvegarde.

**Conclusion SAC :** non retenu pour l'instant. La restauration d'un instantané contenant les clés, même si le fichier est chiffré, est incompatible avec notre preuve stricte tant que le contrôle de restauration et la destruction de toutes les copies ne sont pas démontrés au niveau d'une clé individuelle.

Sources officielles :
- [Thales CipherTrust Manager — Backups](https://www.thalesdocs.com/ctp/cm/2.18/admin/cm_admin/backups/index.html)
- [Thales CipherTrust Manager — AWS External Key Store resources](https://www.thalesdocs.com/ctp/cm/2.11/admin/cckm_ag/aws-xks-proxy/)
- [Thales CipherTrust Manager — HSM Root of Trust et restauration](https://www.thalesdocs.com/ctp/cm/2.9/admin/cm_admin/backups/index.html)

### 10.4 État de sélection après cette passe

| Solution | Résultat pour SAC |
|---|---|
| AWS XKS seul | Interface de séparation intéressante ; ne garantit pas la destruction du matériel externe |
| Entrust nShield | Destruction matérielle possible, mais restauration via sauvegarde/cartes à neutraliser ; granularité et exploitation non démontrées |
| Thales CipherTrust / CCKM | Sauvegardes système restaurables contenant les clés ; destruction individuelle stricte non démontrée |
| Fortanix DSM | Restauration de cluster documentée ; non retenu |
| HashiCorp Vault Transit | Backup/restore de clés et snapshots ; non retenu |

**Décision : aucun de ces produits n'est approuvé pour stocker les clés GPS SAC.** Le travail suivant doit chercher une solution qui offre nativement une destruction individualisée, vérifiable et non restaurable de chaque clé, y compris dans les sauvegardes, les répliques et les plans de reprise. Il faut également établir que sa disponibilité est compatible avec une application d'urgence et que la redondance ne recrée pas une copie de clé après destruction.


## 11. Nouvelle piste : absence de persistance GPS côté serveur et conservation locale contrôlée

Cette piste change le modèle au lieu de chercher uniquement un KMS externe. Elle reste une **proposition d'étude, pas une décision d'architecture validée**.

### 11.1 Principe

- Le téléphone de l'auteur collecte les coordonnées et les chiffre avant transmission.
- Les coordonnées en clair ne sont jamais écrites dans D1, R2, les journaux, les traces, les files de tâches ou les sauvegardes Cloudflare.
- Le serveur Pages Functions authentifie l'auteur, vérifie les destinataires et relaie les paquets chiffrés sans les déchiffrer ni les conserver durablement.
- Les paquets de relais sont éphémères et ont une durée de vie courte, uniquement pour permettre la livraison. Aucun historique GPS serveur n'est créé.
- Les positions à conserver pendant 30 jours après la fin du partage sont archivées uniquement sur le terminal de l'auteur, chiffrées avec une clé propre à ce terminal. À l'échéance, l'application supprime la clé locale et les données chiffrées.
- Les contacts reçoivent uniquement les positions explicitement partagées. SAC ne peut pas garantir qu'un destinataire ne fasse pas une capture d'écran, une copie ou un enregistrement externe.

### 11.2 Ce que cette piste résout

Si elle est correctement implémentée et testée, l'absence de persistance serveur empêche une restauration D1 Time Travel ou R2 de faire réapparaître un historique GPS qui n'a jamais été stocké dans ces services. Cela supprime le besoin de placer une clé GPS de déchiffrement dans un KMS cloud uniquement pour protéger des copies serveur inexistantes.

Cette approche réduit aussi l'impact d'une compromission de la base relationnelle : les données de compte, d'alerte et les événements peuvent être conservés, mais ils ne contiennent pas les coordonnées précises.

### 11.3 Limite PWA : non acceptable comme preuve de destruction forte

La Web Crypto API permet des objets CryptoKey non exportables, mais la spécification W3C précise qu'elle ne garantit pas la manière dont le matériel de clé est conservé par le navigateur ou le système d'exploitation, ni qu'il ne soit pas persisté sur disque. Une clé non exportable ne constitue donc pas, à elle seule, une preuve de destruction irréversible face aux sauvegardes/restaurations ou à un accès au profil du navigateur.

Sources :
- [W3C Web Cryptography API — considérations de sécurité](https://www.w3.org/TR/2025/WD-WebCryptoAPI-20250422/)
- [IETF RFC 10017 — considérations de stockage navigateur](https://www.ietf.org/rfc/rfc10017.html)

Conclusion : la PWA peut assurer le relais chiffré sans stockage serveur, mais ne doit pas promettre à elle seule une destruction locale matériellement irréversible des archives GPS à J+30.

### 11.4 Piste native Android/iOS à tester

Une enveloppe native pourrait conserver les clés locales dans les mécanismes sécurisés du système :
- Android : Android Keystore, avec vérification à l'exécution que la clé est réellement adossée à un TEE ou StrongBox lorsque disponible. Android documente que le matériel de clé peut être protégé et utilisé dans un environnement sécurisé ; les capacités varient selon le terminal.
- iOS : Keychain avec une classe `ThisDeviceOnly` adaptée, éventuellement `WhenPasscodeSetThisDeviceOnly` si le parcours accepte d'exiger un code de verrouillage. Apple documente que ces éléments ne sont pas sauvegardés ni migrés vers un nouvel appareil pour la classe la plus stricte.

Sources :
- [Android — Hardware-backed Keystore](https://source.android.com/docs/security/features/keystore)
- [Android — règles de sauvegarde des données d'application](https://developer.android.com/identity/data/autobackup)
- [Apple — kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly](https://developer.apple.com/documentation/security/ksecattraccessiblewhenpasscodesetthisdeviceonly)
- [Apple — Keychain data protection](https://support.apple.com/en-sa/guide/security/secb0694df1a/web)

Ces mécanismes sont des protections de stockage local, pas encore une preuve universelle de destruction physique de toutes les copies internes du terminal. Il faudra tester suppression de clé, restauration complète, migration de téléphone, réinstallation, sauvegarde locale/cloud, changement de code et appareils sans TEE/StrongBox.

### 11.5 Conditions qui restent à résoudre

1. Confirmer si les 30 jours de conservation concernent exclusivement les données sous contrôle de SAC, ou si l'exigence prétend aussi effacer les copies déjà reçues par les contacts. Ces deux garanties ne sont pas équivalentes.
2. Définir si l'archive GPS de 30 jours peut rester uniquement sur le téléphone de l'auteur, sans accès historique depuis un autre appareil ou depuis les comptes des contacts.
3. Définir le comportement lors d'une perte, panne, casse ou réinitialisation du téléphone : la perte de la clé locale rendrait l'archive irrécupérable avant J+30, ce qui protège la confidentialité mais réduit la disponibilité.
4. Tester les limites de fonctionnement en arrière-plan et de livraison en réseau faible. Un relais sans persistance ne peut pas garantir la livraison si l'émetteur et les destinataires sont simultanément hors ligne.
5. Garantir que les notifications push ne contiennent jamais de coordonnées précises ; elles doivent seulement inviter le contact à ouvrir SAC.
6. Empêcher toute journalisation des coordonnées, y compris dans les erreurs, analytics, outils de diagnostic et rapports de crash.

**Décision provisoire :** approfondir en priorité le relais chiffré sans persistance GPS serveur, associé à une conservation locale. Ne pas activer cette conception en production et ne pas déclarer la règle J+30 satisfaite avant les tests natifs, la clarification de la portée de la rétention et l'analyse des copies côté destinataires. Aucun stockage GPS serveur n'est autorisé entre-temps.


## 12. Conception native : chiffrement local, suppression de clé et limites temporelles

Cette section approfondit la piste sans persistance GPS serveur. Elle s'appuie sur les documentations Android et Apple consultées le 17 novembre 2026. C'est une proposition d'architecture à prototyper, pas une fonctionnalité déjà implémentée.

### 12.1 Modèle de protection proposé

Pour chaque session de partage ou trajet :
1. Le terminal génère une clé de données aléatoire dédiée à cette session (DEK distincte ; aucune clé globale commune à toutes les positions).
2. Les coordonnées sont chiffrées sur le terminal avant toute transmission ou écriture locale.
3. L'archive locale ne contient que des blocs chiffrés, horodatés et authentifiés. Les fichiers de stockage sont exclus des sauvegardes applicatives autant que les plateformes le permettent.
4. La clé de session est conservée dans le magasin sécurisé natif, liée à l'appareil ; elle n'est jamais exportée vers D1, R2, les journaux, les analytics, les notifications ou le compte utilisateur.
5. Les destinataires autorisés reçoivent les positions partagées via un canal chiffré de bout en bout. Le relais serveur ne détient pas la clé de déchiffrement et ne conserve pas d'historique GPS.
6. À l'expiration, l'application supprime la clé de session ; les blocs chiffrés deviennent alors inutilisables. La suppression des fichiers chiffrés est également effectuée, mais elle n'est pas considérée comme la garantie cryptographique principale.

Une clé par session limite l'impact d'une compromission ou d'une erreur de suppression : elle évite qu'une clé maîtresse permette de déchiffrer toutes les sessions historiques.

### 12.2 Android

Android Keystore peut garder le matériel de clé non exportable et, si le terminal le prend en charge, lier la clé à un TEE ou à StrongBox. L'application doit vérifier le niveau réel avec `KeyInfo.getSecurityLevel()` et ne jamais supposer que tous les téléphones disposent de StrongBox.

La clé et les données doivent être liées au terminal. Les fichiers d'archive doivent être exclus des sauvegardes Android. Les tests devront couvrir sauvegarde cloud, transfert d'appareil, restauration sur le même terminal, réinstallation, réinitialisation et suppression d'une entrée de clé.

La documentation Android précise que le matériel de clé peut être lié au matériel sécurisé et non extractible. Elle précise également que certaines autorisations temporelles ne sont généralement pas appliquées par le matériel sécurisé, faute d'horloge temps réel indépendante. Une date d'expiration inscrite dans les paramètres de clé ne suffit donc pas à prouver une destruction à la seconde près.

Source officielle : [Android Keystore system](https://developer.android.com/privacy-and-security/keystore).

### 12.3 iOS

Le candidat le plus restrictif étudié est `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly` : l'élément exige un code de verrouillage, est accessible lorsque l'appareil est déverrouillé, n'est pas migré vers un autre appareil et n'est pas restauré sur un nouvel appareil. Apple précise aussi que retirer le code de l'appareil supprime ces éléments.

Cette classe a une contrepartie : elle n'est disponible que lorsque l'appareil est déverrouillé et peut donc ne pas convenir à toutes les opérations en arrière-plan. Une classe accessible après le premier déverrouillage pourrait améliorer le fonctionnement en arrière-plan, mais doit être comparée à la classe la plus restrictive et ne doit pas être sélectionnée sans test de sauvegarde/restauration.

Source officielle : [Apple — kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly](https://developer.apple.com/documentation/security/ksecattraccessiblewhenpasscodesetthisdeviceonly) et [Apple — Restricting keychain item accessibility](https://developer.apple.com/documentation/Security/restricting-keychain-item-accessibility).

### 12.4 Le point non résolu : exécution exacte à J+30

La suppression d'une clé locale peut être déclenchée par :
- une tâche de nettoyage planifiée ;
- chaque reprise de l'application ;
- chaque ouverture de l'écran d'historique ;
- une vérification d'expiration avant toute opération de déchiffrement.

Toutefois, les systèmes mobiles ne garantissent pas qu'une application soit réveillée à l'heure demandée. La documentation Capacitor indique que les tâches d'arrière-plan sont limitées, que leur exécution n'est pas garantie à l'intervalle demandé et que iOS peut suspendre l'application. Un téléphone éteint, hors batterie, désinstallé ou qui ne rouvre jamais SAC ne peut pas exécuter le nettoyage applicatif à l'instant J+30.

La date d'expiration doit donc bloquer tout accès dans le code dès que l'application peut vérifier l'heure, et le nettoyage doit être relancé à chaque occasion. Mais cela ne prouve pas la destruction matérielle de la clé exactement à J+30 si l'OS n'a pas exécuté SAC. Android ne fournit pas non plus une horloge temps réel sécurisée universelle pour faire appliquer cette échéance par le matériel.

Source officielle sur les limites des tâches : [Capacitor — Background Runner](https://next.capacitorjs.com/docs/next/apis/background-runner).

**Conclusion technique honnête :** l'approche native peut fortement protéger les clés contre l'extraction et leur migration via une sauvegarde vers un autre appareil. Elle permet aussi une suppression cryptographique locale lors de l'exécution du nettoyage. Elle ne démontre pas encore une suppression automatique garantie à l'instant précis J+30 lorsque le téléphone reste éteint ou que le système ne réveille pas l'application.

### 12.5 Stratégie de prototype et critères de validation

Le prototype devra être testé sur plusieurs appareils Android réels (avec et sans TEE/StrongBox) et au moins un appareil iOS :
- vérifier le niveau matériel réel des clés ;
- créer une clé indépendante par session et chiffrer/déchiffrer une archive de test ;
- sauvegarder puis restaurer les données sur le même appareil et sur un autre appareil ;
- vérifier qu'une copie des fichiers chiffrés sans la clé ne permet aucun déchiffrement ;
- supprimer la clé et vérifier que le déchiffrement échoue ;
- éteindre l'appareil avant J+30, le rallumer après l'échéance et vérifier que l'accès est immédiatement bloqué avant tout affichage ;
- vérifier le nettoyage au retour de l'application et mesurer le délai réel de suppression ;
- tester l'appareil sans code de verrouillage, sans matériel sécurisé compatible, avec batterie épuisée, application désinstallée et réinitialisation ;
- vérifier l'absence de coordonnées dans les journaux, crash reports, analytics, push, D1, R2 et sauvegardes serveur.

Critères de rejet :
- une clé de session peut être restaurée sur un autre appareil ;
- une archive GPS peut être déchiffrée après échéance par l'application ;
- une coordonnée apparaît dans un stockage serveur persistant ou une télémétrie ;
- l'application présente une position périmée comme étant en direct ;
- le système annonce une suppression à J+30 alors qu'il n'a fait qu'enregistrer une tâche de nettoyage non exécutée.

### 12.6 Portée de la confiance envers les contacts

L'utilisateur confirme que les destinataires des alertes sont des personnes de confiance. Le périmètre de protection porte donc sur les données et clés sous le contrôle de SAC ; le produit ne cherchera pas à effacer les copies que les contacts autorisés choisissent de conserver sur leurs propres appareils. Cela ne change pas les règles de consentement, de sélection des destinataires et de révocation pour les nouvelles alertes.

**Décision provisoire maintenue :** poursuivre le prototype et les tests natifs, sans stockage GPS persistant côté serveur. Ne pas prétendre que l'exigence J+30 est entièrement prouvée tant que la suppression à échéance hors ligne n'est pas résolue ou que la règle de rétention n'est pas explicitement adaptée.


## 13. Transport temps réel sans historique GPS : Pages Functions + relais WebSocket

Une nouvelle piste de transport est confirmée par la documentation Cloudflare : une Pages Function peut être liée à un namespace Durable Objects et lui transmettre une requête. Cloudflare précise que la classe Durable Object doit être définie et déployée dans un Worker séparé, puis liée au projet Pages. Cela peut rester un service technique de relais et non remplacer l'API REST principale Pages Functions, mais cette extension doit être validée avant création de ressource.

### 13.1 Flux proposé

1. Le téléphone de l'auteur chiffre la position avec une clé de session et vérifie le consentement ainsi que les destinataires.
2. La Pages Function authentifie la session, vérifie l'alerte et les droits des destinataires.
3. La Pages Function transmet la connexion WebSocket au Durable Object de relais.
4. Le Durable Object transmet en mémoire les paquets chiffrés uniquement aux destinataires actuellement connectés à la session.
5. Le relais ne déchiffre jamais les coordonnées et n'écrit jamais le contenu des paquets dans D1, R2, SQLite, KV, les attachments WebSocket, les logs ou les traces.
6. Les attachments nécessaires à la reprise d'une connexion ne contiennent que des identifiants opaques minimaux de routage ; aucune coordonnée, adresse, précision ou historique.
7. À la fermeture des connexions, les paquets de position ne sont pas conservés pour une livraison ultérieure.

### 13.2 Ce que les WebSockets Durable Objects permettent — et ne permettent pas

Cloudflare documente l'API WebSocket Hibernation : les connexions clientes peuvent rester ouvertes pendant que l'objet est hiberné. Les attachments sérialisés peuvent survivre à l'hibernation et doivent donc être considérés comme des données persistantes liées à la connexion. Le stockage SQLite des Durable Objects dispose aussi d'une restauration temporelle jusqu'à 30 jours.

Conséquences impératives pour SAC :
- aucune coordonnée GPS, même chiffrée, ne doit être mise dans un attachment ;
- aucune position ne doit être écrite dans le stockage Durable Objects ;
- le code de relais ne doit pas appeler les API de stockage pour le contenu GPS ;
- seuls les paquets en transit dans la mémoire d'exécution peuvent contenir le ciphertext, pour la durée du transfert ;
- les journaux et traces doivent masquer les corps de messages et paramètres contenant des données de localisation.

Sources officielles :
- [Cloudflare Pages Functions — Bindings Durable Objects](https://developers.cloudflare.com/pages/functions/bindings/)
- [Cloudflare Durable Objects — WebSockets et hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Cloudflare Durable Objects — SQLite et restauration temporelle](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)

### 13.3 Livraison et mode hors ligne

Ce relais ne constitue pas une boîte aux lettres durable. Si le contact n'est pas connecté, le paquet GPS n'est pas stocké pour lui. SAC peut envoyer une notification générique sans coordonnées ; le contact récupère la position lorsque l'auteur et le destinataire sont connectés et que le partage est encore autorisé.

Une alerte non géographique peut être créée et notifiée indépendamment du partage GPS. L'interface doit distinguer « alerte envoyée » de « position disponible en direct ». Elle ne doit jamais afficher une position comme disponible si le relais ne l'a pas transmise.

WebRTC DataChannel est une alternative ou un complément : le transport est chiffré par DTLS et peut être pair-à-pair, mais les connexions peuvent nécessiter STUN/TURN et un serveur de signalisation. Le TURN peut relayer les paquets chiffrés ; le fonctionnement hors ligne et en arrière-plan reste limité par les plateformes mobiles.

Sources :
- [MDN — WebRTC Data Channels et chiffrement DTLS](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels)
- [MDN — STUN, TURN et ICE](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Protocols)
- [MDN — Signalisation WebRTC](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling)

### 13.4 Architecture candidate à tester

- Pages Functions reste l'API REST de référence et contrôle l'authentification et les autorisations.
- Un Worker auxiliaire ne fournit que le point d'entrée Durable Object WebSocket ; il ne remplace pas l'API métier.
- Le Durable Object ne stocke aucune position et ne conserve aucun paquet après transfert.
- D1 conserve uniquement les événements non géographiques et les états d'alerte.
- Les notifications push ne contiennent jamais les coordonnées GPS.
- Le terminal source conserve localement l'archive chiffrée pour la durée produit retenue ; les clés sont liées à l'appareil.

**Limites qui restent ouvertes :** disponibilité des connexions, réception lorsque les contacts sont hors ligne, comportement en arrière-plan Android/iOS, coûts et limites de WebSocket, gestion de plusieurs destinataires, absence de journalisation, et preuve par tests qu'aucun contenu GPS n'est écrit dans les stockages du relais.

Cette piste respecte la règle de ne pas remplacer Pages Functions par un backend autonome. Elle nécessite néanmoins un Worker auxiliaire pour héberger la classe Durable Object, donc une validation explicite avant toute création ou déploiement.
