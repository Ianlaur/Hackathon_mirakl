-- MIRA — enable Supabase Realtime on decision_ledger so the dashboard updates live
-- whenever MIRA writes a new decision. Idempotent: safe to re-run.
--
-- Apply with:
--   npx prisma db execute --file scripts/enable-mira-realtime.sql --schema prisma/schema.prisma

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'decision_ledger'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.decision_ledger;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'override_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.override_records;
  END IF;
END$$;
