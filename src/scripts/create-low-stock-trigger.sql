-- Queue a low-stock event whenever product quantity drops below the threshold.
-- Threshold is max(products.min_quantity, 10) so we always have a hard floor at 10.

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
  ON public.stock_low_alerts (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_low_alerts_product_status
  ON public.stock_low_alerts (product_id, status);

CREATE OR REPLACE FUNCTION public.enqueue_low_stock_alert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  threshold_value integer;
  existing_id uuid;
BEGIN
  IF NEW.active IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  threshold_value := GREATEST(COALESCE(NEW.min_quantity, 0), 10);

  IF NEW.quantity <= threshold_value THEN
    SELECT id
    INTO existing_id
    FROM public.stock_low_alerts
    WHERE product_id = NEW.id
      AND status IN ('pending', 'processing', 'review_ready')
    ORDER BY created_at DESC
    LIMIT 1;

    IF existing_id IS NULL THEN
      INSERT INTO public.stock_low_alerts (
        user_id,
        product_id,
        product_name_snapshot,
        threshold,
        quantity,
        status,
        trigger_reason
      )
      VALUES (
        NEW.user_id,
        NEW.id,
        NEW.name,
        threshold_value,
        NEW.quantity,
        'pending',
        'quantity_below_threshold'
      );
    ELSE
      UPDATE public.stock_low_alerts
      SET
        quantity = NEW.quantity,
        threshold = threshold_value,
        product_name_snapshot = NEW.name,
        trigger_reason = 'quantity_updated_still_low',
        updated_at = now()
      WHERE id = existing_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_low_stock_alert ON public.products;

CREATE TRIGGER trg_enqueue_low_stock_alert
AFTER INSERT OR UPDATE OF quantity, min_quantity, active
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_low_stock_alert();
