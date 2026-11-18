# SAC — Contrat de conservation et de suppression des alertes

**Date de validation produit :** 18 novembre 2026  
**Statut :** règles produit confirmées ; conception technique documentaire uniquement.  
**Périmètre :** alertes SOS et positions GPS qui leur sont associées.

## 1. Décision produit ferme

Les 30 jours sont la durée pendant laquelle une alerte clôturée reste dans l'historique SAC. Ils ne constituent pas une durée de conservation GPS.

1. **Alerte active :** l'alerte suit son cycle normal. Les positions ne sont accessibles que dans le cadre des autorisations et du partage prévus.
2. **Clôture :** dès que la clôture est effective, toutes les positions GPS précises liées à cette alerte sont automatiquement supprimées des systèmes contrôlés par SAC. Aucun délai de 30 jours ne s'applique au GPS.
3. **Historique pendant 30 jours :** l'entrée reste consultable sans position GPS ni possibilité de reconstituer le parcours. La seule information métier conservée est la nature/catégorie de l'alerte.
4. **À l'expiration des 30 jours :** l'entrée d'historique et les informations restantes de l'alerte sont supprimées automatiquement et définitivement.

Le délai commence à l'instant de clôture effective. Il ne repart pas lors d'une consultation, connexion, restauration ou modification technique.

## 2. Suppression GPS à la clôture

La purge immédiate couvre toutes les positions précises et toutes les représentations permettant de les retrouver ou de les reconstituer, dans le périmètre contrôlé par SAC : données actives, caches, files, outbox, pièces jointes, journaux, traces, analytics, exports, stockage local géré par l'application et copies temporaires.

Aucune carte, chronologie, pièce jointe ou vue d'historique ne doit exposer une position après clôture. Un masquage d'interface ou un simple statut « supprimé » ne constitue pas une suppression.

Le contenu conservé pendant les 30 jours est limité à la nature/catégorie. Le contrat n'autorise pas à conserver coordonnées, adresse dérivée, itinéraire, géohash, miniature de carte ou substitut de localisation.

## 3. Suppression définitive à J+30

À l'expiration exacte des 30 jours suivant la clôture, l'entrée d'historique, sa catégorie/nature et les autres données rattachées qui ne doivent plus exister sont purgées de tous les systèmes sous contrôle SAC. Les index, caches, exports, fichiers, files et copies temporaires ne doivent pas permettre de retrouver l'alerte.

La purge doit être idempotente et rattrapable. Un éventuel reçu technique doit être minimal, non ré-identifiant et incapable de reconstituer l'alerte, sa catégorie ou sa localisation. Sa forme et sa durée restent à spécifier ; il ne fait pas partie de l'historique utilisateur.

## 4. Sauvegardes et restaurations : interdiction de résurrection

Une sauvegarde n'est pas une exception à la suppression. Une restauration ne doit jamais faire réapparaître une position supprimée à la clôture, une alerte dont les 30 jours sont écoulés, sa catégorie supprimée, ni une clé/cache/export permettant de récupérer ces données.

Toute reprise après sinistre doit appliquer les suppressions déjà acquises avant de rendre les données restaurées accessibles. Une sauvegarde ancienne ne peut pas rétablir un état antérieur aux suppressions.

La conception devra démontrer cette garantie pour chaque mécanisme réellement utilisé : sauvegardes, snapshots, réplications, restauration D1/Time Travel, stockage objet, caches, exports et sauvegardes locales prises en charge par l'application. Si un mécanisme ne permet pas de garantir la non-résurrection, il ne peut pas être utilisé pour les données concernées tant qu'une solution vérifiable n'existe pas.

Une purge exécutée une seule fois avant sauvegarde est insuffisante si une ancienne sauvegarde contenant les données peut ensuite être restaurée. La reprise doit être « forward-only » du point de vue des suppressions : les preuves minimales nécessaires à la purge doivent survivre à la restauration sans conserver les données supprimées elles-mêmes.

## 5. Ordre atomique et échec

La clôture et la révocation des accès GPS doivent former un point de bascule unique côté serveur : aucune nouvelle lecture ou transmission GPS après clôture ; les tâches de partage non exécutées sont annulées ; les tâches en vol sont neutralisées ou leur contenu rendu irrécupérable dans le périmètre SAC.

L'historique ne doit pas être déclaré nettoyé tant que la purge immédiate n'est pas confirmée. En cas d'échec, le système reste bloqué/à reprendre, sans réexposer la localisation et sans annoncer une suppression réussie.

Le traitement J+30 doit être fiable, idempotent, surveillé et rattrapable après panne. Une tâche planifiée manquée ne doit pas prolonger la conservation visible de l'alerte.

## 6. Tests obligatoires avant activation

Tests synthétiques minimaux : clôture normale, annulation après déclenchement et exception administrative déjà définie ; suppression GPS dans vues/API/caches/files/outbox/logs/exports/stockages contrôlés ; impossibilité de relire via ancien lien ou appareil secondaire ; seule catégorie visible pendant 30 jours ; suppression à l'échéance même après panne ; restauration d'une sauvegarde antérieure à la clôture sans GPS ; restauration d'une sauvegarde antérieure à J+30 sans alerte/catégorie ; tests snapshots/réplications/Time Travel ; panne et rejeu de purge ; absence de fuite dans logs et support.

Tout scénario critique non testé maintient le NO-GO pour l'activation du GPS réel et toute promesse de suppression irréversible.

## 7. Périmètre et limites

Ce contrat fixe le cycle des alertes et de leurs positions GPS. Il ne fixe pas les durées de conservation des comptes, invitations, appareils, trajets, facturation ou journaux généraux.

Il ne prétend pas effacer une copie indépendante qu'un destinataire aurait exportée ou enregistrée hors des systèmes contrôlés par SAC. Les interfaces et contrats devront éviter que SAC crée volontairement de telles copies et expliquer les limites des copies sorties de son contrôle.

## 8. Prévalence

Ce contrat prévaut sur toute formulation antérieure indiquant que les positions GPS d'une alerte clôturée seraient conservées 30 jours ou que le délai GPS J+30 commencerait à la fin du partage.

**Règle de référence : GPS supprimé à la clôture ; catégorie seule conservée 30 jours ; alerte et catégorie supprimées à J+30 ; aucune sauvegarde/restauration ne peut ressusciter les données supprimées.**
