# SAC — Arbitrage P0 : cycle de vie du compte et preuve des proches

Date : 18 novembre 2026  
Statut : consolidation des décisions déjà validées et propositions de résolution ; **aucune décision produit nouvelle n'est réputée approuvée par ce document**.  
Périmètre : premier blocage P0 de la revue relationnelle.

## 1. Décisions déjà validées — à ne pas rouvrir

| Sujet | Règle confirmée |
|---|---|
| États du compte | exactement cinq : `pending_verification`, `active`, `suspended`, `deletion_pending`, `deleted` |
| Vérification initiale | OTP envoyé par e-mail ; code correct = adresse e-mail vérifiée et condition suffisante pour l'activation initiale |
| Téléphone du compte | obligatoire à l'inscription, indicatif international, déclaré mais non vérifié |
| OTP téléphone | aucun SMS OTP, appel automatisé de validation ou preuve téléphonique indépendante |
| Mot de passe | minimum 12 caractères ; maximum technique accepté sans troncature ; espaces et Unicode admis |
| Session | déconnexion après 30 jours consécutifs d'inactivité ; réauthentification obligatoire à 90 jours maximum |
| Suspension administrative | décision réservée au Super Admin ; sessions générales révoquées ; nouvelles activités interdites ; données conservées |
| Blocage de sécurité | une mesure temporaire sur une tentative/session n'est pas automatiquement une suspension du compte |
| Suppression | demande puis finalisation distincte ; aucun nouveau flux métier après demande ; ne pas finaliser avec alertes ou trajets actifs |
| État supprimé | terminal ; aucune restauration/réactivation de l'ancien compte |
| SOS pendant suspension | l'alerte déjà transmise continue ; capacité d'urgence limitée à cette seule alerte et à l'appareil d'origine ; aucune session générale |
| Clôture exceptionnelle | dans le scénario spécifique validé, seul l'administrateur SAC habilité clôture ; la capacité d'urgence du titulaire suspendu ne fait que demander la clôture |

## 2. Contrat cible des cinq états

### 2.1 Signification canonique

- `pending_verification` : inscription enregistrée, identité e-mail principale non vérifiée. Aucun accès privé, aucune session utilisateur, aucune nouvelle alerte.
- `active` : e-mail principal vérifié ; compte utilisable selon permissions, appareils et sessions.
- `suspended` : accès général bloqué, sessions révoquées, nouvelles activités métier interdites. Les données sont conservées. Les seules opérations exceptionnelles déjà validées pour une alerte préexistante sont hors session générale et strictement limitées.
- `deletion_pending` : demande de suppression enregistrée ; création de nouvelles activités interdite ; opérations déjà engagées traitées selon les règles spécifiques ; finalisation différée.
- `deleted` : état terminal après finalisation de suppression/anonymisation selon une politique de conservation approuvée.

La vérification d'une identité est un attribut de l'identité, pas un état supplémentaire du compte. La suspension est un état administratif du compte, pas une propriété de la session.

### 2.2 Matrice des transitions

| État courant | Événement | État cible | Autorité | Statut |
|---|---|---|---|---|
| `pending_verification` | OTP e-mail correct et validation serveur | `active` | système après preuve correcte | règle déjà validée |
| `pending_verification` | expiration/abandon de l'inscription | à définir | système | ouvert |
| `pending_verification` | demande d'effacement avant activation | à définir | titulaire / système selon preuve | ouvert |
| `active` | suspension administrative | `suspended` | Super Admin | règle déjà validée |
| `suspended` | réactivation administrative | `active` | autorité administrative autorisée ; détail à formaliser | principe documenté, procédure à préciser |
| `active` | demande de suppression | `deletion_pending` | titulaire authentifié | règle déjà présente dans le contrat de domaine |
| `deletion_pending` | annulation de la demande | `active` | titulaire authentifié | règle présente dans le contrat de domaine ; confirmer conditions si suspension concomitante |
| `deletion_pending` | finalisation après contrôles | `deleted` | système, après préconditions | principe validé |
| `suspended` | demande de suppression | à définir | titulaire via procédure adaptée | ouvert |
| `deletion_pending` | suspension administrative | à définir | Super Admin | ouvert |
| `deleted` | toute commande de réactivation | interdite | aucune | état terminal validé |

Aucune transition non listée ne doit être ajoutée implicitement. Les lignes « ouvert » nécessitent un arbitrage avant d'être codées ou contraintes en SQL.

### 2.3 Métadonnées minimales à prévoir (proposition de modèle)

- compte : identifiant, état, dates de création et de dernière transition ;
- identité : canal, valeur normalisée, rôle principal/secondaire, état de vérification, date de vérification ;
- suspension : auteur, motif codifié et note interne protégée si nécessaire, date, éventuelle échéance, date et auteur de réactivation ;
- suppression : demandeur, date, état de traitement, date de finalisation, motif de blocage opérationnel ;
- transitions : événements append-only avec état précédent, état suivant, acteur, source, horodatage UTC, motif et référence de corrélation.

Ne pas dupliquer les mêmes vérités dans plusieurs colonnes mutables. Les métadonnées sensibles d'administration ne sont pas visibles au titulaire par défaut. Les secrets OTP, mots de passe et jetons ne sont jamais inscrits dans l'audit.

## 3. Écarts précis du contrat TypeScript actuel

Le fichier `src/domain/account-lifecycle.ts` accepte uniquement :
- `active`
- `deletion_pending`
- `deleted`

Il manque :
- `pending_verification`
- `suspended`

Le contrat actuel :
- ne représente pas la vérification e-mail ;
- ne représente pas l'auteur, le motif ou l'historique d'une suspension ;
- ne définit pas les transitions suspension/réactivation ;
- expose `allowCloseExistingActivity` comme booléen générique, qui ne suffit pas à distinguer la fermeture ordinaire des activités du titulaire actif/en suppression et la capacité cryptographique exceptionnelle d'un titulaire suspendu pour une seule alerte ;
- utilise des compteurs d'activités fournis au domaine pur lors de la finalisation ; côté serveur, ces compteurs doivent être recalculés depuis l'état persistant dans l'opération atomique, jamais acceptés depuis le client.

**Règle impérative pour la future correction :** ne pas simplement ajouter `suspended` à une condition booléenne de clôture. La suspension interdit l'accès général. La capacité d'urgence validée est un contrat distinct, lié à une alerte existante, un appareil d'origine, une preuve cryptographique et une autorisation serveur spécifique.

Les changements TypeScript et les tests ne sont pas exécutés dans cette intervention documentaire. Ils nécessiteront une autorisation de code distincte.

## 4. Vérification des proches : séparation entre coordonnées et consentement

### 4.1 Faits établis

- Le téléphone du titulaire SAC est obligatoire mais non vérifié.
- Aucun SMS OTP de compte n'est autorisé.
- La vérification initiale d'un compte se fait par e-mail OTP.
- Une relation de confiance ne doit pas être créée sur la seule base d'une saisie de numéro ou d'adresse par le titulaire.
- Une invitation n'est pas une relation active ; l'acceptation et le consentement du proche doivent être enregistrés.
- Un groupe privé ne remplace pas une relation de confiance.

### 4.2 Problème à résoudre

Les documents plus anciens évoquent parfois la vérification du téléphone ou de l'e-mail du proche. Cette formulation est trop large et contradictoire avec la règle actuelle : le téléphone n'est pas vérifié et aucun SMS OTP n'est prévu.

Il faut distinguer :
1. l'existence d'une coordonnée fournie par l'invitant ;
2. la preuve que l'invitation atteint une destination contrôlée par le proche ;
3. l'identité du compte SAC qui accepte ;
4. le consentement explicite à devenir proche ;
5. l'autorisation future de recevoir certains types d'alertes et, séparément, des partages de position.

Un simple envoi de notification ou une réponse depuis un numéro déclaré n'est pas une preuve suffisante.

### 4.3 Orientation de sécurité recommandée — non validée

**Voie de référence recommandée : acceptation liée à un compte SAC dont l'e-mail a été vérifié.**

1. L'invitant saisit l'adresse e-mail du proche ; l'adresse est normalisée côté serveur.
2. SAC crée une invitation à durée limitée, à jeton aléatoire à usage unique ; seul le hash du jeton est stocké.
3. L'invitation est remise à cette adresse.
4. Le destinataire s'inscrit ou se connecte ; son adresse e-mail doit être vérifiée par le mécanisme normal OTP e-mail.
5. Le destinataire voit l'identité minimale de l'invitant et les permissions demandées, puis accepte ou refuse explicitement.
6. À l'acceptation, le serveur vérifie que l'adresse vérifiée du compte correspond à la destination de l'invitation, que le jeton est encore valide et inutilisé, et que l'invitation n'a pas été révoquée.
7. La création de la relation et la consommation de l'invitation sont atomiques.
8. La relation reste inactive avant cette acceptation ; le propriétaire peut la révoquer ensuite.

Cette orientation ne crée aucun SMS OTP. Elle suppose que le proche dispose d'une adresse e-mail accessible et d'un compte SAC. Si le produit doit accepter des proches sans e-mail ou sans compte, un autre parcours de preuve et de consentement doit être conçu et validé avant toute activation.

### 4.4 Téléphone comme coordonnée secondaire

Le téléphone peut être collecté comme coordonnée de contact, mais :
- son statut demeure « déclaré non vérifié » ;
- il ne suffit pas à activer une relation de confiance ;
- il ne suffit pas à prouver l'identité d'une personne qui répond ;
- aucune fonction ne doit afficher « numéro vérifié » ;
- aucune invitation ne doit devenir active par simple envoi SMS ;
- les usages administratifs doivent afficher le niveau de preuve réel et conserver la trace des tentatives.

## 5. Contrat logique des invitations et relations

Proposition logique, sans figer encore le SQL :

### Invitation
- identifiant ;
- compte invitant ;
- destination normalisée et type de destination ;
- compte destinataire, nullable jusqu'à rapprochement ;
- hash de jeton, jamais le jeton brut ;
- permissions demandées ;
- état : créée, remise, acceptée, refusée, révoquée, expirée ;
- dates de création, expiration et décision ;
- preuve de vérification utilisée pour accepter ;
- identifiant d'idempotence.

### Relation de confiance
- identifiant ;
- compte propriétaire ;
- compte proche ;
- invitation source ;
- état actif/révoqué ;
- date d'activation et date de révocation ;
- consentement et version des permissions acceptées ;
- contrainte d'unicité sur le couple propriétaire/proche ;
- interdiction d'une relation vers soi-même.

La relation est directionnelle : A désigne B comme proche ne signifie pas automatiquement que B désigne A comme proche. La réciprocité éventuelle nécessite une seconde invitation et un consentement distincts.

Les permissions d'alerte, d'accusé de réception, de prise en charge et de partage de position ne doivent pas être confondues. Leur matrice exacte dépend des décisions encore ouvertes sur la révocation en cours d'alerte.

## 6. Tests d'acceptation indispensables avant migration

### Cycle de vie du compte
- aucune session ni activité privée avant vérification e-mail ;
- OTP valide active uniquement le compte visé et l'identité e-mail visée ;
- OTP expiré, consommé, réutilisé ou lié à une autre finalité refusé ;
- suspension révoque toutes les sessions générales et interdit une nouvelle connexion ;
- blocage temporaire d'une tentative ne transforme pas le compte en `suspended` ;
- réactivation ne restaure aucun ancien jeton ou session ;
- demande de suppression bloque les nouvelles activités ;
- finalisation est refusée si une alerte ou un trajet est encore actif ;
- compte `deleted` ne peut jamais être réactivé ;
- les transitions interdites et les événements antérieurs à la création sont rejetés ;
- une course suspension/suppression/connexion produit un état cohérent et journalisé ;
- le serveur recalcule les activités ouvertes au moment exact de la finalisation.

### Proches
- invitation ne crée jamais une relation active avant acceptation ;
- une adresse non vérifiée ne permet pas d'accepter ;
- une invitation expirée, révoquée ou consommée ne peut être rejouée ;
- le jeton brut n'est jamais stocké ;
- deux acceptations simultanées ne créent qu'une relation ;
- un utilisateur ne peut pas accepter une invitation destinée à une autre adresse ;
- le téléphone déclaré seul ne suffit jamais à accepter ;
- A vers B ne crée pas automatiquement B vers A ;
- révocation et acceptation concurrentes ont un ordre serveur déterministe ;
- le proche ne reçoit aucune permission GPS ou alerte au-delà du consentement enregistré.

## 7. Points encore ouverts — ne pas inventer de règle

1. Durée de validité d'une inscription `pending_verification` et purge des inscriptions abandonnées.
2. Effet d'une demande de suppression sur un compte suspendu.
3. Possibilité et procédure de réactivation d'un compte suspendu pendant une demande de suppression.
4. Traitement d'une demande de suppression avant vérification e-mail.
5. Acceptation d'un proche qui n'a pas d'adresse e-mail ou pas de compte SAC.
6. Durée d'une invitation et nombre de relances.
7. Niveau de détail visible dans l'invitation avant connexion.
8. Permissions précises d'un proche après révocation pendant une alerte déjà active.

Ces choix ne sont pas nécessaires pour documenter les invariants déjà validés, mais ils doivent être décidés avant les API et le schéma SQL concernés.

## 8. Ordre de réalisation après arbitrage

1. Valider les transitions ouvertes du cycle de compte.
2. Valider ou remplacer l'orientation d'acceptation des proches par e-mail vérifié.
3. Mettre à jour le contrat TypeScript et ses tests unitaires.
4. Ajouter tests de propriétés et tests de concurrence.
5. Revoir le modèle logique identité/invitation/relation et ses contraintes composites.
6. Faire relire les flux OTP, récupération et preuve des proches.
7. Mettre à jour le modèle global, la matrice de traçabilité et la revue relationnelle.
8. Réexaminer l'état de préparation D1.
9. Demander séparément l'autorisation de créer des migrations.

## 9. Limites de cette intervention

Cette intervention est documentaire. Aucun code TypeScript, test, API, schéma SQL, migration D1, ressource Cloudflare, fournisseur e-mail/SMS ou déploiement n'a été modifié. Les orientations marquées « recommandées » ne sont pas des décisions utilisateur.

**Statut : blocage P0 clarifié, mais non fermé.** Le contrat de domaine doit encore être aligné dans une intervention de code autorisée et les choix ouverts doivent être arbitrés avant migration.
