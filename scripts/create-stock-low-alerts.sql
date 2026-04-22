CREATE TABLE IF NOT EXISTS public.stock_low_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name_snapshot text,
  threshold integer NOT NULL DEFAULT 10,
  quantity integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  trigger_reason text,
  dust_response text,
  proposed_solution text,
  error_message text,
  processed_at timestamptz,
  recommendation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_low_alerts_user_status_created
  ON public.stock_low_alerts (user_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_stock_low_alerts_product_status
  ON public.stock_low_alerts (product_id, status);
