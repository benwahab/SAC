-- SAC — Abonnements Premium et registre d'événements de paiement.
-- Aucun droit Premium n'est accordé par défaut : l'absence d'abonnement vaut formule gratuite.
PRAGMA foreign_keys = ON;

CREATE TABLE account_subscriptions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  plan_key TEXT NOT NULL DEFAULT 'premium' CHECK (plan_key = 'premium'),
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'failed', 'cancelled', 'expired')),
  provider TEXT,
  provider_subscription_ref TEXT,
  amount_xof INTEGER NOT NULL DEFAULT 5000 CHECK (amount_xof = 5000),
  billing_interval TEXT NOT NULL DEFAULT 'month' CHECK (billing_interval = 'month'),
  current_period_start INTEGER,
  current_period_end INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    status <> 'active'
    OR (
      current_period_start IS NOT NULL
      AND current_period_end IS NOT NULL
      AND current_period_end > current_period_start
    )
  )
);

CREATE INDEX account_subscriptions_active_period
  ON account_subscriptions(status, current_period_end);

CREATE TABLE billing_provider_events (
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  processed_at INTEGER,
  payload_digest TEXT NOT NULL,
  PRIMARY KEY (provider, provider_event_id)
);

CREATE INDEX billing_provider_events_pending
  ON billing_provider_events(processed_at, received_at);
