# Hackathon Mirakl - Nordika Studio

Next.js 14 prototype for a merchant operations cockpit covering marketplace flows, stock, warehouse operations, parcels, business calendar, decisions, losses, and LEIA.

The app is connected to a shared Supabase database for the hackathon demo. Operational seed data is stored under `src/supabase/seed` and related scripts.

## Functional Areas

- Dashboard: operational overview, LEIA chat entry point, KPIs, and recent activity.
- Actions: decision inbox for recommendations and approvals.
- Governance: autonomy modes, founder state, and pause controls.
- Calendar: operational events, leave periods, commercial periods, and restock signals.
- Stock: products, suppliers, thresholds, import helpers, and stock state.
- Orders: marketplace order review.
- Parcels: inbound and outbound tracking.
- Warehouse: zones, bins, bin contents, and picking flows.
- Losses Radar: carrier and supplier losses with recovery potential.
- App Store: plugin registration and plugin visibility.

## LEIA

LEIA is the AI assistant for the merchant.

- Runtime conversations support English, French, Italian, German, and Spanish.
- UI chrome, docs, seed data, internal templates, and code comments are English.
- Ledger templates are English.
- All monetary values are EUR.
- Tool math is deterministic and lives in `src/lib/leia/tools-math.ts`.
- Governance, templates, ledger helpers, briefing, and safety logic live in `src/lib/leia`.

## Setup

Create `src/.env` or `src/.env.local` from `src/.env.example`.

Required values:

```text
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
HACKATHON_USER_ID=00000000-0000-0000-0000-000000000001
OPENAI_API_KEY=...
```

Optional values:

```text
N8N_WEBHOOK_URL=
DUST_ORCHESTRATOR_AGENT_ID=
DUST_ORCHESTRATOR_API_KEY=
```

Never commit `.env` or `.env.local`.

## Development

Run commands from `src/`.

```bash
npm install
npm run dev:3000
npm test
npx tsc --noEmit --pretty false
npm run build
```

On Windows, stop the dev server before `npm run build` if Prisma reports a locked query engine DLL.

## Database

The primary Prisma schema is:

```text
src/prisma/schema.prisma
```

Use targeted SQL scripts for manually managed Supabase tables. Avoid running destructive schema pushes without reviewing Prisma's proposed diff.

Useful commands:

```bash
cd src
npm run db:generate
npm run db:prepare
```

## Seed Data

Relevant seed and import files:

- `src/scripts/import-nordika-products.ts`
- `src/scripts/seed-demo-scenario.ts`
- `src/supabase/seed/historical_orders_n1.sql`

Seed data should use English product names and descriptions. Prices, costs, revenue, and recovery values are EUR.

## Calendar Advisor

The calendar advisor connects operational events to stock decisions:

1. A leave or seasonal event is created.
2. LEIA or n8n triggers `/api/agent/calendar-advisor`.
3. Deterministic stock projection evaluates SKU risk.
4. A recommendation appears in `/actions`.
5. The merchant approves, rejects, or adjusts the plan.

The n8n workflow export is `workflows/calendar-advisor.json`; local demos can run without n8n.

## Losses Radar

Losses Radar aggregates:

- Carrier audit savings.
- Supplier loss declarations.
- Recovery potential for unclaimed losses.
- Supplier status and loss history.

Simulated rows must be labeled `SIMULATED`.

## Project Conventions

- App chrome and docs are English.
- Runtime LEIA replies may match the user's language.
- Currency displays use `€` with English number formatting, for example `€1,234.56`.
- Keep brand names and SKU codes unchanged.
- Keep legacy `iris-*` CSS class names for stability unless a dedicated styling refactor is approved.
- Use existing repository patterns before adding new abstractions.

## Verification Checklist

```bash
cd src
npm test
npx tsc --noEmit --pretty false
npm run build
```

Smoke routes:

- `http://localhost:3000/`
- `http://localhost:3000/dashboard`
- `http://localhost:3000/radar`
