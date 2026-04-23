-- MIRA — conversation history. LLM free-form text lives here, NEVER in decision_ledger.
-- Template-enforced ledger stays clean. This table is the single place chat transcripts
-- are stored (the catalog-review table is separate for F1 LLM output).
-- Run with: npm run db:prepare:mira-conversation-history

CREATE TABLE IF NOT EXISTS public.mira_conversation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id text NOT NULL,
  role text NOT NULL,
  content text,
  tool_calls jsonb,
  tool_call_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mira_conversation_session
  ON public.mira_conversation_history (user_id, session_id, created_at);
