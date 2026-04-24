BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO public.commercial_calendar (region, event_name, event_date, impact_tag, magnitude_hint, notes)
SELECT region, event_name, event_date::date, impact_tag, magnitude_hint, notes
FROM (
  VALUES
    ('DE', 'Back-to-school Germany', '2026-08-25', 'school', 'medium', 'Seeded for Leia N-1 seasonality analysis'),
    ('IT', 'Christmas IT', '2026-12-20', 'holiday', 'high', 'Seeded for Leia N-1 seasonality analysis'),
    ('DE', 'Christmas DE', '2026-12-20', 'holiday', 'high', 'Seeded for Leia N-1 seasonality analysis')
) AS seed(region, event_name, event_date, impact_tag, magnitude_hint, notes)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.commercial_calendar calendar
  WHERE calendar.region = seed.region
    AND lower(calendar.event_name) = lower(seed.event_name)
    AND calendar.event_date = seed.event_date::date
);

DELETE FROM public.operational_objects
WHERE raw_payload->>'source' = 'n1_seed';

WITH settings AS (
  SELECT '00000000-0000-0000-0000-000000000001'::uuid AS user_id
),
sku_pool AS (
  SELECT
    s.user_id,
    s.sku,
    COALESCE(p.name, s.sku) AS product_name,
    COALESCE(s.on_hand, 0) AS on_hand,
    COALESCE(s.velocity_per_week, 0)::numeric AS velocity_per_week,
    CASE
      WHEN lower(COALESCE(p.name, '')) LIKE '%lamp%'
        OR lower(COALESCE(p.name, '')) LIKE '%lampe%'
        OR lower(COALESCE(p.name, '')) LIKE '%applique%'
        OR lower(COALESCE(p.name, '')) LIKE '%suspension%' THEN 'lamps'
      WHEN lower(COALESCE(p.name, '')) LIKE '%rug%'
        OR lower(COALESCE(p.name, '')) LIKE '%tapis%' THEN 'rugs'
      WHEN lower(COALESCE(p.name, '')) LIKE '%mirror%'
        OR lower(COALESCE(p.name, '')) LIKE '%miroir%' THEN 'mirrors'
      WHEN lower(COALESCE(p.name, '')) LIKE '%chair%'
        OR lower(COALESCE(p.name, '')) LIKE '%chaise%'
        OR lower(COALESCE(p.name, '')) LIKE '%fauteuil%' THEN 'chairs'
      WHEN lower(COALESCE(p.name, '')) LIKE '%desk%'
        OR lower(COALESCE(p.name, '')) LIKE '%bureau%' THEN 'desks'
      WHEN lower(COALESCE(p.name, '')) LIKE '%shelf%'
        OR lower(COALESCE(p.name, '')) LIKE '%shelves%'
        OR lower(COALESCE(p.name, '')) LIKE '%etagere%'
        OR lower(COALESCE(p.name, '')) LIKE '%bibliotheque%'
        OR lower(COALESCE(p.name, '')) LIKE '%bibliotheque%' THEN 'shelves'
      WHEN lower(COALESCE(p.name, '')) LIKE '%table%' THEN 'tables'
      ELSE 'decor'
    END AS inferred_category,
    ROW_NUMBER() OVER (
      ORDER BY COALESCE(s.velocity_per_week, 0)::numeric DESC, COALESCE(s.on_hand, 0) DESC, s.sku
    ) AS rn,
    COUNT(*) OVER () AS total_count
  FROM public.stock_state s
  LEFT JOIN public.products p
    ON p.user_id = s.user_id
   AND p.sku = s.sku
  JOIN settings ON settings.user_id = s.user_id
  WHERE s.sku IS NOT NULL
),
seed_specs AS (
  SELECT *
  FROM (
    VALUES
      ('soldes_ete_fr', 'Soldes ete France', 'event', 'FR',
        '2025-06-25T08:00:00Z'::timestamptz, '2025-07-22T22:00:00Z'::timestamptz,
        110, ARRAY['chairs','tables','desks','chairs','tables']::text[], ARRAY['amazon_fr','google_fr']::text[]),
      ('ferragosto_it', 'Ferragosto', 'event', 'IT',
        '2025-08-10T07:30:00Z'::timestamptz, '2025-08-20T22:00:00Z'::timestamptz,
        50, ARRAY['lamps','lamps','lamps','rugs','decor']::text[], ARRAY['amazon_it','google_it']::text[]),
      ('back_to_school_de', 'Back-to-school Germany', 'event', 'DE',
        '2025-08-15T08:00:00Z'::timestamptz, '2025-09-05T21:00:00Z'::timestamptz,
        65, ARRAY['desks','chairs','shelves','desks','chairs']::text[], ARRAY['amazon_de','google_de']::text[]),
      ('black_friday_all', 'Black Friday', 'event', 'ALL',
        '2025-11-24T00:30:00Z'::timestamptz, '2025-11-28T23:30:00Z'::timestamptz,
        250, ARRAY['tables','chairs','desks','lamps','rugs','mirrors','decor']::text[],
        ARRAY['amazon_fr','google_fr','amazon_it','google_it','amazon_de','google_de']::text[]),
      ('christmas_all', 'Christmas', 'event', 'ALL',
        '2025-12-15T07:00:00Z'::timestamptz, '2025-12-22T22:00:00Z'::timestamptz,
        130, ARRAY['lamps','lamps','rugs','mirrors','mirrors']::text[],
        ARRAY['amazon_fr','google_fr','amazon_it','google_it','amazon_de','google_de']::text[]),
      ('baseline_ferragosto_it', 'Ferragosto baseline', 'baseline', 'IT',
        '2025-05-20T08:00:00Z'::timestamptz, '2025-06-20T21:00:00Z'::timestamptz,
        110, ARRAY['lamps','lamps','lamps','lamps','rugs','decor']::text[], ARRAY['amazon_it','google_it']::text[]),
      ('baseline_feb_all', 'Baseline February', 'baseline', 'ALL',
        '2025-02-03T08:00:00Z'::timestamptz, '2025-02-26T21:00:00Z'::timestamptz,
        95, ARRAY['tables','chairs','desks','lamps','rugs','mirrors','decor']::text[],
        ARRAY['amazon_fr','google_fr','amazon_it','google_it','amazon_de','google_de']::text[]),
      ('baseline_march_fr', 'Baseline March', 'baseline', 'FR',
        '2025-03-02T08:00:00Z'::timestamptz, '2025-03-28T20:30:00Z'::timestamptz,
        85, ARRAY['chairs','tables','desks','decor']::text[], ARRAY['amazon_fr','google_fr']::text[]),
      ('baseline_oct_all', 'Baseline October', 'baseline', 'ALL',
        '2025-10-03T08:00:00Z'::timestamptz, '2025-10-27T21:00:00Z'::timestamptz,
        100, ARRAY['tables','chairs','desks','lamps','rugs','mirrors','decor']::text[],
        ARRAY['amazon_fr','google_fr','amazon_it','google_it','amazon_de','google_de']::text[])
  ) AS specs(event_key, event_name, payload_event, region, start_ts, end_ts, order_count, categories, channels)
),
expanded_orders AS (
  SELECT
    settings.user_id,
    specs.*,
    seq,
    specs.start_ts
      + ((specs.end_ts - specs.start_ts)
        * (((seq - 1)::double precision) / GREATEST(specs.order_count - 1, 1)::double precision))
      + (((seq * 37) % 180) * INTERVAL '1 minute') AS order_ts,
    specs.categories[((seq - 1) % array_length(specs.categories, 1)) + 1] AS target_category,
    specs.channels[((seq - 1) % array_length(specs.channels, 1)) + 1] AS source_channel,
    CASE WHEN seq % 4 = 0 THEN 'delivered' ELSE 'shipped' END AS status,
    CASE
      WHEN specs.event_key = 'black_friday_all' AND seq % 8 = 0 THEN 2
      WHEN specs.event_key = 'christmas_all' AND seq % 9 = 0 THEN 2
      ELSE 1
    END AS quantity
  FROM seed_specs specs
  CROSS JOIN settings
  CROSS JOIN LATERAL generate_series(1, specs.order_count) AS seq
),
picked_orders AS (
  SELECT
    orders.*,
    picked.sku,
    picked.product_name,
    picked.inferred_category
  FROM expanded_orders orders
  CROSS JOIN LATERAL (
    SELECT sku_pool.*
    FROM sku_pool
    WHERE sku_pool.user_id = orders.user_id
    ORDER BY
      CASE WHEN sku_pool.inferred_category = orders.target_category THEN 0 ELSE 1 END,
      CASE
        WHEN (orders.seq % 10) < 7
          THEN CASE
            WHEN sku_pool.rn = ((orders.seq - 1) % GREATEST(1, LEAST(4, sku_pool.total_count::int))) + 1 THEN 0
            WHEN sku_pool.rn <= GREATEST(1, CEIL(sku_pool.total_count * 0.15)::int) THEN 1
            ELSE 2
          END
        ELSE CASE
          WHEN sku_pool.rn = ((orders.seq - 1) % GREATEST(1, LEAST(20, sku_pool.total_count::int))) + 1 THEN 0
          WHEN sku_pool.rn > GREATEST(1, CEIL(sku_pool.total_count * 0.15)::int) THEN 1
          ELSE 2
        END
      END,
      ((sku_pool.rn * 97 + orders.seq * 31 + char_length(orders.event_key)) % GREATEST(sku_pool.total_count, 1)),
      sku_pool.sku
    LIMIT 1
  ) picked
),
final_orders AS (
  SELECT
    user_id,
    source_channel,
    'order' AS kind,
    'n1-' || event_key || '-' || LPAD(seq::text, 4, '0') AS external_id,
    sku,
    status,
    quantity,
    CASE target_category
      WHEN 'chairs' THEN 12900
      WHEN 'tables' THEN 21900
      WHEN 'desks' THEN 17900
      WHEN 'shelves' THEN 9900
      WHEN 'lamps' THEN 8900
      WHEN 'rugs' THEN 11900
      WHEN 'mirrors' THEN 10900
      ELSE 6900
    END * quantity AS amount_cents,
    'EUR' AS currency,
    order_ts AS occurred_at,
    order_ts + INTERVAL '5 minutes' AS ingested_at,
    CASE
      WHEN source_channel LIKE 'amazon_%' THEN jsonb_build_object(
        'source', 'n1_seed',
        'event', payload_event,
        'seasonal_event', event_name,
        'region', region,
        'category', target_category,
        'AmazonOrderId', 'n1-' || event_key || '-' || LPAD(seq::text, 4, '0'),
        'PurchaseDate', order_ts,
        'SellerSKU', sku,
        'QuantityOrdered', quantity,
        'OrderStatus', status,
        'product_name', product_name
      )
      ELSE jsonb_build_object(
        'source', 'n1_seed',
        'event', payload_event,
        'seasonal_event', event_name,
        'region', region,
        'category', target_category,
        'order_id', 'n1-' || event_key || '-' || LPAD(seq::text, 4, '0'),
        'created_at', order_ts,
        'line_items', jsonb_build_array(jsonb_build_object(
          'product_sku', sku,
          'quantity', quantity,
          'title', product_name
        )),
        'status', status,
        'product_name', product_name
      )
    END AS raw_payload
  FROM picked_orders
)
INSERT INTO public.operational_objects (
  user_id,
  source_channel,
  kind,
  external_id,
  sku,
  status,
  quantity,
  amount_cents,
  currency,
  occurred_at,
  ingested_at,
  raw_payload
)
SELECT
  user_id,
  source_channel,
  kind,
  external_id,
  sku,
  status,
  quantity,
  amount_cents,
  currency,
  occurred_at,
  ingested_at,
  raw_payload
FROM final_orders;

COMMIT;
