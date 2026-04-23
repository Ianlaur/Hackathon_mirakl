-- MIRA: operational tables + decision ledger with template-only trigger.
-- Idempotent: safe to re-run. Apply with:
--   npx prisma db execute --file scripts/create-mira-tables.sql --schema prisma/schema.prisma

-- 1) operational_objects: unified orders/messages/catalog ingested from source channels.
-- raw_payload preserves the source line verbatim so a round-trip never loses fields.
CREATE TABLE IF NOT EXISTS public.operational_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_channel text NOT NULL,
  kind text NOT NULL,
  external_id text,
  sku text,
  status text,
  quantity integer,
  amount_cents integer,
  currency text,
  occurred_at timestamptz,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  raw_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operational_objects_user_kind
  ON public.operational_objects (user_id, kind);
CREATE INDEX IF NOT EXISTS idx_operational_objects_sku
  ON public.operational_objects (sku);
CREATE INDEX IF NOT EXISTS idx_operational_objects_channel
  ON public.operational_objects (source_channel);
CREATE INDEX IF NOT EXISTS idx_operational_objects_occurred_at
  ON public.operational_objects (occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_operational_objects_source
  ON public.operational_objects (source_channel, kind, external_id);

-- 2) decision_templates: the single source of truth the ledger trigger validates against.
-- Adding a template is a 2-step change: insert here + register a render() in lib/mira/templates.ts.
CREATE TABLE IF NOT EXISTS public.decision_templates (
  id text PRIMARY KEY,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.decision_templates (id, description) VALUES
  ('oversell_risk_v1',           'Detected oversell risk for a SKU based on velocity vs on-hand'),
  ('restock_proposal_v1',        'Proposed reorder quantity for a SKU'),
  ('vacation_queue_v1',          'Decision queued due to founder Vacation/Sick state'),
  ('returns_pattern_v1',         'Detected returns pattern above baseline for SKU/reason'),
  ('reconciliation_variance_v1', 'Nightly reconciliation variance for a SKU vs expected'),
  ('fuse_tripped_v1',            'Safety fuse tripped on metric threshold'),
  ('calendar_posture_v1',        'Buffer adjustment driven by commercial calendar event'),
  ('listing_pause_v1',           'Paused a listing on a channel'),
  ('listing_resume_v1',          'Resumed a listing on a channel'),
  ('buffer_adjustment_v1',       'Adjusted safety buffer for a SKU')
ON CONFLICT (id) DO NOTHING;

-- 3) decision_ledger: template-only action trace. Every row is rendered by a known template.
CREATE TABLE IF NOT EXISTS public.decision_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sku text,
  channel text,
  action_type text NOT NULL,
  template_id text NOT NULL,
  logical_inference text NOT NULL,
  raw_payload jsonb NOT NULL,
  status text NOT NULL,
  reversible boolean NOT NULL DEFAULT true,
  source_agent text,
  triggered_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz,
  founder_decision_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_decision_ledger_user_status_created
  ON public.decision_ledger (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_ledger_sku
  ON public.decision_ledger (sku);
CREATE INDEX IF NOT EXISTS idx_decision_ledger_template
  ON public.decision_ledger (template_id);

-- 4) THE invariant: BEFORE INSERT trigger rejects unknown template_ids.
-- Complements the Python-side render() guard and the test-invariant script.
CREATE OR REPLACE FUNCTION public.enforce_decision_template()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.decision_templates WHERE id = NEW.template_id
  ) THEN
    RAISE EXCEPTION
      'decision_ledger: unknown template_id "%". Register it in public.decision_templates first.',
      NEW.template_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_decision_template ON public.decision_ledger;

CREATE TRIGGER trg_enforce_decision_template
BEFORE INSERT ON public.decision_ledger
FOR EACH ROW
EXECUTE FUNCTION public.enforce_decision_template();

-- 5) stock_state: current inventory snapshot per SKU (velocity + lead time + buffer for agents).
CREATE TABLE IF NOT EXISTS public.stock_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sku text NOT NULL,
  on_hand integer NOT NULL DEFAULT 0,
  incoming integer NOT NULL DEFAULT 0,
  reserved integer NOT NULL DEFAULT 0,
  velocity_per_week numeric(10, 2) NOT NULL DEFAULT 0,
  lead_time_weeks numeric(5, 2) NOT NULL DEFAULT 2,
  buffer_weeks numeric(5, 2) NOT NULL DEFAULT 2,
  last_movement_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_stock_state_user_sku UNIQUE (user_id, sku)
);

-- 6) founder_state: singleton per user. Vacation/Sick widens safety buffers (policy.ts).
CREATE TABLE IF NOT EXISTS public.founder_state (
  user_id uuid PRIMARY KEY,
  state text NOT NULL DEFAULT 'Active',
  "until" timestamptz,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7) autonomy_config: per-action-type mode (observe | propose | auto_execute).
-- UI labels (Watching / Ask me / Handle it) are mapped client-side.
CREATE TABLE IF NOT EXISTS public.autonomy_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  mode text NOT NULL DEFAULT 'propose',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_autonomy_config_user_action UNIQUE (user_id, action_type)
);

-- 8) override_records: founder undoes/rejects a ledger decision.
CREATE TABLE IF NOT EXISTS public.override_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  decision_id uuid NOT NULL REFERENCES public.decision_ledger(id) ON DELETE CASCADE,
  reason text,
  previous_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_override_records_decision
  ON public.override_records (decision_id);

-- 9) commercial_calendar: seasonal events seed (FR/IT/DE/EU).
CREATE TABLE IF NOT EXISTS public.commercial_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region text NOT NULL,
  event_name text NOT NULL,
  event_date date NOT NULL,
  impact_tag text NOT NULL,
  magnitude_hint text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_commercial_calendar_region_event UNIQUE (region, event_name, event_date)
);

-- 10) catalog_review_records: Feature 1 LLM outputs. Separate from decision_ledger on purpose
-- (LLM free-form text does not belong in the template-enforced ledger).
CREATE TABLE IF NOT EXISTS public.catalog_review_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sku text NOT NULL,
  channel text,
  review_payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_review_records_user_created
  ON public.catalog_review_records (user_id, created_at DESC);

-- NOTE: the brief's "conversation_history" is intentionally mapped to the existing
-- public.copilot_chat_messages table. The ledger stays the ONLY template-enforced table.
