# SAC — Matrice de traçabilité du futur schéma D1

**Statut :** document de préparation et de contrôle, non SQL, non validé pour migration.  
**Référence de base :** `SCHEMA_RELATIONNEL_D1_PROPOSITION.md`, `REVUE_SCHEMA_RELATIONNEL_D1.md`, `MACHINES_ETATS_ET_CONSERVATION.md` et `CONTRATS_OPERATIONS_ATOMIQUES_D1.md`.

## 1. Règles de lecture

- « Présente » signifie que la table est proposée conceptuellement, pas qu'elle existe dans D1.
- « Test requis » décrit une preuve future à exécuter sur D1 local puis Preview isolé. Un test TypeScript pur ne remplace pas un test d'intégration SQL.
- « Conservation à définir » est un blocage : aucune durée ne doit être inventée.
- Les données GPS précises, géohash, payloads de localisation et clés de déchiffrement restent exclus du schéma.
- Les droits après révocation et le cas d'une alerte orpheline restent des décisions produit ouvertes.
- Les tables d'abonnement et de paiement ne font pas partie de cette première proposition.

## 2. Matrice table par table

| Table proposée | Invariant métier / sécurité à garantir | Contraintes et index à examiner | Tests D1 indispensables | Conservation / blocage |
|---|---|---|---|---|
| `accounts` | Un compte supprimé ne revient pas actif ; finalisation seulement si aucune alerte ni aucun trajet actif | unicité ID ; états CHECK ; horodatages demande/finalisation ; index statut | deux finalisations concurrentes ; demande vs nouvelle alerte ; finalisation avec alerte/trajet actif ; restauration d'un état terminal interdite | Durée et minimisation hors GPS à définir ; état `deleted` à intégrer |
| `account_identities` | Une identité vérifiée appartient à un seul compte et n'est vérifiée qu'après preuve serveur | UNIQUE(channel, normalized_value) ; FK compte ; format normalisé | même numéro revendiqué simultanément ; identité non vérifiée utilisée ; changement d'identité interrompu | Durée après révocation/suppression à définir ; téléphone/email = données personnelles |
| `auth_challenges` | OTP/défi à usage unique, limité en essais, expiré et lié à son objectif | hash protégé ; FK identité/compte ; index expiration et statut ; unicité/consommation | deux consommations concurrentes ; expiration exacte ; dépassement essais ; mauvais objectif ; panne intermédiaire | Purge des défis expirés à définir ; aucun OTP clair ni hash rapide de code court |
| `user_devices` | Un appareil appartient à un compte ; seul le root actif approuve les secondaires ; révocation terminale | UNIQUE(account_id,id) ; unicité partielle root actif ; FK composites ; index appareils actifs | secondaire approuvant ; deux roots concurrents ; révocation concurrente à session ; root absent/révoqué | Historique et durée des métadonnées appareil à définir |
| `device_certificates` | Certificat lié au bon compte/appareil et à une racine de confiance ; certificat révoqué inutilisable | FK composite compte/appareil ; unicité certificat actif selon rotation ; tailles/format de clés bornés | substitution de clé ; mauvais compte/appareil ; révocation puis tentative crypto ; certificat remplacé | Conservation de l'historique non secret à définir ; aucune clé privée |
| `device_pairing_challenges` | Cérémonie liée au root actif et au terminal en attente ; défi consommé une seule fois | FK composites des deux appareils ; expiration ; statut terminal | deux validations simultanées ; replay ; root révoqué pendant cérémonie ; interruption réseau ambiguë | Purge des défis terminaux à définir ; aucun secret de cérémonie |
| `device_sessions` | Session liée à un seul compte/appareil ; révocation et auth_version bloquent chaque requête protégée | UNIQUE(token_hash) ; FK composite ; index compte/appareil/statut/expiration | session d'un autre appareil ; auth_version changée ; expiration exacte ; révocation et requête concurrentes | Durée de session et conservation des hashes à définir ; jamais de token brut |
| `trusted_contacts` | Relation directionnelle ; invitation acceptée ; révocation bloque nouveaux partages et nouvelles alertes | UNIQUE(owner_account_id,contact_account_id) ; CHECK owner != contact ; FK comptes | invitation non acceptée ; relation auto-référente ; révocation concurrente au déclenchement | Historique et durée relation à définir |
| `contact_invitations` | Invitation en attente sans accès ; acceptation par compte authentifié et identité vérifiée | UNIQUE(token_hash) ; FK owner/accepted account ; index pending/expiry | acceptation concurrente ; token rejoué ; destination substituée ; expiration/révocation | Purge et durée des invitations à définir ; token brut absent |
| `contact_alert_preferences` | Préférences lues au déclenchement puis figées dans l'instantané ; changement ultérieur sans effet rétroactif | UNIQUE(trusted_contact_id,alert_category) ; FK relation ; CHECK catégorie | préférence modifiée en concurrence avec création ; catégorie inconnue ; relation révoquée | Historique des changements à arbitrer |
| `alerts` | Seul auteur clôture/annule ; aucun contact ne clôture ; l'alerte ne se résout pas par expiration GPS | FK auteur ; CHECK état/motif/horodatages ; index auteur/statut/date | auteur vs destinataire ; double clôture ; clôture vs rappel ; alerte orpheline | Conservation hors GPS à définir ; aucune clôture automatique autorisée |
| `alert_recipients` | Instantané initial immuable ; pas d'ajout ni retrait rétroactif ; destinataire distinct de l'auteur | PK/UNIQUE(alert_id,contact_account_id) ; FK composites ; CHECK non-auteur | relation révoquée après déclenchement ; tentative modification instantané ; doublon ; accès par non-destinataire | Conservation liée à l'alerte à définir |
| `alert_events` | Historique append-only ; métadonnées à liste blanche ; aucun secret ni GPS | FK alerte/acteur ; index alerte/date ; triggers anti UPDATE/DELETE à étudier | UPDATE/DELETE refusé ; acteur non autorisé ; JSON contenant champ interdit ; tentative de fuite GPS | Durée par type d'événement à définir ; restauration admin hors garantie des triggers |
| `alert_responses` | Accusé, volontariat et retrait sont distincts ; un accusé n'arrête pas les rappels | FK alerte/destinataire ; CHECK type ; unicité/idempotence par commande | non-destinataire ; accusé répété ; retrait après révocation selon règle validée | Historique à conserver selon politique à définir |
| `alert_responsibility_history` | Un seul responsable courant ; premier volontaire accepté par opération atomique ; retrait sans clôture | FK alerte/contact ; unicité partielle d'une responsabilité ouverte ; index alerte/fin | deux volontaires concurrents ; transfert ; aucun successeur ; retrait et clôture simultanés | Historique de responsabilité à définir avec conservation alerte |
| `notification_outbox` | Rappels aux destinataires figés toutes les 5 min jusqu'à clôture ; reprise sans doublon ; révocation contact ne supprime pas le rappel initial | UNIQUE(deduplication_key) ; index statut/scheduled_at ; lease et séquence ; FK alerte/destinataire | deux workers ; bail expiré ; clôture vs planification ; révocation vs rappel ; réponse fournisseur ambiguë | Durée de retry et purge à définir ; aucune donnée GPS dans payload |
| `notification_attempts` | Tentatives traçables sans confondre accepté, livré et lu ; erreurs non sensibles | FK outbox ; index outbox/date ; taille bornée error_code | réponse fournisseur perdue ; retry ; tentative dupliquée ; fuite de payload dans logs | Durée et minimisation des logs à définir |
| `trips` | Trois modes cohérents ; auteur seul clôture ; absence d'arrivée confirmée ne crée pas SOS | FK auteur ; CHECK mode/status ; index actif/échéance | modes invalides ; auteur vs participant ; confirmation tardive ; suppression avec trajet actif | Conservation hors GPS à définir ; aucun GPS en D1 |
| `trip_participants` | Participants sélectionnés explicitement ; pas d'accès implicite au trajet | UNIQUE(trip_id,contact_account_id) ; FK composites | participant non autorisé ; doublon ; retrait pendant trajet | Durée et accès historique à définir |
| `arrival_checks` | Échéance serveur + délai explicitement choisi ; retard = non confirmé, pas accident ; trajet reste actif | FK trajet ; index due_at/status ; CHECK cohérence timestamps | confirmation vs scheduler ; heure limite ; confirmation tardive ; répétition scheduler | Conservation événement à définir ; aucun GPS en D1 |
| `push_subscriptions` | Abonnement lié à un appareil ; révocation appareil invalide abonnement ; worker revalide juste avant envoi | FK composite compte/appareil ; endpoint fingerprint unique ; statut | révocation concurrente envoi ; endpoint dupliqué ; appareil révoqué ; token expiré | Durée et chiffrement endpoint à définir ; fournisseur non choisi |

## 3. Tables / décisions manquantes avant SQL

La matrice identifie des objets qui ne doivent pas être ajoutés implicitement sans préciser leur rôle :

1. **Permissions par destinataire et par alerte** : la proposition d'une table `alert_recipient_permissions` reste conditionnelle. Elle dépend des arbitrages de lecture, rappel, GPS et réponse après révocation.
2. **Idempotence des commandes** : la stratégie est obligatoire dans le contrat D1, mais la table ou le mécanisme persistant de déduplication n'est pas encore défini.
3. **Suppression de compte** : `accounts` doit porter ou référencer l'état de demande/finalisation ; les reçus de finalisation et la minimisation des identités restent à préciser.
4. **Partage de position** : aucune table GPS n'est autorisée. Le futur mécanisme doit être défini hors D1 et démontrer l'effacement cryptographique irréversible à J+30.
5. **Durées de conservation** : les durées hors GPS sont ouvertes ; aucune purge SQL ne doit être écrite avant validation de la matrice légale et métier.
6. **Alerte orpheline** : aucune politique d'arrêt des rappels ou de clôture de secours n'est approuvée.
7. **Abonnements et paiements** : exclus de cette première proposition, prestataire et règles commerciales à définir séparément.

## 4. Critères d'acceptation avant première migration

La proposition ne sera déclarée prête que si toutes les cases suivantes sont satisfaites :

- [ ] Chaque table possède une clé primaire, des FK et une politique `ON DELETE` explicitement justifiée.
- [ ] Toutes les relations compte/appareil utilisent des FK composites quand nécessaire.
- [ ] Les règles d'accès sont appliquées dans les requêtes SQL de lecture et les écritures finales.
- [ ] Chaque état et transition est relié à un contrat de domaine testé.
- [ ] Les opérations multi-table disposent d'une stratégie atomique D1 qui traite les écritures à zéro ligne.
- [ ] Les scénarios de concurrence et de répétition réseau sont testés sur D1 local.
- [ ] L'outbox résiste à deux workers, aux baux expirés et aux réponses fournisseur ambiguës.
- [ ] Les accès après révocation sont décidés et testés.
- [ ] La suppression de compte, les alertes orphelines et les durées de conservation sont arbitrées.
- [ ] Aucun GPS précis, géohash, secret ou payload sensible n'est présent dans D1, logs, analytics ou outbox.
- [ ] Preview est prouvé isolé de Production par identifiant de base.
- [ ] La preuve de destruction J+30 résiste aux sauvegardes, exports, restaurations et accès administrateur.

**Décision actuelle : NON PRÊT POUR MIGRATION.**  
Cette conclusion est volontaire : la matrice rend visibles les prérequis sans transformer une proposition en autorisation d'écrire ou d'appliquer du SQL.

## 5. Ordre recommandé de réalisation

1. Arbitrages produit : révocation, alerte orpheline, partage GPS, suppression.
2. Matrice légale de conservation hors GPS.
3. Revue du schéma et des contraintes composites.
4. Définition des opérations atomiques et idempotence.
5. Tests D1 locaux avec concurrence, rollback et isolation.
6. Revue indépendante de sécurité et de cryptographie.
7. Preuve de destruction J+30.
8. Autorisation distincte avant toute migration ou ressource distante.
