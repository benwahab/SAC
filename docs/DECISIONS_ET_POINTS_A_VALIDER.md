# SAC — Décisions actées et points à valider

Ce document évite de confondre une décision de l'utilisateur avec une proposition technique. Il doit être mis à jour à chaque validation.

## 1. Décisions actées

| Sujet | Décision |
|---|---|
| Nom | SAC — Sécurité, Alerte, Citoyenne |
| Logo | Aucun logo pour le moment |
| Couleurs | Pas de violet ; bleu nuit `#142B45`, rouge SOS `#D9273F`, blanc `#FFFFFF`, vert `#15966B`, gris clair `#E9EEF3` |
| Plateforme | PWA mobile-first en premier |
| Stack frontend | React + Vite + TypeScript + Tailwind CSS + Lucide React |
| Public | Toute la population |
| Destinataires | Les proches choisis et autorisés par l'utilisateur |
| Gratuit | Jusqu'à 2 contacts de confiance |
| Premium | 5 000 FCFA/mois, jusqu'à 10 contacts et options supplémentaires à définir |
| SOS essentiel | Reste gratuit |
| Catégories | Danger personnel, accident, intrusion au domicile, urgence médicale, personne perdue/désorientée, alerte personnalisée |
| Niveaux | Préventif, urgent, critique |
| SOS discret | Écran neutre après déclenchement ; code de contrainte dans SAC ou via raccourci écran verrouillé si faisable |
| Protection contre désactivation forcée | Tentative d'alerte discrète avant désactivation lorsque la plateforme le permet, sans garantie d'empêcher l'arrêt |
| Protection des trajets | Une fonction regroupée avec trois modes : vérification d'arrivée, accompagnement, protection complète |
| Rappels | Toutes les 5 minutes vers les contacts initiaux, jusqu'à la clôture par l'auteur ; aucun ajout automatique de contacts |
| Clôture | Seul l'auteur de l'alerte peut clôturer |
| Expiration des rappels | Ne clôture pas l'alerte |
| Répondant principal | Premier contact qui accepte la prise en charge ; promotion du volontaire suivant si retrait |
| Contacts | Invitation acceptée obligatoire ; révocation pour les nouvelles alertes |
| Destinataires | Instantané figé au déclenchement |
| Localisation | Partage soumis à autorisation ; une position ancienne doit être datée et identifiée |
| Backend / API | API REST séparée sur Cloudflare Workers, implémentée en TypeScript |
| Portabilité mobile | PWA d'abord ; préparation Capacitor pour Android/iOS sans réécriture |
| Adaptateurs appareil | Interfaces isolées dans `src/services/device/` |
| Collaboration IA | Claude et Qwen peuvent intervenir via les consignes partagées, sans changer la stack ni les conventions |
| Langues prévues | Français, Hausa, Zarma et anglais |
| SMS de secours | Prévoir un mécanisme SMS de secours lorsque l'accès Internet est indisponible, sous réserve des capacités réelles du terminal et du fournisseur |
| Groupes familiaux | Disponibles avec limites selon l'offre gratuite/Premium ; plafonds précis à valider |
| Infrastructure de données | Fournisseur relationnel et authentification à confirmer |
| Phase actuelle | Documentation et cadrage, pas de développement applicatif |
| Dépôt | `benwahab/SAC` |
| Branche | Une seule branche : `main` |
| Méthode | Tout le travail directement sur GitHub |

## 2. Règles confirmées sur les alertes

- L'accusé de réception (« J'ai reçu l'alerte ») est différent de la prise en charge (« Je prends la situation en charge »).
- Le premier volontaire devient répondant principal.
- Les autres contacts peuvent également intervenir.
- Si le principal se retire, le prochain volontaire devient principal.
- Si aucun autre contact ne se porte volontaire, l'alerte reste active sans répondant principal.
- Les contacts ne clôturent jamais l'alerte.
- Les rappels s'arrêtent à la clôture ou à l'échéance choisie.
- L'arrêt des rappels n'est pas une preuve de résolution.
- Aucun nouveau destinataire n'est ajouté automatiquement après déclenchement.

## 3. Propositions techniques — non encore validées comme choix définitifs

- Utiliser PostgreSQL comme base de données.
- Étudier Supabase pour la base, l'authentification et éventuellement le temps réel.
- Utiliser Web Push pour la PWA, puis étudier FCM/APNs pour des applications natives.
- Étudier OpenStreetMap ou un fournisseur cartographique équivalent.
- Utiliser une file de tâches côté serveur pour rappels et alertes différées.
- Mettre en place un modèle outbox/idempotence pour les notifications.
- Isoler les prestataires SMS et paiement derrière des adaptateurs.

Ces éléments sont des recommandations d'architecture, pas des engagements de fournisseur.

## 4. Points à valider avant développement ou lancement

1. **Durée des rappels :** liste des durées proposées par l'interface, durée minimale et maximale.
2. **Protection des trajets :** délai avant alerte en cas d'absence de confirmation et nombre de relances.
3. **Premium :** liste précise des options supplémentaires incluses dans les 5 000 FCFA/mois.
4. **Groupes :** nombre maximal de groupes, membres, rôles et règles d'invitation.
5. **Paiement :** prestataire(s) acceptés au Niger, frais, renouvellement, remboursement et gestion des paiements échoués.
6. **SMS :** prestataire, coût, disponibilité et règles de bascule depuis les notifications push.
7. **Données GPS :** durée de conservation, fréquence d'échantillonnage, purge et export.
8. **Compte :** récupération après perte du téléphone, changement de numéro/e-mail et suppression du compte.
9. **SOS discret :** scénarios techniquement réalisables sur Android, iOS et PWA ; limites de permissions et de fonctionnement en arrière-plan.
10. **Base et hébergement :** choix définitif de l'infrastructure et localisation des données.
11. **Notifications :** politique de consentement, permissions, canaux de secours et affichage des échecs.
12. **Langues :** langues disponibles au lancement après le français.
13. **Administration :** rôles, support, accès exceptionnel aux données et audit.
14. **Cadre légal :** obligations de protection des données et conditions d'exploitation au Niger et dans les pays futurs.

## 5. Questions à ne pas trancher automatiquement

- Ne pas rendre le SOS essentiel payant.
- Ne pas promettre que le GPS fonctionne en continu lorsque la PWA est fermée.
- Ne pas promettre qu'un SMS sera envoyé ou reçu sans confirmation du fournisseur.
- Ne pas faire croire qu'une notification acceptée par un fournisseur a été lue.
- Ne pas permettre à un contact ou administrateur de clôturer arbitrairement l'alerte.
- Ne pas considérer la fin des rappels comme une résolution.
- Ne pas donner à un membre d'un groupe un accès automatique aux positions.
- Ne pas choisir un fournisseur de paiement, SMS ou base de données sans validation.

## 6. Historique des validations

| Version | Événement |
|---|---|
| 1.0 | Consolidation des décisions connues et des points ouverts dans le cadre du dépôt initial de la documentation. |
| 1.1 | Cahier des charges complété sur la portabilité Android/iOS, la stack TypeScript et la collaboration Claude/Qwen ; langues de référence harmonisées. |
| 1.2 | Rappels alignés sur la validation utilisateur : toutes les 5 minutes vers les contacts initiaux jusqu'à clôture ; détails du SOS discret et de la protection contre désactivation forcée consignés. |

Mettre à jour ce tableau à chaque nouvelle validation importante.
