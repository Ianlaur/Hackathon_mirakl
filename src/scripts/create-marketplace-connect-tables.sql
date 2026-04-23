-- Marketplace Connect tables — Integration Proposals + Active Connections (dialogues).
-- Future: Mirakl Connect API populates proposals + dialogues when authenticated.
-- Idempotent: safe to re-run. Apply with:
--   npx prisma db execute --file scripts/create-marketplace-connect-tables.sql --schema prisma/schema.prisma

-- 1) marketplace_proposals: incoming integration opportunities.
CREATE TABLE IF NOT EXISTS public.marketplace_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text,
  daily_users text,
  last_year_revenue text,
  status text NOT NULL DEFAULT 'pending',   -- pending | accepted | declined
  about text,
  logo_url text,
  match_score integer,                      -- 0-100, nullable until MIRA scores it
  risk_signal text,
  source text NOT NULL DEFAULT 'manual',    -- manual | mirakl_connect_api
  external_ref text,                        -- id from Mirakl Connect API when source='mirakl_connect_api'
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketplace_proposals_user
  ON public.marketplace_proposals (user_id, status, created_at DESC);

-- 2) marketplace_requirements: per-proposal checklist (Mirakl API key, catalog match, shipping, contract, ...).
CREATE TABLE IF NOT EXISTS public.marketplace_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.marketplace_proposals(id) ON DELETE CASCADE,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'pending',   -- ok | warn | pending | fail
  position integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketplace_requirements_proposal
  ON public.marketplace_requirements (proposal_id, position);

-- 3) marketplace_dialogues: conversation metadata with a counterpart.
-- Linked to a proposal (1:1 ideally) so accepting creates one.
CREATE TABLE IF NOT EXISTS public.marketplace_dialogues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  proposal_id uuid REFERENCES public.marketplace_proposals(id) ON DELETE SET NULL,
  counterpart_name text NOT NULL,
  last_message_preview text,
  last_message_at timestamptz,
  unread_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',      -- open | archived
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketplace_dialogues_user
  ON public.marketplace_dialogues (user_id, status, last_message_at DESC);

-- 4) marketplace_messages: messages inside a dialogue, from founder | counterpart | mira (autopilot).
CREATE TABLE IF NOT EXISTS public.marketplace_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dialogue_id uuid NOT NULL REFERENCES public.marketplace_dialogues(id) ON DELETE CASCADE,
  sender text NOT NULL,                     -- 'founder' | 'counterpart' | 'mira'
  body text NOT NULL,
  autopilot boolean NOT NULL DEFAULT false, -- true when MIRA autonomously sent the message
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_dialogue
  ON public.marketplace_messages (dialogue_id, created_at ASC);
