# MIRA Supply OS — Build Context

## CRITICAL: Read this first

There is an EXISTING codebase in this repo, built by teammates. Before writing ANY new code:
1. Run `find . -type f -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.sql" -o -name "*.json" | head -100` to map what exists
2. Check for n8n workflows — if they exist and work, USE THEM for edge actions (write-backs). If not, don't add n8n — use FastAPI endpoints instead.
3. Check for existing Supabase tables/migrations — EXTEND, don't replace
4. Check for existing frontend components — ADAPT, don't rewrite
5. Read ALL existing code before proposing changes

When in doubt: preserve existing work, add what's missing, refactor only what's broken.

---

## What is MIRA

MIRA Supply OS is a conversational AI agent for Nordika Studio — a solo French furniture seller (200 SKUs, 6 storefronts: Amazon FR/IT/DE + Google Shopping FR/IT/DE). The founder ("Marie") talks to MIRA via chat or voice. MIRA understands, analyzes data, predicts trends, and acts — with a visual dashboard that updates in real-time.

MIRA replaces a team of 3-5 ops people while keeping the founder visibly in control at all times.

Hackathon: Mirakl UC1, Topic 2 (Order Processing & Supply).

---

## Current Project State — 2026-04-23

**Branch:** `integrate-mira-on-iris` · 7 commits today on top of `origin/nathan-iris`.
**Backup branch:** `mira-backup` preserves the pre-integration WIP snapshot.
**Pitch:** VEN 24 avril 2026, 14h — Mirakl offices.

### Shipped this session

| Area | Status |
|---|---|
| F1 Flash Onboarding (CSV → Mirakl mapping, approve/reject) | ✅ `/catalog` + `/api/mira/catalog-mapping` |
| F2 Reputation Shield (auto-fires when founder → Vacation/Sick) | ✅ `policy.ts` + `evaluateReputationShield` |
| F3 White Supply Atlas home (map, pulses, animated flow, Intent-Based Shielding visual) | ✅ `/dashboard` (replaced old stat wall) |
| F4 Predictive Seasonality + N-1 analysis with `seasonal_assumption` fallback | ✅ `get_seasonal_patterns` tool + `commercial_calendar` seed |
| F5 MIRA RADAR plugin (carrier audit, supplier scorecard, profit recovery) | ✅ `/radar` + `/api/mira/radar` |
| F6 The Orb governance control (3-mode selector, pause-all) | ✅ `OrbModePanel` + `/api/mira/autonomy` |
| Logic-Load Pipeline (ANALYZE → POLICY → TEMPLATE → ACTION → LEDGER) | ✅ all 5 stages live |
| No-LLM-math invariant | ✅ `tools_math.ts` + 15/15 unit tests |
| Template registry (14 templates) | ✅ `templates.ts` ↔ `decision_templates` ↔ ledger consistent via invariant test |
| `trigger_event_id` on every ledger row | ✅ schema + migration applied |
| Conversation history separated from ledger | ✅ `mira_conversation_history` + `/api/mascot/history` |
| UX language remap (Watching / Ask me / Handle it, plain-French status labels) | ✅ across DecisionFeed, Orb panel, activity page |
| SIMULÉ badges on mocked integrations | ✅ Reputation Shield, supplier emails, catalog onboarding, suppliers without return data |
| Morning briefing auto-open on first visit of day | ✅ `MorningBriefingCard` on Atlas sidebar |
| Production build (`npx next build`) | ✅ exit 0 |
| Scale note (DoD #5) | ✅ `docs/mira-scale-notes.md` |
| Vercel deployment | ❌ not done — see CLAUDE.md Friday checklist below |
| n8n VPS live wire-up | ❌ JSON ready (`workflows/calendar-advisor.json`), `APP_BASE_URL` not configured |
| Loom / deck / doc tech | ❌ to do Friday before 8h |

### Unified chat — 23 tools

Single endpoint: `POST /api/mascot/chat` (the `/api/mira/chat` route was dropped during unification). Exposes:

- **7 conversational tools (from nathan-iris):** `get_stock_summary`, `get_product_by_sku`, `search_products`, `list_pending_actions`, `create_calendar_event`, `propose_restock_plan`, `draft_supplier_emails`
- **11 MIRA READ tools:** `query_orders`, `query_stock`, `query_velocity`, `query_calendar`, `query_decisions`, `predict_stockout`, `get_founder_state`, `query_returns`, `compare_channels`, `get_top_products`, `get_seasonal_patterns`
- **6 MIRA ACTION tools:** `execute_action`, `set_founder_state`, `update_autonomy`, `approve_decision`, `reject_decision`, `override_decision`

Voice input via `POST /api/mascot/transcribe` (OpenAI Whisper).

### Demo scenes — all 4 validated end-to-end today

1. **OVERSELL save** — `predict_stockout(NKS-00108)` returned on_hand 10, velocity 0.6/day, 16.7 days to stockout (numbers from `calculateStockoutDays`). `execute_action(pause_listing)` auto-executed with `trigger_event_id=ORD-000255`.
2. **VACATION + Reputation Shield** — `set_founder_state("Vacation")` auto-wrote `reputation_shield_v1` (primary=amazon_fr, 5 paused secondaries). Subsequent `pause_listing` wrapped in `vacation_queue_v1`. Morning briefing: "5 décision(s) en file, 2 gérée(s)".
3. **ANALYSIS (Jarvis)** — Mira chained `get_top_products(channel=amazon_de)` + `compare_channels` in one turn. Amazon DE = 22.4% share (37 237 / 165 963 verified).
4. **OVERRIDE** — `override_decision` flipped status to `overridden`, `override_records` row created with previous_status + reason. `/api/mira/autonomy/pause-all` flipped all 7 action_types to `observe` transactionally.

### Routes shipped

| Path | Purpose |
|---|---|
| `/dashboard` | Atlas home (PRIMAIRE) |
| `/activity` | decision ledger viewer |
| `/actions` | pending decisions inbox |
| `/catalog` | F1 Flash Onboarding UI |
| `/radar` | F5 RADAR plugin |
| `/api/mascot/chat` | unified conversational + governed endpoint |
| `/api/mascot/transcribe` | Whisper voice input |
| `/api/mascot/history` | conversation history GET/DELETE |
| `/api/mira/atlas` | home-screen aggregator |
| `/api/mira/ledger` | decision ledger snapshot |
| `/api/mira/briefing` | morning digest |
| `/api/mira/decisions/[id]` | single decision detail |
| `/api/mira/autonomy` + `/pause-all` | Orb governance writes |
| `/api/mira/radar` | carrier + supplier aggregates |
| `/api/mira/catalog-mapping` + `[id]` | F1 CSV mapping |

### Tests status

```
npx tsc --noEmit        → exit 0
npm run test:mira-math  → 15/15 pass
npm run test:mira-invariant → 14 templates consistent
npx next build          → exit 0
```

### Friday checklist (remaining, non-code)

- Vercel deployment
- n8n VPS: import `workflows/calendar-advisor.json`, set `APP_BASE_URL`
- Loom demo video + slide deck
- Founder state prep: walk in with MIRA in `Active`, demo flips to `Vacation` live

### Reprise rapide (30 secondes)

1. `cd src && npm run dev` — dev server on :3000
2. Open `http://localhost:3000/dashboard` — Atlas + Orb visible
3. If Prisma DLL is locked on Windows: `taskkill //F //IM node.exe && rm -rf src/.next && npm run dev`
4. If stuck on data: `npm run db:seed:mira-stock-state` then `npm run db:seed:mira-returns`

---

## The Logic-Load Pattern (5-step execution pipeline)

Every action follows this rigid pipeline. No shortcuts. No exceptions.

```
Step 1: ANALYZE (GPT-4o)
   └→ Interprets user intent, retrieves data via READ tools
   └→ All math done by tools_math, NEVER by LLM directly

Step 2: POLICY FILTER (policy.ts)
   └→ Checks FounderPolicy: autonomy_level × founder_state × reversibility
   └→ Reputation Shield: if founder sick/vacation → auto-protect primary channel

Step 3: TEMPLATE ENGINE (Deterministic — templates.ts)
   └→ Renders action text using immutable template functions
   └→ Same inputs = same output. Always. No LLM involved.

Step 4: ACTION (Next.js API routes, or n8n if already wired)
   └→ Executes write-back (mocked for hackathon, labelled SIMULÉ)

Step 5: LEDGER (Audit — decision_ledger in Supabase)
   └→ Records the final invariant trace
   └→ Includes trigger_event_id linking back to the original order/event
```

## The fundamental distinction — ANALYZE ≠ ACT

```
ANALYZE (LLM, free-form)              ACT (deterministic, traced)
─────────────────────────              ──────────────────────────
GPT-4o reasons on data                 Agent + tools_math + Template
Can predict, compare, advise           Same inputs = same output
Lives in conversation_history          Lives in decision_ledger
Math via tools_math                    Trigger SQL enforces template_id
```

The LLM CANNOT write to decision_ledger directly. Enforced by:
1. TS: only `render()` from `templates.ts` produces `logical_inference` text
2. Postgres: BEFORE INSERT trigger rejects unknown template_ids
3. Test: `test-mira-invariant.ts` checks every ledger row against `TEMPLATES.keys()`
4. Math: all calculations go through `tools_math.ts`, never raw LLM output

---

## LLM Provider: OpenAI (NOT Anthropic)

MIRA's brain runs on **OpenAI GPT-4o**. Claude Code is the DEVELOPMENT tool — it writes code but doesn't run in production.

```ts
import OpenAI from 'openai'
const client = new OpenAI()  // reads OPENAI_API_KEY from env

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
  tools: [...],          // OpenAI function calling format
  tool_choice: 'auto',
})
```

Tool call handling loop (implemented in `src/app/api/mascot/chat/route.ts`):
```ts
while (response.choices[0].message.tool_calls) {
  for (const tc of response.choices[0].message.tool_calls) {
    const result = await executeTool(tc.function.name, JSON.parse(tc.function.arguments), ctx)
    messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })
  }
  response = await client.chat.completions.create({ model: 'gpt-4o', messages, tools })
}
```

Environment variable: `OPENAI_API_KEY`

---

## Stack (locked)

- **Claude Code**: development tool — writes all production code
- **Codex (OpenAI)**: parallel dev tasks (UI components, mocks, seeds)
- **OpenAI API (GPT-4o)**: MIRA's conversation + analysis layer (runtime)
- **Supabase Cloud**: Postgres + Realtime + Row-Level Security
- **Lovable**: design validation only, no production code
- **n8n**: ONLY if already wired in the repo — for edge write-backs. Don't add new n8n workflows.
- **NOT using**: Dust.tt, LangGraph, CrewAI, Anthropic API

Runtime: **Next.js 14 App Router + TypeScript** (the original spec described FastAPI + Pydantic; we kept the existing Next.js repo per the "preserve existing work" rule and mapped the logical architecture 1:1 onto `src/lib/mira/*`).

---

## Feature Matrix — "The Deep Supply"

### F1: Flash Onboarding (CSV → Mirakl)
- Marie uploads messy 80-column supplier CSV
- MIRA (via GPT-4o) maps columns to Mirakl taxonomies
- Draft review UI: every mapping shows raw value ↔ proposed value ↔ reasoning
- Output stored in `catalog_review_records` (NEVER in decision_ledger)
- Founder approves/modifies/rejects each mapping
- This is the ONLY place LLM reasoning is stored

### F2: Smart Calendar + Reputation Shield
Two separate implementations, one feature label:

**Calendar (FounderContextAgent):**
- Reads founder_state (Available, Travelling, OffHours, Sick, Vacation)
- When Sick/Vacation: inflates safety buffers (×1.25), lead times (×1.4)
- Morning digest compiles queued decisions for return date

**Reputation Shield (rule in policy.ts):**
- When founder unavailable + multiple storefronts active:
  - Identify the primary channel (highest rating/sales)
  - Auto-reduce exposure on secondary channels to protect Top Seller badge
  - Template: `reputation_shield_v1(primary_channel, paused_channels, reason)`
- This is a POLICY RULE, not an agent. Deterministic, not LLM.

### F3: White Supply Atlas (Home Screen)
- Minimalist world map (France, Italy, Germany) with animated elements
- Animated curved lines ("Supply Pulses") showing stock flow between countries = POLISH if time permits, NOT MVP
- MVP = pulses on countries (pink = needs decision, blue = handled)
- Floating badges per storefront with order count + risk flags
- Intent-Based Shielding visual: when oversell detected, show suppression across 5 storefronts

### F4: Predictive Seasonality (N-1 Analysis)
- Compare current stock with sales during previous events (Black Friday, Soldes, Ferragosto, Ramadan)
- REQUIRES seeded historical data (12 months). Codex generates this.
- All growth/factor calculations via tools_math — NEVER LLM
- If real historical data is thin, label as "seasonal assumption" in trace
- Template: `calendar_posture_v1` + `seasonal_prediction_v1`

### F5: MIRA RADAR (Audit & Profit Recovery) — PLUGIN, not primary
- Carrier audit: SKUs with high "Damaged on Arrival" → suggest carrier change
- Supplier scorecard: lead-time delays, defect rates per supplier
- "Profit Recovery" widget on dashboard
- **This is a PLUGIN (own tab in sidebar). Never on the home screen.**
- Demo: show 30 seconds at end if time permits. Not a core demo scene.

### F6: The Orb (Governance Control)
- **NOT a mascot. A system governance indicator.** Never call it "mascot" in demo.
- Floating circle, bottom-right, every screen
- 3 modes per action type:
  - Watching (observe) → data logging only
  - Ask me (propose) → MIRA prepares, user approves
  - Handle it (auto_execute) → MIRA executes + logs
- "Pause everything" = one-tap, all modes → Watching
- Plain language labels only (see UX language mapping)

---

## Architecture

Spec-level structure (mapped to Next.js/TypeScript file paths):

```
Frontend (Next.js 14 + Tailwind)
├── Chat panel (text + voice via Whisper)           [PRIMAIRE]  MascotChatDrawer
├── Atlas map (pulses, badges, supply lines)        [PRIMAIRE]  components/atlas/
├── Decisions inbox                                 [PRIMAIRE]  app/actions/
├── Orb (governance control)                        [CONTRÔLE]  components/orb/OrbModePanel
├── Stock detail                                    [PLUGIN]    app/stock/
├── Activity log                                    [PLUGIN]    app/activity/
├── Catalog review (F1)                             [PLUGIN]    app/catalog/
├── Analytics / RADAR (F5)                          [PLUGIN]    app/radar/
└── All update via Supabase Realtime (useMiraLedger)

Backend (Next.js API routes + Prisma)
├── /api/mascot/chat          → unified conversation (GPT-4o + 23 tools)
├── /api/mascot/transcribe    → Whisper voice
├── /api/mascot/history       → conversation persistence
├── /api/mira/atlas           → home aggregator
├── /api/mira/ledger          → decision stream
├── /api/mira/briefing        → morning digest
├── /api/mira/autonomy(+pause-all) → Orb writes
├── /api/mira/radar           → F5 aggregates
├── /api/mira/catalog-mapping → F1 LLM mapping
└── /api/mira/decisions/[id]  → detail/mutation

src/lib/mira/
├── tools_math.ts     → ALL calculations (velocity, stockout, reorder, growth, return rate, margin)
├── tools_read.ts     → 11 READ tools
├── tools_action.ts   → 6 ACTION tools
├── agents/
│   ├── stock.ts          → oversell detection
│   ├── restock.ts        → reorder proposals (uses tools_math.calculateReorderQty)
│   ├── returns.ts        → pattern detection
│   └── founderContext.ts → calendar + state + autonomy loader
├── templates.ts      → 14 immutable renderers (THE invariant)
├── policy.ts         → FounderPolicy + Reputation Shield rule
├── fuse.ts           → Safety Fuse (deterministic circuit breakers)
├── briefing.ts       → morning digest assembly
├── ingestion.ts      → JSONL → operational_objects
└── history.ts        → mira_conversation_history helpers

src/scripts/
├── run-mira-ingestion.ts
├── test-mira-invariant.ts      → template registry enforcement
├── test-mira-math.ts           → 15 unit tests, no LLM math
├── test-mira-decision-mutations.ts
├── test-dashboard-mira-only.js
├── test-mira-design-language.js
├── create-mira-tables.sql
├── enable-mira-realtime.sql
├── migrate-mira-templates-v2.sql
├── migrate-mira-trigger-event-id.sql
├── migrate-mira-conversation-history.sql
├── seed-mira-commercial-calendar.sql
├── seed-mira-stock-state.sql
└── seed-mira-returns.sql

Supabase (Postgres + Realtime)
├── operational_objects        → Unified orders & returns (raw_payload preserved)
├── decision_ledger            → Template-only traces + trigger_event_id FK
├── decision_templates         → Registry — enforced by BEFORE INSERT trigger
├── mira_conversation_history  → Chat messages (LLM free-form, SEPARATE)
├── catalog_review_records     → F1 LLM reasoning (SEPARATE, never in ledger)
├── stock_state                → Current inventory per SKU
├── founder_state              → Availability singleton
├── autonomy_config            → Per-action-type modes
├── override_records           → Founder overrides
└── commercial_calendar        → Events seed (retail + cultural)
```

---

## tools_math.ts — No LLM Math Rule

```ts
// Every calculation in MIRA goes through these functions.
// The LLM calls tools that INTERNALLY use these.
// The LLM never calculates growth rates, stock gaps, or costs.

export function calculateVelocity(orders: OrderLike[], windowHours: number)
  // → units_per_hour, units_per_day, units_per_week

export function calculateStockoutDays(onHand: number, velocityPerDay: number): number | null
  // null if velocity ≤ 0

export function calculateReorderQty(
  velocityPerWeek: number,
  leadTimeWeeks: number,
  bufferWeeks: number,
  onHand: number,
): { demand, qty, lead_time_weeks, buffer_weeks }

export function calculateGrowthFactor(current: number, previous: number): number | null
  // Year-over-year or event-over-event growth

export function calculateReturnRate(returns: number, totalOrders: number): number
export function calculateMargin(revenue: number, cost: number): number
export function calculateHoursOfStock(onHand: number, velocityPerHour: number): number
export function calculateChannelShares<T extends { revenue: number }>(rows: T[])
```

If any test catches a DecisionRecord where a number was produced by LLM inference rather than tools_math, that's a bug. Covered by `npm run test:mira-math` (15 tests, all passing).

---

## OpenAI Tools

### READ tools (11, no permission needed)
- `query_orders(channel?, sku?, period_hours?)`
- `query_stock(sku?)`
- `query_returns(sku?, period_days?)`
- `query_velocity(sku, channel?, window_hours?)` → uses tools_math internally
- `query_calendar(region?, next_days?)`
- `query_decisions(status?, sku?)`
- `predict_stockout(sku)` → uses tools_math.calculateStockoutDays
- `compare_channels(sku?, period_days?)` → uses tools_math.calculateChannelShares
- `get_seasonal_patterns(sku?, region?, event?, next_days?)` → uses tools_math.calculateGrowthFactor, falls back to magnitude default when N-1 data thin (labelled `data_source: 'seasonal_assumption'`)
- `get_top_products(channel?, period_days?, metric?)`
- `get_founder_state()`

### ACTION tools (6, routed through FounderPolicy)
- `execute_action(action_type, sku, channel?, params?, trigger_event_id?)`
- `set_founder_state(state, until?)`  — auto-fires Reputation Shield when state ∈ {Vacation, Sick}
- `update_autonomy(action_type, mode)`
- `approve_decision(decision_id)`
- `reject_decision(decision_id, reason?)`
- `override_decision(decision_id, reason?)` — writes row into `override_records`

---

## Template Registry (templates.ts)

Every template is a pure function: dict → str. Deterministic. No LLM. No randomness.

Required templates (all 14 shipped):
- `oversell_risk_v1(sku, total_24h, velocity_24h, on_hand)`
- `restock_proposal_v1(sku, velocity_per_week, lead_time_weeks, buffer_weeks, qty)`
- `vacation_queue_v1(return_date, original_action)`
- `returns_pattern_v1(sku, matching_returns, window, reason_code, rate_pct, baseline_pct)`
- `reconciliation_variance_v1(sku, observed, expected, variance_pct, threshold_pct, cause)`
- `fuse_tripped_v1(fuse_name, sku, metric_name, metric_value, window, threshold, action)`
- `calendar_posture_v1(buffer_delta_pct, sku, event_name, event_date, region, evidence_line)`
- `listing_pause_v1(sku, channel, reason)`
- `listing_resume_v1(sku, channel)`
- `buffer_adjustment_v1(sku, old_buffer, new_buffer, reason)`
- `reputation_shield_v1(primary_channel, paused_channels, reason)`
- `seasonal_prediction_v1(sku, event, growth_factor, recommended_buffer)`
- `carrier_audit_v1(sku, carrier, damage_rate, recommended_carrier)` → F5 RADAR
- `supplier_scorecard_v1(supplier, avg_delay_days, defect_rate)` → F5 RADAR

Invariant: `render(template_id, inputs)` raises `ValueError` if template_id not in TEMPLATES.

---

## FounderPolicy + Reputation Shield (policy.ts)

```ts
function evaluatePolicy<K extends TemplateId>(input: PolicyInput<K>): PolicyDecision<K> {
  const reversible = isReversible(input.actionType)
  const multipliers = safetyMultipliers(input.founderState)   // ×1.25 / ×1.4 when away

  if (AWAY_STATES.has(input.founderState)) {
    return { status: 'queued', templateId: 'vacation_queue_v1', rendered, reversible, multipliers }
  }
  if (input.autonomy === 'observe')        return { status: 'skipped', ... }
  if (input.autonomy === 'auto_execute' && reversible) return { status: 'auto_executed', ... }
  return { status: 'proposed', ... }
}

// Reputation Shield — deterministic rule, fires on founder state change.
async function evaluateReputationShield(prisma, userId, founderState) {
  if (!AWAY_STATES.has(founderState)) return null
  const { primary, secondaries } = await identifyPrimaryChannel(prisma, userId)
  if (!primary || secondaries.length === 0) return null
  return { shouldApply: true, primary_channel: primary, paused_channels: secondaries, rendered }
}
```

Wired so that `set_founder_state(Vacation|Sick)` writes a single `reputation_shield_v1` row into the ledger (source_agent='founder_policy', triggered_by='set_founder_state').

---

## Database Schema additions (vs basic spec)

### decision_ledger — trigger_event_id
```sql
ALTER TABLE decision_ledger
ADD COLUMN trigger_event_id text;
CREATE INDEX idx_decision_ledger_trigger_event ON decision_ledger (trigger_event_id);
-- Links each decision to the order/event that triggered it (external_id of the
-- operational_objects row). Kept as TEXT for portability.
```

### Invariant trigger — template allowlist
```sql
-- Current allowlist:
'oversell_risk_v1', 'restock_proposal_v1', 'vacation_queue_v1',
'returns_pattern_v1', 'reconciliation_variance_v1', 'fuse_tripped_v1',
'calendar_posture_v1', 'listing_pause_v1', 'listing_resume_v1',
'buffer_adjustment_v1', 'reputation_shield_v1', 'seasonal_prediction_v1',
'carrier_audit_v1', 'supplier_scorecard_v1'
```

---

## UX Information Hierarchy (strict)

### PRIMAIRE (always visible on Atlas home)
Marie answers 3 questions in 3 seconds:
- "Everything OK?" → 1 stock health gauge
- "Something waiting?" → pink pulses on map + pending count
- "MIRA did what?" → blue pulses on map
- "Talk to MIRA" → chat panel always open

### SECONDAIRE (visible but visually recessive)
- KPIs (orders today, active SKUs, fulfillment rate)
- Events timeline (upcoming 60 days)
- Last actions summary

### PLUGINS (own tabs in sidebar, never on home)
- 📦 Stock → detail per SKU, levels, history
- 📋 Activity → full decision log
- 🗂 Catalog → F1 review mappings
- 📊 Analytics/RADAR → F5 carrier audit, supplier scorecard

### Design rules from this hierarchy
1. Home shows ONLY primaire + secondaire. No tables, no long lists.
2. Each plugin has its own sidebar tab. No sub-menus, no dropdowns.
3. Chat is PRIMAIRE — always visible or one-tap accessible.
4. Atlas map is PRIMAIRE — it IS the home, not a widget.
5. KPIs are SECONDAIRE — small, top of page, not a stat wall.
6. Zero unsolicited information in plugins. No "0 alerts" badges.
7. The Orb is outside hierarchy — it's a control, not information.
8. One view = one clear data point. No dashboard-ception.

---

## UX Language Mapping

| Code (internal)         | UI (founder sees)        |
|-------------------------|--------------------------|
| observe                 | Watching                 |
| propose                 | Ask me                   |
| auto_execute            | Handle it                |
| decision_ledger         | (never shown)            |
| template_id             | (never shown)            |
| raw_payload             | (never shown)            |
| oversell_risk           | "stock en tension"       |
| reputation_shield       | "protection des avis"    |
| trigger_event_id        | (never shown)            |

---

## Brand tokens (Mirakl)

- `--mira-ink: #03182F` — headers, text, sidebar bg
- `--mira-blue: #2764FF` — blue = MIRA handled something
- `--mira-bg: #F2F8FF` — page background
- `--mira-pink: #F22E75` — pink = needs decision / risk
- `--mira-pink-soft: #FFE7EC` — soft pink bg
- `--mira-blue-soft: #E9F0FF`
- Typography: Roboto Serif display (`--mira-font-display`), Inter/system sans everywhere else.
- Spacing: xs 8, sm 16, md 24 (default), lg 32, xl 48, xxl 64, generous 96 (px).
- Cards: white bg, 8px radius, shadow `0 1px 4px rgba(3,24,47,0.08)`, padding 20px.
- Color semantics: Blue = handled. Pink = needs attention. Green = healthy. Never cross.

---

## Personas

**Léo (18)**: speed, zero friction, one-tap, no config needed.
**Marie (58)**: understand why, see undo before clicking, no jargon.

Every screen:
- Léo test: "Can I act in under 5 seconds?"
- Marie test: "Do I know what happens and how to undo?"

---

## MIRA Conversation Personality

System prompt for OpenAI GPT-4o (`src/app/api/mascot/chat/route.ts`):
```
Tu es MIRA, l'assistante opérationnelle de Nordika Studio.
Tu gères 200 produits sur 6 storefronts (Amazon FR/IT/DE, Google Shopping FR/IT/DE).

RÈGLES :
- Tu parles français, phrases courtes, factuelles, calmes.
- Tu analyses librement les données avec tes outils de lecture.
- Tu ne fais JAMAIS de calcul toi-même. Tu appelles les outils de calcul
  (predict_stockout, query_velocity, etc.) qui utilisent tools_math.
- Pour AGIR (pauser un listing, commander du stock, ajuster un buffer),
  tu appelles TOUJOURS execute_action.
- Après chaque action, tu montres comment annuler.
- Au premier message de la journée, tu donnes un briefing proactif.
- Tu ne dis jamais "je pense que" ou "il me semble".
  Tu dis ce que les données montrent.
- Jamais d'emoji, de "Super !", de "Oops !".
- Quand tu ne sais pas, tu dis "Je n'ai pas cette donnée" et tu nommes
  ce qui manque.
- Quand la fondatrice est en vacances ou malade, tu mentionnes que le
  Reputation Shield est actif et quels canaux sont protégés.
```

---

## Mocking rules

Mock at the edges, never at the core.
Every mock labelled "SIMULÉ" in the UI with a small pink badge
(`<SimulatedBadge />` from `src/components/SimulatedBadge.tsx`).

**Mocked**: Amazon/Google APIs (write-back, cart-intent, stock feed), supplier system, notifications, auth, carrier APIs.
**Real**: agent logic, templates, policy, fuse, tools_math, Supabase, frontend, ingestion, calendar seed.
**Seeded**: upcoming 2026 commercial calendar; 15 realistic returns with mixed reason_codes; stock_state derived from Product.quantity + 30-day velocity. 12-month historical sales for F4 are NOT seeded today — `get_seasonal_patterns` returns `data_source: 'seasonal_assumption'` with magnitude-based defaults, per spec's own fallback.

---

## Demo Scenes (4 scenes, 8 minutes total)

1. **L'oversell save** (2 min): Marie asks about NKS-00108 → MIRA explains risk (using tools_math, not LLM math) → "Pause Google DE" → pulse pink→blue → ledger trace visible
2. **Le mode vacation + Reputation Shield** (2 min): Marie says "je pars en vacances" → buffers inflate → secondary channels shielded → decisions queued → morning digest
3. **L'analyse Jarvis** (2 min): Marie asks "meilleurs produits en Allemagne ?" → MIRA queries + calculates (tools_math) → rankings + insights → "Et la table ?" → returns pattern → propose fix
4. **L'override** (2 min): Marie undoes an auto-executed decision → changes Orb mode → visible in <1s → captured in ledger

If time: 30s F5 RADAR plugin walkthrough.

**All 4 scenes validated end-to-end on 2026-04-23.**

---

## Definition of Done (jury checklist)

1. Ingestion of both JSONL files with zero field loss (raw_payload round-trip test).
2. Oversell: conversation + flag + propose pause + dashboard update real-time. All numbers from tools_math.
3. Vacation + Reputation Shield: queue + shield secondary channels + morning digest.
4. Override via conversation: undo + change Orb + captured in ledger with trigger_event_id.
5. Scale note: what breaks at 10K SKUs, how to fix → `docs/mira-scale-notes.md`.

---

## No Slop Rules (Safety Constraints)

1. **No math by LLM**: All calculations (growth, stock gap, cost, velocity, rates) MUST go through `tools_math.ts`. If a trace contains a number not produced by tools_math, it's a bug.
2. **Template enforcement**: `render()` raises `ValueError` for unknown template_ids. Postgres trigger rejects unknown IDs.
3. **Audit trail**: Every decision_ledger row has `trigger_event_id` linking to the source event for re-playability.
4. **French-first**: MIRA speaks French by default. Factual, calm, no emoji, no exclamation marks.
5. **The Orb is a control, not a mascot**: Never say "mascot" in demo. It's a "system governance indicator."
6. **Supply Pulses (animated flow lines) = polish**: Already shipped today since MVP was green — low-opacity dashed drift + animated dot along FR↔DE and FR↔IT curves.

---

## Out of scope

Pricing (Topic 1), customer service (Topic 3), real supplier APIs, account creation, real marketplace write-backs, free-text return classification.
