-- SAC — jeton de mutation pour rendre atomique le remplacement des permissions.
-- Chaque écriture pose un jeton unique ; les écritures dérivées ne s'exécutent
-- que si ce jeton a effectivement été posé par la même requête.

ALTER TABLE admin_missions ADD COLUMN mutation_token TEXT;
