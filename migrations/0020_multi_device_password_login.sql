-- SAC — Connexion par mot de passe sur plusieurs appareils (Option 2).
--
-- Décision produit explicite : un appareil peut ouvrir une session avec
-- e-mail vérifié + mot de passe sans approbation WebAuthn d'un autre appareil.
-- Cette migration supprime l'unicité d'appareil par compte, mais conserve
-- l'unicité d'une credential racine par compte.
--
-- La fonctionnalité reste désactivée tant que
-- MULTI_DEVICE_PASSWORD_LOGIN_ENABLED n'est pas explicitement "true".
-- Ne pas appliquer cette migration sans autorisation et sauvegarde vérifiée.

PRAGMA foreign_keys = ON;

DROP INDEX IF EXISTS devices_one_root_per_account;

CREATE INDEX IF NOT EXISTS devices_account_status
  ON devices(account_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS device_root_credentials_one_per_account
  ON device_root_credentials(account_id);
