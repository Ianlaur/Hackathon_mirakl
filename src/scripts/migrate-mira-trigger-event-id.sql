-- MIRA — additive migration: add trigger_event_id column to decision_ledger.
-- Links every decision back to the operational_objects row that triggered it
-- (external_id of the source order/return/event). Kept as TEXT for portability.
-- Run with: npm run db:prepare:mira-trigger-event-id
-- Idempotent: IF NOT EXISTS on column + index.

ALTER TABLE public.decision_ledger
  ADD COLUMN IF NOT EXISTS trigger_event_id text;

CREATE INDEX IF NOT EXISTS idx_decision_ledger_trigger_event
  ON public.decision_ledger (trigger_event_id);
