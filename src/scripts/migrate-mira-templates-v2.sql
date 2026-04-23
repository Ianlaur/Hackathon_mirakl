-- MIRA — additive migration for the template allowlist.
-- Adds: reputation_shield_v1, seasonal_prediction_v1, carrier_audit_v1, supplier_scorecard_v1.
-- Run with: npm run db:prepare:mira-templates-v2
-- Idempotent: ON CONFLICT DO NOTHING on duplicate template ids.

INSERT INTO public.decision_templates (id, description) VALUES
  ('reputation_shield_v1',       'Auto-protection of primary storefront when founder is away'),
  ('seasonal_prediction_v1',     'Predicted demand growth for a SKU around a commercial event'),
  ('carrier_audit_v1',           'Carrier damage-rate audit for a SKU (F5 RADAR)'),
  ('supplier_scorecard_v1',      'Supplier lead-time and defect-rate summary (F5 RADAR)')
ON CONFLICT (id) DO NOTHING;
