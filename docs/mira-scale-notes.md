# MIRA at 10K SKUs — what breaks, what we fix

MIRA ships today for Nordika Studio: 200 SKUs × 6 storefronts × ~60 orders/day.
The pitch claims the architecture scales — here is an honest audit of what
starts to bend at 50× the current load, with concrete fixes.

## 1. Atlas aggregation (home screen)

**What breaks.** `GET /api/mira/atlas` runs 6 Prisma queries (group-by channel,
findMany pending, group-by handled, findMany stock, findUnique founder,
findFirst shield, findMany oversells). At 10K SKUs the `findMany stockState`
pulls 10K rows per request; dashboard refreshes every 15s → ~80 MB/min per
connected founder.

**Fix.**
- Materialized view `mira_atlas_snapshot` refreshed by the scheduler (see §4)
  once per minute. `/api/mira/atlas` reads one row.
- Stock-health gauge computed in SQL, not JS: `CASE WHEN on_hand / velocity_per_day < 7 THEN 1 ELSE 0 END`.
- Drop the `findMany stockState` full scan; keep only `COUNT(*) FILTER (WHERE …)`.

## 2. Decision ledger pagination

**What breaks.** `/api/mira/ledger` returns 20 rows `ORDER BY created_at DESC`.
With 10K SKUs generating ~500 decisions/day, ledger grows ~180K rows/year.
Naive `LIMIT/OFFSET` stops being cheap past page 100.

**Fix.**
- Keyset pagination: `WHERE created_at < :cursor ORDER BY created_at DESC LIMIT 20`.
- Composite index `(user_id, created_at DESC)` already present in schema.
- Archive decisions > 12 months to `decision_ledger_archive` nightly.

## 3. Supabase Realtime throughput

**What breaks.** DecisionFeed and AtlasHome subscribe to `postgres_changes` on
`decision_ledger`. At 500 decisions/day × 1000 connected devices = 500K
broadcast events/day. Supabase free tier caps at 200 concurrent clients; throughput
scales with replication slot health.

**Fix.**
- Filter server-side by `user_id` in the Realtime filter, not in the client.
- Debounce client-side: collapse bursts of >3 inserts/s into one refetch.
- For multi-tenant deployment, one Realtime channel per `user_id` instead of
  one global channel.

## 4. Scheduler (nightly recon + morning digest)

**What breaks today.** No real scheduler. Morning digest relies on
`localStorage.first-visit-of-day` client-side. Nightly stock reconciliation
doesn't exist — `reconciliation_variance_v1` template has no writer.

**Fix at scale.**
- Vercel cron (or pg_cron directly on Supabase) hitting `/api/mira/briefing/build`
  and `/api/mira/recon/nightly` at fixed times.
- Recon compares `operational_objects` sum vs `stock_state.on_hand` per SKU;
  variance > 3% → `reconciliation_variance_v1` written to ledger.
- Each job batches 500 SKUs per OpenAI call max (token budget §6).

## 5. Ingestion batching

**What breaks.** `scripts/run-mira-ingestion.ts` loads JSONL in one transaction.
At 10K SKUs × 6 channels × hourly snapshot, one ingestion batch = ~60K rows.
Prisma `createMany` with per-row JSON parsing blocks the event loop.

**Fix.**
- Stream the JSONL; `createMany` in chunks of 1000 with `skipDuplicates: true`.
- Use `COPY FROM STDIN` via raw SQL for the initial backfill.
- Keep round-trip verification (we compute a hash per batch) but on samples,
  not full dataset, in production.

## 6. OpenAI token budget for conversation context

**What breaks.** The system prompt is ~2K tokens. Morning briefing context
today pulls `/api/mira/briefing` summary (~500 tokens). At 10K SKUs, if we
naively included the full queued decision list, briefing context alone would
blow past gpt-4o's efficient context window on a cold start.

**Fix.**
- Briefing injects only the top 10 queued decisions by recency, not all.
- For long conversations, we summarize turns >20 using a cheaper model (gpt-4o-mini)
  and drop raw older messages from the OpenAI request — keep them in
  `mira_conversation_history` for audit but not in the LLM context.
- Tool results > 4KB truncated with `…(truncated, N more rows)` before being
  appended as `role: tool` messages.

## 7. Cross-tenant isolation (SaaS vector)

**What breaks.** Today one user_id = one Nordika. If we onboard a second
seller, `/api/mira/atlas` and DecisionFeed are already scoped by `userId`, but:
- `autonomy_config` is not RLS-enforced at the DB level.
- `decision_templates` is shared globally (not per-tenant).

**Fix.**
- Enable Supabase RLS on every MIRA table with `USING (user_id = auth.uid())`.
- Template registry stays global; only `decision_ledger` + `catalog_review_records`
  need per-tenant scoping.
- Pass a bearer token through to `/api/mira/*` routes; current `getCurrentUserId`
  returns the hackathon constant — swap for JWT extraction.

## 8. Template renderer perf

**Not a break.** `render(templateId, inputs)` is a dict lookup + one string
interpolation. Cost is O(1) with a handful of properties. No change needed up to
hundreds of thousands of decisions/day.

---

## One-line summary for the jury

*"Atlas and DecisionFeed break first at 10K SKUs — both fixed by replacing
full-scan aggregates with a materialized snapshot refreshed by pg_cron, and
filtering Realtime on the server side. Ledger, ingestion, and token budget all
have specific fixes (§2, §5, §6). Nothing in `tools_math`, templates, or policy
changes — those are already O(1)."*
