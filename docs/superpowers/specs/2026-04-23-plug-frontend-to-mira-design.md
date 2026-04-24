# Plug functional backend into the dev-design frontend (pitch path)

**Branch:** `integrate-mira-on-iris`
**Pitch deadline:** 2026-04-24 14:00 CEST
**Scope:** C2 — pitch-critical path only (Dashboard + Actions + Orders). Losses + Calendar stay static.

## Problem

The recent `origin/dev` merges refreshed the UI (dashboard, actions, orders, losses, calendar, marketplaces) but several pages still render from hard-coded arrays even though the MIRA backend (`/api/mira/atlas`, `/api/mira/ledger`, `/api/mira/briefing`, `/api/mascot/chat`, decision mutation, etc.) is fully operational. The three pitch-critical pages must pull live data so demo scenes look real end-to-end.

## Non-goals

- Losses page wiring (plugin, not on pitch path).
- Calendar page wiring (plugin, not on pitch path).
- Any change to stock / parcels / wms / planning / marketplaces / settings — already wired.
- Restyling or copy changes (design already approved via earlier design-cleanup session).
- Introducing a data-fetching library (SWR, TanStack). Plain `useEffect + fetch` matches the rest of the codebase.
- **Renaming the internal `mira` namespace.** The AI's user-facing name is **Leia**; internal paths (`/api/mira/*`, `src/lib/mira/*`), Prisma models (`decision_ledger`, `mira_conversation_history`), env names, and tests continue to use `mira` for pitch stability. Repo-wide rename is post-pitch work.

## Naming convention

- **User-visible copy:** always "Leia" (headers, card titles, placeholders, "LEIA INSIGHT" badge, etc.). The dev-design already uses Leia consistently on the dashboard — we keep it that way.
- **Internal code / API paths / DB / files:** keep existing `mira` identifiers. Do not rename `/api/mira/atlas` → `/api/leia/atlas` in this change.
- **Template-title map below:** French labels, no brand name, unchanged.

## Approach

**A (Dashboard + Orders): direct client-side fetches** from existing/new MIRA endpoints; sections with no backing data keep their current visuals but gain a `SimulatedBadge` pill for truthfulness.

**C (Actions): adapter endpoint** `/api/actions` that reads `decision_ledger` and maps each row into the existing `RecommendationDTO` shape — so `ActionsPageClient`, `RecommendationCard`, `RecommendationDetailPanel` do not change structurally. Mutations route through `/api/mira/decisions/[id]` PATCH.

## Architecture

```
Dashboard (client) ──fetch──▶ /api/mira/atlas          (exists)
                 └──fetch──▶ /api/mira/orders-recent  (NEW, thin)
                 └──fetch──▶ /api/mira/ledger?status=proposed&limit=2  (exists)

Orders (client) ──fetch──▶ /api/mira/atlas           (exists)
              └──fetch──▶ /api/mira/orders-recent?channel=…  (NEW)
              └──fetch──▶ /api/mira/ledger?limit=3           (exists)

Actions (SSR) ──▶ /api/actions  (NEW adapter)
               │     └── reads decision_ledger via Prisma, maps to RecommendationDTO
ActionsPageClient ──fetch (refresh)──▶ /api/actions
RecommendationDetailPanel ──PATCH──▶ /api/mira/decisions/[id]
```

## New files

### 1. `src/components/SimulatedBadge.tsx`

Tiny presentational pill, reused on Orders for sections with no live backing. No props.

```tsx
'use client'
export function SimulatedBadge() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-[#FFE7EC] text-[#F22E75]">
      SIMULÉ
    </span>
  )
}
```

### 2. `src/app/api/mira/orders-recent/route.ts`

GET, query params:
- `limit` (default 4, max 50)
- `channel` (optional, comma-separated — e.g. `amazon_fr,amazon_it,amazon_de`)
- `aggregate` (optional boolean; when `true`, response also includes status counts over the last 24h for the same channel filter)

Reads `operationalObject` where `kind='order'`, user-scoped, ordered by `occurred_at desc`. Returns:

```ts
type OrderRowDTO = {
  id: string                // operational_objects.external_id
  channel: string           // e.g. "amazon_de"
  marketplace_label: string // e.g. "Amazon DE"
  marketplace_code: string  // "AMZ" / "GGL"
  amount_eur: number
  status: 'fulfilled' | 'processing' | 'risk_attached'  // derived (see Derivation)
  items_count: number
  occurred_at: string       // ISO
}

type AggregateCounts = {
  pending_action: number    // decision_ledger rows with status ∈ {proposed, queued}, channel match
  in_transit: number        // operational_objects.raw_payload.status === 'shipped' (24h)
  delivered_24h: number     // operational_objects.raw_payload.status === 'delivered' (24h)
  processing: number        // operational_objects kind='order' minus the three above (24h)
}

type Response = {
  rows: OrderRowDTO[]
  aggregate?: AggregateCounts  // only present when ?aggregate=true
}
```

**Row `status` derivation** (no column — computed):
- If a `decision_ledger` row exists with `trigger_event_id === external_id` and `status in ('proposed','queued')` → `risk_attached`.
- Else if `operational_objects.raw_payload.status` is `fulfilled`/`shipped`/`delivered` → `fulfilled`.
- Else → `processing`.

### 3. `src/app/api/actions/route.ts` (adapter)

GET, optional `status` filter. Reads `decision_ledger` (same query as `/api/mira/ledger` but mapped). Produces `{ recommendations: RecommendationDTO[] }` to match what `ActionsPageClient` already consumes.

**Mapping `DecisionRecord → RecommendationDTO`:**

| `RecommendationDTO` field | Source |
|---|---|
| `id` | `decision_ledger.id` |
| `title` | per-`template_id` label map (see below) |
| `scenario_type` | `template_id` |
| `status` | `decision_ledger.status` |
| `reasoning_summary` | `decision_ledger.logical_inference` |
| `expected_impact` | derived from `raw_payload` when available, else `null` |
| `confidence_note` | `null` |
| `evidence_payload` | small list: `sku`, `channel`, `action_type`, `source_agent`, `trigger_event_id` |
| `action_payload` | `null` (existing panel handles this gracefully) |
| `approval_required` | `status === 'proposed'` |
| `source` | `source_agent` |
| `created_at` | `decision_ledger.created_at` |
| `updated_at` | `executed_at ?? founder_decision_at ?? created_at` |

**Template → title label map** (French, matches CLAUDE.md UX language):
- `oversell_risk_v1` → "Stock en tension"
- `restock_proposal_v1` → "Proposition de réassort"
- `vacation_queue_v1` → "En file — retour fondatrice"
- `reputation_shield_v1` → "Protection des avis"
- `returns_pattern_v1` → "Motif de retours"
- `seasonal_prediction_v1` → "Prédiction saisonnière"
- `listing_pause_v1` → "Pause de listing"
- `listing_resume_v1` → "Reprise de listing"
- `buffer_adjustment_v1` → "Ajustement de buffer"
- `calendar_posture_v1` → "Posture calendrier"
- `fuse_tripped_v1` → "Fuse déclenché"
- `reconciliation_variance_v1` → "Écart de réconciliation"
- `carrier_audit_v1` → "Audit transporteur"
- `supplier_scorecard_v1` → "Score fournisseur"

Fallback: `template_id` as-is.

## Modified files

### 4. `src/app/dashboard/page.tsx`

Replace the hard-coded `orders` array and the three KPI values.

Add:
```ts
type AtlasResponse = /* subset mirrored from /api/mira/atlas GET */
type LedgerResponse = { count: number; decisions: DecisionDTO[] }
```

Inside component, three independent `useEffect` fetches:
- `atlas` — drives KPIs (Total Orders Today = `totals.orders_24h`; Active SKUs = `stock.healthy` / `stock.total_skus`; Stock Health = `stock.health_pct`).
- `recentOrders` — drives table rows.
- `proposedDecisions` — drives the two decision cards at the bottom. Card 1 = first `oversell_risk_v1` or `restock_proposal_v1`; Card 2 = first `seasonal_prediction_v1` or `returns_pattern_v1`. If only one exists, render one full-width card.

Loading: small skeleton (`bg-[#DDE5EE]/40 animate-pulse` on value slots) for ~300ms max. Error: fall back to the original static values (dashboard must never crash during pitch).

### 5. `src/app/orders/page.tsx`

Replace `SOURCE_DATA.all|amazon|shopify` usage selectively. The page keeps its `selectedSource` tab switcher; each tab triggers a different fetch.

Mapping per source key:
- `all` → no channel filter
- `amazon` → channels `amazon_fr`, `amazon_it`, `amazon_de` (multi-channel, handled server-side by accepting comma-list)
- `shopify` → keep static + `SimulatedBadge` (no Shopify channel in Atlas yet; the merge added the Shopify integration route but no `operational_objects` rows flow through it)

Live sections:
- Headline KPIs (Visits/Sales/Orders/Conv) — derive from atlas `totals.orders_24h` and a lightweight denominator. If a KPI has no backing (Visits, Conversion Rate), keep value + `SimulatedBadge`.
- Orders table — from `orders-recent` filtered by channel list.
- Marketplace Revenue bar — from atlas `regions[].revenue_24h` split per storefront.
- Key Indicators (Pending / In Transit / Delivered / Processing) — single call `GET /api/mira/orders-recent?channel=<list>&limit=10&aggregate=true`. Pending = `aggregate.pending_action`, In Transit = `aggregate.in_transit`, Delivered 24h = `aggregate.delivered_24h`, Processing = `aggregate.processing`.
- Logistics Feed — from `/api/mira/ledger?limit=3` formatted as feed lines using `logical_inference`.
- Quick Decision card — first `status=proposed` ledger row; buttons `Auto-Replenish` → `PATCH /api/mira/decisions/[id] {action:'approve'}`, `Snooze Alert` → `PATCH … {action:'reject', reason:'snoozed'}`.

Static sections (visible `SimulatedBadge`):
- Financial Highlights (Revenue/Margin, N-1/M-1 comparisons)
- Cash Flow (Collected/Disbursed)
- Outstanding Balances (Receivables/Payables)
- Traffic Trend chart

### 6. `src/app/actions/page.tsx`

Change SSR fetch target from `prisma.agentRecommendation.findMany(...)` to an internal call that returns the same `RecommendationDTO[]`, using the new adapter. Simplest: import the mapper directly from `lib/mira/adapters/decisionToRecommendation.ts` so SSR doesn't HTTP-fetch itself.

### 7. `src/app/actions/ActionsPageClient.tsx`

One-liner change: refresh URL from `/api/copilot/recommendations` → `/api/actions`.

### 8. `src/app/actions/RecommendationDetailPanel.tsx`

Approve/Reject buttons currently call old approval endpoint. Update to call `PATCH /api/mira/decisions/[id]` with `{action: 'approve'|'reject', reason?}`. On success, re-fetch `/api/actions` (or locally update status).

Existing `action_payload`/`evidence_payload` rendering stays — gracefully handles null.

### 9. `src/lib/mira/adapters/decisionToRecommendation.ts`

The mapping function, pure, no I/O. Consumed by both `page.tsx` (SSR) and `route.ts` (HTTP).

```ts
export function decisionToRecommendation(d: DecisionRecord): RecommendationDTO
```

## Data flow example — demo scene 1 "OVERSELL save"

1. Pitch laptop shows `/dashboard`.
2. `useEffect` fetches `/api/mira/atlas` → `totals.orders_24h = N`, `totals.pending_decisions = 1`, `oversell.active = true`, `oversell.items = [{sku:'NKS-00108',...}]`.
3. `useEffect` fetches `/api/mira/ledger?status=proposed&limit=2` → first row is `oversell_risk_v1` for NKS-00108.
4. Decision card renders "Stock en tension" with `logical_inference` text, Approve/Ignore buttons live.
5. User clicks Approve → `PATCH /api/mira/decisions/[id] {action:'approve'}` → card updates + pending count drops on next atlas refresh.

## Error handling

- All `useEffect` fetches wrapped in try/catch, on failure render a subtle `"Données indisponibles"` line and KEEP the original static values (pitch safety rail).
- Adapter endpoint: on Prisma error, return `{recommendations: []}` (don't 500 the page).
- `/api/mira/orders-recent`: on Prisma error, return `{rows: []}`.
- No retries, no toasts — silent degradation matches the rest of the app.

## Testing

- Manual smoke: open `/dashboard`, `/orders`, `/actions` after `npm run dev`. Verify:
  - KPIs show non-placeholder numbers.
  - Orders table shows rows with real SKUs / channels.
  - Decision cards show live `logical_inference` text.
  - Approve/Reject on Actions mutates status (visible on refresh).
- `npx tsc --noEmit` must exit 0.
- `npm run test:mira-invariant` must still pass (no changes to templates or ledger writes).
- `npm run test:mira-math` must still pass (no math changes).

## Refresh cadence

No polling. Data fetched on page mount + manual refresh button (already on Actions; add a quiet "↻" icon to Dashboard KPIs header). Matches current codebase style.

## Rollout

Single branch, single commit (or small series). No feature flag needed — worst case we `git revert` before pitch.

## Risk log

| Risk | Mitigation |
|---|---|
| Orders page `orders-recent` aggregate returns empty (no operational_objects seeded for today) | Fall back to static `SOURCE_DATA` values, show `SimulatedBadge`. |
| Adapter maps a `decision_ledger` row whose `logical_inference` is null | Use the template title as `reasoning_summary`. |
| `/api/actions` SSR fails (db down) | Existing `try/catch` in `actions/page.tsx` keeps serialized as `[]`; page still renders empty-state. |
| Shopify tab has no real backing | Keep static + `SimulatedBadge` on all Shopify-only blocks. |
| Approve from Dashboard hits a decision already mutated | `resolveDecisionMutation` throws 409 → swallow, show toast "Action déjà prise". |
