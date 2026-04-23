-- Tables du socle copilot + agent (ianlaur/dev schema)

CREATE TABLE IF NOT EXISTS public.merchant_ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  encrypted_api_key text,
  api_key_hint text,
  preferred_model text NOT NULL DEFAULT 'gpt-4.1-mini',
  autonomy_mode text NOT NULL DEFAULT 'approval_required',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.merchant_profile_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  merchant_category text,
  operating_regions text[] NOT NULL DEFAULT '{}',
  supplier_regions text[] NOT NULL DEFAULT '{}',
  supplier_names text[] NOT NULL DEFAULT '{}',
  seasonality_tags text[] NOT NULL DEFAULT '{}',
  planning_notes text,
  protected_channels text[] NOT NULL DEFAULT '{}',
  watchlist_keywords text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  scenario_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending_approval',
  reasoning_summary text NOT NULL,
  evidence_payload jsonb,
  expected_impact text,
  confidence_note text,
  approval_required boolean NOT NULL DEFAULT true,
  action_payload jsonb,
  source text NOT NULL DEFAULT 'copilot',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_recommendations_user_status_created
  ON public.agent_recommendations (user_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_recommendations_user_scenario
  ON public.agent_recommendations (user_id, scenario_type);

CREATE TABLE IF NOT EXISTS public.recommendation_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES public.agent_recommendations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_approvals_rec_created
  ON public.recommendation_approvals (recommendation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_recommendation_approvals_user_status
  ON public.recommendation_approvals (user_id, status);

CREATE TABLE IF NOT EXISTS public.agent_execution_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES public.agent_recommendations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  target text NOT NULL,
  payload jsonb,
  result_summary text,
  error_message text,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_execution_runs_rec_created
  ON public.agent_execution_runs (recommendation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_execution_runs_user_status
  ON public.agent_execution_runs (user_id, status);

CREATE TABLE IF NOT EXISTS public.agent_context_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scenario_type text NOT NULL,
  label text NOT NULL,
  context_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_context_snapshots_user_scenario
  ON public.agent_context_snapshots (user_id, scenario_type);

CREATE TABLE IF NOT EXISTS public.copilot_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copilot_chat_sessions_user_last
  ON public.copilot_chat_sessions (user_id, last_message_at);

CREATE TABLE IF NOT EXISTS public.copilot_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.copilot_chat_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  reasoning_summary text,
  evidence_payload jsonb,
  linked_recommendation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copilot_chat_messages_session_created
  ON public.copilot_chat_messages (session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_copilot_chat_messages_user_created
  ON public.copilot_chat_messages (user_id, created_at);

CREATE TABLE IF NOT EXISTS public.merchant_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  event_type text NOT NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  notes text,
  impact_level text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_calendar_events_user_start
  ON public.merchant_calendar_events (user_id, start_date);

CREATE TABLE IF NOT EXISTS public.external_context_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recommendation_id uuid REFERENCES public.agent_recommendations(id) ON DELETE SET NULL,
  title text NOT NULL,
  summary text NOT NULL,
  source_name text,
  source_url text,
  signal_type text NOT NULL,
  impact_level text NOT NULL DEFAULT 'medium',
  relevance_score integer NOT NULL DEFAULT 50,
  geography text,
  tags text[] NOT NULL DEFAULT '{}',
  starts_at timestamptz,
  ends_at timestamptz,
  evidence_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_context_signals_user_created
  ON public.external_context_signals (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_external_context_signals_user_signal_relevance
  ON public.external_context_signals (user_id, signal_type, relevance_score);
