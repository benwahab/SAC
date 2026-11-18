# SAC — Recherche complémentaire : destruction GPS J+30 et textes nigériens

**Date de recherche : 18 novembre 2026**  
**Statut : recherche documentaire complémentaire ; aucune architecture de destruction J+30 ni analyse juridique finale approuvée.**

## 1. Résultat principal sur la destruction GPS

La recherche confirme qu'une suppression dans la base principale ou une programmation de suppression ne suffit pas à établir une destruction irréversible.

Le NIST précise que la destruction des clés n'est complète qu'une fois toutes les copies détruites, y compris les copies de sauvegarde et d'archive. L'OWASP rappelle également qu'une copie de clé conservée en mémoire, dans un backup, un escrow ou une archive peut maintenir la possibilité de déchiffrement. Une simple suppression du matériel enveloppé ou de sa référence ne suffit donc pas.

Références :
- NIST SP 800-57 Part 2 Rev. 1, section 6.2.12 — destruction de clés et copies de sauvegarde : https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-57pt2r1.pdf
- NIST SP 800-57 Part 1 Rev. 5 — sauvegarde, archivage et récupération de clés : https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-57pt1r5.pdf
- OWASP Key Management Cheat Sheet — destruction et effacement cryptographique : https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html

Une étude sur les appareils hors tension relève explicitement qu'une tâche programmée ne garantit pas l'effacement si l'appareil est éteint à l'échéance. Elle conclut que la clé ne doit pas être conservée uniquement sur l'appareil ni uniquement sur le serveur destinataire ; elle doit être gérée par un mécanisme externe. Cette recherche académique est une piste de conception, pas une preuve d'implémentation sûre pour SAC :
- Keeping Data Secret under Full Compromise Using Porter Devices : https://www.researchgate.net/publication/221046447_Keeping_data_secret_under_full_compromise_using_porter_devices

## 2. Conséquence pour SAC : incompatibilité à résoudre

La règle SAC est que les positions GPS historiques sous contrôle de SAC ne puissent plus être rendues lisibles après 30 jours, y compris après restauration de sauvegarde, restauration D1/Time Travel, réinstallation ou retour d'horloge.

Deux objectifs entrent en tension :
- permettre de lire l'historique GPS hors ligne pendant les 30 jours ;
- garantir qu'aucune copie de clé conservée sur l'appareil ne permette une lecture après J+30, même si l'appareil est resté éteint.

Si une clé de déchiffrement utilisable est disponible durablement sur l'appareil, une copie de cette clé pourrait être restaurée ou réutilisée après l'échéance. Si l'accès à la clé dépend d'un service externe, une connexion à ce service peut être nécessaire pour relire l'historique ; le mode hors ligne n'est alors pas garanti.

**Aucune décision produit ne doit être déduite de cette tension.** Elle doit être soumise à un arbitrage explicite. Tant qu'une preuve technique ne démontre pas les deux propriétés, l'archive historique GPS ne doit pas être activée. La solution de repli sûre reste de ne conserver aucun historique GPS précis : uniquement le partage en direct éphémère jusqu'à sa fin.

Le périmètre de la garantie reste les données sous contrôle de SAC. Les copies éventuellement conservées par les destinataires ne sont pas effaçables par SAC et ne doivent pas être présentées comme couvertes par la garantie.

## 3. Architecture candidate à tester — sans validation

Une architecture à deux composantes de clé peut être étudiée :
1. le téléphone conserve le ciphertext GPS et une composante locale non exportable ;
2. un service de clés indépendant conserve une seconde composante, sans recevoir ni stocker les coordonnées GPS en clair ;
3. la reconstruction de la clé nécessite les deux composantes et une autorisation serveur vérifiée à chaque accès ;
4. après J+30, la seconde composante doit être détruite dans toutes ses copies récupérables, y compris sauvegardes, archives, répliques, export et procédures de reprise ;
5. aucune composante complète ne doit avoir été mise en cache ou exportée vers le téléphone avant l'échéance.

Risques à traiter avant toute expérimentation :
- le cache ou la copie mémoire d'une clé complète ;
- la restauration d'une sauvegarde ou d'un snapshot du service de clés ;
- la restauration administrative ou l'annulation d'une destruction ;
- les copies internes du fournisseur, les délais de purge et la reprise après sinistre ;
- l'indisponibilité réseau avant J+30 ;
- les accès concurrents à la limite exacte J+30 ;
- les copies en mémoire, fichiers temporaires, journaux, crash reports et exports ;
- la possibilité pour un administrateur ou un opérateur de restaurer une clé échue.

Le service externe ne doit jamais recevoir de latitude, longitude, itinéraire ou payload GPS en clair. Le choix d'un fournisseur, la création d'un compte cloud, d'un KMS, d'une ressource ou d'une API restent interdits sans autorisation explicite.

## 4. Conditions de validation renforcées

Le test de destruction doit distinguer :
- **refus d'accès après expiration** par les interfaces normales ;
- **non-récupérabilité cryptographique** malgré une sauvegarde ancienne ;
- **destruction des copies de clé** chez le fournisseur et dans ses procédures de reprise ;
- **suppression du ciphertext** sur l'appareil et dans toutes les copies sous contrôle de SAC ;
- **limites hors périmètre** : captures d'écran, copie manuelle ou extraction de données par un destinataire avant expiration.

Un statut « supprimé » dans une API, un tableau de bord ou un journal n'est pas une preuve suffisante. Il faut une documentation contractuelle du fournisseur et des essais adversariaux indépendants. Les essais doivent couvrir le téléphone éteint, le mode avion, l'horloge reculée/avancée, la restauration de sauvegarde, la réinstallation, le changement d'appareil, la restauration du service de clés et les accès juste avant/à/après l'échéance.

## 5. État de la recherche juridique — Niger

### 5.1 Éléments confirmés par des sources consultées

- La loi n° 2023-31 du 4 juillet 2023 modifie les articles 6, 7, 14, 23, 24 et 111 de la loi n° 2022-59. Une copie PDF de la loi est accessible sur le site historique de la HAPDP et sur DataGuidance :
  - https://www.hapdp.ne/uploads/files/Loi%20N%C2%B0%202023-31%20Modifiant%20la%20Loi%20N%C2%B0%202022-59.pdf
  - https://www.dataguidance.com/sites/default/files/loi_ndeg_2023-31_modifiant_la_loi_ndeg_2022-59.pdf
- L'Agence Nigérienne de Presse a rapporté la suppression de plusieurs organismes le 8 juin 2026 et le transfert des missions de la HAPDP vers les ministères de la Justice et de l'Intérieur. Cette source confirme le fait institutionnel rapporté, mais ne suffit pas à authentifier le numéro du décret ni le texte intégral :
  - https://anp.ne/niger-plusieurs-services-rattaches-ou-sous-tutelle-de-la-presidence-de-la-primature-et-du-secretariat-general-du-gouvernement-supprimes/
- Des sources secondaires citent le décret n° 2026-310/PRN/PM du 8 juin 2026.
- Des sources secondaires citent une ordonnance n° 2026-30 du 8 juin 2026 portant abrogation de certaines lois portant création d'autorités de régulation et de certaines dispositions de la loi n° 2022-59.

### 5.2 Éléments qui restent non authentifiés

- Le texte intégral officiel de l'ordonnance n° 2026-30 n'a pas été retrouvé dans les sources officielles consultées. Les articles précis de la loi n° 2022-59 qui seraient abrogés ou modifiés ne doivent donc pas être affirmés.
- Une copie numérisée secondaire du décret présente une incohérence : son intitulé de fichier/page évoque le n° 2026-310, tandis que le corps OCR du document affiche le n° 2026-340/PRN/PM. Cette copie n'est pas une authentification officielle. Le numéro exact doit être vérifié dans le Journal officiel.
- Le transfert institutionnel annoncé ne permet pas, à lui seul, d'identifier les services opérationnels, les formulaires, les procédures, les délais ou les interlocuteurs compétents pour les formalités de SAC.
- Il n'est pas établi, à partir des documents authentifiés consultés, que toutes les garanties substantielles de la loi n° 2022-59 demeurent inchangées, ni que l'ensemble de cette loi aurait disparu.

Sources de contexte, à ne pas substituer au Journal officiel :
- ANP : https://anp.ne/niger-plusieurs-services-rattaches-ou-sous-tutelle-de-la-presidence-de-la-primature-et-du-secretariat-general-du-gouvernement-supprimes/
- Africa Data Protection : https://www.africadataprotection.org/niger-suppression-de-la-haute-autorite-de-protection-des-donnees-a-caractere-personnel.html
- Copie secondaire du décret (transcription incohérente) : https://www.scribd.com/document/1058080703/Decret-2026-310-Du-08-Juin-Pourtant-Suppression-de-Certains-Services

## 6. Actions toujours bloquantes

- Obtenir une copie authentique du Journal officiel contenant l'ordonnance n° 2026-30 et relever exactement ses articles.
- Obtenir la copie authentique du décret du 8 juin 2026 et confirmer son numéro, son contenu et les transferts de missions.
- Identifier les services réellement opérationnels au sein des ministères concernés et faire confirmer les formalités applicables à SAC.
- Arbitrer explicitement la compatibilité entre historique GPS consultable hors ligne et expiration stricte J+30.
- Ne pas connecter de GPS réel, ne créer aucune migration D1, aucune API GPS et aucune ressource cloud avant validation des critères.
- Maintenir le statut **NON PRÊT POUR PRODUCTION** pour l'historique GPS tant que la preuve de destruction n'existe pas.
