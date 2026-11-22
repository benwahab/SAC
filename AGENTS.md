# Instructions communes aux agents IA — SAC

Tu interviens sur **SAC — Sécurité, Alerte, Citoyenne**, application privée de sécurité personnelle et familiale. Ce projet n'est pas PCS et ne doit jamais devenir une plateforme publique de signalement.

## Lecture obligatoire
Avant toute tâche, lis :
1. `README.md`
2. `ARCHITECTURE.md`
3. `TODO_SUPERVISION.md`
4. `docs/CAHIER_DES_CHARGES_SAC.md`
5. `docs/ARCHITECTURE_ET_MODELE_DONNEES.md`
6. `docs/CONSIGNES_DE_TRAVAIL.md`
7. `docs/DECISIONS_ET_POINTS_A_VALIDER.md`
8. `docs/CLOUDFLARE_GITHUB_DEPLOYMENT.md`
9. `docs/DECISIONS_PRODUIT_RESTANTES.md`
10. `docs/PLAN_VALIDATION_DESTRUCTION_GPS_J30.md`
11. `docs/SECURITE_GPS_DESTRUCTION_CRYPTO.md`
12. `docs/MISE_A_JOUR_JURIDIQUE_NIGER_NOV_2026.md`
13. `docs/ANALYSE_JURIDIQUE_NIGER_SAC_2026-11-18_COMPLEMENT.md`
14. `docs/CONFORMITE_DONNEES_NIGER.md`
15. `docs/AUDIT_DEPENDANCES_ET_REPRODUCTIBILITE.md`
16. `docs/CONSOLIDATION_GENERALE_SAC.md`
17. `docs/DECISIONS_COMPLEMENTAIRES_2026-11-18.md`
18. `docs/CONSOLE_PROFESSIONNELLE_ET_SERVICES.md`
18. `docs/PLAN_DIRECTEUR_REALISATION_SAC.md`
19. `docs/ANNEXE_MODELE_DONNEES_SERVICES_PROFESSIONNELS.md`
20. `docs/AUDIT_ETAT_REEL_CODE_2026-11-18.md`
21. `docs/PLAN_SOCLE_COMPTE_SESSIONS_APPAREILS.md`
23. `docs/AUDIT_TRANSVERSAL_COHERENCE_ARCHITECTURE_2026-11-18.md`
22. `docs/ARBITRAGES_TECHNIQUES_COMPTES_OTP_SESSIONS.md`
23. `docs/DECISION_CLE_SECURITE_OPTIONNELLE_2026-11-21.md`

Avant toute intervention, lis aussi les cinq documents de consolidation ajoutés à la liste obligatoire, dont l'audit de l'état réel du code. Pour les sujets qu'il couvre, `docs/DECISIONS_COMPLEMENTAIRES_2026-11-18.md` remplace les anciennes formulations relatives à l'identité visuelle, aux langues de lancement, à la console mobile, à la gouvernance des délégations et au kit de récupération. En cas de conflit non couvert ou ambigu, ne tranche pas seul : demande validation.

## Stack verrouillée
- React
- Vite
- TypeScript
- Tailwind CSS
- Lucide React
- API REST séparée via Cloudflare Pages Functions
- PWA en premier
- Capacitor prévu pour Android/iOS ultérieurement, sans réécriture
- Adaptateurs des capacités du terminal dans `src/services/device/`

Ne remplace pas cette stack par Next.js, Vue, Angular, Svelte, JavaScript non typé ou une autre architecture. N'ajoute pas un second backend ou un second dépôt. Les changements de stack exigent une validation explicite de l'utilisateur.

## Collaboration
Claude, Qwen et les autres assistants autorisés travaillent sur les mêmes références et l'unique branche `main`. Avant chaque écriture, vérifie le dernier commit. Ne crée jamais de branche. Évite les modifications concurrentes et n'écrase jamais le travail d'un autre agent.

## Discipline
- Audit avant modification ; diff limité et expliqué.
- Pas de mock, données fictives ou succès simulé.
- Pas de suppression ou refactorisation non autorisée.
- Pas de secret ni donnée personnelle réelle dans Git.
- Respect absolu des règles de sécurité et de confidentialité du cahier des charges.
- Tests et CI seulement déclarés réussis après vérification réelle.
- En cas de contradiction entre le code et les décisions, ne tranche pas seul : documente et demande validation.

## Points de vigilance obligatoires au 18 novembre 2026

- **GPS J+30 :** l'historique GPS précis est NO-GO. Aucune conservation durable, archive, API, migration, synchronisation ou connexion à un flux GPS réel ne doit être implémentée avant preuve des scénarios critiques et arbitrage produit explicite. Les primitives cryptographiques présentes sont expérimentales, non branchées à l'application et ne prouvent pas la destruction J+30.
- **Sauvegardes mobiles :** les exclusions Android/iOS sont des mesures de réduction du risque, pas une preuve d'effacement irréversible. Respecter le plan GPS-01 à GPS-36 ; aucun test natif ne doit être déclaré exécuté sans appareils et preuves réelles.
- **Droit nigérien :** l'ancienne HAPDP a été supprimée selon les informations publiées par l'ANP le 12 juin 2026. Ne pas la présenter comme autorité opérationnelle ni envoyer de formalité à son ancien contact. L'ordonnance 2026-30 et le décret de suppression doivent encore être authentifiés sur le Journal officiel ; ne pas extrapoler les obligations actuelles à partir des seuls textes historiques.
- **Picomatch :** GHSA-fc5q-39xc-vjpf / CVE-2026-112366 est toujours sans version corrigée publiée vérifiée. Les PR amont examinées sont ouvertes ; ne pas ajouter de commit non publié, override artisanal, ignorer l'audit ou forcer une rétrogradation.
- Les changements documentaires n'autorisent pas une modification de code, une migration D1, une ressource Cloudflare, une intégration fournisseur ou un déploiement.

- **Bundles ECDH :** avant d'accepter un bundle signé, vérifier la structure JWK, importer effectivement la clé publique ECDH P-256 avec WebCrypto pour faire valider le point de courbe, puis vérifier la signature sous une identité déjà ancrée indépendamment. Le test du point (0,0) doit rester dans la suite adversariale. Une signature auto-incluse ne prouve jamais l'identité du propriétaire.

- **Cérémonie multi-appareils :** le certificat secondaire expérimental actuel ne lie pas encore le défi serveur, le nonce du nouvel appareil, l'identifiant de cérémonie et l'expiration. Ne pas l'intégrer à une API d'approbation. Exiger un transcript canonique versionné signé par la racine et une consommation atomique du défi avant toute implémentation serveur.


## Interface, langues et direction visuelle

- Tous les textes visibles par l'utilisateur doivent être centralisés dans `src/i18n/translations.ts` ; ne pas ajouter de textes métier directement dans les composants.
- Langues de lancement : français, anglais et arabe. L'arabe exige une interface RTL réelle, pas uniquement une traduction des libellés.
- Toute nouvelle page ou tout nouveau composant doit utiliser les traductions et respecter `dir="rtl"` sans casser les parcours LTR.
- Conserver le vert clair effet verre dépoli, le blanc, le rouge d'alerte et un vert de confirmation distinct. Aucun violet ni bleu nuit comme couleur principale.
- Les codes hexadécimaux présents dans le thème sont des valeurs initiales de mise en œuvre ; ils ne doivent pas être présentés comme une charte définitive validée.


## Gouvernance administrative SAC — lecture obligatoire avant tout travail concerné

Avant de concevoir ou modifier des rôles, permissions, missions, comptes administratifs, sessions administratives, exports, journaux d'audit ou clôtures administratives, lire les documents suivants :

- `docs/PLAN_SOCLE_COMPTE_SESSIONS_APPAREILS.md`
- `docs/ARBITRAGES_TECHNIQUES_COMPTES_OTP_SESSIONS.md`
- `docs/CATALOGUE_RESSOURCES_MATRICE_PERMISSIONS.md`
- `docs/CLASSIFICATION_DONNEES_ET_ACCES_ADMIN.md`
- `docs/GOUVERNANCE_MISSIONS_ADMIN_ET_CYCLE_DE_VIE.md`

Règles pour les agents :
- Ne jamais considérer une proposition marquée « à valider » comme une décision approuvée.
- Ne pas créer de compte administratif, permission, mission, endpoint, middleware, table ou migration D1 sans autorisation explicite.
- Ne pas élargir les droits pour contourner un point non arbitré ; appliquer le refus par défaut.
- Toute implémentation future doit inclure des tests positifs et négatifs, une revue de sécurité et une vérification des effets de révocation côté serveur.
- Ne jamais exposer ou journaliser OTP, mots de passe, clés privées, jetons bruts, secrets de récupération ou GPS précis.


Complément obligatoire pour tout travail administratif ou de sécurité : lire également `docs/MODELE_MENACES_ET_PLAN_SECURITE_ADMIN.md`. Toute implémentation doit traiter les scénarios de menace, les frontières de confiance et les critères de passage en production qui y sont définis. Les exigences documentaires ne prouvent pas que les contrôles existent déjà.


Avant toute conception ou modification d'opérations administratives, lire également `docs/CONTRATS_OPERATIONS_ADMIN_ATOMIQUES.md`. Respecter ses préconditions, contrôles transactionnels, règles d'idempotence et tests de concurrence. Ne jamais considérer ce contrat documentaire comme une autorisation d'implémenter.


Avant toute évolution du schéma, des comptes administratifs, missions, permissions, sessions, audits, clôtures ou exports, lire `docs/MODELE_DONNEES_ADMIN_ET_INTEGRATION_SAC.md`. Vérifier les incohérences identifiées et ne pas figer les points « à arbitrer ». Ce document ne vaut pas autorisation de migration.


## Référentiel global des données

Avant toute évolution du modèle relationnel, lire `docs/MODELE_GLOBAL_DONNEES_SAC.md`, puis les contrats spécialisés qu'il référence. Le nom conceptuel canonique de l'identité est `accounts` ; ne pas créer une seconde table d'identité `users` pour l'administration. Les tables mentionnées comme « à ajouter » ou « conditionnelles » ne sont pas approuvées pour SQL. Le modèle reste NON PRÊT POUR MIGRATION.


Avant toute proposition SQL ou migration, lire aussi `docs/REVUE_FINALE_COHERENCE_MODELE_RELATIONNEL.md`. Son verdict est NON PRÊT POUR MIGRATION. Ne pas transformer les recommandations P0/P1 en décisions produit sans validation. Aucun SQL ne doit être créé sur la seule base de la carte globale.


Avant toute modification du cycle de compte ou des invitations de proches, lire `docs/ARBITRAGE_P0_CYCLE_COMPTE_ET_PREUVE_PROCHES.md` et `docs/CONTRAT_CYCLE_VIE_PROCHES_ET_INVITATIONS.md`. Toute inscription exige une adresse e-mail ; l'OTP e-mail est une condition sine qua non de l'activation ; aucun compte ne peut être créé/activé par téléphone seul. Tout proche qui devient un contact SAC actif doit donc disposer d'un compte SAC actif avec e-mail vérifié ; le téléphone déclaré et les SMS ne remplacent ni cette condition ni le consentement. Le contrat distingue les invariants validés des propositions à arbitrer : ne jamais implémenter une proposition comme une décision approuvée. Lire aussi `docs/PROPOSITIONS_ARBITRAGE_INVITATIONS_ET_REVOCATION.md` pour les valeurs par défaut proposées ; aucune n'est approuvée sans confirmation explicite. Ne pas modifier le code, les tests ou D1 sans autorisation distincte.

Avant toute conception ou modification de la conservation, suppression, pseudonymisation, export ou restauration des données non GPS, lire `docs/PROPOSITION_POLITIQUE_GENERALE_CONSERVATION_DONNEES.md` ainsi que le contrat spécialisé des alertes/GPS. Les durées de la proposition restent non approuvées ; ne créer aucune purge, table, API ou migration sans arbitrage explicite et autorisation distincte. Une restauration doit respecter les suppressions/révocations déjà intervenues et ne jamais réactiver silencieusement une ressource.

Avant toute modification du cycle de suppression d'un compte, lire `docs/CONTRAT_PROPOSE_SUPPRESSION_COMPTE_ET_CAS_PARTICULIERS.md`. Distinguer les règles déjà validées des propositions « à confirmer ». Ne pas ajouter de transition aux cinq états, de procédure de secours, de mode de clôture restreint, de purge ou de migration sans arbitrage explicite et autorisation distincte. La suppression ne doit jamais clôturer automatiquement une alerte ni un trajet.

Avant toute évolution des appareils, sessions ou récupération, lire `docs/CONSOLIDATION_APPAREILS_SESSIONS_ET_RECUPERATION.md` avec les contrats détaillés qu'il référence. Ne jamais confondre récupération du compte, enrôlement d'un appareil et remplacement de la racine. La récupération de racine est interdite en V1 ; les facteurs de récupération d'accès et le renouvellement de session restent à arbitrer. Ne pas implémenter une option présentée comme proposition.

Pour toute évolution de l'authentification ou des sessions, lire `docs/PROPOSITION_SECURITE_CONNEXIONS_ET_SESSIONS.md`. Les seuils anti-abus, le transport, le refresh token, la réaction au rejeu et les notifications sont des propositions non validées. Ne pas les implémenter ni choisir un fournisseur sans arbitrage et autorisation explicite. Préserver les durées validées 30 jours d'inactivité / 90 jours maximum, la séparation compte/racine et l'interdiction de remplacement de racine en V1.


Pour toute conception ou modification de consultation interne, classification des données, recherche, export ou journal d'audit, lire également `docs/CONTRAT_PROTECTION_DONNEES_ACCES_INTERNES_ET_AUDIT.md`. Appliquer le refus par défaut, la minimisation côté serveur, la séparation lecture/export et l'audit des consultations sensibles. Le scellement externe, les durées, le break-glass et les contrôles indépendants du Super Admin restent à arbitrer. Ce contrat n'autorise aucune implémentation.


Avant toute conception ou évolution du déclenchement, de l'accès, des réponses, des notifications, de la chronologie ou de la clôture SOS, lire `docs/CONTRAT_SECURITE_CYCLE_SOS_ET_INTEGRITE_ALERTES.md` avec les contrats SOS spécialisés. Préserver les destinataires figés, la clôture normale par l'auteur avec l'exception administrative étroite définie dans `docs/CONTRAT_CLOTURE_EXCEPTIONNELLE_ADMINISTRATIVE_SOS.md`, les rappels toutes les cinq minutes et la purge GPS à la clôture/J+30. Ne jamais transformer une proposition anti-abus ou d'idempotence en implémentation sans arbitrage et autorisation distincte. Le contrat ne prouve aucun contrôle opérationnel.


Avant toute conception ou évolution des notifications push, e-mails, SMS, abonnements d'appareils, webhooks ou fournisseurs, lire `docs/CONTRAT_SECURITE_NOTIFICATIONS_ET_COMMUNICATIONS.md` avec les contrats SOS, invitations, sessions et confidentialité. Ne jamais traiter un numéro déclaré comme vérifié, une acceptation fournisseur comme une livraison ou une lecture, ni un lien de notification comme une autorisation. Aucun canal réel, secret, endpoint, fournisseur ou stockage ne peut être activé par ce document.


Avant toute conception ou évolution des trajets, de la vérification d'arrivée, de l'accompagnement, du partage de position ou des permissions GPS, lire `docs/CONTRAT_SECURITE_TRAJETS_ET_LOCALISATION.md` avec les contrats de conservation GPS J+30, SOS, communications et confidentialité. Ne jamais activer une collecte GPS réelle tant que le NO-GO J+30 et la non-résurrection après restauration ne sont pas levés par preuves et autorisation explicite. Les durées proposées ne sont pas des décisions validées.


Avant toute conception ou modification de récupération de compte, perte/vol d'appareil, sécurisation d'urgence, changement d'e-mail, révocation globale ou remplacement d'appareil, lire `docs/CONTRAT_SECURITE_COMPTES_ET_APPAREILS_EN_URGENCE.md` avec la consolidation appareils/sessions, le plan socle compte, les arbitrages OTP et les contrats SOS. Ne jamais confondre récupération du compte et récupération de la racine. En V1, aucune racine perdue ou compromise ne peut être remplacée par OTP, mot de passe, support, Super Admin ou appareil secondaire. Les parcours décrits comme propositions ne sont pas implémentables sans arbitrage et autorisation distincte.


Avant toute évolution des proches, groupes, vues d'alertes, notifications, caches, stockage local, partage familial, pièces jointes ou exports, lire `docs/CONTRAT_CONFIDENTIALITE_FAMILIALE_ET_ISOLATION_DONNEES.md` avec les contrats de confidentialité interne, proches, groupes, appareils, SOS, trajets et communications. Ne jamais déduire un droit d'accès du lien familial, du partage d'un téléphone ou de l'appartenance à un groupe. Chaque compte est une sphère privée distincte ; appliquer les contrôles côté serveur et l'isolation par compte/appareil. Les propositions de verrouillage local, d'aperçus et de stockage ne sont pas des décisions approuvées. Aucun code, stockage, D1, notification ou déploiement sans autorisation distincte.


Avant toute conception ou évolution des limites de débit, anti-bot, invitations, OTP, signalements, détection d'abus, mesures de sécurité, WAF, quotas ou disponibilité SOS, lire `docs/CONTRAT_PREVENTION_ABUS_USURPATION_ET_SATURATION.md` avec les contrats SOS, communications, invitations, comptes/appareils et accès internes. Ne jamais bloquer automatiquement un SOS uniquement à cause d'alertes répétées ; ne pas mettre de CAPTCHA, paiement ou dépendance fournisseur dans le chemin critique par défaut. Les seuils d'invitation déjà proposés restent non approuvés. Aucun anti-abus, seuil, WAF, code, migration, fournisseur ou déploiement sans arbitrage et autorisation distincte.


Avant toute conception ou modification de la disponibilité, du réseau faible/hors ligne, des workers/outbox, sauvegardes, restauration, reprise après incident, health checks ou objectifs de service, lire `docs/CONTRAT_RESILIENCE_CONTINUITE_ET_REPRISE_INCIDENT.md` avec les contrats SOS, notifications, D1, conservation et anti-abus. Ne jamais présenter `/api/health` comme preuve que le SOS fonctionne. Aucune file locale ne peut annoncer un SOS transmis sans confirmation serveur. Toute restauration doit réconcilier les révocations et suppressions et prouver la non-résurrection GPS/alertes avant remise en service. Aucun code, D1, ressource Cloudflare, fournisseur ou déploiement sans autorisation distincte.


Avant toute conception ou activation de traitement personnel réel, lire `docs/CONTRAT_GOUVERNANCE_JURIDIQUE_ET_CONFORMITE.md`, `docs/MISE_A_JOUR_JURIDIQUE_NIGER_NOV_2026.md`, `docs/ANALYSE_JURIDIQUE_NIGER_SAC_2026-11-18_COMPLEMENT.md` et `docs/CONFORMITE_DONNEES_NIGER.md`. Ne pas présenter l'ancienne HAPDP comme autorité actuelle : sa suppression et le transfert de ses missions ont été rapportés en juin 2026, mais les textes authentiques de l'ordonnance 2026-30 et les circuits ministériels doivent être vérifiés. Aucune formalité, durée hors GPS, base juridique, règle mineur, région d'hébergement ou transfert international ne doit être supposé conforme. Aucune collecte réelle, formalité, contractualisation fournisseur ou mise en production sans validation juridique et autorisation distincte.


Avant toute modification du projet, lire `docs/AUDIT_TRANSVERSAL_COHERENCE_ET_MATURITE_2026-11-18.md` comme synthèse des blocages et contradictions documentaires. Respecter les sources de vérité spécialisées. Ne pas réintroduire la règle GPS obsolète « 30 jours après fin du partage » : pour les alertes SOS, GPS supprimé dès clôture, catégorie seule 30 jours, alerte/catégorie purgées à J+30 ; GPS de trajet séparé et durée non décidée. Le cycle compte cible a cinq états, mais le contrat TypeScript existant n'en supporte encore que trois : ne pas migrer D1 avant réconciliation. Le SOS réel, l'authentification complète, les fournisseurs et le GPS ne sont pas opérationnels simplement parce qu'ils sont documentés.


Avant toute conception ou évolution de la clôture exceptionnelle d'une alerte SOS, lire `docs/CONTRAT_CLOTURE_EXCEPTIONNELLE_ADMINISTRATIVE_SOS.md`. Préserver la règle générale de clôture par l'auteur et l'exception étroite déjà validée pour un auteur suspendu dans le scénario de suspicion d'abus ou de perte/compromission du téléphone. Aucun administrateur sans permission nominative attribuée par le Super Admin ne peut clôturer ; le délégataire ne peut jamais transmettre cette permission. Ne pas élargir cette exception et ne pas considérer le contrat pur `src/domain/alert-lifecycle.ts` comme une autorisation serveur.


Pour tout travail sur le cycle de suppression, lire `docs/RECOMMANDATIONS_ARBITRAGE_FINAL_SUPPRESSION_COMPTES.md` avec `docs/CONTRAT_PROPOSE_SUPPRESSION_COMPTE_ET_CAS_PARTICULIERS.md`. Les recommandations restent non approuvées : ne pas les coder, ne pas créer de sixième état et ne pas modifier D1 sans arbitrage et autorisation distincte. Préserver les cinq états validés, la suspension sans session générale, la non-clôture automatique des alertes/trajets et la règle de purge GPS.

## Mémoire technique — compte, profils et relations réciproques (2026-11-21)

- Les migrations `0018_account_profiles_privacy_proximity.sql` et `0019_account_contact_change_guards.sql` ajoutent profils, confidentialité, annuaire, invitations de proximité, relations réciproques, permissions par relation, changements d'e-mail/téléphone contrôlés par défi et journal d'activité append-only.
- Les relations `close_relations` / « Mes proches » sont distinctes des `trusted_contacts` utilisés comme destinataires SOS. Ne pas les fusionner sans arbitrage produit et validation de sécurité : l'acceptation d'une relation de proximité ne vaut pas consentement à recevoir des alertes SOS.
- Les tests D1 d'intégration doivent utiliser un état local isolé (`--persist-to` vers un répertoire temporaire). Sans cela, les données de exécutions précédentes provoquent des collisions d'unicité.
- `npm run test:webauthn-workers` exige la dépendance temporaire `@simplewebauthn/server@14.1.0`, installée par la CI avec `npm install --no-save --package-lock=false`. Elle n'est pas une dépendance applicative.
- Le cache des photos de profil est `private, no-cache` et les URL de photo ne sont renvoyées que si une photo existe réellement et si la confidentialité ou la permission de relation l'autorise.
- Le changement de téléphone est contrôlé par un OTP envoyé à l'e-mail vérifié ; le numéro reste « déclaré, non vérifié ». Aucun OTP SMS n'est implémenté.
- Les migrations 0018 et 0019 ne sont pas appliquées à la base D1 distante par le code ou les tests locaux ; leur application exige une autorisation distincte.
- `src/domain/account-lifecycle.ts` supporte désormais les cinq états (`pending_verification`, `active`, `suspended`, `deletion_pending`, `deleted`) ; la phrase antérieure indiquant qu'il n'en supporte que trois est obsolète.
- L'acceptation d'une invitation de proximité ne partage automatiquement ni la photo ni les coordonnées. Chaque permission doit être accordée explicitement, conformément à `docs/CONTRAT_CONFIDENTIALITE_FAMILIALE_ET_ISOLATION_DONNEES.md`.

## Mémoire technique — connexion biométrique (2026-11-21)

- La page `/connexion` propose un bouton de connexion par clé de sécurité si un identifiant de credential non secret est mémorisé localement. Le bouton déclenche une cérémonie WebAuthn puis redirige vers l’espace demandé.
- `POST /api/auth/login-options` accepte `{ credentialId }` sans e-mail ni mot de passe ; il exige un compte actif, un appareil actif et une credential racine existante. Un identifiant inconnu retourne `invalid_credentials` sans révéler son existence.
- `GET /api/auth/session` renvoie l’identifiant de credential de l’appareil courant à une session authentifiée. Le client le mémorise après enrôlement ou connexion par mot de passe.
- Cette credential n’est pas discoverable : l’effacement du stockage local exige une reconnexion par mot de passe pour réafficher le bouton. Aucune migration D1 n’est nécessaire pour ce raccourci.
