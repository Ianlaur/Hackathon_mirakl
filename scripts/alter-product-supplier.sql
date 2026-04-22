ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS supplier_lead_time_days integer DEFAULT 7,
  ADD COLUMN IF NOT EXISTS supplier_min_order_qty integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supplier_unit_cost_eur numeric(12,2);
