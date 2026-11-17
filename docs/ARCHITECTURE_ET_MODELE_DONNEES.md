# SAC — Modèle de données Cloudflare

Complément à la racine ARCHITECTURE.md ; remplace le modèle des alertes privées.

D1 : sac-citoyen-db, créé le 17/11/2026 en juridiction EU. R2 : service non activé au moment de la préparation ; bucket à créer après activation. Pages : projet à configurer.

Tables initiales : users (citoyen, agent, modérateur, admin), reports (catégorie, urgence, coordonnées, statut, modération, hash de suivi, clé R2), report_updates (historique), rate_limits. Les codes sont hashés et les médias privés.

Extensions futures : organisations, zones, affectations, sessions, notifications, pièces jointes multiples et audit. Toute extension doit être migrée et testée. Toutes les autorisations sont serveur.