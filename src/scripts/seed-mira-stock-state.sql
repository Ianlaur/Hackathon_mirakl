-- MIRA — seed stock_state from real Products + 30-day order history.
-- Powers predict_stockout, query_stock, oversell detection.
-- Idempotent via ON CONFLICT on (user_id, sku).

INSERT INTO public.stock_state
  (user_id, sku, on_hand, incoming, reserved, velocity_per_week, lead_time_weeks, buffer_weeks, last_movement_at)
SELECT
  p.user_id,
  p.sku,
  p.quantity::int                               AS on_hand,
  0                                             AS incoming,
  0                                             AS reserved,
  COALESCE(v.units_per_week, 0)::numeric(10,2)  AS velocity_per_week,
  GREATEST(1, (COALESCE(p.supplier_lead_time_days, 7)::numeric / 7))::numeric(5,2) AS lead_time_weeks,
  2::numeric(5,2)                               AS buffer_weeks,
  NOW()                                         AS last_movement_at
FROM public.products p
LEFT JOIN (
  SELECT
    sku,
    (SUM(quantity)::numeric / 30.0 * 7.0) AS units_per_week
  FROM public.operational_objects
  WHERE kind = 'order'
    AND occurred_at >= NOW() - INTERVAL '30 days'
    AND sku IS NOT NULL
  GROUP BY sku
) v ON v.sku = p.sku
WHERE p.active = true
ON CONFLICT ON CONSTRAINT ux_stock_state_user_sku
DO UPDATE SET
  on_hand = EXCLUDED.on_hand,
  velocity_per_week = EXCLUDED.velocity_per_week,
  lead_time_weeks = EXCLUDED.lead_time_weeks,
  last_movement_at = EXCLUDED.last_movement_at;
