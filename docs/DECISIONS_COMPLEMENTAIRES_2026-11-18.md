# SAC — Décisions complémentaires et mises à jour produit

**Date :** 18 novembre 2026  
**Statut :** complément au registre principal ; les décisions ci-dessous reflètent les validations les plus récentes connues.  
**Portée :** ce document met à jour uniquement les sujets explicitement indiqués. Il ne remplace pas l'ensemble de `docs/DECISIONS_ET_POINTS_A_VALIDER.md`.

## 1. Priorité et effet de remplacement

Pour les sujets couverts ici, ce document prévaut sur les formulations plus anciennes :
- identité visuelle : remplace l'ancienne palette bleu nuit ;
- langues de lancement : remplace l'ancienne liste de langues de lancement ;
- console professionnelle mobile : précise la séparation citoyen/professionnel ;
- gouvernance des missions : précise le pouvoir exclusif du Super Admin ;
- récupération hors ligne : précise la gestion du kit de récupération.

Les autres décisions du registre principal restent inchangées.

## 2. Identité visuelle — décision la plus récente

**Décision validée :** remplacer le bleu nuit par un vert clair avec effet verre dépoli (Glassmorphism).

Palette et usages :
- vert clair : couleur principale de l'identité, surfaces translucides ;
- blanc : lisibilité et surfaces ;
- rouge : réservé aux alertes et à l'urgence ;
- vert de confirmation : nuance distincte du vert clair principal ;
- aucun violet ;
- aucun bleu nuit comme couleur principale.

Direction d'interface :
- verre dépoli maîtrisé, transparence modérée ;
- bordures claires discrètes et ombres douces ;
- lisibilité et contraste prioritaires ;
- effets décoratifs limités ;
- boutons accessibles au pouce et parcours mobile simples ;
- même identité sur les écrans, avec console professionnelle plus sobre et structurée.

Les valeurs hexadécimales évoquées comme exemples sont des propositions et ne sont pas des tokens définitifs tant qu'elles ne sont pas validées.

## 3. Langues — décision la plus récente

Langues de lancement :
1. Français — langue par défaut.
2. Anglais.
3. Arabe — interface complète en RTL (sens de lecture, alignement, navigation, composants et mise en page).

Hausa et Zarma sont prévues comme extensions ultérieures. Leur présence dans d'anciens documents ne doit pas être interprétée comme une exigence de lancement avant le français, l'anglais et l'arabe.

Les traductions des messages d'urgence doivent être relues et validées avec soin. La structure doit permettre d'ajouter des langues sans disperser les textes métier dans les composants.

## 4. Récupération de compte — kit personnel hors ligne

**Décision produit :** un kit de récupération personnel unique est généré localement et présenté une seule fois à l'utilisateur.

Principes :
- le secret brut n'est jamais envoyé au serveur ni stocké en clair ;
- SAC ne conserve qu'un vérificateur adapté, sans secret récupérable ;
- le kit est à usage unique ;
- après récupération réussie, l'ancien kit est invalidé ;
- un nouveau kit est généré depuis une session/appareil approuvé selon le parcours autorisé ;
- le kit récupère l'accès au compte, pas l'ancienne identité cryptographique racine ;
- OTP email, mot de passe, support, pièce d'identité et contacts de confiance ne remplacent pas la preuve cryptographique de continuité.

Conseils de conservation validés dans l'audit documentaire du 18 novembre :
- méthode recommandée : papier dans une enveloppe verrouillée, séparée du téléphone ;
- ne pas le conserver dans le portefeuille ou la coque du téléphone ;
- ne pas le photographier, scanner, envoyer par email/SMS, stocker dans galerie, notes, cloud ou dossier partagé ;
- éviter les ordinateurs et imprimantes publics ;
- une clé USB ou un gestionnaire synchronisé ne sont pas des options par défaut ;
- en cas de perte ou de suspicion de copie, remplacer le kit depuis un appareil approuvé sûr et détruire les copies connues.

SAC ne peut pas vérifier matériellement que l'utilisateur a conservé le kit de façon sûre. Aucune fonctionnalité de stockage ou de transfert du kit n'est autorisée.

## 5. Identité cryptographique et appareils

Décisions confirmées :
- un compte peut utiliser plusieurs appareils ;
- chaque appareil possède ses propres sessions et clés privées locales ;
- le premier appareil racine approuvé est l'unique appareil autorisé à approuver les nouveaux appareils dans le modèle retenu ;
- les appareils secondaires ne peuvent pas approuver d'autres appareils ni se promouvoir racine ;
- récupérer l'accès au compte ne restaure pas l'ancienne identité cryptographique ;
- après perte de tous les appareils approuvés, une nouvelle identité racine doit être créée localement ;
- les proches concernés doivent vérifier indépendamment la nouvelle empreinte avant tout nouveau partage GPS avec eux ;
- la révocation serveur invalide les droits futurs de l'appareil mais ne peut pas effacer à distance les données d'un appareil hors ligne.

Le protocole cryptographique, le jumelage, les API et les tests adversariaux ne sont pas considérés comme finalisés ou déployés. Les garde-fous plus précis de `AGENTS.md` restent obligatoires.

## 6. Application citoyenne et console professionnelle

**Décision produit :** l'application citoyenne et la console professionnelle sont deux expériences séparées.

- La console professionnelle est destinée aux ordinateurs et tablettes.
- Sur téléphone, même un Super Admin ou un collaborateur utilise uniquement l'application citoyenne.
- L'URL directe de la console depuis un téléphone doit être refusée côté serveur, pas seulement masquée dans l'interface.
- La détection du type d'appareil n'est pas infaillible ; utiliser plusieurs signaux et contrôles serveur sans promettre une protection impossible à contourner.

### Les onze espaces principaux de la console

1. Vue d'ensemble.
2. Utilisateurs.
3. Alertes.
4. Finances.
5. Assistance.
6. Sécurité.
7. Équipe et missions.
8. Relations externes.
9. Ressources.
10. Pilotage.
11. Paramètres.

Les fonctions secondaires doivent être regroupées dans ces espaces, onglets ou sous-menus. Ne pas créer un nouveau menu principal pour chaque service ou fonctionnalité.

## 7. Gouvernance et délégations

**Décision ferme : seul le Super Admin peut créer, attribuer, modifier, suspendre ou retirer les missions, délégations et permissions.**

Les collaborateurs :
- ne peuvent pas déléguer à leur tour ;
- ne peuvent pas attribuer de tâches à d'autres personnes ;
- ne peuvent pas modifier leurs propres permissions ;
- ne peuvent pas créer un administrateur ;
- ne peuvent pas s'accorder un accès à un autre service ;
- ne peuvent pas publier une communication institutionnelle sans autorisation explicite.

Chaque mission est limitée aux permissions explicitement accordées. Un collaborateur peut recevoir plusieurs missions, mais cela n'élargit pas automatiquement ses accès.

L'appartenance à un service ou à un groupe ne constitue jamais une permission générale. Les vérifications sont côté serveur et les actions sensibles sont historisées.

## 8. Équipe et missions — fonctions intégrées

Ces fonctions restent regroupées dans « Équipe et missions » et ne créent pas de nouveaux menus principaux :
- communication interne et conversations ;
- groupes de travail créés ou contrôlés par le Super Admin ;
- réunions, invitations et réponses de présence ;
- calendrier d'équipe ;
- notifications et rappels ;
- rapports d'avancement ;
- tâches et sous-tâches ;
- évaluation des missions ;
- objectifs et résultats ;
- profils de compétences ;
- formations ;
- absences et disponibilités ;
- bibliothèque documentaire d'équipe.

Les collaborateurs ne peuvent pas utiliser ces outils pour se déléguer du travail ou élargir leurs permissions.

Certaines modalités détaillées, notamment validation des congés, délais de rappels et politique de conservation des conversations, restent des propositions à confirmer avant implémentation.

## 9. Secrétariat — règles confirmées et propositions

Décisions confirmées :
- la secrétaire peut planifier des rendez-vous pour le Super Admin ;
- le Super Admin confirme, annule ou reporte ;
- la secrétaire voit la décision et informe le visiteur ;
- elle peut recevoir, classer et transmettre des documents ;
- elle peut imprimer depuis son espace sur ordinateur/tablette, sous réserve des capacités et autorisations du navigateur ;
- les visiteurs sans rendez-vous peuvent être reçus directement et ne doivent pas obligatoirement être enregistrés.

Limites :
- compte individuel et permissions limitées ;
- pas d'accès automatique aux finances, aux données privées des citoyens ou aux dossiers confidentiels ;
- pas de pouvoir d'approuver à la place du Super Admin ni de créer des délégations.

**Proposition non confirmée :** la secrétaire pourrait préparer certains courriers et documents administratifs pour validation du Super Admin avant impression ou transmission. Ne pas traiter cette proposition comme une décision déjà approuvée.

## 10. Documents et archivage — règle confirmée

Tout document généré et imprimé est archivé automatiquement dans sa rubrique d'origine.

Règle opérationnelle retenue :
- archiver dès la génération, même si l'impression échoue ;
- conserver référence, date, auteur, service, version et statut ;
- distinguer génération, validation, émission, impression demandée et impression confirmée/échouée ;
- les corrections et réimpressions créent une version traçable ;
- ne jamais écraser silencieusement un document ;
- utiliser un service documentaire central, pas une archive indépendante par service.

La confirmation d'impression ne doit pas être déduite de la simple ouverture de la boîte de dialogue d'impression.

Les politiques de conservation s'appliquent aux documents. L'archivage ne doit jamais contourner la règle GPS J+30.

## 11. Services professionnels prévus

Les services sont intégrés aux onze espaces, sans multiplier le menu principal :
- Direction et supervision.
- RH.
- Comptabilité et finances.
- Logistique.
- Secrétariat.
- Juridique et conformité.
- DSI.
- Assistance.
- Relations externes.
- Pilotage.

Aucun service distinct « Communication / Relations publiques / Image institutionnelle » n'est ajouté.

### Règles transversales

- Les données sont saisies une seule fois et référencées entre services.
- Les opérations logistiques alimentent la comptabilité via des références communes.
- Les données salariales, bancaires, disciplinaires, médicales et les alertes privées ont des permissions spécifiques.
- Les services ne disposent pas d'un accès général aux données citoyennes.
- Les fournisseurs externes n'obtiennent que les données nécessaires à leur prestation.
- Les statistiques de supervision proviennent de données réelles ; aucune donnée fictive en production.

## 12. Modèle documentaire et assistants IA

Le travail d'architecture, les décisions et les règles de sécurité doivent être conservés dans le dépôt GitHub `benwahab/SAC`, afin que Claude, Qwen et les autres assistants autorisés puissent reprendre le travail.

Règles :
- branche `main` uniquement ;
- aucun dépôt parallèle ni branche secondaire ;
- lecture obligatoire de `AGENTS.md`, `README.md` et des références listées ;
- audit du dernier commit avant chaque écriture ;
- aucun changement de code applicatif, migration D1, ressource Cloudflare, fournisseur ou déploiement sans autorisation explicite ;
- ne jamais déclarer une fonctionnalité implémentée sur la seule base d'une spécification ;
- signaler les fichiers modifiés, les contrôles exécutés et les limites.

## 13. Historique de cette mise à jour

| Date | Mise à jour |
|---|---|
| 18 novembre 2026 | Nouvelle identité vert clair effet verre dépoli ; lancement français/anglais/arabe RTL ; précision du kit de récupération hors ligne ; règles de console mobile ; gouvernance Super Admin ; archivage central ; organisation des services. |

Toute décision ultérieure qui modifie ces règles doit être ajoutée avec sa date et son statut.