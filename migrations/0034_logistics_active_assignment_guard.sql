CREATE UNIQUE INDEX logistics_one_active_assignment ON logistics_asset_assignments(asset_id) WHERE returned_at IS NULL;
