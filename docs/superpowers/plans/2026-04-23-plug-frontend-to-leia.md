# Plug functional backend into dev-design frontend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Dashboard, Actions, and Orders pages to live MIRA backend data before the 2026-04-24 pitch.

**Architecture:** Client-side `useEffect + fetch` for Dashboard/Orders; SSR adapter for Actions. New thin endpoints (`/api/mira/orders-recent`, `/api/actions`) translate MIRA's `decision_ledger` and `operational_objects` into the shapes the dev-design UI already expects. Static sections with no backing data get a `SimulatedBadge`. User-facing name is **Leia**; internal paths stay `mira/*`.

**Tech Stack:** Next.js 14 App Router, Prisma, TypeScript, existing Tailwind, recharts.

**Spec:** `docs/superpowers/specs/2026-04-23-plug-frontend-to-mira-design.md`

---

## Phase 1 — Infrastructure (pure additions, low risk)

### Task 1: `SimulatedBadge` component
**File:** Create `src/components/SimulatedBadge.tsx`

### Task 2: `decisionToRecommendation` pure mapper
**File:** Create `src/lib/mira/adapters/decisionToRecommendation.ts`
- Input: `DecisionRecord` (Prisma select subset, matches spec table)
- Output: `RecommendationDTO` (existing type from `src/app/actions/types.ts`)
- Title map: oversell_risk_v1 → "Stock en tension", etc. (14 templates, see spec)

### Task 3: `/api/mira/orders-recent` endpoint
**File:** Create `src/app/api/mira/orders-recent/route.ts`
- GET with `limit`, `channel` (comma-list), `aggregate` params
- Reads `operationalObject` where `kind='order'`
- Derives `status` per row from `raw_payload.status` + `decision_ledger.trigger_event_id` cross-check
- When `aggregate=true`, also returns `{pending_action, in_transit, delivered_24h, processing}` counts

### Task 4: `/api/actions` adapter endpoint
**File:** Create `src/app/api/actions/route.ts`
- GET optional `status` filter
- Reads `decisionRecord`, maps via `decisionToRecommendation`

### Task 5: TypeScript check after Phase 1
- `npx tsc --noEmit` — must exit 0

---

## Phase 2 — Dashboard wiring

### Task 6: Rewire `dashboard/page.tsx`
- Keep voice input logic (fully working).
- Add 3 `useEffect` fetches on mount: atlas, orders-recent, ledger (proposed).
- Replace hardcoded `orders` const with state; render loading skeleton ~300ms.
- Wire the 3 KPI cards: Total Orders Today = `totals.orders_24h`, Active SKUs = `stock.healthy` / `stock.total_skus`, Stock Health = `stock.health_pct`.
- Wire 2 decision cards at bottom to top 2 proposed ledger rows. If zero, keep static as fallback.
- On fetch error: silently fall back to current static values.

### Task 7: Manual smoke — Dashboard
- Restart dev server if needed, load `/dashboard`.
- Verify KPIs render non-placeholder numbers from DB.
- Verify table rows reference real SKUs/channels.

---

## Phase 3 — Actions wiring

### Task 8: Adapt `RecommendationDetailPanel` for dual-mode
**File:** Modify `src/app/actions/RecommendationDetailPanel.tsx`
- If `action_payload` is null (MIRA decision), render a simpler view:
  - Header with `title` (no "Congés détectés")
  - `reasoning_summary` text
  - `evidence_payload` as key/value grid
  - Approve / Reject / Override buttons (Override only when `status === 'auto_executed'`)
  - Buttons call `PATCH /api/mira/decisions/[id]` with `{action, reason?}`
- If `action_payload` is present, keep the existing rich view.
- Handle MIRA status values in approve/reject UI: `proposed`/`queued` show both buttons.

### Task 9: Adapt `RecommendationCard` status badges
**File:** Modify `src/app/actions/RecommendationCard.tsx`
- Extend badge map for MIRA statuses: `proposed` → "À valider", `queued` → "En file", `auto_executed` → "Exécutée", `overridden` → "Annulée", `skipped` → "Ignorée".

### Task 10: Switch Actions SSR source
**File:** Modify `src/app/actions/page.tsx`
- Replace `prisma.agentRecommendation.findMany(...)` block with `prisma.decisionRecord.findMany(...)` + map through `decisionToRecommendation`.
- Keep the outer try/catch so DB failures don't crash the page.

### Task 11: Switch client refresh URL
**File:** Modify `src/app/actions/ActionsPageClient.tsx:24`
- Change `/api/copilot/recommendations` → `/api/actions`.

### Task 12: Manual smoke — Actions
- Load `/actions`.
- Verify left list shows MIRA decision titles (e.g. "Stock en tension").
- Click one → detail panel shows `reasoning_summary` + evidence + approve/reject buttons.
- Click Approve → status badge updates.

---

## Phase 4 — Orders wiring

### Task 13: Rewire `orders/page.tsx`
- Keep `selectedSource` tab switcher.
- Per-tab channel mapping: `all` → no filter; `amazon` → `amazon_fr,amazon_it,amazon_de`; `shopify` → keep static + `SimulatedBadge`.
- Add 3 `useEffect` fetches reacting to `selectedSource`: atlas, orders-recent (with aggregate + channel list), ledger (limit 3).
- Wire: Headline KPIs (Orders from atlas), Marketplace Revenue bar (atlas.regions), Key Indicators (aggregate), Orders table (orders-recent.rows), Logistics Feed (ledger), Quick Decision card (first proposed ledger row → PATCH on buttons).
- Add `SimulatedBadge` to: Financial Highlights, Cash Flow, Outstanding Balances, Traffic Trend, Visits/Conversion KPIs, Shopify tab sections.

### Task 14: Manual smoke — Orders
- Load `/orders`, switch between All / Amazon / Shopify tabs.
- Verify data changes per tab.
- Verify SIMULÉ pills visible on financial sections.

---

## Phase 5 — Verification & commit

### Task 15: Run test suites
- `npx tsc --noEmit` — exit 0
- `npm run test:mira-invariant` — pass
- `npm run test:mira-math` — pass

### Task 16: Commit
- Single commit: "feat(ui): wire Dashboard/Actions/Orders to live Leia backend"
