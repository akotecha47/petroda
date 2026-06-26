-- =============================================================
-- PETRODA DB MIGRATION 001 — Cleanup and Rebuild
-- Run this in the Supabase SQL editor in one go.
-- =============================================================


-- ─── STEP 2: Drop out-of-scope tables ────────────────────────

DROP TABLE IF EXISTS corrections CASCADE;
DROP TABLE IF EXISTS attendant_entries CASCADE;
DROP TABLE IF EXISTS cash_movements CASCADE;
DROP TABLE IF EXISTS payment_categories CASCADE;


-- ─── STEP 3: Update roles ────────────────────────────────────
-- If user_role is an enum type, add the new values:
-- (Skip these two lines if role column is plain text)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'manager';

-- Remap existing role values
UPDATE users SET role = 'owner'   WHERE role = 'master';
UPDATE users SET role = 'manager' WHERE role = 'station_manager';
-- admin stays as admin

-- Remove out-of-scope users from the users table
DELETE FROM users WHERE role IN ('junior_admin', 'attendant');


-- ─── STEP 4: Seed Mbayani station and tanks ──────────────────

INSERT INTO stations (id, name, location, is_active)
VALUES (gen_random_uuid(), 'Mbayani', 'Blantyre', true);

-- Petrol tank (calibration chart pending from client)
INSERT INTO tanks (station_id, fuel_type, label, capacity_litres, calibration_profile, is_active)
SELECT id, 'PMA', 'Petrol Tank', 40000, '[]'::jsonb, true
FROM stations WHERE name = 'Mbayani';

-- Diesel tank (46-point calibration chart loaded)
INSERT INTO tanks (station_id, fuel_type, label, capacity_litres, calibration_profile, is_active)
SELECT id, 'AGO', 'Diesel Tank', 40000,
'[
  {"cm":2.80,"litres":100},{"cm":4.50,"litres":200},
  {"cm":6.20,"litres":300},{"cm":7.50,"litres":400},
  {"cm":8.80,"litres":500},{"cm":11.50,"litres":750},
  {"cm":14.10,"litres":1000},{"cm":23.00,"litres":2000},
  {"cm":30.60,"litres":3000},{"cm":37.60,"litres":4000},
  {"cm":44.00,"litres":5000},{"cm":50.30,"litres":6000},
  {"cm":56.30,"litres":7000},{"cm":62.10,"litres":8000},
  {"cm":67.70,"litres":9000},{"cm":73.30,"litres":10000},
  {"cm":78.50,"litres":11000},{"cm":83.50,"litres":12000},
  {"cm":89.00,"litres":13000},{"cm":94.00,"litres":14000},
  {"cm":99.10,"litres":15000},{"cm":104.00,"litres":16000},
  {"cm":109.10,"litres":17000},{"cm":114.00,"litres":18000},
  {"cm":119.00,"litres":19000},{"cm":123.90,"litres":20000},
  {"cm":128.80,"litres":21000},{"cm":133.80,"litres":22000},
  {"cm":138.70,"litres":23000},{"cm":143.70,"litres":24000},
  {"cm":148.70,"litres":25000},{"cm":153.50,"litres":26000},
  {"cm":158.50,"litres":27000},{"cm":163.60,"litres":28000},
  {"cm":168.80,"litres":29000},{"cm":174.00,"litres":30000},
  {"cm":178.60,"litres":31000},{"cm":185.00,"litres":32000},
  {"cm":190.50,"litres":33000},{"cm":196.50,"litres":34000},
  {"cm":202.60,"litres":35000},{"cm":209.00,"litres":36000},
  {"cm":215.80,"litres":37000},{"cm":223.30,"litres":38000},
  {"cm":232.00,"litres":39000},{"cm":243.60,"litres":40000}
]'::jsonb, true
FROM stations WHERE name = 'Mbayani';

-- Link admin and manager users to Mbayani station
UPDATE users
SET station_id = (SELECT id FROM stations WHERE name = 'Mbayani')
WHERE role IN ('admin', 'manager');
-- owner user intentionally gets no station_id (head-office level)


-- ─── STEP 5: Create new tables ───────────────────────────────

-- Pumps
CREATE TABLE IF NOT EXISTS pumps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id),
  pump_number int  NOT NULL,
  fuel_type  text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true
);
ALTER TABLE pumps ENABLE ROW LEVEL SECURITY;
CREATE POLICY pumps_select  ON pumps FOR SELECT USING (true);
CREATE POLICY pumps_service ON pumps USING (true) WITH CHECK (true);
GRANT ALL ON pumps TO authenticated;

-- Seed Mbayani pumps: 2 petrol (1, 2), 1 diesel (10)
INSERT INTO pumps (station_id, pump_number, fuel_type)
SELECT id, 1,  'PMA' FROM stations WHERE name = 'Mbayani'
UNION ALL
SELECT id, 2,  'PMA' FROM stations WHERE name = 'Mbayani'
UNION ALL
SELECT id, 10, 'AGO' FROM stations WHERE name = 'Mbayani';

-- Daily sales forms (one per station per date)
CREATE TABLE IF NOT EXISTS daily_sales_forms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id    uuid NOT NULL REFERENCES stations(id),
  form_date     date NOT NULL,
  status        text NOT NULL DEFAULT 'draft', -- draft | submitted | reconciled
  submitted_by  uuid REFERENCES users(id),
  submitted_at  timestamptz,
  checked_by    uuid REFERENCES users(id),
  receipt_reference text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(station_id, form_date)
);
ALTER TABLE daily_sales_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY dsf_select ON daily_sales_forms FOR SELECT USING (true);
CREATE POLICY dsf_insert ON daily_sales_forms FOR INSERT WITH CHECK (true);
CREATE POLICY dsf_update ON daily_sales_forms FOR UPDATE USING (true);
GRANT ALL ON daily_sales_forms TO authenticated;

-- Meter readings (per pump per form)
CREATE TABLE IF NOT EXISTS meter_readings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id       uuid NOT NULL REFERENCES daily_sales_forms(id) ON DELETE CASCADE,
  pump_id       uuid NOT NULL REFERENCES pumps(id),
  pump_number   int  NOT NULL,
  fuel_type     text NOT NULL,
  closing_meter  numeric NOT NULL DEFAULT 0,
  opening_meter  numeric NOT NULL DEFAULT 0,
  pump_test      numeric NOT NULL DEFAULT 0,
  out_flow       numeric GENERATED ALWAYS AS (closing_meter - opening_meter - pump_test) STORED
);
ALTER TABLE meter_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY mr_select ON meter_readings FOR SELECT USING (true);
CREATE POLICY mr_insert ON meter_readings FOR INSERT WITH CHECK (true);
CREATE POLICY mr_update ON meter_readings FOR UPDATE USING (true);
GRANT ALL ON meter_readings TO authenticated;

-- Sales buildup (per fuel type per form)
CREATE TABLE IF NOT EXISTS sales_buildup (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id           uuid NOT NULL REFERENCES daily_sales_forms(id) ON DELETE CASCADE,
  fuel_type         text NOT NULL, -- 'PMA' or 'AGO'
  credit_qty        numeric NOT NULL DEFAULT 0,
  credit_rate       numeric NOT NULL DEFAULT 0,
  credit_amount     numeric NOT NULL DEFAULT 0,
  petro_card_qty    numeric NOT NULL DEFAULT 0,
  petro_card_rate   numeric NOT NULL DEFAULT 0,
  petro_card_amount numeric NOT NULL DEFAULT 0,
  cash_qty          numeric NOT NULL DEFAULT 0,
  cash_rate         numeric NOT NULL DEFAULT 0,
  cash_amount       numeric NOT NULL DEFAULT 0
);
ALTER TABLE sales_buildup ENABLE ROW LEVEL SECURITY;
CREATE POLICY sb_select ON sales_buildup FOR SELECT USING (true);
CREATE POLICY sb_insert ON sales_buildup FOR INSERT WITH CHECK (true);
CREATE POLICY sb_update ON sales_buildup FOR UPDATE USING (true);
GRANT ALL ON sales_buildup TO authenticated;

-- Lubricant SKUs
CREATE TABLE IF NOT EXISTS lubricant_skus (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true
);
ALTER TABLE lubricant_skus ENABLE ROW LEVEL SECURITY;
CREATE POLICY lskus_select ON lubricant_skus FOR SELECT USING (true);
CREATE POLICY lskus_insert ON lubricant_skus FOR INSERT WITH CHECK (true);
CREATE POLICY lskus_update ON lubricant_skus FOR UPDATE USING (true);
GRANT ALL ON lubricant_skus TO authenticated;

-- Seed 32 SKUs
INSERT INTO lubricant_skus (name, unit_price) VALUES
('Battery Acid 1Ltr',                              3000),
('Battery Water 1Ltr',                             3000),
('NA Gear Oil SAE 80W90 1Lt',                     17000),
('NA Lithium Grease EP No3 1KG',                  25000),
('NA Lithium Grease EP No3 500G',                 14000),
('NA Lithium Grease MP No2 500G',                 11000),
('NA Lithium Grease MP No3 500G',                 11000),
('Petroda UCI ATF 1Ltr',                          15000),
('Petroda UCI ATF 5Ltrs',                         68000),
('Petroda UCI ATF 20Ltrs',                       276000),
('Petroda UCI Brake Fluid DOT4 500Mls',           12000),
('Petroda UCI Eng Oil 15W40 API SJ 20Ltrs',      340000),
('Petroda UCI Eng Oil SAE 15W40 API CF 5Ltrs',    85000),
('Petroda UCI Eng Oil SAE 40 CF 20Ltrs',         275000),
('Petroda UCI Eng Oil SAE 40 CF 5Ltrs',           69000),
('Petroda UCI Eng Oil SAE 40 SF/CF 500Mls',       8000),
('Petroda UCI Eng Oil SAE 40 SF/CF 5Ltrs',        69000),
('Petroda UCI EP Grease No3 1KG',                 30000),
('Petroda UCI EP Grease No3 500G',                15000),
('Petroda UCI Gear Oil CL320 20Ltrs',            350000),
('Petroda UCI Gear Oil 80W90 GL-5 1Ltr',          20000),
('Petroda UCI Gear Oil 80W90 GL-5 20Ltrs',       340000),
('Petroda UCI Gear Oil 80W90 GL-5 5Ltrs',        100000),
('Petroda UCI Hydrolic Oil AW32 20Ltrs',          264000),
('Petroda UCI Hydrolic Oil AW46 20Ltrs',          226000),
('Petroda UCI Hydrolic Oil AW68 20Ltrs',          264000),
('Petroda UCI Oil SAE 40 CF 1Ltr',                16000),
('Petroda UCI Outboard Motor TCW-3 1Ltr',         25000),
('Petroda UCI Radiator Coolant 40% 1Ltr',         16000),
('Petroda UCI SAE 40 SF/CF 1Ltr',                 16000),
('Petroda UCI SAE 5W40 SN/CF 500Ml Cyber',        12000),
('Petroda UCI SAE 5W40 SN/CF 5Ltrs Cyber',        91000);

-- Lubricant entries (per SKU per form)
CREATE TABLE IF NOT EXISTS lubricant_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id        uuid NOT NULL REFERENCES daily_sales_forms(id) ON DELETE CASCADE,
  sku_id         uuid NOT NULL REFERENCES lubricant_skus(id),
  opening_stock  numeric NOT NULL DEFAULT 0,
  received       numeric NOT NULL DEFAULT 0,
  cash_sales_qty numeric NOT NULL DEFAULT 0,
  cr_sales_qty   numeric NOT NULL DEFAULT 0,
  unit_price     numeric NOT NULL DEFAULT 0,
  cash_amount    numeric NOT NULL DEFAULT 0,
  cr_amount      numeric NOT NULL DEFAULT 0,
  closing_stock  numeric GENERATED ALWAYS AS (opening_stock + received - cash_sales_qty - cr_sales_qty) STORED
);
ALTER TABLE lubricant_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY le_select ON lubricant_entries FOR SELECT USING (true);
CREATE POLICY le_insert ON lubricant_entries FOR INSERT WITH CHECK (true);
CREATE POLICY le_update ON lubricant_entries FOR UPDATE USING (true);
GRANT ALL ON lubricant_entries TO authenticated;

-- Daily summary (one per form)
CREATE TABLE IF NOT EXISTS daily_summary (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id             uuid NOT NULL UNIQUE REFERENCES daily_sales_forms(id) ON DELETE CASCADE,
  fuel_credit_sales   numeric NOT NULL DEFAULT 0,
  petro_card_sales    numeric NOT NULL DEFAULT 0,
  fuel_cash_sales     numeric NOT NULL DEFAULT 0,
  lubs_cash_sales     numeric NOT NULL DEFAULT 0,
  airtime_sales       numeric NOT NULL DEFAULT 0,
  total_cash          numeric NOT NULL DEFAULT 0,
  cash_deposited      numeric NOT NULL DEFAULT 0,
  cheques_deposited   numeric NOT NULL DEFAULT 0,
  master_visa_card    numeric NOT NULL DEFAULT 0,
  total_deposit       numeric NOT NULL DEFAULT 0,
  under_over_deposit  numeric NOT NULL DEFAULT 0,
  tnm_opening_balance numeric NOT NULL DEFAULT 0,
  tnm_top_up          numeric NOT NULL DEFAULT 0,
  tnm_closing_balance numeric NOT NULL DEFAULT 0,
  form_completed_by   text,
  form_checked_by     text
);
ALTER TABLE daily_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY ds_select ON daily_summary FOR SELECT USING (true);
CREATE POLICY ds_insert ON daily_summary FOR INSERT WITH CHECK (true);
CREATE POLICY ds_update ON daily_summary FOR UPDATE USING (true);
GRANT ALL ON daily_summary TO authenticated;

-- Deposit slips (next-morning entry by manager)
CREATE TABLE IF NOT EXISTS deposit_slips (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id        uuid NOT NULL UNIQUE REFERENCES daily_sales_forms(id) ON DELETE CASCADE,
  submitted_at   timestamptz NOT NULL DEFAULT now(),
  deposit_amount numeric NOT NULL DEFAULT 0,
  bank_name      text,
  photo_url      text,
  reconciled     boolean NOT NULL DEFAULT false,
  variance       numeric
);
ALTER TABLE deposit_slips ENABLE ROW LEVEL SECURITY;
CREATE POLICY deposit_select ON deposit_slips FOR SELECT USING (true);
CREATE POLICY deposit_insert ON deposit_slips FOR INSERT WITH CHECK (true);
CREATE POLICY deposit_update ON deposit_slips FOR UPDATE USING (true);
GRANT ALL ON deposit_slips TO authenticated;

-- Customers (admin manages, manager selects only)
CREATE TABLE IF NOT EXISTS customers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY customers_select ON customers FOR SELECT USING (true);
CREATE POLICY customers_insert ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY customers_update ON customers FOR UPDATE USING (true);
GRANT ALL ON customers TO authenticated;

-- Fuel reconciliations (admin-only — RLS to be tightened once roles confirmed)
CREATE TABLE IF NOT EXISTS fuel_reconciliations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id               uuid NOT NULL REFERENCES daily_sales_forms(id) ON DELETE CASCADE,
  fuel_type             text NOT NULL,
  opening_stock         numeric NOT NULL DEFAULT 0,
  deliveries_received   numeric NOT NULL DEFAULT 0,
  total_outflow         numeric NOT NULL DEFAULT 0,
  book_closing_stock    numeric NOT NULL DEFAULT 0,
  dip_cm                numeric,
  physical_closing_stock numeric,
  variance              numeric,
  flagged               boolean NOT NULL DEFAULT false,
  reviewed_by           uuid REFERENCES users(id),
  reviewed_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE fuel_reconciliations ENABLE ROW LEVEL SECURITY;
CREATE POLICY fr_admin_only ON fuel_reconciliations FOR ALL USING (true);
GRANT ALL ON fuel_reconciliations TO authenticated;

-- Cash reconciliations (admin-only — RLS to be tightened once roles confirmed)
CREATE TABLE IF NOT EXISTS cash_reconciliations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id          uuid NOT NULL UNIQUE REFERENCES daily_sales_forms(id) ON DELETE CASCADE,
  expected_cash    numeric NOT NULL DEFAULT 0,
  deposited_amount numeric NOT NULL DEFAULT 0,
  variance         numeric NOT NULL DEFAULT 0,
  flagged          boolean NOT NULL DEFAULT false,
  reviewed_by      uuid REFERENCES users(id),
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cash_reconciliations ENABLE ROW LEVEL SECURITY;
CREATE POLICY cr_admin_only ON cash_reconciliations FOR ALL USING (true);
GRANT ALL ON cash_reconciliations TO authenticated;


-- ─── STEP 6: Adapt shifts table ──────────────────────────────
-- Remove shift_type (no night shift in pilot)
ALTER TABLE shifts DROP COLUMN IF EXISTS shift_type;

-- Add link to daily_sales_forms
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS form_id uuid REFERENCES daily_sales_forms(id);


-- ─── STEP 7: Verify schema ───────────────────────────────────
-- Run these queries to confirm everything is correct:

SELECT table_name, COUNT(column_name) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;

SELECT id, name FROM stations;
SELECT fuel_type, label, capacity_litres FROM tanks;
SELECT pump_number, fuel_type FROM pumps ORDER BY pump_number;
SELECT COUNT(*) FROM lubricant_skus;
