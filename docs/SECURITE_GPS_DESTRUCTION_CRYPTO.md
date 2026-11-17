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
