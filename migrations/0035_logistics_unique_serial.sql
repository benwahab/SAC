CREATE UNIQUE INDEX logistics_assets_serial_unique ON logistics_assets(serial_number) WHERE serial_number <> '';
