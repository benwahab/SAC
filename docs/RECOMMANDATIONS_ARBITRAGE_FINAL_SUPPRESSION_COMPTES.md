# SAC — Recommandations d'arbitrage final du cycle de suppression des comptes

**Date :** 18 novembre 2026  
**Statut :** recommandations à soumettre au propriétaire du projet ; aucune des options ci-dessous n'est réputée approuvée.  
**Portée :** fermer les ambiguïtés du contrat de suppression sans changer les cinq états validés, sans créer de droit de clôture SOS et sans autoriser une implémentation.

## 1. Invariants non négociables

Les cinq états restent exactement : pending_verification, active, suspended, deletion_pending, deleted.

- L'activation exige une adresse e-mail vérifiée par OTP ; téléphone obligatoire mais non vérifié.
- Un compte suspendu ne récupère jamais une session générale par un parcours de suppression.
- Une demande de suppression bloque immédiatement les nouveaux flux métier.
- Une demande ne clôture jamais une alerte ni un trajet.
- Une alerte SOS active conserve son instantané initial de destinataires et ses rappels toutes les cinq minutes jusqu'à une clôture autorisée.
- La clôture normale est celle de l'auteur ; l'exception administrative étroite pour un auteur suspendu reste régie exclusivement par CONTRAT_CLOTURE_EXCEPTIONNELLE_ADMINISTRATIVE_SOS.md.
- Aucun proche, responsable principal, support ou administrateur non habilité ne reçoit un droit de clôture.
- Un trajet actif n'est jamais clos par simple suppression du compte.
- La finalisation est interdite tant qu'une alerte ou un trajet dont le compte est l'auteur est actif.
- Les positions GPS d'une alerte sont supprimées immédiatement à sa clôture ; catégorie seule 30 jours ; entrée supprimée à J+30. La conservation GPS des trajets reste séparée et NO-GO.
- deleted est terminal ; une restauration ne réactive ni compte, ni session, ni appareil, ni relation révoquée.

## 2. Recommandations proposées, par cas

### A. Inscription pending_verification

**Recommandation :** expiration automatique après 24 heures, avec invalidation immédiate de tous les OTP et défis associés. Effacer les données provisoires non nécessaires ; toute empreinte anti-abus éventuelle doit être séparée, minimisée et soumise à la validation juridique.

**Effacement avant activation :** offrir un lien de demande à usage unique envoyé à l'adresse e-mail déjà saisie, sans créer de session et sans activer le compte. La demande ne doit révéler ni l'existence d'un autre compte ni son état. Le téléphone déclaré ne constitue jamais une preuve.

**Pourquoi :** limiter les inscriptions abandonnées sans contourner la vérification e-mail ni créer une session avant activation.

**À approuver :** délai 24 h, lien de demande et champs techniques conservés pour anti-abus.

### B. Compte active

**Recommandation :** exiger une authentification récente par les moyens normaux du compte, puis une confirmation explicite qui expose les conséquences et les activités ouvertes. Après confirmation, passer à deletion_pending, révoquer les sessions générales sur les autres appareils et bloquer les nouvelles activités.

L'auteur conserve uniquement les capacités nécessaires et déjà prévues pour terminer ses propres activités ouvertes. Aucun mode restreint spécial ne doit être créé avant spécification et validation de sécurité.

**SOS programmé :** recommander l'annulation atomique des SOS programmés non déclenchés au moment où la demande de suppression est acceptée. Si le déclenchement serveur gagne la course, l'alerte déjà créée est traitée comme une activité existante ; la suppression reste en attente. Si l'annulation gagne, aucun dossier d'alerte n'est créé.

**À approuver :** définition de l'authentification récente, annulation des programmations et notifications associées.

### C. Compte suspended

**Recommandation :** ne jamais réactiver le compte pour recevoir une demande de suppression. Permettre au titulaire de déposer une demande par un canal de vérification distinct, limité à cette démarche et sans accès aux données privées ni session générale.

La demande est enregistrée comme une procédure séparée ; le compte reste suspended. Elle ne peut être finalisée tant que des activités actives empêchent la suppression. Le Super Admin peut traiter la demande dans le cadre de ses pouvoirs, mais ne peut pas supprimer arbitrairement le compte ni clôturer une alerte hors de l'exception SOS déjà définie.

**Pourquoi :** respecter à la fois le blocage de sécurité et la possibilité de traiter une demande d'effacement, sans transformer la procédure en porte dérobée.

**À approuver :** canal de vérification distinct, preuve demandée et autorité de décision sur la demande.

### D. Suspension administrative pendant deletion_pending

**Recommandation :** la suspension administrative doit empêcher toute annulation qui réactiverait automatiquement le compte. Pour ne pas créer un sixième état, conserver les cinq états canoniques et traiter l'événement de suspension comme un contrôle administratif séparé et audité attaché à la procédure de suppression. Tant que ce contrôle est actif, la demande ne peut pas revenir à active.

Si une décision de suspension est prise avant la finalisation, la finalisation doit être mise en attente jusqu'à décision explicite de l'autorité compétente ; aucune session générale ne doit être rétablie. Une annulation de demande ne peut rendre le compte actif que si aucune suspension administrative valide n'est en vigueur.

**À approuver :** cette priorité et le mécanisme de contrôle séparé. Ne pas créer une transition ou une colonne avant définition de sa sémantique.

### E. Compte deletion_pending avec alerte ou trajet actif

**Recommandation :** pas de clôture automatique, pas de transfert automatique à un proche et pas d'expiration silencieuse de l'alerte. Les rappels SOS continuent selon la règle validée. L'auteur peut terminer ses propres activités selon les capacités déjà permises ; la suppression reste en attente.

Pour un auteur absent durablement, prévoir une procédure d'escalade opérationnelle séparée, sans droit de clôture implicite. Le seul mécanisme administratif de clôture reste l'exception existante pour le compte suspendu, avec ses conditions strictes. Le silence, l'inactivité, une demande de suppression ou une durée écoulée ne prouvent jamais que le danger est terminé.

Pour un trajet, la suppression reste en attente jusqu'à sa clôture autorisée. La fin d'un partage de position, lorsqu'elle est ultérieurement définie, ne doit pas être confondue avec la clôture du trajet.

**À approuver :** durée et étapes de l'escalade de compte absent, sans automatiser la clôture SOS ou trajet.

### F. Compte deleted

**Recommandation :** conserver un marqueur technique minimal de non-résurrection, non réversible, séparé des données personnelles supprimées. Il doit empêcher la restauration de sessions, appareils, certificats, invitations, relations, abonnements push et droits révoqués.

Une nouvelle inscription est une nouvelle identité technique. La réutilisation d'un e-mail ou d'un numéro ne doit pas réactiver l'ancien compte. Le délai de réutilisation et les éventuelles données anti-abus sont à fixer après analyse juridique et sécurité.

**À approuver :** champs minimaux du marqueur, politique de réutilisation des identifiants et durée des preuves conservées.

## 3. Effets recommandés sur les relations, invitations et groupes

À la demande de suppression : bloquer la création d'invitations, l'acceptation de nouvelles relations initiées par le compte et toute nouvelle adhésion ou création de groupe. Les invitations sortantes en attente devraient être révoquées, sous réserve d'un événement d'audit minimal.

À la finalisation : révoquer les relations de confiance et adhésions du compte supprimé ; invalider ses invitations et abonnements push ; ne pas transférer automatiquement la propriété d'un groupe. Un groupe propriétaire doit être transféré avec acceptation explicite ou supprimé selon une règle validée. Les alertes actives gardent leur instantané de destinataires et leur continuité ; aucune relation ne doit être réécrite rétroactivement.

Les autres membres conservent leurs propres comptes. Les notifications éventuelles doivent rester neutres et ne pas révéler le motif de suppression.

**Statut :** recommandations non approuvées ; la politique générale de conservation et les effets sur les groupes doivent être validés avant migration.

## 4. Ordre des opérations et courses concurrentes

Toute demande ou finalisation doit être arbitrée côté serveur avec une version d'état et une transaction atomique.

1. **Demande contre nouvelle activité :** une seule opération gagne. Si la demande est validée en premier, l'activité est refusée. Si la création d'activité a été validée en premier, elle devient une activité existante et bloque la finalisation.
2. **Demande contre SOS programmé :** appliquer l'arbitrage atomique décrit en B ; aucune double création/annulation.
3. **Annulation contre finalisation :** une seule transition terminale gagne. Une réponse client en retard ne peut pas réactiver un compte déjà deleted.
4. **Suspension contre demande/annulation :** l'état et l'événement administratif doivent être ordonnés côté serveur ; une suspension valide interdit le retour automatique à active.
5. **Suppression contre acceptation d'invitation :** après prise d'effet de la demande, aucune nouvelle relation ne peut être créée au nom du compte ; une acceptation concurrente doit être refusée ou annulée selon l'ordre transactionnel.
6. **Finalisation contre révocation d'appareil/session :** les révocations doivent être durables et non réactivables par une restauration antérieure.
7. **Restauration :** restaurer une sauvegarde ne doit jamais réactiver un compte supprimé, une session, un appareil ou une relation révoquée.

Les clés d'idempotence empêchent les doublons ; elles ne doivent pas faire disparaître une nouvelle action SOS explicitement initiée. Les compteurs d'activités doivent être relus dans la transaction serveur, jamais fournis comme preuve par le client.

## 5. Questions qui restent réellement à arbitrer

| Sujet | Recommandation | Pourquoi une décision du propriétaire reste nécessaire |
|---|---|---|
| Expiration pending_verification | 24 h | impact sur les inscriptions abandonnées et obligations de conservation |
| Effacement avant activation | lien e-mail à usage unique | canal de preuve et risque d'énumération |
| Demande depuis suspended | canal distinct, sans session | équilibre entre droit d'effacement et sécurité |
| Suspension pendant deletion_pending | blocage de l'annulation/réactivation | priorité entre mesure administrative et demande personnelle |
| Authentification récente | réauthentification avant demande | facteurs autorisés et risque de compte compromis |
| SOS programmés | annulation atomique à la demande | arbitrage d'une course avec le déclenchement |
| Auteur absent | escalade sans clôture automatique | procédure de sécurité et responsabilités |
| Trajet actif | attendre la clôture autorisée | aucun mécanisme de clôture de secours validé |
| Relations et groupes | révocation à finalisation, sans transfert implicite | conséquences sur les autres membres |
| Identifiants réutilisables | nouvelle identité, jamais restauration | délai et anti-abus à valider |
| Conservation non GPS | matrice par finalité/table | dépend du droit applicable et des besoins démontrés |

## 6. Tests d'acceptation complémentaires

Ajouter aux tests déjà listés dans le contrat de suppression :

- expiration d'une inscription provisoire et rejeu d'un OTP expiré ;
- demande d'effacement avant activation sans création de session ;
- compte suspendu déposant une demande sans accès privé ;
- tentative d'annulation d'une suppression alors qu'une suspension est en vigueur ;
- suspension concurrente avec demande, annulation et finalisation ;
- SOS programmé dont le déclenchement serveur et l'annulation arrivent simultanément ;
- auteur deletion_pending absent : aucun auto-close, aucune promotion d'un proche en auteur ;
- trajet orphelin : aucune clôture automatique ni suppression forcée ;
- révocation des relations/invitations et invalidation des appareils au moment approprié ;
- restauration d'une sauvegarde antérieure après suppression : aucun compte, session, appareil, relation ou invitation réactivé ;
- nouvel enregistrement avec un e-mail déjà utilisé : aucune restauration de l'ancien identifiant ou de son historique ;
- conservation des seules preuves explicitement approuvées, sans coordonnées GPS, OTP ou jetons bruts.

## 7. Décision d'architecture et limites

Ce document propose une politique cohérente, mais ne remplace pas l'approbation du propriétaire du projet. Les recommandations ne doivent pas être transformées en code, contraintes SQL ou migration D1 avant validation explicite.

Le contrat TypeScript actuel src/domain/account-lifecycle.ts ne prend encore en charge que trois états (active, deletion_pending, deleted) et expose un booléen trop générique allowCloseExistingActivity. Il doit être réconcilié avec les cinq états et les capacités distinctes, mais cette opération de code nécessite une autorisation séparée.

**Verdict :** les recommandations sont consolidées ; le P0 produit reste ouvert sur les arbitrages listés à la section 5. Aucun code, test, API, SQL, D1, ressource Cloudflare, fournisseur ou déploiement n'est modifié par ce document.
