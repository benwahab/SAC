# SAC — Récupération du compte et perte de l'appareil racine

**Date :** 18 novembre 2026
**Statut :** contrat de sécurité proposé — aucune transition de racine approuvée, aucune API ni migration autorisée.

## 1. Principe non négociable

La récupération d'accès au compte et la récupération de la confiance cryptographique sont deux opérations distinctes.

- Un OTP, un SMS, un e-mail, une réinitialisation de mot de passe ou une intervention du support peut éventuellement rétablir l'accès au compte après vérification renforcée.
- Aucun de ces mécanismes ne peut recréer, exporter, restaurer ou remplacer silencieusement la clé privée de l'ancienne racine.
- Une nouvelle racine est une nouvelle identité cryptographique, avec une nouvelle paire de clés, un nouvel identifiant de génération et une nouvelle empreinte.
- Les contacts qui avaient épinglé l'ancienne racine doivent vérifier indépendamment la nouvelle empreinte avant tout nouveau partage GPS.
- Les certificats, sessions et clés liés à l'ancienne racine ne sont jamais transférés automatiquement à la nouvelle.

Ce principe reprend les décisions déjà consignées dans MACHINES_ETATS_ET_CONSERVATION.md et PROTOCOLE_MULTI_APPAREILS.md.

## 2. Menaces et cas distincts

| Situation | Risque principal | Réponse de sécurité |
|---|---|---|
| Téléphone racine perdu, possiblement hors ligne | Anciennes clés encore utilisables localement | Révoquer côté serveur ; considérer les copies locales comme non effacées |
| Téléphone racine volé et déverrouillé | Usurpation et approbations malveillantes | Révocation urgente, blocage de la racine, réauthentification |
| Mot de passe oublié, racine toujours disponible | Perte d'accès sans perte nécessaire de la clé | Récupération de compte séparée, puis preuve locale de possession de la racine |
| SIM remplacée ou numéro détourné | OTP reçu par un tiers | OTP seul insuffisant pour rétablir l'identité cryptographique |
| Tous les appareils approuvés perdus | Plus aucune clé privée de confiance disponible | Nouvelle racine et ré-ancrage indépendant |
| Ancienne sauvegarde restaurée | Réapparition d'un ancien état local | L'état serveur courant prévaut ; aucune réactivation d'un appareil révoqué |

## 3. États proposés pour la racine

- root_active : une racine unique est active.
- root_recovery_required : racine révoquée, compromise ou indisponible ; aucune nouvelle approbation ni opération GPS dépendant de cette racine.
- root_replacement_pending : une nouvelle racine a été créée localement, mais son ancrage indépendant n'est pas terminé.
- root_active_new_generation : nouvelle racine activée après validation de la procédure et des contacts requis.

Transitions proposées :
1. root_active vers root_recovery_required uniquement par une opération authentifiée et atomique, ou une procédure de sécurité définie.
2. root_recovery_required vers root_replacement_pending après récupération du compte et génération locale d'une nouvelle paire de clés ; jamais par import de l'ancienne clé.
3. root_replacement_pending vers root_active_new_generation uniquement après validation de la nouvelle génération et des ancrages indépendants requis.
4. Aucun retour vers l'ancienne génération ; une racine révoquée reste révoquée.

**Point à arbitrer :** nombre et nature des confirmations indépendantes exigées des contacts, ainsi que le traitement des contacts injoignables. Aucune valeur ne doit être codée avant décision produit.

## 4. Séquence de récupération proposée

### Phase A — sécuriser le compte
1. L'utilisateur lance une récupération depuis un canal disponible.
2. Le mécanisme d'identification et de vérification forte est exécuté ; fournisseur, facteurs et délais restent à décider.
3. La récupération ne change aucune clé racine et n'accorde aucun droit d'approbation d'appareil.
4. Les opérations sensibles restent limitées tant que l'état de la racine n'est pas clarifié.

### Phase B — déclarer la perte ou compromission
1. L'utilisateur ou un processus de sécurité signale la perte ou compromission.
2. Le serveur vérifie l'autorité de la demande selon une procédure dédiée ; un OTP isolé ne suffit pas pour remplacer une racine.
3. L'opération atomique marque l'ancienne racine révoquée, invalide les sessions et certificats dépendants, annule les cérémonies en attente et bloque les opérations dépendant de cette racine.
4. Les événements d'audit ne contiennent que des métadonnées minimales, sans secrets ni GPS.

**Limite physique :** une révocation serveur ne peut pas effacer une clé ou une copie déjà présente sur un appareil hors ligne.

### Phase C — créer une nouvelle identité
1. Un appareil neuf génère localement une nouvelle paire de clés racine.
2. La clé privée ne quitte jamais le terminal et n'est pas incluse dans une sauvegarde transférable.
3. Le nouvel appareil prouve la possession de la clé au moyen d'un transcript versionné, lié au compte, à la génération et à un défi à usage unique.
4. Le serveur effectue une création conditionnelle : une seule génération de remplacement peut être en attente ou activée.
5. L'ancienne empreinte reste révoquée ; elle ne peut pas être réactivée par une restauration ou un ancien certificat.

### Phase D — rétablir la confiance des contacts
1. Chaque contact reçoit une demande de vérification de nouvelle identité, distincte d'une simple notification de récupération.
2. Il compare l'empreinte par un canal indépendant de SAC : présence physique ou appel vocal indépendant, par exemple.
3. Une empreinte reçue uniquement dans SAC, par SMS ou par e-mail du même compte n'est pas une vérification indépendante.
4. La confirmation est liée à la nouvelle génération et à l'empreinte exacte ; une rotation ultérieure invalide ces confirmations.
5. Tant que le seuil produit n'est pas atteint, le partage GPS reste bloqué.

**Décision produit ouverte :** faut-il exiger la vérification de tous les contacts, d'un quorum défini, ou de chaque contact avant de lui partager la localisation ?

## 5. Matrice des droits pendant la récupération

| Fonction | Pendant récupération |
|---|---|
| Connexion au compte | Selon vérification forte et limites de récupération |
| Déclencher une alerte SOS sans GPS | Doit rester possible par une voie d'authentification sûre |
| Ajouter ou approuver un appareil | Interdit |
| Réactiver un appareil révoqué | Interdit |
| Partager une position GPS | Interdit jusqu'à validation de la nouvelle racine et des ancrages requis |
| Accéder à un historique GPS | Interdit ; aucune archive GPS ne doit être restaurée |
| Changer la racine par simple OTP | Interdit |

Le maintien du SOS non-GPS est un objectif produit important, mais sa disponibilité pendant une récupération n'est pas une garantie technique acquise. L'authentification, l'anti-abus et la transmission doivent être spécifiés et testés ; aucun contournement par OTP seul, appareil neuf non approuvé ou ancienne session révoquée n'est permis. Lire également `AUDIT_RECUPERATION_COMPTE_SANS_APPAREIL_FIABLE.md` et `CONSOLIDATION_APPAREILS_SESSIONS_ET_RECUPERATION.md`.

## 6. Sauvegardes et restaurations
- Une sauvegarde de l'application ne doit pas restaurer une clé privée racine exportable.
- Un certificat ou état local restauré ne constitue jamais une preuve d'autorisation actuelle.
- Chaque opération protégée doit vérifier l'état serveur courant de l'appareil, de la session, du certificat et de la génération racine, sans cache positif.
- Un appareil révoqué reste révoqué même si sa sauvegarde locale indique active.
- Les clés et positions GPS expirées ne sont jamais recréées à partir d'une sauvegarde.
- Les clés non exportables et les exclusions de sauvegarde ne prouvent pas à elles seules la destruction GPS J+30.

## 7. Concurrence, idempotence et anti-rejeu
- Deux récupérations concurrentes ne peuvent pas activer deux racines.
- Une ancienne génération ne peut pas écraser la génération courante.
- Défi, demande et confirmation sont à usage unique et liés au compte, à la génération et à l'empreinte.
- Une révocation concurrente gagne contre une approbation non encore validée ; après commit de révocation, aucune approbation liée à l'ancienne racine ne réussit.
- Les répétitions après perte réseau retournent l'état déjà établi sans répéter les effets.
- Un champ rootDeviceId fourni par le client ne constitue jamais une preuve d'autorité.
- Révocation, invalidation des sessions, annulation des cérémonies et audit doivent être conçus ensemble et testés sur runtime D1 isolé.

## 8. Tests adversariaux obligatoires
1. OTP valide sans preuve de possession de la racine : aucune restauration de l'identité cryptographique.
2. Mot de passe réinitialisé : aucune modification de l'empreinte racine.
3. Ancien appareil révoqué présentant un certificat et une sauvegarde historiquement valides : refus.
4. Deux nouvelles racines créées simultanément : une seule génération acceptée.
5. Ancienne racine tentant d'approuver pendant root_recovery_required : refus.
6. Appareil secondaire tentant de remplacer la racine : refus.
7. Réponse serveur substituant l'empreinte : blocage et alerte.
8. Confirmation d'un contact liée à une ancienne génération : refus pour la nouvelle.
9. Contact confirmant uniquement via le même canal SAC : statut non vérifié.
10. Perte réseau avant ou après commit : résultat idempotent, aucune double racine.
11. Restauration d'une sauvegarde antérieure à la révocation : l'état serveur courant prévaut.
12. Révocation pendant une approbation concurrente : aucun certificat actif sous l'ancienne racine après commit.
13. SOS non-GPS pendant récupération : reste disponible selon la voie sûre définie.
14. Aucun OTP, jeton, secret, clé privée ou GPS dans logs et audit.

## 9. Décisions qui restent obligatoirement ouvertes
- Fournisseur et facteurs de récupération du compte.
- Niveau de preuve exigé pour déclarer une racine compromise lorsque l'utilisateur n'a plus aucun appareil.
- Délai éventuel de sécurité et notifications vers les contacts.
- Quorum ou règle de vérification indépendante des contacts.
- Politique pour contacts injoignables ou relation révoquée.
- Droits non-GPS accordés pendant la récupération.
- Durées de conservation des traces minimales de sécurité.

Ne pas inventer une procédure de support « administrateur qui remplace la racine » : elle détruirait le modèle de confiance si elle n'est pas explicitement conçue, contrôlée et auditée.

## 10. Verrou avant implémentation

Ce document ne valide aucun fournisseur, aucune méthode OTP, aucun endpoint, aucune migration D1 et aucun stockage de clé. Il formalise les invariants et les questions à arbitrer. Le protocole de cérémonie multi-appareils doit d'abord être unifié et revu indépendamment.

**NO-GO maintenu :** aucun GPS réel, historique GPS, service de clés ou ressource Cloudflare ne doit être activé avant preuve indépendante de destruction irréversible J+30, y compris restauration, appareil hors ligne et appareil éteint.