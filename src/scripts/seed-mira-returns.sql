-- MIRA — seed a small, realistic set of returns for demo depth.
-- Feeds query_returns, returns_pattern_v1, carrier_audit_v1.
-- Idempotent via the unique constraint ux_operational_objects_source on
-- (source_channel, kind, external_id). Uses a deterministic HACKATHON user_id.

DO $$
DECLARE
  uid uuid := '00000000-0000-0000-0000-000000000001';
  -- returns spread over the last 60 days, mixed reasons across top SKUs.
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('RET-000001', 'amazon_de',         'NKS-00079', 1,  26400,  3,  'damaged_in_transit'),
      ('RET-000002', 'amazon_de',         'NKS-00079', 1,  26400,  9,  'damaged_in_transit'),
      ('RET-000003', 'amazon_de',         'NKS-00079', 2,  52800, 17,  'not_as_described'),
      ('RET-000004', 'google_shopping_de','NKS-00079', 1,  26400, 31,  'damaged_in_transit'),
      ('RET-000005', 'amazon_de',         'NKS-00112', 1,  42600,  4,  'wrong_size'),
      ('RET-000006', 'amazon_fr',         'NKS-00108', 1,  95500, 12,  'damaged_in_transit'),
      ('RET-000007', 'amazon_fr',         'NKS-00108', 1,  95500, 22,  'changed_mind'),
      ('RET-000008', 'google_shopping_fr','NKS-00108', 1,  95500, 38,  'not_as_described'),
      ('RET-000009', 'amazon_fr',         'NKS-00050', 1,  61400,  6,  'damaged_in_transit'),
      ('RET-000010', 'amazon_fr',         'NKS-00050', 1,  61400, 27,  'changed_mind'),
      ('RET-000011', 'amazon_it',         'NKS-00070', 1, 163200, 13,  'wrong_size'),
      ('RET-000012', 'amazon_de',         'NKS-00191', 1,  24450, 19,  'damaged_in_transit'),
      ('RET-000013', 'amazon_it',         'NKS-00176', 1,  30650,  8,  'not_as_described'),
      ('RET-000014', 'amazon_fr',         'NKS-00098', 1,  22600, 45,  'changed_mind'),
      ('RET-000015', 'google_shopping_fr','NKS-00177', 1,  13500, 51,  'damaged_in_transit')
    ) AS t(external_id, source_channel, sku, quantity, refund_cents, days_ago, reason_code)
  LOOP
    INSERT INTO public.operational_objects
      (user_id, source_channel, kind, external_id, sku, status, quantity, amount_cents, currency, occurred_at, raw_payload)
    VALUES (
      uid,
      r.source_channel,
      'return',
      r.external_id,
      r.sku,
      'received',
      r.quantity,
      r.refund_cents,
      'EUR',
      NOW() - (r.days_ago || ' days')::interval,
      jsonb_build_object(
        'reason_code', r.reason_code,
        'refund_amount_cents', r.refund_cents,
        'channel', r.source_channel
      )
    )
    ON CONFLICT (source_channel, kind, external_id) DO NOTHING;
  END LOOP;
END $$;
