# MIRA Supply OS

MIRA Supply OS is a conversational AI agent for a solo French furniture
seller operating 200 SKUs across 6 storefronts (Amazon FR/IT/DE, Google
Shopping FR/IT/DE). The founder — "Marie" — talks to MIRA via chat or
voice. MIRA reads operational data, predicts demand, and acts under a
strict governance layer (template-enforced decisions, per-action-type
autonomy, audit-trail ledger) while keeping the founder visibly in
control at all times.

Hackathon: Mirakl UC1, Topic 2 (Order Processing & Supply).

## Stack

- **Next.js 14** App Router + TypeScript
- **Supabase Postgres** + Realtime
- **OpenAI GPT-4o** (function calling, Whisper for voice)
- **Prisma** + Zod
- **Tailwind CSS** (Mirakl brand tokens)

## Features (F1–F6)

- **F1 Flash Onboarding** — drop a supplier CSV, GPT-4o maps columns to
  Mirakl taxonomies, founder approves. Reasoning stored in
  `catalog_review_records` (never in the decision ledger).
- **F2 Smart Calendar + Reputation Shield** — when the founder enters
  Vacation / Sick state, buffers inflate ×1.25, lead times ×1.4, and the
  Reputation Shield auto-protects the primary storefront by reducing
  exposure on the others.
- **F3 White Supply Atlas** — the home screen. Minimalist map of FR / IT
  / DE with animated supply pulses between storefronts, per-region
  badges (orders, revenue, pending, handled), and Intent-Based Shielding
  ripple when an oversell is detected.
- **F4 Predictive Seasonality (N-1)** — for each upcoming commercial
  calendar event, attempt year-over-year comparison and fall back to a
  magnitude-based growth factor labelled `seasonal_assumption`. All math
  through `tools_math`.
- **F5 MIRA RADAR** — plugin tab with carrier damage audit, supplier
  scorecard, and Profit Recovery estimate.
- **F6 The Orb** — always-on governance control. Per-action-type mode
  (Watching / Ask me / Handle it) with a one-tap "Tout passer en veille".

## Invariants

- **No LLM math.** Every number in a decision ledger row comes from
  `src/lib/mira/tools_math.ts` (`calculateVelocity`, `calculateStockoutDays`,
  `calculateReorderQty`, etc.). Covered by `npm run test:mira-math` (15/15).
- **Template-only ledger.** `decision_ledger` only accepts rows whose
  `template_id` is in the allowed registry. Enforced by a Postgres
  `BEFORE INSERT` trigger and by `npm run test:mira-invariant`.
- **Free-form LLM text stays out of the ledger.** Chat transcripts live
  in `mira_conversation_history`; F1 catalog reasoning in
  `catalog_review_records`.
- **Re-playability.** Every ledger row links back to the operational
  object that triggered it via `trigger_event_id`.

## Quickstart

```bash
cd src
cp .env.example .env            # fill in DATABASE_URL, DIRECT_URL,
                                # OPENAI_API_KEY, SUPABASE_*
npm install
npm run db:prepare:mira                          # create MIRA tables
npm run db:prepare:mira-templates-v2             # template allowlist v2
npm run db:prepare:mira-trigger-event-id         # ledger trigger_event_id
npm run db:prepare:mira-conversation-history     # chat persistence
npm run db:prepare:mira-realtime                 # enable Supabase Realtime
npm run db:seed:mira-calendar                    # seed 2026 events
npm run db:seed:mira-stock-state                 # derive stock_state per SKU
npm run db:seed:mira-returns                     # seeded return signals
npm run mira:ingest                              # ingest JSONL fixtures
npm run dev
```

Open `http://localhost:3000/dashboard`.

## Required environment

```bash
DATABASE_URL=...                       # Supabase pooler
DIRECT_URL=...                         # Supabase direct
HACKATHON_USER_ID=...                  # UUID scoping everything
OPENAI_API_KEY=...                     # gpt-4o + whisper-1
MIRA_MODEL=gpt-4o
NEXT_PUBLIC_SUPABASE_URL=...           # browser Realtime
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Tests

```bash
npm run test:mira-math            # tools_math unit tests (15/15)
npm run test:mira-invariant       # TS ↔ DB ↔ ledger template consistency
npm run test:mira-decision-mutations
npm run test:dashboard-mira-only
```

## Scale

What breaks at 10K SKUs and how we fix it is documented in
[`docs/mira-scale-notes.md`](docs/mira-scale-notes.md) — covers Atlas
aggregation cost, ledger pagination, Realtime throughput, scheduler,
ingestion batching, token budget, and multi-tenant RLS.

## Repository layout

```
src/app/                     # Next.js App Router
  dashboard/                 # Atlas home (F3)
  activity/                  # ledger viewer
  actions/                   # pending decisions inbox
  catalog/                   # F1 CSV upload + mapping review
  radar/                     # F5 plugin
  api/mascot/                # unified chat endpoint + Whisper
  api/mira/                  # atlas, ledger, briefing, autonomy,
                             # decisions, catalog-mapping, radar
src/components/
  atlas/                     # AtlasHome, MorningBriefingCard
  orb/                       # OrbModePanel (governance control)
  mira/                      # DecisionFeed (realtime)
  MascotOrb.tsx              # floating orb (governance indicator)
  MascotChatDrawer.tsx       # chat UI (voice + markdown + Spotlight)
src/lib/mira/
  agents/                    # stock, restock, returns, founderContext
  tools_math.ts              # ALL arithmetic (no LLM math)
  tools_read.ts              # 11 READ tools
  tools_action.ts            # 6 ACTION tools
  policy.ts                  # FounderPolicy + Reputation Shield
  templates.ts               # 14 immutable renderers
  fuse.ts                    # Safety Fuse
  briefing.ts                # morning digest
  ingestion.ts               # JSONL → operational_objects
  history.ts                 # mira_conversation_history
src/scripts/                 # migrations, seeds, tests
```
