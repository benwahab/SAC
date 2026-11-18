# SAC — Revue critique de la proposition de schéma D1

**Statut :** revue technique interne, ouverte.  
**Base :** proposition dans `docs/SCHEMA_RELATIONNEL_D1_PROPOSITION.md`.  
**Décision :** aucune migration, endpoint ni ressource distante n'est autorisé par cette revue.

## 1. Conclusion

La proposition constitue une bonne carte des domaines métier, mais elle n'est pas encore assez précise pour être convertie en SQL. Plusieurs invariants importants ne sont pas encore garantis par le modèle relationnel. Les principaux risques concernent :

- les relations croisées entre comptes, appareils, certificats et sessions ;
- la concurrence lors de la prise en charge d'une alerte ;
- la reprise des notifications et rappels après interruption ;
- la révocation des abonnements push ;
- l'immutabilité réelle de l'historique ;
- les règles de suppression et de conservation des données personnelles.

La suite recommandée est de corriger le modèle conceptuel et de définir les contraintes, états et opérations atomiques avant d'écrire une migration.

## 2. Points bloquants à corriger dans le modèle

### 2.1 Clés étrangères composites et isolation entre comptes

La proposition mentionne des identifiants opaques, mais elle ne définit pas encore les clés étrangères composites nécessaires pour empêcher certaines associations incohérentes.

Exemples :
- une session doit référencer un appareil appartenant au même compte ;
- un certificat doit référencer le même compte que son appareil ;
- un défi de jumelage doit relier deux appareils du même compte, avec le premier comme racine active et le second comme appareil en attente ;
- un destinataire d'alerte doit être un compte distinct de l'auteur ;
- une réponse ne peut être créée que par un destinataire de cette alerte.

**Correction attendue :** ajouter des contraintes uniques parentales sur `(account_id, device_id)` et des clés étrangères composites correspondantes. Les contrôleurs doivent également filtrer par compte. Les clés étrangères seules ne remplacent pas l'autorisation métier.

Cloudflare D1 applique les contraintes de clés étrangères et permet les références composites. La politique `ON DELETE` doit être explicite pour chaque relation ; ne pas utiliser `CASCADE` par défaut sur les alertes, événements ou traces nécessaires à la sécurité. Référence : https://developers.cloudflare.com/d1/sql-api/foreign-keys/

### 2.2 Un seul appareil racine et cycle de vie de la racine

La règle « un seul appareil racine » doit être exprimée sans ambiguïté. Une contrainte d'unicité partielle peut limiter à un seul appareil racine actif par compte, mais elle ne définit pas à elle seule le remplacement de la racine.

Le protocole approuvé prévoit que seul l'appareil racine approuve les appareils secondaires. La procédure de transition de racine n'est pas encore validée.

**Correction attendue :**
- distinguer racine historique et appareil actuellement autorisé à approuver ;
- ne pas autoriser un nouveau root par simple insertion ou changement de booléen ;
- définir une cérémonie de transition et de récupération avant d'ajouter une route permettant de changer la racine ;
- garantir côté SQL qu'aucune approbation secondaire ne passe si le root actif est absent, révoqué ou remplacé.

Tant que cette procédure n'est pas définie, le modèle doit interdire toute transition implicite de racine.

### 2.3 Certificats : unicité et révocation

Le modèle ne précise pas :
- combien de certificats actifs un appareil peut posséder ;
- comment un certificat remplacé est conservé ;
- comment la révocation d'un certificat invalide les sessions et les échanges de clés ;
- comment le statut de certificat est relu avant chaque opération cryptographique.

**Correction attendue :** clé étrangère composite compte/appareil, unicité d'un certificat actif par appareil (ou règle de rotation explicitement versionnée), historique des changements de statut, et refus serveur si certificat non actif. Aucun échange ECDH ne doit être autorisé sur la seule présence d'un certificat en cache.

### 2.4 Réponses et prise en charge principale

La table `alert_responses` conserve des réponses, mais la proposition ne définit pas suffisamment l'état courant de prise en charge.

La règle produit est :
- plusieurs contacts peuvent accuser réception ou se proposer ;
- le premier contact volontaire qui prend effectivement la responsabilité devient responsable principal ;
- s'il se retire, un autre volontaire peut prendre la relève ;
- seul l'auteur clôt l'alerte.

**Correction attendue :**
- séparer accusé de réception et candidature à la prise en charge ;
- conserver toutes les transitions dans `alert_events` ;
- représenter l'occupation du rôle principal par une ligne courante ou une table d'historique avec une contrainte d'unicité partielle sur une responsabilité non terminée ;
- faire la sélection du premier volontaire dans une transition SQL atomique ;
- exiger une autorisation du destinataire figé de l'alerte ;
- empêcher les contacts de clôturer ou d'annuler l'alerte de l'auteur.

Un simple `SELECT` suivi d'un `INSERT` dans deux appels séparés n'est pas suffisant contre deux prises en charge simultanées.

### 2.5 Rappels SOS et outbox

La proposition prévoit des notifications et des rappels toutes les cinq minutes, mais le modèle outbox est incomplet pour un service qui peut être interrompu ou redémarré.

Champs à étudier :
- `attempt_count`, `next_attempt_at` ;
- `lease_until` et identifiant du worker détenteur pour les lignes en traitement ;
- `last_error_code` borné ;
- numéro de séquence du rappel ou identifiant de période ;
- clé de déduplication déterministe par alerte, destinataire, canal et occurrence ;
- date d'annulation et motif technique.

Le système doit récupérer les lignes dont le bail a expiré, éviter les doublons lors de deux workers concurrents et ne jamais considérer un rappel envoyé uniquement parce qu'il a été planifié.

La clôture par l'auteur doit empêcher la création de nouveaux rappels et annuler ceux qui n'ont pas encore été envoyés. Un rappel déjà accepté par le fournisseur peut toutefois être livré après la clôture ; cette limite doit être documentée.

### 2.6 Abonnements push manquants

La proposition prévoit la révocation des abonnements push, mais aucune table ne représente les abonnements.

**Correction attendue :** prévoir une table dédiée aux abonnements push par appareil, avec :
- identifiant opaque ;
- compte et appareil liés par clé composite ;
- endpoint/token push protégé (ne jamais l'exposer dans les réponses ordinaires ni les logs) ;
- clé de chiffrement/authentification si le standard push retenu l'exige ;
- statut actif/révoqué ;
- dates de création et révocation ;
- empreinte ou identifiant unique permettant la déduplication.

La révocation d'un appareil doit invalider ses abonnements push dans la même opération atomique. Le worker d'envoi doit revalider le statut de l'appareil et de l'abonnement juste avant l'envoi. Le fournisseur et le format restent à sélectionner.

### 2.7 Journal d'événements : append-only à garantir

La mention « append-only côté application » est une règle de code, pas une contrainte de base.

**Correction attendue :**
- interdire UPDATE et DELETE par les chemins applicatifs ordinaires ;
- ajouter des tests vérifiant que les endpoints ne peuvent pas modifier un événement ;
- envisager des triggers SQLite qui rejettent UPDATE/DELETE, en sachant qu'un administrateur ayant accès aux migrations ou à la restauration reste hors de cette garantie ;
- limiter strictement les champs de métadonnées autorisés au lieu d'accepter un JSON arbitraire ;
- ne jamais placer dans les événements une coordonnée, un token, un OTP, un secret, un payload GPS ou une URL de localisation.

Un journal append-only ne doit pas devenir une copie indirecte des données qu'on s'engage à supprimer à J+30.

### 2.8 Données libres et fuite GPS

Le champ `alerts.description` et le `destination_label` des trajets peuvent recevoir une adresse ou des coordonnées saisies librement. L'interdiction de créer une table GPS ne suffit donc pas à exclure toute coordonnée de D1.

**Correction attendue :**
- définir les champs texte comme non destinés à recevoir une position ;
- ne pas préremplir ces champs avec une adresse ou une coordonnée ;
- empêcher les clients d'y injecter automatiquement les données de localisation ;
- décider si les utilisateurs peuvent librement écrire des coordonnées ; si oui, cette donnée devient une donnée de localisation soumise à la politique J+30 et ne peut être conservée dans D1 ;
- exclure les corps de requête et champs descriptifs des logs, traces et analytics par défaut.

Aucun validateur de texte ne peut garantir à lui seul qu'une personne n'écrira jamais une adresse ou une coordonnée. La règle de traitement doit donc être appliquée à la source et à la journalisation.

### 2.9 Suppression et conservation

Le modèle ne peut pas être migré avant de définir ce qui se passe quand :
- un compte est supprimé ;
- un contact révoque la relation ;
- un utilisateur change de téléphone ou d'e-mail ;
- une invitation expire ;
- une alerte est annulée ou clôturée ;
- un destinataire demande la suppression de son compte alors qu'il apparaît dans l'historique d'une alerte ;
- une notification échoue définitivement.

**Correction attendue :** établir une matrice par table : durée de conservation, propriétaire, règle de suppression/anonymisation, dépendances FK, droit d'accès après révocation, et comportement pendant une alerte active. Les données de sécurité nécessaires ne doivent pas être conservées indéfiniment par défaut.

### 2.10 Authentification OTP et anti-abus

Le champ `challenge_hash` n'est pas une conception complète pour un code court. Un hash rapide simple permettrait de tester toutes les combinaisons si la base fuit.

**Correction attendue :**
- ne pas stocker le code en clair ;
- choisir une méthode de vérification adaptée à un secret à faible entropie, avec secret serveur séparé et limitation d'essais ;
- rendre la consommation à usage unique atomique ;
- limiter l'émission et la vérification par identité, compte, IP/appareil et période ;
- protéger les messages d'erreur contre l'énumération de comptes ;
- garder le fournisseur et la politique de livraison en décision séparée.

La sélection d'un fournisseur OTP n'est pas faite dans cette revue.

## 3. Corrections structurelles supplémentaires

Avant migration, ajouter au modèle ou à sa documentation :

1. Une table d'abonnements push, séparée des appareils.
2. Des baux et mécanismes de reprise pour l'outbox.
3. Une représentation non ambiguë du responsable principal courant.
4. Des contraintes composites compte/appareil et alerte/destinataire.
5. Une matrice de conservation/suppression par table.
6. Une stratégie de limitation d'abus indépendante du seul compteur d'essais OTP.
7. Des contraintes de longueur, valeurs autorisées et transitions pour chaque statut.
8. Un mécanisme de versionnement des événements et du schéma métier.
9. Une règle de rétention des tentatives de notification et des identifiants fournisseur.
10. Une politique de suppression des données personnelles qui ne repose pas sur des `ON DELETE CASCADE` aveugles.

## 4. Invariants métier à transformer en tests

Les tests d'intégration D1 devront démontrer au minimum :

- une session ne peut pas pointer vers un appareil d'un autre compte ;
- un certificat ne peut pas être attaché à un appareil d'un autre compte ;
- un appareil secondaire ne peut pas approuver un autre appareil ;
- un compte ne peut pas avoir deux racines actives ;
- un destinataire non sélectionné ne peut pas lire ni répondre à une alerte ;
- une relation révoquée ne peut pas être utilisée pour une nouvelle alerte ;
- la liste des destinataires d'une alerte déjà déclenchée reste figée ;
- exactement un contact peut devenir responsable principal à un instant donné ;
- le retrait du responsable permet une reprise sans effacer l'historique ;
- un contact ne peut pas clôturer l'alerte ;
- l'auteur peut annuler/clôturer selon les transitions autorisées ;
- un rappel ne part pas après clôture s'il n'a pas déjà été transmis au fournisseur ;
- deux workers ne peuvent pas traiter le même rappel simultanément ;
- un abonnement push d'appareil révoqué ne peut plus être utilisé ;
- les événements ne peuvent pas être modifiés via les routes applicatives ;
- aucun champ de journalisation ne reçoit de GPS, secret ou token ;
- suppression et révocation respectent la matrice de conservation ;
- un défi OTP ou de jumelage ne peut être consommé qu'une fois même en concurrence.

## 5. Garanties D1 à exploiter correctement

Cloudflare documente que D1 applique les clés étrangères et permet les clés étrangères composites. Les comportements `ON DELETE` sont configurables ; chaque relation doit donc être décidée explicitement :
https://developers.cloudflare.com/d1/sql-api/foreign-keys/

Les résultats de `D1PreparedStatement.run()` et `D1Database.batch()` comprennent un objet `meta`, notamment le nombre de changements. Les contrôleurs doivent examiner les résultats de chaque instruction et vérifier les effets réellement obtenus ; une promesse résolue ne prouve pas à elle seule que la transition métier a eu lieu :
https://developers.cloudflare.com/d1/worker-api/return-object/

Les instructions d'un batch s'exécutent dans une transaction ; une erreur SQL annule le batch. Cependant, une condition `WHERE` sans correspondance n'est pas une erreur SQL. Le SQL doit donc empêcher les écritures secondaires indésirables et les tests doivent vérifier les lignes affectées :
https://developers.cloudflare.com/d1/worker-api/d1-database/

## 6. Ordre de travail recommandé

1. Corriger la proposition relationnelle avec les clés composites et les tables manquantes.
2. Formaliser les machines à états des alertes, réponses, responsabilité et notifications.
3. Définir la matrice de conservation et de suppression.
4. Définir les opérations atomiques (déclenchement, prise en charge, retrait, clôture, révocation appareil, consommation OTP).
5. Écrire des migrations locales uniquement après revue du schéma corrigé.
6. Exécuter les tests D1 locaux, notamment les scénarios concurrents et d'isolation.
7. Faire valider l'isolation de l'environnement Preview avant toute opération distante.
8. Garder le GPS hors D1 et hors du backend tant que la destruction irréversible J+30 n'est pas prouvée.

**Cette revue ne valide pas encore le schéma pour migration.**


## 2.10 Droits d'un destinataire après révocation

La relation de confiance et l'instantané initial d'une alerte sont bien séparés, mais la proposition ne doit pas utiliser la seule présence dans `alert_recipients` comme autorisation universelle.

Il faut représenter séparément les droits de rappel, de lecture du détail, de réception de nouvelles positions et de réponse/prise en charge. Le rappel initial reste régi par l'instantané et l'état actif de l'alerte ; la révocation ne doit pas l'annuler. Toute émission de position doit cependant revalider une autorisation active au dernier point d'envoi.

**Point non résolu :** la politique d'accès au détail après révocation et les droits de réponse n'ont pas été validés. La table conceptuelle proposée en section 8 de `SCHEMA_RELATIONNEL_D1_PROPOSITION.md` reste donc un emplacement d'architecture, pas un schéma prêt à migrer.

## 2.11 Suppression de compte et alerte orpheline

Le modèle doit inclure l'état terminal logique `deleted` et les dates de demande/finalisation. La suppression finale doit vérifier l'absence d'alertes et de trajets actifs dans la transaction finale, sans faire confiance à un compteur fourni par le client.

Le cas d'un auteur qui ne revient jamais est toujours ouvert. Tant qu'il ne l'est pas :
- pas de clôture automatique ;
- pas de clôture par un contact ;
- pas de suppression en cascade de l'alerte ;
- pas d'expiration implicite de l'alerte par simple expiration d'un partage de position.

Une expiration du partage de position peut arrêter les nouvelles positions sans déclarer l'alerte résolue ; la durée maximale reste à valider.

## 5. Conclusion actualisée

Les amendements conceptuels sur les droits par destinataire, la suppression et les alertes orphelines sont ajoutés à la proposition. Le schéma demeure non validé : les arbitrages produit, la matrice de conservation et la preuve J+30 restent des prérequis absolus avant toute migration D1.
