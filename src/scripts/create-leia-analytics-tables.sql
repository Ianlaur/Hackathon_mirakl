-- Financial snapshots + marketing analytics — read-only intelligence surface for Leia.
-- Values are seeded to match the Orders page widgets so Leia can reason on real numbers
-- even though the external finance/analytics integrations aren't live yet.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS public.financial_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_type text NOT NULL,        -- 'month' | 'year'
  period_start date NOT NULL,
  period_end date NOT NULL,
  source text NOT NULL DEFAULT 'aggregate', -- 'aggregate' | channel name
  revenue_cents bigint NOT NULL DEFAULT 0,
  cost_cents bigint NOT NULL DEFAULT 0,
  margin_cents bigint NOT NULL DEFAULT 0,
  margin_pct numeric(5, 2),
  cashflow_in_cents bigint NOT NULL DEFAULT 0,
  cashflow_out_cents bigint NOT NULL DEFAULT 0,
  receivables_cents bigint NOT NULL DEFAULT 0,
  payables_cents bigint NOT NULL DEFAULT 0,
  overdue_receivables_cents bigint NOT NULL DEFAULT 0,
  overdue_payables_cents bigint NOT NULL DEFAULT 0,
  previous_period_revenue_cents bigint,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_financial_snapshots
  ON public.financial_snapshots (user_id, period_type, period_start, source);
CREATE INDEX IF NOT EXISTS idx_financial_snapshots_user
  ON public.financial_snapshots (user_id, period_end DESC);

CREATE TABLE IF NOT EXISTS public.marketing_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  day date NOT NULL,
  channel text NOT NULL,           -- 'all' or a source_channel like 'amazon_fr'
  visits integer NOT NULL DEFAULT 0,
  sessions integer NOT NULL DEFAULT 0,
  orders integer NOT NULL DEFAULT 0,
  sales_cents bigint NOT NULL DEFAULT 0,
  conversion_pct numeric(5, 2),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_marketing_analytics
  ON public.marketing_analytics (user_id, day, channel);
CREATE INDEX IF NOT EXISTS idx_marketing_analytics_user_day
  ON public.marketing_analytics (user_id, day DESC);
