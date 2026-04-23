// Seed financial_snapshots + marketing_analytics so Leia can actually query/analyze
// the Cash Flow, Outstanding Balances, Visits & Conversion widgets on /orders.
//
// Run: npx ts-node --project tsconfig.scripts.json scripts/seed-leia-analytics.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const USER_ID = process.env.HACKATHON_USER_ID ?? '00000000-0000-0000-0000-000000000001'

function toDate(iso: string) {
  return new Date(iso + 'T00:00:00Z')
}

const FINANCIAL_SNAPSHOTS = [
  // Year 2026 — aggregate
  {
    period_type: 'year',
    period_start: '2026-01-01',
    period_end: '2026-12-31',
    source: 'aggregate',
    revenue_cents: 37500000_00,
    cost_cents: 20050000_00,
    margin_cents: 17450000_00,
    margin_pct: 47,
    cashflow_in_cents: 28400000_00,
    cashflow_out_cents: 18200000_00,
    receivables_cents: 18920000_00,
    payables_cents: 3179800_00,
    overdue_receivables_cents: 7850000_00,
    overdue_payables_cents: 3179800_00,
    previous_period_revenue_cents: 67760000_00,
    notes: 'Année 2026 — baisse vs 2025 (marché ralenti T1), rattrapage partiel en avril.',
  },
  // April 2026 — aggregate
  {
    period_type: 'month',
    period_start: '2026-04-01',
    period_end: '2026-04-30',
    source: 'aggregate',
    revenue_cents: 7670000_00,
    cost_cents: 3992000_00,
    margin_cents: 3678000_00,
    margin_pct: 48,
    cashflow_in_cents: 340_00,
    cashflow_out_cents: 0,
    receivables_cents: 18920000_00,
    payables_cents: 3179800_00,
    overdue_receivables_cents: 7850000_00,
    overdue_payables_cents: 3179800_00,
    previous_period_revenue_cents: 5240000_00,
    notes: 'Avril 2026 — +46% vs mars. Encaissements faibles (340€) car règlements clients fin de mois.',
  },
  // March 2026 — aggregate (so comparisons land)
  {
    period_type: 'month',
    period_start: '2026-03-01',
    period_end: '2026-03-31',
    source: 'aggregate',
    revenue_cents: 5240000_00,
    cost_cents: 2820000_00,
    margin_cents: 2420000_00,
    margin_pct: 46,
    cashflow_in_cents: 44468_00,
    cashflow_out_cents: 0,
    receivables_cents: 17100000_00,
    payables_cents: 2800000_00,
    overdue_receivables_cents: 6900000_00,
    overdue_payables_cents: 2800000_00,
    previous_period_revenue_cents: 4150000_00,
    notes: null,
  },
  // Amazon breakdown 2026
  {
    period_type: 'year',
    period_start: '2026-01-01',
    period_end: '2026-12-31',
    source: 'amazon',
    revenue_cents: 24210000_00,
    cost_cents: 14130000_00,
    margin_cents: 10080000_00,
    margin_pct: 42,
    cashflow_in_cents: 12120_00,
    cashflow_out_cents: 3180_00,
    receivables_cents: 8120000_00,
    payables_cents: 1439000_00,
    overdue_receivables_cents: 2290000_00,
    overdue_payables_cents: 1132000_00,
    previous_period_revenue_cents: 31120000_00,
    notes: 'Amazon concentre 64% du CA 2026. Baisse de 22% vs 2025.',
  },
  // Shopify breakdown 2026
  {
    period_type: 'year',
    period_start: '2026-01-01',
    period_end: '2026-12-31',
    source: 'shopify',
    revenue_cents: 13290000_00,
    cost_cents: 6120000_00,
    margin_cents: 7160000_00,
    margin_pct: 54,
    cashflow_in_cents: 18440_00,
    cashflow_out_cents: 5410_00,
    receivables_cents: 4720000_00,
    payables_cents: 892000_00,
    overdue_receivables_cents: 980000_00,
    overdue_payables_cents: 765000_00,
    previous_period_revenue_cents: 12050000_00,
    notes: 'Shopify en croissance +10%. Meilleure marge (54% vs 42% Amazon).',
  },
]

const CHANNELS = ['all', 'amazon_fr', 'amazon_it', 'amazon_de']

// 31 days of mock marketing analytics (24 Mar → 23 Apr 2026)
function buildAnalytics() {
  const rows: Array<{
    user_id: string
    day: Date
    channel: string
    visits: number
    sessions: number
    orders: number
    sales_cents: bigint
    conversion_pct: number
  }> = []
  const start = toDate('2026-03-24')
  for (let i = 0; i < 31; i++) {
    const day = new Date(start)
    day.setUTCDate(start.getUTCDate() + i)
    for (const channel of CHANNELS) {
      const factor = channel === 'all' ? 1 : channel === 'amazon_fr' ? 0.42 : channel === 'amazon_it' ? 0.26 : 0.32
      const baseVisits = Math.round((20 + Math.sin(i / 3) * 15 + (i % 4) * 8) * factor)
      const visits = Math.max(5, baseVisits)
      const sessions = Math.round(visits * 0.86)
      const orders = Math.max(0, Math.round(sessions * (0.01 + Math.random() * 0.02)))
      const aov = 120 + Math.random() * 90
      const sales = Math.round(orders * aov * 100)
      const conv = sessions > 0 ? Number(((orders / sessions) * 100).toFixed(2)) : 0
      rows.push({
        user_id: USER_ID,
        day,
        channel,
        visits,
        sessions,
        orders,
        sales_cents: BigInt(sales),
        conversion_pct: conv,
      })
    }
  }
  return rows
}

async function main() {
  console.log(`Seeding financial_snapshots + marketing_analytics for user ${USER_ID}…`)

  for (const s of FINANCIAL_SNAPSHOTS) {
    await prisma.financialSnapshot.upsert({
      where: {
        user_id_period_type_period_start_source: {
          user_id: USER_ID,
          period_type: s.period_type,
          period_start: toDate(s.period_start),
          source: s.source,
        },
      },
      create: {
        user_id: USER_ID,
        period_type: s.period_type,
        period_start: toDate(s.period_start),
        period_end: toDate(s.period_end),
        source: s.source,
        revenue_cents: BigInt(s.revenue_cents),
        cost_cents: BigInt(s.cost_cents),
        margin_cents: BigInt(s.margin_cents),
        margin_pct: s.margin_pct,
        cashflow_in_cents: BigInt(s.cashflow_in_cents),
        cashflow_out_cents: BigInt(s.cashflow_out_cents),
        receivables_cents: BigInt(s.receivables_cents),
        payables_cents: BigInt(s.payables_cents),
        overdue_receivables_cents: BigInt(s.overdue_receivables_cents),
        overdue_payables_cents: BigInt(s.overdue_payables_cents),
        previous_period_revenue_cents: s.previous_period_revenue_cents
          ? BigInt(s.previous_period_revenue_cents)
          : null,
        notes: s.notes,
      },
      update: {
        period_end: toDate(s.period_end),
        revenue_cents: BigInt(s.revenue_cents),
        cost_cents: BigInt(s.cost_cents),
        margin_cents: BigInt(s.margin_cents),
        margin_pct: s.margin_pct,
        cashflow_in_cents: BigInt(s.cashflow_in_cents),
        cashflow_out_cents: BigInt(s.cashflow_out_cents),
        receivables_cents: BigInt(s.receivables_cents),
        payables_cents: BigInt(s.payables_cents),
        overdue_receivables_cents: BigInt(s.overdue_receivables_cents),
        overdue_payables_cents: BigInt(s.overdue_payables_cents),
        previous_period_revenue_cents: s.previous_period_revenue_cents
          ? BigInt(s.previous_period_revenue_cents)
          : null,
        notes: s.notes,
      },
    })
    console.log(`  ok financial_snapshot ${s.period_type} ${s.period_start} ${s.source}`)
  }

  const analyticsRows = buildAnalytics()
  await prisma.marketingAnalytic.deleteMany({ where: { user_id: USER_ID } })
  for (const r of analyticsRows) {
    await prisma.marketingAnalytic.create({ data: r })
  }
  console.log(`  ok marketing_analytics (${analyticsRows.length} rows across ${CHANNELS.length} channels × 31 days)`)

  console.log('Seed complete.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
