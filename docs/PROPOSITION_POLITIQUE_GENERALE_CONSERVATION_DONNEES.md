# SAC — Proposition de politique générale de conservation et de suppression des données

**Date :** 18 novembre 2026  
**Statut :** proposition de conception — aucune durée nouvelle ci-dessous n'est approuvée par l'utilisateur ni présentée comme une durée légale.  
**Portée :** données non GPS des comptes, identités, appareils, sessions, invitations, relations, groupes, notifications, journaux, support et administration.  
**Hors périmètre :** le cycle de conservation des alertes et de leurs positions GPS est déjà fixé dans `CONTRAT_CONSERVATION_ALERTES_ET_PURGE.md` et ne doit pas être modifié par ce document.

## 1. Principes obligatoires

1. Une donnée n'est conservée que pour une finalité identifiée, pendant la durée nécessaire à cette finalité.
2. Chaque catégorie possède un responsable, une date de départ du délai, une règle de suppression/anonymisation et une règle de sauvegarde/restauration.
3. Les durées proposées ci-dessous sont des valeurs de travail à arbitrer, pas des obligations légales. Elles doivent être confrontées au droit applicable au Niger et à chaque pays de déploiement avant lancement.
4. L'expiration d'un délai déclenche une suppression effective, pas un simple masquage dans l'interface.
5. Les sauvegardes, snapshots, réplications, exports internes et restaurations ne doivent jamais ressusciter une donnée déjà supprimée ou rendre à nouveau accessible un secret révoqué.
6. Une restauration doit être « forward-only » : restaurer les données encore autorisées, puis rejouer les suppressions et révocations connues avant toute remise en service.
7. Les copies indépendantes réalisées par un destinataire ou exportées hors des systèmes contrôlés par SAC ne peuvent pas être effacées à distance par SAC. SAC doit limiter les exports et avertir clairement avant tout partage/export autorisé.
8. La suppression d'un compte ne doit pas effacer en cascade les preuves minimales nécessaires à la sécurité d'une alerte en cours, mais ne doit pas non plus conserver automatiquement l'identité complète.
9. Aucun OTP, mot de passe, secret, jeton brut, clé privée, contenu sensible d'alerte ou GPS précis ne doit apparaître dans les journaux.
10. En cas de doute sur la finalité, le droit d'accès ou la durée, le système refuse l'accès ou la conservation supplémentaire par défaut et ouvre un arbitrage ; il ne prolonge pas silencieusement.

## 2. Matrice proposée — durées non validées

Les durées sont des propositions techniques initiales uniquement. « À arbitrer » signifie qu'aucune durée ne doit être codée avant validation.

| Catégorie | Finalité minimale | Départ du délai | Proposition de durée | Fin de conservation |
|---|---|---|---|---|
| Compte actif et profil | Fournir le service et gérer les préférences | Tant que le compte est actif | Tant que nécessaire au compte actif | À la finalisation de suppression, supprimer ou anonymiser selon les dépendances autorisées |
| Inscription non vérifiée | Permettre l'activation par e-mail OTP | Création de l'inscription | 24 h après création, proposition à arbitrer | Purger le compte provisoire et ses identités non vérifiées ; garder seulement une empreinte anti-abus temporaire si justifiée |
| Défis OTP | Vérification initiale, opération sensible ou réinitialisation | Consommation, expiration ou invalidation | Purge des données du défi sous 24 h ; agrégat anti-abus séparé jusqu'à 30 jours, à arbitrer | Supprimer code, hash de code court, payload et lien de défi ; aucun OTP en clair |
| Identités e-mail/téléphone | Connexion, récupération et contact | Tant que l'identité est liée au compte | Tant que le compte est actif ; après changement/suppression, 30 jours pour prévenir la réattribution abusive, à arbitrer | Supprimer la valeur ou la remplacer par une empreinte non réversible si un besoin anti-abus démontré le justifie |
| Appareils et certificats publics | Reconnaître les terminaux et vérifier leur état | Révocation/remplacement de l'appareil | 180 jours après révocation, à arbitrer | Supprimer les métadonnées détaillées ; ne garder qu'un événement de sécurité minimisé si nécessaire |
| Sessions | Authentifier un appareil pendant la durée autorisée | Expiration ou révocation | Métadonnées de session 90 jours après fin, à arbitrer | Supprimer les hashes de jetons et détails de session ; conserver seulement l'événement de révocation minimal si justifié |
| Défis de jumelage | Approbation anti-rejeu d'un nouvel appareil | Consommation, rejet, annulation ou expiration | Purge sous 24 h, à arbitrer | Supprimer nonce, transcript temporaire, challenge et liens de cérémonie ; garder au plus un résultat non secret |
| Invitations de proches | Permettre l'acceptation explicite | Acceptation, refus, révocation ou expiration | Purger jeton et destination technique sous 30 jours ; garder preuve de consentement minimisée selon durée à arbitrer | Séparer preuve de consentement de l'URL/token ; aucun token brut |
| Relations de confiance | Appliquer les droits entre comptes | Révocation de la relation | Historique minimal 12 mois après révocation, à arbitrer | Supprimer les détails non nécessaires ; ne pas réactiver une relation révoquée |
| Groupes privés | Gérer l'adhésion et les invitations | Suppression du groupe ou départ/retrait d'un membre | Événements minimaux 90 jours, à arbitrer | Supprimer invitations et appartenance actives ; ne jamais déduire un droit SOS/GPS de l'historique |
| Abonnements push | Acheminer les notifications | Révocation/expiration de l'abonnement ou de l'appareil | Purge endpoint et clés de transport sous 30 jours, à arbitrer | Supprimer endpoint, clés et jetons fournisseur ; garder un code de résultat minimal si nécessaire |
| Notifications et tentatives | Diagnostiquer l'acheminement | Dernière tentative d'envoi | 90 jours pour métadonnées techniques, à arbitrer | Supprimer payloads, réponses brutes et identifiants non nécessaires ; conserver des compteurs agrégés si possible |
| Journaux techniques opérationnels | Diagnostiquer disponibilité et erreurs | Création de l'événement | 30 jours, proposition à arbitrer | Agréger puis purger ; exclure données personnelles et charges utiles |
| Journaux sécurité et accès privilégiés | Détecter abus, prouver les actions sensibles | Événement d'accès ou d'administration | 12 mois, proposition à arbitrer | Conserver uniquement acteur pseudonymisé, action, ressource minimale, résultat, horodatage et motif codifié |
| Dossiers de support | Répondre à une demande volontaire | Clôture du dossier | 12 mois après clôture, à arbitrer | Supprimer pièces jointes et texte libre ; garder une référence et un résultat minimisés si nécessaire |
| Exports demandés par l'utilisateur | Fournir une copie explicitement demandée | Génération de l'export | Expiration du lien sous 24 h ; suppression du fichier sous 7 jours au plus, à arbitrer | Supprimer fichier, URL signée et clés ; tracer uniquement la génération/remise sans recopier le contenu |
| Préférences et paramètres | Appliquer les choix de l'utilisateur | Tant que le compte est actif | Tant que nécessaire au compte actif | Supprimer avec le compte, sauf preuve minimale explicitement justifiée |
| Données administratives de mission | Exécuter et contrôler une délégation | Fin/révocation de mission | 12 mois après clôture, à arbitrer | Garder la preuve minimale de qui a accordé/révoqué quoi ; supprimer le détail devenu inutile |
| Facturation/paiement (si activé) | Exécuter et justifier une transaction | Date de transaction ou fin de relation contractuelle | À déterminer après avis juridique et exigences comptables locales | Ne pas fixer une durée arbitraire ; séparer les données financières légalement requises du profil SAC |

**Important :** les durées de cette matrice ne sont pas des durées légales nigériennes. Le délai de conservation des données de facturation, les journaux de sécurité et toute preuve de consentement exigent une validation juridique documentée avant mise en production.

## 3. Cas particulier : suppression du compte

La procédure en deux phases déjà décrite dans le registre produit reste une proposition à arbitrer et ne devient pas approuvée par ce document.

### Phase A — demande authentifiée
- Révoquer les sessions générales et empêcher les nouvelles activités selon les règles du cycle de compte.
- Bloquer les nouvelles alertes, invitations, trajets, groupes et partages.
- Présenter les alertes/trajets encore actifs et les conséquences de la suppression.
- Ne pas supprimer immédiatement les données indispensables à la continuité d'une alerte active.

### Phase B — finalisation
- Vérifier côté serveur et dans une transaction que les conditions de finalisation sont satisfaites.
- Supprimer les identités personnelles, préférences, appareils, sessions, abonnements push et contenus non soumis à une conservation justifiée.
- Supprimer ou pseudonymiser les relations, groupes, notifications et traces selon la matrice approuvée.
- Préserver uniquement les preuves minimales dont la finalité, les champs, l'accès et la durée ont été explicitement approuvés.
- Rendre l'ancien compte non réactivable ; une nouvelle inscription est une nouvelle identité de compte.
- Produire un reçu de suppression contenant une référence non sensible, la date, le périmètre et le résultat, sans recopier les données supprimées.

### Cas non résolus
- Suppression depuis `pending_verification` ou `suspended`.
- Compte en suppression avec alerte/trajet qui ne peut pas être clôturé par son auteur.
- Traitement d'une identité e-mail/téléphone après suppression et prévention de la réinscription abusive.
- Durée de conservation du reçu de suppression.
- Effets sur les groupes, relations directionnelles, missions administratives et paiements.

Aucune clôture automatique d'alerte n'est introduite ici. Les règles déjà décidées sur la clôture par l'auteur et les rappels continuent de prévaloir.

## 4. Suppression, pseudonymisation et preuve

- **Suppression :** rendre les données et leurs clés inaccessibles, purger les index, caches, files, copies de travail et objets dérivés contrôlés par SAC.
- **Pseudonymisation :** remplacer les identifiants directs par un identifiant aléatoire distinct ; ce n'est pas une anonymisation si une table de correspondance existe encore.
- **Agrégation :** ne conserver que des statistiques ne permettant pas de retrouver une personne, un appareil ou une alerte.
- **Preuve de suppression :** enregistrer une preuve minimale de l'opération sans garder le contenu effacé. Cette preuve ne doit pas permettre de reconstruire la donnée.
- **Empreintes anti-abus :** ne conserver une empreinte d'identité que si elle est nécessaire, non réversible dans le contexte retenu, limitée à une finalité et à une durée approuvées ; une empreinte stable peut elle-même rester une donnée personnelle.

La suppression doit couvrir les dépendances : lignes enfants, index de recherche, caches, files/outbox, pièces jointes, stockage objet, liens signés, analytics, observabilité, systèmes de support et fournisseurs externes contrôlables.

## 5. Sauvegardes, snapshots et restauration

La règle de non-résurrection s'applique à toutes les catégories, pas seulement au GPS :

1. Chaque suppression ou révocation produit un marqueur de suppression/révocation minimal, durable et indépendant du snapshot restauré.
2. Une restauration ne remet jamais automatiquement un compte, une session, un appareil, une relation, une invitation, un endpoint push ou un droit révoqué à l'état actif.
3. Avant réouverture du service, le système rejoue les marqueurs de suppression et de révocation, purge les données expirées et vérifie les invariants.
4. Les jetons, secrets temporaires et clés révoquées doivent rester inutilisables après restauration, même si leurs anciennes lignes réapparaissent dans un snapshot.
5. Les sauvegardes doivent être conçues pour ne pas conserver au-delà de leur durée approuvée des données personnelles supprimées ; si la suppression sélective n'est pas démontrable, la restauration est bloquée jusqu'à purge ou destruction irréversible des copies concernées.
6. Une restauration ne doit pas redémarrer les délais de conservation à partir de la date de restauration.
7. Le test de restauration doit inclure des comptes supprimés, appareils révoqués, sessions expirées, invitations consommées, relations révoquées, groupes supprimés, endpoints push supprimés et journaux arrivés à échéance.

## 6. Accès, audit et minimisation

- Les accès administratifs suivent la classification C0–C4 et les missions autorisées ; aucun rôle n'obtient une visibilité globale par défaut.
- Les journaux d'accès privilégié ne contiennent jamais le contenu consulté.
- Les recherches et exports sont justifiés, limités, horodatés et auditables.
- Les textes libres sont évités dans les événements techniques ; utiliser des codes d'événement et des motifs prédéfinis.
- Les identifiants techniques sont pseudonymisés dans les outils d'observabilité.
- Les fournisseurs d'e-mail, push, SMS et paiement ne reçoivent que les champs strictement nécessaires à leur tâche ; les durées de leurs journaux et leurs procédures de suppression doivent être vérifiées contractuellement.
- Les accès de support ne doivent jamais révéler les alertes privées, les proches ou les coordonnées GPS.

## 7. Critères bloquants avant toute implémentation

1. Valider les durées proposées catégorie par catégorie après revue juridique Niger/pays de lancement.
2. Définir les responsables de traitement, finalités et bases applicables pour chaque flux.
3. Réconcilier les règles de suppression de compte avec les cinq états validés et les cas d'alerte/trajet actifs.
4. Définir les preuves minimales conservées et leurs champs exacts.
5. Définir les marqueurs durables de suppression/révocation et le protocole de restauration forward-only.
6. Tester concurrence entre suppression, nouvelle activité, révocation et notification.
7. Tester les sauvegardes, exports, caches, files, stockage objet et fournisseurs.
8. Aligner modèle logique, matrice D1, machines à états, contrats TypeScript et documentation avant toute migration.
9. Faire réaliser une revue indépendante sécurité/confidentialité et une revue juridique.
10. Obtenir une autorisation distincte avant toute modification de code, API, D1, Cloudflare, fournisseur ou déploiement.

## 8. Objets conceptuels possibles — non approuvés pour SQL

Selon le modèle retenu après arbitrage, les métadonnées de suppression pourraient être portées par les ressources elles-mêmes ou par un journal technique dédié, par exemple `data_lifecycle_events` et `deletion_markers`. Ces noms sont illustratifs : aucune table, colonne, index ou migration n'est approuvée par ce document.

## 9. Décisions à obtenir

Les arbitrages prioritaires sont :
1. confirmer ou modifier les durées proposées ;
2. décider si les preuves de sécurité et de consentement doivent être conservées plus longtemps que les données opérationnelles ;
3. définir le sort des comptes non vérifiés et des identités après suppression ;
4. valider le délai d'expiration des exports et la conservation des dossiers de support ;
5. définir la politique de suppression des données administratives et financières ;
6. confirmer le niveau de preuve exigé avant restauration d'une sauvegarde.

Jusqu'à ces validations, toutes les durées restent des propositions et aucune purge automatique ne doit être implémentée sur leur seule base.
