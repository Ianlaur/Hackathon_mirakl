# Calendar-Aware Restock Advisor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Quand l'utilisateur crée un événement `kind=leave` dans son calendrier, un agent projette ses stocks × vélocité × délai fournisseur sur la période d'absence, crée une recommandation agrégée "Plan congés" dans l'inbox `/actions`, et l'utilisateur approuve en un clic.

**Architecture :** Route Next.js `/api/agent/calendar-advisor` appelée par n8n (webhook on-create event + cron quotidien). Logique déterministe en TS pur dans `lib/calendar-restock.ts` (projection stock), enrichissement LLM optionnel dans `lib/calendar-restock-llm.ts` avec fallback déterministe. Réutilise `AgentRecommendation` + `approve/reject` existants. Nouvelle page `/actions` inbox dédiée.

**Tech Stack :** Next.js 14 App Router, Prisma + Supabase Postgres, OpenAI API (via fetch), Tailwind CSS, vitest (tests unit), n8n (orchestration exportée en JSON).

**Spec source :** `docs/superpowers/specs/2026-04-21-calendar-aware-restock-advisor-design.md`

---

## File Structure

**Nouveaux fichiers :**
- `src/lib/calendar-restock.ts` — fonctions pures de projection stock (testables)
- `src/lib/calendar-restock-llm.ts` — enrichissement via OpenAI + fallback déterministe
- `src/app/api/agent/calendar-advisor/route.ts` — endpoint POST principal (appelé par n8n)
- `src/app/api/agent/calendar-advisor/trigger/route.ts` — endpoint POST debug/plan-B démo
- `src/app/api/agent/calendar-advisor/refresh/route.ts` — endpoint GET cron quotidien
- `src/app/actions/page.tsx` — server page inbox
- `src/app/actions/ActionsPageClient.tsx` — client inbox avec liste + panneau détail
- `src/app/actions/RecommendationCard.tsx` — card d'une reco dans la liste
- `src/app/actions/RecommendationDetailPanel.tsx` — panneau détail (tableau SKU + approve)
- `src/app/actions/types.ts` — types TS partagés entre server/client
- `src/components/ActionsPendingWidget.tsx` — widget dashboard compteur
- `tests/calendar-restock.test.ts` — tests unitaires logique projection
- `scripts/seed-suppliers.ts` — seed fournisseurs mockés sur les products existants
- `scripts/seed-demo-scenario.ts` — seed event leave + ajustement stock pour démo
- `workflows/calendar-advisor.json` — workflow n8n exportable

**Fichiers modifiés :**
- `src/prisma/schema.prisma` — ajouter `supplier_lead_time_days Int?` + `supplier_min_order_qty Int?` sur `Product`
- `src/components/Sidebar.tsx` — ajouter entrée `{ href: '/actions', label: 'Actions', short: 'AC' }`
- `src/app/dashboard/page.tsx` — intégrer `<ActionsPendingWidget />`
- `src/package.json` — ajouter `vitest` + script `test`

---

## Prérequis équipe

Le socle (modèles `AgentRecommendation`, `CalendarEvent`, routes `/api/copilot/recommendations/[id]/approve|reject`, lib `copilot.ts`, page `/calendar`) est sur la branche **`ianlaur/dev`**. La branche courante `nathan` n'a pas ce socle.

Avant de démarrer : **créer la branche de feature à partir de `ianlaur/dev`** (voir Task 0).

---

## Task 0 : Préparer la branche de travail

**Files :**
- Aucun fichier touché, uniquement des opérations git

- [ ] **Step 1 : Stash les éventuels changements locaux**

```bash
cd "C:/Users/skwar/Desktop/hackaton/hackaton-mirakl"
git status
git stash -u
```

Expected : `Saved working directory and index state WIP on nathan`, ou `No local changes to save` si rien à stash.

- [ ] **Step 2 : Créer la branche feature depuis `ianlaur/dev`**

```bash
git fetch --all
git checkout -b nathan/calendar-advisor ianlaur/dev
```

Expected : `Switched to a new branch 'nathan/calendar-advisor'`.

- [ ] **Step 3 : Récupérer le spec commité sur `nathan`**

```bash
git checkout nathan -- docs/superpowers/specs/2026-04-21-calendar-aware-restock-advisor-design.md
git checkout nathan -- docs/superpowers/plans/2026-04-21-calendar-aware-restock-advisor.md
```

Expected : les 2 fichiers restent présents dans `docs/superpowers/`.

- [ ] **Step 4 : Vérifier l'arbre et committer**

```bash
git status
git add docs/superpowers/
git commit -m "chore: carry design spec and plan from nathan branch"
```

Expected : `1 file changed` ou `2 files changed` selon diff.

- [ ] **Step 5 : Installer les dépendances**

```bash
cd src
npm install
```

Expected : `added X packages`, pas d'erreur critique. Le lockfile existe déjà.

- [ ] **Step 6 : Vérifier que le projet build et run**

```bash
npm run dev
```

Expected : serveur démarre sur `http://localhost:3000`. Tester l'accès à `/calendar`, `/dashboard`, `/copilot`. Couper avec Ctrl+C.

---

## Task 1 : Installer vitest pour les tests unitaires

**Files :**
- Modify : `src/package.json`
- Create : `src/vitest.config.ts`

- [ ] **Step 1 : Installer vitest en devDependency**

```bash
cd src
npm install --save-dev vitest @vitest/ui
```

Expected : `added 2 packages`.

- [ ] **Step 2 : Créer la config vitest**

Create `src/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

- [ ] **Step 3 : Ajouter le script `test` dans `package.json`**

Dans `src/package.json`, ajouter dans la section `"scripts"` (au-dessus de `"lint"`) :

```json
"test": "vitest run",
"test:watch": "vitest",
```

- [ ] **Step 4 : Créer un test sanity pour vérifier le setup**

Create `src/tests/sanity.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('vitest setup', () => {
  it('runs a trivial assertion', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5 : Lancer les tests**

```bash
cd src
npm test
```

Expected : `1 passed`, pas d'erreur.

- [ ] **Step 6 : Commit**

```bash
git add src/package.json src/package-lock.json src/vitest.config.ts src/tests/sanity.test.ts
git commit -m "chore: add vitest for unit tests"
```

---

## Task 2 : Étendre le schéma `Product` avec les champs fournisseur

**Files :**
- Modify : `src/prisma/schema.prisma` (model `Product`)
- Create : `scripts/seed-suppliers.ts`

- [ ] **Step 1 : Ajouter les champs supplier dans `Product`**

Dans `src/prisma/schema.prisma`, localiser le model `Product` (vers ligne 66) et ajouter les champs après `supplier`:

```prisma
  supplier                 String?
  supplier_lead_time_days  Int?     @default(7)
  supplier_min_order_qty   Int?     @default(1)
  supplier_unit_cost_eur   Decimal? @db.Decimal(12, 2)
  image_url                String?
```

Note : `supplier_unit_cost_eur` est distinct de `purchase_price` (qui reste le coût de référence interne). On garde les deux pour séparer la vérité marchande de la vérité fournisseur.

- [ ] **Step 2 : Régénérer le client Prisma**

```bash
cd src
npx prisma generate
```

Expected : `✔ Generated Prisma Client`.

- [ ] **Step 3 : Pousser le schéma vers Supabase**

```bash
npx prisma db push
```

Expected : `Your database is now in sync with your Prisma schema. Done in Xs`. Accepter si demandé (pas de destructive change).

⚠️ Si Prisma propose de supprimer des tables (ex: tables importées manuellement comme `data_orders_amazon`), **STOP** et répondre `No`. Dans ce cas, utiliser la solution alternative :

```bash
npx prisma db execute --schema prisma/schema.prisma --file ../scripts/alter-product-supplier.sql
```

Et créer en amont `scripts/alter-product-supplier.sql`:

```sql
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS supplier_lead_time_days integer DEFAULT 7,
  ADD COLUMN IF NOT EXISTS supplier_min_order_qty integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supplier_unit_cost_eur numeric(12,2);
```

- [ ] **Step 4 : Créer le script de seed fournisseurs**

Create `scripts/seed-suppliers.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SUPPLIERS = [
  { name: 'Scandi Wood Co', lead_time: 7, min_qty: 10, unit_cost_factor: 0.35 },
  { name: 'Oak Mill Atelier', lead_time: 14, min_qty: 5, unit_cost_factor: 0.42 },
  { name: 'Nordic Textile', lead_time: 10, min_qty: 20, unit_cost_factor: 0.28 },
  { name: 'Metal Craft Lyon', lead_time: 5, min_qty: 8, unit_cost_factor: 0.38 },
  { name: 'Shenzhen Furniture Ltd', lead_time: 35, min_qty: 50, unit_cost_factor: 0.22 },
]

async function main() {
  const products = await prisma.product.findMany({ where: { active: true } })
  console.log(`Seeding suppliers on ${products.length} products`)

  for (const [index, product] of products.entries()) {
    const supplier = SUPPLIERS[index % SUPPLIERS.length]
    const sellingPrice = Number(product.selling_price)
    const unitCost = Number((sellingPrice * supplier.unit_cost_factor).toFixed(2))

    await prisma.product.update({
      where: { id: product.id },
      data: {
        supplier: supplier.name,
        supplier_lead_time_days: supplier.lead_time,
        supplier_min_order_qty: supplier.min_qty,
        supplier_unit_cost_eur: unitCost,
      },
    })
  }

  console.log('Done seeding suppliers')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 5 : Lancer le seed**

```bash
cd src
npx ts-node --compiler-options '{"module":"CommonJS"}' ../scripts/seed-suppliers.ts
```

Expected : `Seeding suppliers on N products`, puis `Done seeding suppliers`.

- [ ] **Step 6 : Vérifier dans Supabase**

```bash
npx prisma studio
```

Ouvrir `Product`, vérifier qu'une ligne a bien `supplier_lead_time_days` et `supplier_unit_cost_eur` renseignés.

- [ ] **Step 7 : Commit**

```bash
cd ..
git add src/prisma/schema.prisma scripts/seed-suppliers.ts
git commit -m "feat(schema): add supplier lead time and unit cost on Product; seed mock suppliers"
```

---

## Task 3 : Logique pure de projection stock (`lib/calendar-restock.ts`)

**Files :**
- Create : `src/lib/calendar-restock.ts`
- Create : `src/tests/calendar-restock.test.ts`

- [ ] **Step 1 : Écrire les tests d'abord (TDD)**

Create `src/tests/calendar-restock.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  daysBetween,
  computeProjection,
  pickPriority,
  buildPlanItems,
  ProductForProjection,
  OrderAggregate,
} from '@/lib/calendar-restock'

describe('daysBetween', () => {
  it('returns 10 between two dates 10 days apart', () => {
    expect(daysBetween(new Date('2026-05-10'), new Date('2026-05-20'))).toBe(10)
  })
  it('returns 0 for same day', () => {
    expect(daysBetween(new Date('2026-05-10'), new Date('2026-05-10'))).toBe(0)
  })
})

describe('computeProjection', () => {
  it('returns stock minus velocity times days', () => {
    expect(computeProjection({ currentStock: 100, velocityPerDay: 2, daysAhead: 10 })).toBe(80)
  })
  it('can go negative for under-stocked SKUs', () => {
    expect(computeProjection({ currentStock: 5, velocityPerDay: 2, daysAhead: 10 })).toBe(-15)
  })
})

describe('pickPriority', () => {
  it('is critical when stock runs out before leave starts', () => {
    expect(
      pickPriority({ daysCovered: 3, daysUntilLeaveStart: 5, daysUntilLeaveEnd: 15 })
    ).toBe('critical')
  })
  it('is high when stock runs out during leave', () => {
    expect(
      pickPriority({ daysCovered: 10, daysUntilLeaveStart: 5, daysUntilLeaveEnd: 15 })
    ).toBe('high')
  })
  it('is medium otherwise', () => {
    expect(
      pickPriority({ daysCovered: 20, daysUntilLeaveStart: 5, daysUntilLeaveEnd: 15 })
    ).toBe('medium')
  })
})

describe('buildPlanItems', () => {
  const today = new Date('2026-05-01')
  const leaveStart = new Date('2026-05-10')
  const leaveEnd = new Date('2026-05-20')

  const products: ProductForProjection[] = [
    {
      id: 'p1',
      sku: 'NKS-00042',
      name: 'Chaise Oslo',
      currentStock: 8,
      supplier: 'Scandi Wood Co',
      supplierLeadTimeDays: 7,
      supplierUnitCostEur: 12.8,
    },
    {
      id: 'p2',
      sku: 'NKS-00100',
      name: 'Table Stockholm',
      currentStock: 200,
      supplier: 'Oak Mill',
      supplierLeadTimeDays: 14,
      supplierUnitCostEur: 60,
    },
    {
      id: 'p3',
      sku: 'NKS-00050',
      name: 'Dormant',
      currentStock: 50,
      supplier: 'Nordic Textile',
      supplierLeadTimeDays: 10,
      supplierUnitCostEur: 20,
    },
  ]

  const orders: OrderAggregate[] = [
    { productId: 'p1', orders60d: 54 },   // 0.9/day → stock 8 = 9 days cover
    { productId: 'p2', orders60d: 30 },   // 0.5/day → stock 200 = 400 days cover (no risk)
    { productId: 'p3', orders60d: 0 },    // dormant → excluded
  ]

  it('includes at-risk SKU only', () => {
    const items = buildPlanItems({ today, leaveStart, leaveEnd, products, orders })
    expect(items).toHaveLength(1)
    expect(items[0].sku).toBe('NKS-00042')
  })

  it('excludes SKU without orders (dormant)', () => {
    const items = buildPlanItems({ today, leaveStart, leaveEnd, products, orders })
    expect(items.find((i) => i.sku === 'NKS-00050')).toBeUndefined()
  })

  it('excludes SKU with enough coverage', () => {
    const items = buildPlanItems({ today, leaveStart, leaveEnd, products, orders })
    expect(items.find((i) => i.sku === 'NKS-00100')).toBeUndefined()
  })

  it('computes recommended qty with safety factor 1.2', () => {
    const items = buildPlanItems({ today, leaveStart, leaveEnd, products, orders })
    const item = items[0]
    // velocity 0.9/day × (10 days leave + 7 days lead) × 1.2 = 18.36 → ceil 19 minus current 8 = 11
    expect(item.recommendedQty).toBe(11)
  })

  it('sets order_deadline = leave_start - lead_time - 2j buffer', () => {
    const items = buildPlanItems({ today, leaveStart, leaveEnd, products, orders })
    // leaveStart 2026-05-10, lead 7, buffer 2 → deadline 2026-05-01
    expect(items[0].orderDeadline.toISOString().slice(0, 10)).toBe('2026-05-01')
  })
})
```

- [ ] **Step 2 : Lancer les tests — ils doivent échouer**

```bash
cd src
npm test
```

Expected : Tests fail with "Cannot find module '@/lib/calendar-restock'".

- [ ] **Step 3 : Implémenter `lib/calendar-restock.ts`**

Create `src/lib/calendar-restock.ts`:

```typescript
export type ProductForProjection = {
  id: string
  sku: string | null
  name: string
  currentStock: number
  supplier: string | null
  supplierLeadTimeDays: number
  supplierUnitCostEur: number
}

export type OrderAggregate = {
  productId: string
  orders60d: number
}

export type Priority = 'critical' | 'high' | 'medium'

export type PlanItem = {
  productId: string
  sku: string | null
  productName: string
  currentStock: number
  velocityPerDay: number
  projectedStockEndOfLeave: number
  recommendedQty: number
  supplier: string | null
  leadTimeDays: number
  unitCostEur: number
  estimatedCostEur: number
  priority: Priority
  orderDeadline: Date
  reasoning: string
}

const DAY_MS = 24 * 60 * 60 * 1000
const SAFETY_FACTOR = 1.2
const DEADLINE_BUFFER_DAYS = 2

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS)
}

export function computeProjection(args: {
  currentStock: number
  velocityPerDay: number
  daysAhead: number
}): number {
  return args.currentStock - args.velocityPerDay * args.daysAhead
}

export function pickPriority(args: {
  daysCovered: number
  daysUntilLeaveStart: number
  daysUntilLeaveEnd: number
}): Priority {
  if (args.daysCovered < args.daysUntilLeaveStart) return 'critical'
  if (args.daysCovered < args.daysUntilLeaveEnd) return 'high'
  return 'medium'
}

export function buildPlanItems(args: {
  today: Date
  leaveStart: Date
  leaveEnd: Date
  products: ProductForProjection[]
  orders: OrderAggregate[]
}): PlanItem[] {
  const { today, leaveStart, leaveEnd, products, orders } = args
  const leaveDuration = daysBetween(leaveStart, leaveEnd)
  const ordersByProduct = new Map(orders.map((o) => [o.productId, o.orders60d]))

  const items: PlanItem[] = []

  for (const product of products) {
    const orders60d = ordersByProduct.get(product.id) ?? 0
    if (orders60d === 0) continue

    const velocityPerDay = orders60d / 60
    const leadTime = product.supplierLeadTimeDays
    const daysCovered = product.currentStock / velocityPerDay
    const daysUntilSafe = daysBetween(today, leaveEnd) + leadTime

    if (daysCovered >= daysUntilSafe) continue

    const qtyNeeded =
      Math.ceil(velocityPerDay * (leaveDuration + leadTime) * SAFETY_FACTOR) -
      product.currentStock

    if (qtyNeeded <= 0) continue

    const orderDeadline = new Date(
      leaveStart.getTime() - (leadTime + DEADLINE_BUFFER_DAYS) * DAY_MS
    )

    const projection = computeProjection({
      currentStock: product.currentStock,
      velocityPerDay,
      daysAhead: leaveDuration,
    })

    const priority = pickPriority({
      daysCovered,
      daysUntilLeaveStart: daysBetween(today, leaveStart),
      daysUntilLeaveEnd: daysBetween(today, leaveEnd),
    })

    const reasoning =
      `Stock actuel couvre ${daysCovered.toFixed(1)} jours au rythme de ${velocityPerDay.toFixed(2)}/jour. ` +
      `Absence + délai fournisseur = ${daysUntilSafe} jours. ` +
      (projection < 0
        ? `Rupture estimée pendant l'absence.`
        : `Marge insuffisante pour couvrir le délai de réapprovisionnement.`)

    items.push({
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      currentStock: product.currentStock,
      velocityPerDay: Number(velocityPerDay.toFixed(3)),
      projectedStockEndOfLeave: Math.round(projection),
      recommendedQty: qtyNeeded,
      supplier: product.supplier,
      leadTimeDays: leadTime,
      unitCostEur: product.supplierUnitCostEur,
      estimatedCostEur: Number((qtyNeeded * product.supplierUnitCostEur).toFixed(2)),
      priority,
      orderDeadline,
      reasoning,
    })
  }

  return items.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2 } as const
    return order[a.priority] - order[b.priority]
  })
}

export function summarizePlan(items: PlanItem[]): {
  totalCostEur: number
  itemsCount: number
  earliestDeadline: Date | null
} {
  if (items.length === 0) {
    return { totalCostEur: 0, itemsCount: 0, earliestDeadline: null }
  }
  const totalCostEur = Number(items.reduce((s, i) => s + i.estimatedCostEur, 0).toFixed(2))
  const earliestDeadline = items
    .map((i) => i.orderDeadline)
    .sort((a, b) => a.getTime() - b.getTime())[0]
  return { totalCostEur, itemsCount: items.length, earliestDeadline }
}
```

- [ ] **Step 4 : Relancer les tests — ils doivent passer**

```bash
cd src
npm test
```

Expected : `6 passed` (ou plus). Si un test fail, ajuster la logique/les asserts.

- [ ] **Step 5 : Commit**

```bash
cd ..
git add src/lib/calendar-restock.ts src/tests/calendar-restock.test.ts
git commit -m "feat(lib): pure projection logic for calendar-aware restock plan"
```

---

## Task 4 : Enrichissement LLM + fallback déterministe

**Files :**
- Create : `src/lib/calendar-restock-llm.ts`

- [ ] **Step 1 : Créer le module d'enrichissement LLM**

Create `src/lib/calendar-restock-llm.ts`:

```typescript
import { decryptSecret } from '@/lib/crypto'
import type { PlanItem } from '@/lib/calendar-restock'

export type LlmEnrichmentInput = {
  leaveTitle: string
  leaveStart: Date
  leaveEnd: Date
  atRiskItems: PlanItem[]
  coincidingEvents: Array<{ title: string; kind: string; start: Date; end: Date }>
  merchantProfile: {
    merchantCategory: string | null
    operatingRegions: string[]
    supplierRegions: string[]
    seasonalityTags: string[]
  } | null
}

export type LlmEnrichmentOutput = {
  reasoningSummary: string
  expectedImpact: string
  confidenceNote: string
  supplementaryNotes: string[]
  fallback: boolean
}

const SYSTEM_PROMPT = `You are an operations advisor for a solo merchant preparing for a leave period.
Given the leave event, the list of at-risk SKUs with deterministic calculations, any calendar events coinciding with the leave, and the merchant profile, produce a JSON object with:
- reasoningSummary: narrative explanation in FRENCH (2-4 sentences, empathetic tone, uses the merchant's "tu" form)
- expectedImpact: short sentence in FRENCH describing the business outcome if the merchant approves
- confidenceNote: short sentence in FRENCH describing the confidence level and what could shift the recommendation
- supplementaryNotes: array of short strings in FRENCH (e.g. "Nouvel An chinois tombe pendant tes congés, ton fournisseur asiatique sera fermé.")

Respond ONLY in valid JSON. No markdown, no commentary.`

export function buildDeterministicFallback(input: LlmEnrichmentInput): LlmEnrichmentOutput {
  const count = input.atRiskItems.length
  const totalCost = input.atRiskItems.reduce((s, i) => s + i.estimatedCostEur, 0)
  const reasoningSummary =
    count === 0
      ? `Aucun SKU à risque détecté pour ton absence. Tu peux partir tranquille.`
      : `${count} produits risquent la rupture pendant tes congés. Passe les commandes avant la deadline pour être livré à temps.`
  const expectedImpact =
    count === 0
      ? `Aucun impact attendu.`
      : `Éviter ${count} ruptures potentielles pendant ton absence et protéger ${totalCost.toFixed(0)} € de chiffre d'affaires.`
  const confidenceNote = `Confiance : élevée sur le filtrage déterministe, dépend de la stabilité de la vélocité de vente.`
  return {
    reasoningSummary,
    expectedImpact,
    confidenceNote,
    supplementaryNotes: [],
    fallback: true,
  }
}

export async function enrichWithLlm(
  input: LlmEnrichmentInput,
  opts: { apiKey: string; model: string }
): Promise<LlmEnrichmentOutput> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            leaveTitle: input.leaveTitle,
            leaveStart: input.leaveStart.toISOString().slice(0, 10),
            leaveEnd: input.leaveEnd.toISOString().slice(0, 10),
            atRiskItems: input.atRiskItems.map((i) => ({
              sku: i.sku,
              productName: i.productName,
              currentStock: i.currentStock,
              recommendedQty: i.recommendedQty,
              supplier: i.supplier,
              leadTimeDays: i.leadTimeDays,
              priority: i.priority,
            })),
            coincidingEvents: input.coincidingEvents.map((e) => ({
              title: e.title,
              kind: e.kind,
              start: e.start.toISOString().slice(0, 10),
              end: e.end.toISOString().slice(0, 10),
            })),
            merchantProfile: input.merchantProfile,
          }),
        },
      ],
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status}`)
  }
  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') {
    throw new Error('OpenAI response missing content')
  }

  const parsed = JSON.parse(content) as Partial<LlmEnrichmentOutput>
  if (!parsed.reasoningSummary || !parsed.expectedImpact || !parsed.confidenceNote) {
    throw new Error('OpenAI response missing required fields')
  }

  return {
    reasoningSummary: parsed.reasoningSummary,
    expectedImpact: parsed.expectedImpact,
    confidenceNote: parsed.confidenceNote,
    supplementaryNotes: parsed.supplementaryNotes ?? [],
    fallback: false,
  }
}

export async function enrichWithFallback(
  input: LlmEnrichmentInput,
  encryptedApiKey: string | null | undefined,
  model: string
): Promise<LlmEnrichmentOutput> {
  if (!encryptedApiKey) {
    return buildDeterministicFallback(input)
  }
  try {
    const apiKey = decryptSecret(encryptedApiKey)
    return await enrichWithLlm(input, { apiKey, model })
  } catch (err) {
    console.error('LLM enrichment failed, using fallback:', err)
    return buildDeterministicFallback(input)
  }
}
```

- [ ] **Step 2 : Vérifier que TypeScript compile**

```bash
cd src
npx tsc --noEmit
```

Expected : aucune erreur TS sur `calendar-restock-llm.ts`. Si d'autres erreurs pré-existantes, les ignorer.

- [ ] **Step 3 : Commit**

```bash
cd ..
git add src/lib/calendar-restock-llm.ts
git commit -m "feat(lib): add LLM enrichment with deterministic fallback for restock plan"
```

---

## Task 5 : Routes API `/api/agent/calendar-advisor`

**Files :**
- Create : `src/app/api/agent/calendar-advisor/route.ts`
- Create : `src/app/api/agent/calendar-advisor/trigger/route.ts`
- Create : `src/app/api/agent/calendar-advisor/refresh/route.ts`

- [ ] **Step 1 : Créer l'endpoint POST principal (appelé par n8n)**

Create `src/app/api/agent/calendar-advisor/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { buildPlanItems, summarizePlan } from '@/lib/calendar-restock'
import { enrichWithFallback } from '@/lib/calendar-restock-llm'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  event_id: z.string().uuid(),
  user_id: z.string().uuid(),
})

type LeaveEventRow = {
  id: string
  user_id: string
  title: string
  start_at: Date
  end_at: Date
  kind: string
}

type OrderCountRow = { product_id: string; cnt: number }

export async function POST(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error }, { status: 400 })
    }
    const { event_id, user_id } = parsed.data

    const events = await prisma.$queryRaw<LeaveEventRow[]>`
      SELECT id, user_id, title, start_at, end_at, kind
      FROM public.calendar_events
      WHERE id = ${event_id}::uuid AND user_id = ${user_id}::uuid AND kind = 'leave'
      LIMIT 1
    `
    if (events.length === 0) {
      return NextResponse.json({ error: 'Leave event not found' }, { status: 404 })
    }
    const event = events[0]

    const products = await prisma.product.findMany({
      where: { user_id, active: true },
      select: {
        id: true,
        sku: true,
        name: true,
        quantity: true,
        supplier: true,
        supplier_lead_time_days: true,
        supplier_unit_cost_eur: true,
      },
    })

    const sixtyDaysAgoISO = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const orderCounts = await prisma.$queryRaw<OrderCountRow[]>`
      SELECT p.id AS product_id, COUNT(o.*)::int AS cnt
      FROM public.products p
      LEFT JOIN public.data_orders_amazon o
        ON o.sku = p.sku AND o.purchase_date >= ${sixtyDaysAgoISO}::timestamptz
      WHERE p.user_id = ${user_id}::uuid AND p.active = true
      GROUP BY p.id
    `
    const ordersMap = new Map(orderCounts.map((r) => [r.product_id, r.cnt]))

    const coincidingEventsRaw = await prisma.$queryRaw<Array<{ title: string; kind: string; start_at: Date; end_at: Date }>>`
      SELECT title, kind, start_at, end_at
      FROM public.calendar_events
      WHERE user_id = ${user_id}::uuid
        AND kind <> 'leave'
        AND start_at <= ${event.end_at}
        AND end_at >= ${event.start_at}
    `

    const today = new Date()
    const items = buildPlanItems({
      today,
      leaveStart: event.start_at,
      leaveEnd: event.end_at,
      products: products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        currentStock: p.quantity,
        supplier: p.supplier,
        supplierLeadTimeDays: p.supplier_lead_time_days ?? 7,
        supplierUnitCostEur: Number(p.supplier_unit_cost_eur ?? 0),
      })),
      orders: products.map((p) => ({
        productId: p.id,
        orders60d: ordersMap.get(p.id) ?? 0,
      })),
    })

    const summary = summarizePlan(items)

    const aiSettings = await prisma.merchantAiSettings.findUnique({ where: { user_id } })
    const merchantProfile = await prisma.merchantProfileContext.findUnique({ where: { user_id } })

    const enrichment = await enrichWithFallback(
      {
        leaveTitle: event.title,
        leaveStart: event.start_at,
        leaveEnd: event.end_at,
        atRiskItems: items,
        coincidingEvents: coincidingEventsRaw.map((e) => ({
          title: e.title,
          kind: e.kind,
          start: e.start_at,
          end: e.end_at,
        })),
        merchantProfile: merchantProfile
          ? {
              merchantCategory: merchantProfile.merchant_category,
              operatingRegions: merchantProfile.operating_regions,
              supplierRegions: merchantProfile.supplier_regions,
              seasonalityTags: merchantProfile.seasonality_tags,
            }
          : null,
      },
      aiSettings?.encrypted_api_key,
      aiSettings?.preferred_model ?? 'gpt-4.1-mini'
    )

    const title = `🏖️ Plan congés ${event.start_at.toISOString().slice(0, 10)} → ${event.end_at.toISOString().slice(0, 10)}`

    const evidence = [
      { label: "Période d'absence", value: `${event.start_at.toISOString().slice(0, 10)} → ${event.end_at.toISOString().slice(0, 10)}` },
      { label: 'SKUs analysés', value: String(products.length) },
      { label: 'SKUs à risque', value: String(items.length) },
      { label: 'Deadline commande', value: summary.earliestDeadline?.toISOString().slice(0, 10) ?? '—' },
      { label: 'Coût total estimé', value: `${summary.totalCostEur.toFixed(2)} €` },
      { label: 'Événements commerce coïncidant', value: coincidingEventsRaw.length > 0 ? coincidingEventsRaw.map((e) => e.title).join(', ') : 'Aucun' },
    ]

    const actionPayload = {
      leave_event_id: event.id,
      leave_start: event.start_at.toISOString().slice(0, 10),
      leave_end: event.end_at.toISOString().slice(0, 10),
      leave_duration_days: Math.round((event.end_at.getTime() - event.start_at.getTime()) / (24 * 3600 * 1000)),
      order_deadline: summary.earliestDeadline?.toISOString().slice(0, 10) ?? null,
      total_estimated_cost_eur: summary.totalCostEur,
      items_count: items.length,
      target: 'calendar_restock_plan',
      supplementary_notes: enrichment.supplementaryNotes,
      items: items.map((i) => ({
        product_id: i.productId,
        sku: i.sku,
        product_name: i.productName,
        current_stock: i.currentStock,
        velocity_per_day: i.velocityPerDay,
        projected_stock_end_of_leave: i.projectedStockEndOfLeave,
        recommended_qty: i.recommendedQty,
        supplier: i.supplier,
        lead_time_days: i.leadTimeDays,
        unit_cost_eur: i.unitCostEur,
        estimated_cost_eur: i.estimatedCostEur,
        priority: i.priority,
        order_deadline: i.orderDeadline.toISOString().slice(0, 10),
        reasoning: i.reasoning,
      })),
    }

    const existing = await prisma.agentRecommendation.findFirst({
      where: {
        user_id,
        scenario_type: 'calendar_restock_plan',
        status: 'pending_approval',
        action_payload: { path: ['leave_event_id'], equals: event.id },
      },
    })

    const recommendation = existing
      ? await prisma.agentRecommendation.update({
          where: { id: existing.id },
          data: {
            title,
            reasoning_summary: enrichment.reasoningSummary,
            expected_impact: enrichment.expectedImpact,
            confidence_note: enrichment.confidenceNote,
            evidence_payload: evidence,
            action_payload: actionPayload,
          },
        })
      : await prisma.agentRecommendation.create({
          data: {
            user_id,
            title,
            scenario_type: 'calendar_restock_plan',
            status: 'pending_approval',
            reasoning_summary: enrichment.reasoningSummary,
            expected_impact: enrichment.expectedImpact,
            confidence_note: enrichment.confidenceNote,
            evidence_payload: evidence,
            action_payload: actionPayload,
            approval_required: true,
            source: 'calendar_advisor',
          },
        })

    return NextResponse.json({
      recommendation_id: recommendation.id,
      items_count: items.length,
      total_cost_eur: summary.totalCostEur,
      llm_used: !enrichment.fallback,
    })
  } catch (error) {
    console.error('calendar-advisor error:', error)
    return NextResponse.json({ error: 'Internal error', detail: String(error) }, { status: 500 })
  }
}
```

- [ ] **Step 2 : Créer l'endpoint trigger (fallback démo, utilise getCurrentUserId)**

Create `src/app/api/agent/calendar-advisor/trigger/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  event_id: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const url = new URL(request.url)
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Missing event_id query param' }, { status: 400 })
    }

    const proxyResp = await fetch(`${url.origin}/api/agent/calendar-advisor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: parsed.data.event_id, user_id: userId }),
    })

    const data = await proxyResp.json()
    return NextResponse.json(data, { status: proxyResp.status })
  } catch (error) {
    console.error('trigger error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

- [ ] **Step 3 : Créer l'endpoint refresh cron**

Create `src/app/api/agent/calendar-advisor/refresh/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type LeaveRow = { id: string; user_id: string }

export async function GET(request: Request) {
  try {
    const now = new Date()
    const in30d = new Date(Date.now() + 30 * 24 * 3600 * 1000)

    const leaves = await prisma.$queryRaw<LeaveRow[]>`
      SELECT id, user_id
      FROM public.calendar_events
      WHERE kind = 'leave'
        AND start_at >= ${now}
        AND start_at <= ${in30d}
    `

    const origin = new URL(request.url).origin
    const results: Array<{ event_id: string; ok: boolean }> = []

    for (const leave of leaves) {
      const resp = await fetch(`${origin}/api/agent/calendar-advisor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: leave.id, user_id: leave.user_id }),
      })
      results.push({ event_id: leave.id, ok: resp.ok })
    }

    return NextResponse.json({ processed: results.length, results })
  } catch (error) {
    console.error('refresh error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

- [ ] **Step 4 : Tester le build Next**

```bash
cd src
npm run build
```

Expected : build complete, aucune erreur TypeScript bloquante.

- [ ] **Step 5 : Test manuel end-to-end avec un event leave existant**

Démarrer le dev server :

```bash
npm run dev
```

Dans un autre terminal, créer un event leave via l'UI `/calendar` (double-cliquer sur un jour, créer avec kind=leave). Noter l'ID de l'event via Prisma Studio ou les logs.

Puis :

```bash
curl -X POST "http://localhost:3000/api/agent/calendar-advisor/trigger?event_id=<UUID>"
```

Expected : JSON avec `recommendation_id`, `items_count`, `total_cost_eur`. Vérifier dans Prisma Studio que `agent_recommendations` contient une nouvelle ligne `scenario_type='calendar_restock_plan'`.

- [ ] **Step 6 : Commit**

```bash
cd ..
git add src/app/api/agent/calendar-advisor/
git commit -m "feat(api): calendar-advisor endpoints (main + trigger + refresh)"
```

---

## Task 6 : Page `/actions` — inbox list + RecommendationCard

**Files :**
- Create : `src/app/actions/types.ts`
- Create : `src/app/actions/page.tsx`
- Create : `src/app/actions/ActionsPageClient.tsx`
- Create : `src/app/actions/RecommendationCard.tsx`

- [ ] **Step 1 : Types partagés**

Create `src/app/actions/types.ts`:

```typescript
export type PlanItemDTO = {
  product_id: string
  sku: string | null
  product_name: string
  current_stock: number
  velocity_per_day: number
  projected_stock_end_of_leave: number
  recommended_qty: number
  supplier: string | null
  lead_time_days: number
  unit_cost_eur: number
  estimated_cost_eur: number
  priority: 'critical' | 'high' | 'medium'
  order_deadline: string
  reasoning: string
}

export type ActionPayload = {
  leave_event_id: string
  leave_start: string
  leave_end: string
  leave_duration_days: number
  order_deadline: string | null
  total_estimated_cost_eur: number
  items_count: number
  target: string
  supplementary_notes: string[]
  items: PlanItemDTO[]
}

export type EvidenceEntry = { label: string; value: string }

export type RecommendationDTO = {
  id: string
  title: string
  scenario_type: string
  status: string
  reasoning_summary: string
  expected_impact: string | null
  confidence_note: string | null
  evidence_payload: EvidenceEntry[] | null
  action_payload: ActionPayload | null
  approval_required: boolean
  source: string
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2 : Server page**

Create `src/app/actions/page.tsx`:

```typescript
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import ActionsPageClient from './ActionsPageClient'
import type { RecommendationDTO } from './types'

export const dynamic = 'force-dynamic'

export default async function ActionsPage() {
  const userId = await getCurrentUserId()

  const recommendations = await prisma.agentRecommendation.findMany({
    where: { user_id: userId },
    orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
    take: 50,
  })

  const serialized: RecommendationDTO[] = recommendations.map((r) => ({
    id: r.id,
    title: r.title,
    scenario_type: r.scenario_type,
    status: r.status,
    reasoning_summary: r.reasoning_summary,
    expected_impact: r.expected_impact,
    confidence_note: r.confidence_note,
    evidence_payload: (r.evidence_payload as any) ?? null,
    action_payload: (r.action_payload as any) ?? null,
    approval_required: r.approval_required,
    source: r.source,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  }))

  return <ActionsPageClient initialRecommendations={serialized} />
}
```

- [ ] **Step 3 : RecommendationCard component**

Create `src/app/actions/RecommendationCard.tsx`:

```typescript
'use client'

import type { RecommendationDTO } from './types'

export function RecommendationCard({
  recommendation,
  selected,
  onSelect,
}: {
  recommendation: RecommendationDTO
  selected: boolean
  onSelect: () => void
}) {
  const payload = recommendation.action_payload
  const isPending = recommendation.status === 'pending_approval'

  const badge =
    recommendation.status === 'pending_approval'
      ? { text: 'À valider', className: 'bg-amber-100 text-amber-700' }
      : recommendation.status === 'approved'
        ? { text: 'Approuvée', className: 'bg-emerald-100 text-emerald-700' }
        : recommendation.status === 'rejected'
          ? { text: 'Rejetée', className: 'bg-slate-200 text-slate-700' }
          : { text: recommendation.status, className: 'bg-slate-200 text-slate-700' }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left transition hover:border-blue-500 ${
        selected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{recommendation.title}</p>
          <p className="mt-1 line-clamp-2 text-xs text-slate-600">{recommendation.reasoning_summary}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
          {badge.text}
        </span>
      </div>

      {payload && isPending && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
          <span>{payload.items_count} commandes</span>
          <span>•</span>
          <span>{payload.total_estimated_cost_eur.toFixed(0)} €</span>
          {payload.order_deadline && (
            <>
              <span>•</span>
              <span>Deadline {payload.order_deadline}</span>
            </>
          )}
        </div>
      )}
    </button>
  )
}
```

- [ ] **Step 4 : ActionsPageClient (liste à gauche, détail à droite — le panneau détail sera ajouté à la Task 7)**

Create `src/app/actions/ActionsPageClient.tsx`:

```typescript
'use client'

import { useMemo, useState } from 'react'
import { RecommendationCard } from './RecommendationCard'
import type { RecommendationDTO } from './types'

export default function ActionsPageClient({
  initialRecommendations,
}: {
  initialRecommendations: RecommendationDTO[]
}) {
  const [recommendations, setRecommendations] = useState(initialRecommendations)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialRecommendations[0]?.id ?? null
  )

  const selected = useMemo(
    () => recommendations.find((r) => r.id === selectedId) ?? null,
    [recommendations, selectedId]
  )

  const handleRefresh = async () => {
    const resp = await fetch('/api/copilot/recommendations', { cache: 'no-store' })
    if (!resp.ok) return
    const data = await resp.json()
    setRecommendations(data.recommendations)
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-7xl gap-6 p-6">
      <aside className="flex w-96 shrink-0 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Actions</h1>
          <button
            type="button"
            onClick={handleRefresh}
            className="text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            Rafraîchir
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto">
          {recommendations.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
              Aucune action en attente. L'agent vous préviendra dès qu'il détecte un risque.
            </p>
          )}

          {recommendations.map((r) => (
            <RecommendationCard
              key={r.id}
              recommendation={r}
              selected={r.id === selectedId}
              onSelect={() => setSelectedId(r.id)}
            />
          ))}
        </div>
      </aside>

      <section className="flex-1 rounded-2xl border border-slate-200 bg-white p-6">
        {!selected ? (
          <p className="text-sm text-slate-500">Sélectionne une action à gauche.</p>
        ) : (
          <div className="space-y-4">
            <header>
              <h2 className="text-xl font-semibold text-slate-900">{selected.title}</h2>
              <p className="mt-2 text-sm text-slate-700">{selected.reasoning_summary}</p>
            </header>
            <p className="text-xs text-slate-500">
              (Le panneau détail arrive à la prochaine étape.)
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 5 : Vérifier que la page se charge**

```bash
cd src
npm run dev
```

Ouvrir `http://localhost:3000/actions`. Doit afficher la liste des recommandations (ou un message "Aucune action en attente" si table vide).

- [ ] **Step 6 : Commit**

```bash
cd ..
git add src/app/actions/
git commit -m "feat(ui): /actions inbox list with RecommendationCard"
```

---

## Task 7 : RecommendationDetailPanel + intégration approve/reject

**Files :**
- Create : `src/app/actions/RecommendationDetailPanel.tsx`
- Modify : `src/app/actions/ActionsPageClient.tsx`

- [ ] **Step 1 : Créer le panneau détail**

Create `src/app/actions/RecommendationDetailPanel.tsx`:

```typescript
'use client'

import { useMemo, useState } from 'react'
import type { PlanItemDTO, RecommendationDTO } from './types'

const priorityStyles: Record<PlanItemDTO['priority'], string> = {
  critical: 'bg-rose-100 text-rose-700',
  high: 'bg-amber-100 text-amber-700',
  medium: 'bg-sky-100 text-sky-700',
}

export function RecommendationDetailPanel({
  recommendation,
  onStatusChange,
}: {
  recommendation: RecommendationDTO
  onStatusChange: (next: RecommendationDTO) => void
}) {
  const payload = recommendation.action_payload
  const isPending = recommendation.status === 'pending_approval'
  const items = payload?.items ?? []

  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(items.map((i) => i.product_id))
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedItems = useMemo(
    () => items.filter((i) => checked.has(i.product_id)),
    [items, checked]
  )
  const selectedCost = useMemo(
    () => selectedItems.reduce((s, i) => s + i.estimated_cost_eur, 0),
    [selectedItems]
  )

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const submit = async (action: 'approve' | 'reject') => {
    setBusy(true)
    setError(null)
    try {
      const body =
        action === 'approve'
          ? {
              comment: `Approuvé sur ${selectedItems.length}/${items.length} lignes, ${selectedCost.toFixed(2)} €`,
              selected_product_ids: Array.from(checked),
            }
          : {}

      const resp = await fetch(`/api/copilot/recommendations/${recommendation.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data?.error ?? 'Request failed')
      }
      const data = await resp.json()
      onStatusChange({ ...recommendation, status: data.recommendation.status })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setBusy(false)
    }
  }

  if (!payload) {
    return <p className="text-sm text-slate-500">Pas de détails disponibles pour cette action.</p>
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Congés détectés • {payload.leave_duration_days} jours
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">{recommendation.title}</h2>
          </div>
          {payload.order_deadline && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-right">
              <p className="text-xs text-rose-700">Deadline commande</p>
              <p className="text-sm font-semibold text-rose-900">{payload.order_deadline}</p>
            </div>
          )}
        </div>
        <p className="mt-3 text-sm text-slate-700">{recommendation.reasoning_summary}</p>
        {recommendation.expected_impact && (
          <p className="mt-2 text-xs text-emerald-700">💡 {recommendation.expected_impact}</p>
        )}
      </header>

      {payload.supplementary_notes.length > 0 && (
        <div className="mt-4 space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3">
          {payload.supplementary_notes.map((n, idx) => (
            <p key={idx} className="text-xs text-amber-900">
              ⚠️ {n}
            </p>
          ))}
        </div>
      )}

      <div className="mt-6 flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="p-3 text-left">☑</th>
              <th className="p-3 text-left">Priorité</th>
              <th className="p-3 text-left">SKU</th>
              <th className="p-3 text-left">Produit</th>
              <th className="p-3 text-right">Stock</th>
              <th className="p-3 text-right">Projection</th>
              <th className="p-3 text-right">Reco qty</th>
              <th className="p-3 text-left">Fournisseur</th>
              <th className="p-3 text-right">Coût</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.product_id} className="hover:bg-slate-50">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={checked.has(item.product_id)}
                    onChange={() => toggle(item.product_id)}
                    disabled={!isPending}
                  />
                </td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityStyles[item.priority]}`}
                  >
                    {item.priority}
                  </span>
                </td>
                <td className="p-3 font-mono text-xs text-slate-700">{item.sku ?? '—'}</td>
                <td className="p-3 text-slate-900">{item.product_name}</td>
                <td className="p-3 text-right tabular-nums">{item.current_stock}</td>
                <td
                  className={`p-3 text-right tabular-nums ${
                    item.projected_stock_end_of_leave < 0 ? 'text-rose-700 font-medium' : 'text-slate-700'
                  }`}
                >
                  {item.projected_stock_end_of_leave}
                </td>
                <td className="p-3 text-right tabular-nums font-semibold text-slate-900">
                  +{item.recommended_qty}
                </td>
                <td className="p-3 text-xs text-slate-700">{item.supplier ?? '—'}</td>
                <td className="p-3 text-right tabular-nums">
                  {item.estimated_cost_eur.toFixed(2)} €
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isPending && (
        <footer className="mt-6 border-t border-slate-200 pt-4">
          {error && <p className="mb-3 text-sm text-rose-700">{error}</p>}
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              {selectedItems.length}/{items.length} lignes sélectionnées •{' '}
              <strong className="text-slate-900">{selectedCost.toFixed(2)} €</strong>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => submit('reject')}
                disabled={busy}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Rejeter
              </button>
              <button
                type="button"
                onClick={() => submit('approve')}
                disabled={busy || selectedItems.length === 0}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Approuver la sélection
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
```

- [ ] **Step 2 : Brancher le panneau dans `ActionsPageClient`**

Dans `src/app/actions/ActionsPageClient.tsx`, remplacer la section `<section>` par :

```typescript
      <section className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6">
        {!selected ? (
          <p className="text-sm text-slate-500">Sélectionne une action à gauche.</p>
        ) : (
          <RecommendationDetailPanel
            recommendation={selected}
            onStatusChange={(next) =>
              setRecommendations((prev) =>
                prev.map((r) => (r.id === next.id ? next : r))
              )
            }
          />
        )}
      </section>
```

Et ajouter l'import en haut du fichier :

```typescript
import { RecommendationDetailPanel } from './RecommendationDetailPanel'
```

- [ ] **Step 3 : Test manuel end-to-end**

Démarrer le serveur, créer un event leave dans `/calendar`, puis déclencher l'agent :

```bash
curl -X POST "http://localhost:3000/api/agent/calendar-advisor/trigger?event_id=<UUID>"
```

Ouvrir `http://localhost:3000/actions`, vérifier :
- La reco apparaît dans la liste
- Clic → le panneau détail s'affiche avec le tableau SKU
- Décoche 1 ligne
- Clic "Approuver la sélection" → statut passe à "approved"
- Vérifier dans Supabase que `agent_execution_runs` contient un nouveau row `status='queued'`

- [ ] **Step 4 : Commit**

```bash
cd ..
git add src/app/actions/
git commit -m "feat(ui): detail panel with SKU table and approve/reject flow"
```

---

## Task 8 : Navigation — sidebar + widget dashboard

**Files :**
- Modify : `src/components/Sidebar.tsx`
- Create : `src/components/ActionsPendingWidget.tsx`
- Modify : `src/app/dashboard/page.tsx`

- [ ] **Step 1 : Ajouter l'entrée Actions dans la sidebar**

Dans `src/components/Sidebar.tsx`, modifier le tableau `navigation` pour insérer Actions juste après Copilot :

```typescript
const navigation = [
  { href: '/dashboard', label: 'Dashboard', short: 'DB' },
  { href: '/actions', label: 'Actions', short: 'AC' },
  { href: '/copilot', label: 'Copilot', short: 'AI' },
  { href: '/planning', label: 'Planning', short: 'PL' },
  { href: '/settings', label: 'Paramètres', short: 'PR' },
  { href: '/stock', label: 'Stock', short: 'ST' },
  { href: '/wms', label: 'Entrepôt', short: 'WM' },
  { href: '/parcels', label: 'Transport', short: 'TR' },
  { href: '/calendar', label: 'Calendrier', short: 'CA' },
  { href: '/losses', label: 'Suivi des pertes', short: 'SP' },
]
```

- [ ] **Step 2 : Créer le widget**

Create `src/components/ActionsPendingWidget.tsx`:

```typescript
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export default async function ActionsPendingWidget() {
  const userId = await getCurrentUserId()
  const pending = await prisma.agentRecommendation.findMany({
    where: { user_id: userId, status: 'pending_approval' },
    orderBy: { created_at: 'desc' },
    take: 3,
  })

  const totalCount = await prisma.agentRecommendation.count({
    where: { user_id: userId, status: 'pending_approval' },
  })

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Actions en attente</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">{totalCount}</p>
        </div>
        <Link
          href="/actions"
          className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
        >
          Ouvrir l'inbox →
        </Link>
      </div>

      {pending.length > 0 && (
        <ul className="mt-4 space-y-2">
          {pending.map((r) => (
            <li key={r.id} className="truncate rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {r.title}
            </li>
          ))}
        </ul>
      )}
      {pending.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">
          Tout est à jour. L'agent te préviendra s'il détecte un risque.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3 : Intégrer le widget dans `/dashboard`**

Ouvrir `src/app/dashboard/page.tsx`. En haut, ajouter l'import :

```typescript
import ActionsPendingWidget from '@/components/ActionsPendingWidget'
```

Puis insérer `<ActionsPendingWidget />` dans la grille principale (à placer au-dessus ou à côté des autres cards existantes — adapter au layout existant).

- [ ] **Step 4 : Vérifier visuellement**

```bash
cd src
npm run dev
```

Ouvrir `/dashboard` : le widget doit afficher le compteur + les 3 dernières recos pending.
Ouvrir n'importe quelle page : l'entrée "Actions" doit apparaître dans la sidebar, active sur `/actions`.

- [ ] **Step 5 : Commit**

```bash
cd ..
git add src/components/Sidebar.tsx src/components/ActionsPendingWidget.tsx src/app/dashboard/page.tsx
git commit -m "feat(ui): sidebar Actions entry + dashboard pending widget"
```

---

## Task 9 : Workflow n8n exportable

**Files :**
- Create : `workflows/calendar-advisor.json`

- [ ] **Step 1 : Créer le workflow**

Create `workflows/calendar-advisor.json`:

```json
{
  "name": "Calendar Advisor",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "calendar-leave-created",
        "responseMode": "onReceived",
        "options": {}
      },
      "name": "Webhook Leave Created",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [240, 300],
      "webhookId": "calendar-leave-created"
    },
    {
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{$json[\"kind\"]}}",
              "operation": "equals",
              "value2": "leave"
            }
          ]
        }
      },
      "name": "Is Leave Event",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [460, 300]
    },
    {
      "parameters": {
        "url": "={{$env[\"APP_BASE_URL\"]}}/api/agent/calendar-advisor",
        "method": "POST",
        "sendBody": true,
        "contentType": "json",
        "bodyParameters": {
          "parameters": [
            { "name": "event_id", "value": "={{$json[\"id\"]}}" },
            { "name": "user_id", "value": "={{$json[\"user_id\"]}}" }
          ]
        }
      },
      "name": "POST Calendar Advisor",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [680, 200]
    },
    {
      "parameters": {
        "triggerTimes": {
          "item": [{ "mode": "everyDay", "hour": 7, "minute": 0 }]
        }
      },
      "name": "Cron Daily 07:00",
      "type": "n8n-nodes-base.cron",
      "typeVersion": 1,
      "position": [240, 500]
    },
    {
      "parameters": {
        "url": "={{$env[\"APP_BASE_URL\"]}}/api/agent/calendar-advisor/refresh",
        "method": "GET"
      },
      "name": "GET Refresh",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [460, 500]
    }
  ],
  "connections": {
    "Webhook Leave Created": {
      "main": [[{ "node": "Is Leave Event", "type": "main", "index": 0 }]]
    },
    "Is Leave Event": {
      "main": [
        [{ "node": "POST Calendar Advisor", "type": "main", "index": 0 }],
        []
      ]
    },
    "Cron Daily 07:00": {
      "main": [[{ "node": "GET Refresh", "type": "main", "index": 0 }]]
    }
  }
}
```

- [ ] **Step 2 : (Optionnel) Tester le workflow dans n8n Cloud**

Dans n8n Cloud (compte hackathon ou self-hosted) : Import from File → sélectionner `workflows/calendar-advisor.json`. Activer. Définir `APP_BASE_URL` dans les env vars n8n.

- [ ] **Step 3 : Commit**

```bash
git add workflows/calendar-advisor.json
git commit -m "feat(n8n): add calendar-advisor workflow export"
```

---

## Task 10 : Scénario démo scripté + README final

**Files :**
- Create : `scripts/seed-demo-scenario.ts`
- Create : `docs/demo-script.md`

- [ ] **Step 1 : Script de seed pour la démo**

Create `scripts/seed-demo-scenario.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEMO_USER_ID = process.env.HACKATHON_USER_ID
if (!DEMO_USER_ID) {
  console.error('HACKATHON_USER_ID env var required')
  process.exit(1)
}

async function main() {
  // 1. Assurer que certains products sont à stock critique pour la démo
  const criticalSkus = ['NKS-00042', 'NKS-00021', 'NKS-00100', 'NKS-00055', 'NKS-00079']
  const products = await prisma.product.findMany({
    where: { user_id: DEMO_USER_ID, sku: { in: criticalSkus } },
  })

  for (const p of products) {
    const ninetyPercentOfMin = Math.max(1, Math.floor((p.min_quantity || 10) * 0.4))
    await prisma.product.update({
      where: { id: p.id },
      data: { quantity: ninetyPercentOfMin },
    })
    console.log(`Stock ${p.sku} set to ${ninetyPercentOfMin}`)
  }

  // 2. Créer un event leave "Congés Savoie" dans ~10 jours
  const in10d = new Date(Date.now() + 10 * 24 * 3600 * 1000)
  const in20d = new Date(Date.now() + 20 * 24 * 3600 * 1000)

  const existing: Array<{ id: string }> = await prisma.$queryRaw`
    SELECT id FROM public.calendar_events
    WHERE user_id = ${DEMO_USER_ID}::uuid
      AND title = 'Congés Savoie - Démo'
    LIMIT 1
  `

  if (existing.length === 0) {
    await prisma.$executeRaw`
      INSERT INTO public.calendar_events (user_id, title, start_at, end_at, kind, impact, notes)
      VALUES (
        ${DEMO_USER_ID}::uuid,
        'Congés Savoie - Démo',
        ${in10d},
        ${in20d},
        'leave',
        'high',
        'Événement seedé pour la démo'
      )
    `
    console.log('Created demo leave event')
  } else {
    console.log('Demo leave event already exists, skipping')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 2 : Lancer le seed démo**

```bash
cd src
npx ts-node --compiler-options '{"module":"CommonJS"}' ../scripts/seed-demo-scenario.ts
```

Expected : logs `Stock ... set to X` pour chaque SKU, puis `Created demo leave event`.

- [ ] **Step 3 : Déclencher l'agent pour générer la reco démo**

Récupérer l'UUID de l'event :

```bash
npx prisma studio
```

Ouvrir `calendar_events`, trouver "Congés Savoie - Démo", copier l'ID.

Déclencher :

```bash
curl -X POST "http://localhost:3000/api/agent/calendar-advisor/trigger?event_id=<UUID>"
```

Vérifier que la reco apparaît dans `/actions` avec les SKUs à risque.

- [ ] **Step 4 : Script démo Loom**

Create `docs/demo-script.md`:

```markdown
# Script démo Loom — Calendar-Aware Restock Advisor

**Durée cible :** 90 secondes sur les 5-8 min du Loom complet.

## Préparation (avant Loom)
1. Exécuter `scripts/seed-demo-scenario.ts` pour reset le stock + créer l'event leave.
2. Ouvrir `http://localhost:3000/calendar` dans un onglet.
3. Ouvrir `http://localhost:3000/actions` dans un second onglet.
4. Noter l'UUID de l'event "Congés Savoie - Démo" pour le curl de trigger si n8n indisponible.

## Déroulé

| t (s) | Écran | Action | Voiceover |
|---|---|---|---|
| 00:00 | /calendar | Zoom sur les dates 10-20 mai | "Jean-Charles veut partir 10 jours en Savoie." |
| 00:10 | /calendar | Double-clic sur un jour, saisir "Congés Savoie", kind=leave | "Il crée l'événement dans son calendrier." |
| 00:20 | sidebar | Cliquer sur Actions (badge compteur = 1) | "L'agent a détecté l'absence et préparé un plan." |
| 00:25 | /actions | Reco "Plan congés" sélectionnée | "Un seul plan, pas 5 alertes séparées." |
| 00:35 | /actions | Lire tableau SKU, pointer la colonne Projection négative | "Voilà les 5 références qui vont tomber en rupture." |
| 00:55 | /actions | Décocher 1 ligne | "Celle-là, je la gère avec un autre fournisseur." |
| 01:05 | /actions | Clic "Approuver la sélection" | "Un clic — 4 commandes passées." |
| 01:15 | Toast confirmation | Statut passe à "Approuvée" | "Jean-Charles peut partir. Le business continue sans lui." |

## Plan B si n8n ne répond pas
Déclencher manuellement la reco :

    curl -X POST "http://localhost:3000/api/agent/calendar-advisor/trigger?event_id=<UUID_démo>"

Puis rafraîchir `/actions`.
```

- [ ] **Step 5 : Commit**

```bash
cd ..
git add scripts/seed-demo-scenario.ts docs/demo-script.md
git commit -m "docs: demo seed script and Loom shot-by-shot"
```

---

## Task 11 : Vérification finale end-to-end

**Files :** aucun

- [ ] **Step 1 : Checklist acceptance du spec**

Reprendre `docs/superpowers/specs/2026-04-21-calendar-aware-restock-advisor-design.md` §17 et cocher manuellement :

- Créer un event `kind=leave` dans `/calendar` → reco créée (via n8n ou trigger direct) en < 5s ✓
- `scenario_type='calendar_restock_plan'` + `action_payload` conforme §5.3 ✓
- Card visible dans `/actions` §8.1 ✓
- Vue détail avec tableau SKU §8.2 ✓
- Approuver sélection → status='approved' + execution_run créé ✓
- Rejeter → status='rejected' ✓
- Cron `refresh` callable via curl sans erreur ✓
- Fallback déterministe (couper la clé OpenAI dans settings) → reco produite quand même ✓
- Scénario démo §10 jouable en < 90s ✓

- [ ] **Step 2 : Lancer la suite de tests**

```bash
cd src
npm test
```

Expected : tous les tests calendar-restock passent.

- [ ] **Step 3 : Vérifier le build production**

```bash
npm run build
```

Expected : build succeeds, pas d'erreurs TS bloquantes.

- [ ] **Step 4 : Push de la branche**

```bash
cd ..
git push -u origin nathan/calendar-advisor
```

Expected : branche poussée, PR disponible côté GitHub.

- [ ] **Step 5 : Commit final (doc d'état)**

Pas de fichier à créer : cette étape est un checkpoint. La branche est prête pour review/merge.

---

## Self-review (fait par l'auteur du plan)

**Couverture du spec :**
- §1 Vision → Tasks 3-7 couvrent le flux complet
- §2 Problème → Scénario démo Task 10 raconte le problème
- §3 Parti pris → Tasks 6-7 implémentent l'inbox agrégée et human-in-the-loop
- §4 Architecture → Tasks 5 (routes), 3-4 (libs), 6-7 (UI) mappent 1:1
- §5 Data model → Task 5 crée le payload conforme
- §6 Calcul déterministe → Task 3 (pseudo-code direct → TS testé)
- §7 LLM → Task 4
- §8 UX → Tasks 6-7
- §9 Trigger n8n → Task 9
- §10 Démo → Task 10
- §11 Scaling → pas d'action ; reste doc, validé via query SQL O(n)
- §12 Limites → documenté dans spec
- §13 FinOps → doc dans spec, pas d'action plan
- §14-15 Ce qui existe/reste → reflété dans File Structure et tâches
- §16 Livrables → Tasks 9 (n8n) + 10 (démo + doc)
- §17 Acceptance → Task 11

**Type consistency :**
- `ProductForProjection`, `OrderAggregate`, `PlanItem` définis une seule fois dans `calendar-restock.ts`
- `PlanItemDTO`, `ActionPayload`, `RecommendationDTO` définis une seule fois dans `actions/types.ts` (côté server/client)
- Noms alignés : `recommendedQty` en interne, `recommended_qty` côté payload (snake_case DB)
- `scenario_type='calendar_restock_plan'` utilisé de manière cohérente

**Placeholders :** aucun TBD / TODO / "à implémenter plus tard" dans les tâches.

**Scope :** 1 feature cohérente, 11 tâches, ~14h de dev estimées.

---

## Execution Handoff

Plan sauvegardé dans `docs/superpowers/plans/2026-04-21-calendar-aware-restock-advisor.md`.

Deux options d'exécution :

1. **Subagent-Driven (recommandé)** — dispatch d'un subagent fresh par tâche, review entre chaque, itération rapide
2. **Inline Execution** — exécution tâche par tâche dans la session courante, checkpoints de review

Au vu du temps hackathon serré (3 jours restants) et du fait que plusieurs tâches ont des dépendances (schéma avant seed avant lib avant route), je recommande **Inline Execution**. La session garde le contexte et on peut ajuster à la volée.
