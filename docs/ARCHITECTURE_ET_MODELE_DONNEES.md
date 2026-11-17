# SAC — Modèle de données Cloudflare

Complément à la racine ARCHITECTURE.md. Remplace le modèle des alertes privées.

D1 : sac-citoyen-db, créé le 17/11/2026 en juridiction EU ; tables initiales appliquées et vérifiées. Pages : sac-citoyen relié à GitHub main avec binding D1 DB. R2 : service non activé ; bucket et binding à créer après activation.

Tables : users (citoyen, agent, modérateur, admin), reports (catégorie, urgence, coordonnées, statut, modération, hash de suivi, clé R2), report_updates (historique), rate_limits. Les codes sont hashés et les médias privés.

Extensions futures : organisations, zones, affectations, sessions, notifications, pièces jointes multiples et audit. Toute extension doit être migrée et testée. Toutes les autorisations sont serveur.