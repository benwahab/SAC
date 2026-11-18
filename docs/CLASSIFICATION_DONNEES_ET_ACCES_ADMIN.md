# SAC — Classification des données et accès administratif

Date : 18 novembre 2026  
Statut : cadre de conception — règles proposées à confirmer avant implémentation

## 1. Objectif

Appliquer le moindre privilège aux données consultées par le Super Admin, l'administrateur sécurité, le Support et l'Auditeur. Le fait d'avoir un compte administratif ne donne pas accès à toutes les données personnelles.

## 2. Classes de sensibilité

| Classe | Nature | Règle d'accès |
|---|---|---|
| C0 — Technique publique | Version de l'application, état général non sensible du service | Consultation selon fonction |
| C1 — Interne | Paramètres non secrets, statistiques agrégées, procédures | Mission explicite si nécessaire |
| C2 — Personnel | Identité, e-mail, téléphone déclaré, profil, métadonnées de compte | Accès limité au besoin de la mission |
| C3 — Confidentiel opérationnel | Alertes individuelles, proches, interventions, notes internes, historique nominatif | Accès nominatif, limité à une alerte ou un dossier lorsque possible |
| C4 — Secret / critique | Mots de passe, OTP, jetons bruts, clés privées, secrets de récupération, GPS précis, éléments permettant de contourner la sécurité | Jamais exposé dans les consoles administratives ordinaires ; secrets non lisibles ; GPS précis bloqué tant que la garantie de suppression irréversible n'est pas démontrée |

Cette classification est un modèle de travail. Le GPS précis reste soumis au NO-GO déjà établi ; sa classe C4 n'autorise en aucun cas sa collecte ou son accès.

## 3. Limites proposées pour le Support

Le Support doit résoudre un problème sans devenir enquêteur ni opérateur des alertes. Par défaut, il peut recevoir uniquement :
- une référence de demande d'assistance ;
- l'état technique ou administratif minimal du compte ;
- les dates et résultats génériques d'opérations utiles au diagnostic ;
- les informations que l'utilisateur a volontairement incluses dans sa demande.

Par défaut, le Support ne voit pas :
- le contenu des alertes SOS et les coordonnées des proches ;
- les notes internes d'administration ou de sécurité ;
- les clés, secrets, OTP, jetons ou données GPS précises ;
- les données d'autres utilisateurs simplement parce qu'ils sont liés au même appareil, numéro ou foyer.

Toute exception doit être liée à un dossier d'assistance, limitée dans le temps et dans les champs visibles, autorisée par le Super Admin et auditée. Le Support ne peut ni clôturer une alerte, ni suspendre un compte, ni modifier une mission, ni effacer une trace.

## 4. Limites proposées pour l'Auditeur

L'Auditeur contrôle la conformité et la traçabilité, sans agir sur les opérations métier. Par défaut :
- lecture des politiques, configurations non secrètes et journaux expurgés ;
- consultation des événements nécessaires au contrôle dans un périmètre explicitement attribué ;
- accès aux identifiants pseudonymisés lorsque l'identité civile n'est pas nécessaire ;
- aucun accès aux secrets, clés privées, OTP, jetons bruts ou GPS précis.

L'accès à des dossiers individuels doit être exceptionnel, motivé, limité à un périmètre et une durée, et journalisé. Les exports sont interdits par défaut ; toute autorisation d'export doit être distincte, ciblée, motivée, limitée et auditée. L'Auditeur ne modifie, ne suspend, ne clôture et ne supprime aucune donnée.

## 5. Règles de minimisation pour tous les profils

1. Afficher uniquement les champs nécessaires à l'action autorisée.
2. Masquer par défaut les coordonnées personnelles lorsqu'elles ne sont pas nécessaires.
3. Ne jamais afficher les OTP, mots de passe, clés privées, jetons bruts ou secrets de récupération.
4. Ne pas exposer le contenu intégral des messages privés dans les journaux ou tableaux de bord.
5. Ne pas permettre de recherche globale de personnes sans mission et motif autorisés.
6. Limiter les résultats, exports et téléchargements au périmètre exact de la mission.
7. Tracer l'accès aux données C2/C3, les recherches sensibles et tout export.
8. Les refus d'accès ne doivent pas révéler à l'acteur non autorisé si une ressource protégée existe.

## 6. Accès exceptionnel et procédure de justification

Toute consultation exceptionnelle de données C3 doit être précédée d'un motif métier précis, d'une référence de dossier ou d'alerte et d'une permission serveur explicite. L'accès est limité à la durée nécessaire. Il ne doit pas créer un accès permanent ni être réutilisable pour d'autres dossiers.

Une urgence opérationnelle ne crée pas automatiquement un privilège. Si aucun profil n'est habilité, l'action est transmise au Super Admin plutôt que contournée.

## 7. Points à confirmer

- Valider les classes C0 à C4 et les champs exacts de chaque ressource.
- Valider les vues minimales du Support et de l'Auditeur.
- Définir le processus de demande et d'autorisation d'accès exceptionnel.
- Définir la pseudonymisation, le masquage et les limites d'export.
- Faire vérifier la classification et les obligations légales applicables par une revue compétente.

## 8. Portée

Ce document propose des garde-fous de conception. Il ne crée aucun compte, rôle, permission, interface, endpoint, journal, traitement de données ou migration D1. Les accès restent non opérationnels tant que la matrice n'est pas approuvée, implémentée et testée.
