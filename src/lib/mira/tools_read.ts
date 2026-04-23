// MIRA — READ tools. Free to call; no governance involved. The LLM uses these to analyze.
// Each tool returns a plain object serialized to the LLM as tool message content.
// Schemas follow the OpenAI function-calling format.
// All numeric calculations delegate to tools_math — the LLM never produces numbers.

import type { PrismaClient } from '@prisma/client'
import {
  calculateVelocity,
  calculateStockoutDays,
  calculateChannelShares,
  calculateGrowthFactor,
  DAYS_PER_WEEK,
} from './tools_math'

export type ReadToolContext = {
  prisma: PrismaClient
  userId: string
}

export type OpenAITool = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required?: string[]
    }
  }
}

export const READ_TOOLS: OpenAITool[] = [
  {
    type: 'function',
    function: {
      name: 'query_orders',
      description:
        'Liste les commandes ingérées (table operational_objects, kind=order). Filtres optionnels: channel, sku, période en heures.',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', description: 'amazon_fr | amazon_it | amazon_de | google_shopping_fr | google_shopping_it | google_shopping_de' },
          sku: { type: 'string', description: 'SKU exact, ex: NKS-00178' },
          period_hours: { type: 'number', description: 'Fenêtre en heures à partir de maintenant (ex: 24 pour 24h)' },
          limit: { type: 'number', description: 'Nombre max de lignes (défaut: 20, max: 200)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_stock',
      description: 'Snapshot stock actuel (table stock_state). Sans SKU: renvoie les 20 SKU les plus à risque.',
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_velocity',
      description: 'Calcule la vélocité de ventes pour un SKU sur une fenêtre donnée (à partir de operational_objects).',
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string' },
          channel: { type: 'string' },
          window_hours: { type: 'number', description: 'Défaut: 168 (7 jours)' },
        },
        required: ['sku'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_calendar',
      description: 'Événements commerciaux à venir (table commercial_calendar).',
      parameters: {
        type: 'object',
        properties: {
          region: { type: 'string', description: 'FR | IT | DE | EU | GLOBAL' },
          next_days: { type: 'number', description: 'Défaut: 30' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_decisions',
      description: 'Historique des décisions MIRA (table decision_ledger). Filtres optionnels: statut, SKU.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'proposed | auto_executed | queued | overridden | rejected' },
          sku: { type: 'string' },
          limit: { type: 'number', description: 'Défaut: 20' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'predict_stockout',
      description: 'Estime en jours quand un SKU sera en rupture au rythme actuel (on_hand / velocity_per_day).',
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string' },
        },
        required: ['sku'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_founder_state',
      description: 'État actuel du fondateur (Active/Vacation/Sick/Busy) et autonomy_config par action_type.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_returns',
      description:
        'Liste les retours ingérés (operational_objects kind=return). Filtres: sku, période en jours. Expose reason_code quand présent dans raw_payload.',
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string' },
          period_days: { type: 'number', description: 'Fenêtre en jours, défaut 30.' },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_channels',
      description:
        "Compare les 6 storefronts sur la période (défaut 30j) par revenus, nombre de commandes et quantités. Optionnellement filtrable par sku. Utilise-le pour répondre à \"quel canal marche le mieux\" ou \"meilleur canal pour ce SKU\".",
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string' },
          period_days: { type: 'number', description: 'Fenêtre en jours, défaut 30.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_top_products',
      description:
        'Top N produits sur une période, classés par metric (revenue | units | orders). Filtre optionnel par channel. Utilise-le pour "meilleurs produits en Allemagne", "top vente cette semaine".',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string' },
          period_days: { type: 'number', description: 'Fenêtre en jours, défaut 30.' },
          metric: {
            type: 'string',
            enum: ['revenue', 'units', 'orders'],
            description: 'Défaut: revenue.',
          },
          limit: { type: 'number', description: 'Défaut 10.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_seasonal_patterns',
      description:
        "Prévision de demande pour les événements commerciaux à venir (commercial_calendar). Pour chaque événement dans la fenêtre, tente une comparaison N-1 (même période l'an dernier) via operational_objects; sinon retourne un growth_factor par défaut fondé sur magnitude_hint (low/medium/high/very_high) et marque data_source=seasonal_assumption. Utile pour 'Que prévois-tu pour Black Friday ?' ou 'Quel buffer pour les soldes ?'.",
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string', description: 'Optionnel. Restreint la comparaison N-1 à ce SKU.' },
          region: { type: 'string', description: 'FR | IT | DE | EU. Défaut: tous.' },
          event: { type: 'string', description: "Optionnel. Filtre par nom d'événement partiel (ex: 'Black Friday', 'Soldes')." },
          next_days: { type: 'number', description: 'Fenêtre événements à venir en jours, défaut 120.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_marketplace_proposals',
      description:
        "Liste les opportunités d'intégration marketplace (table marketplace_proposals, alimentées par Mirakl Connect). Retourne nom, catégorie, match_score, risk_signal, statut, et la checklist de requirements. Utile pour 'Quelle proposition devrais-je accepter ?' ou 'Où en est l'intégration Darty ?'.",
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'pending | accepted | declined. Défaut: toutes.' },
          limit: { type: 'number', description: 'Nombre max de lignes (défaut 10, max 50).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_marketplace_dialogues',
      description:
        "Conversations actives avec les marketplaces (table marketplace_dialogues + marketplace_messages). Pour chaque dialogue: dernier message, compteur non-lus, derniers messages du fil. Utile pour 'Qu'a dit Darty dernièrement ?' ou 'Quelles conversations sont en attente ?'.",
      parameters: {
        type: 'object',
        properties: {
          counterpart_name: { type: 'string', description: 'Filtre partiel sur le nom du partenaire, ex: Darty.' },
          limit: { type: 'number', description: 'Nombre max de dialogues (défaut 5, max 20).' },
          include_messages: { type: 'boolean', description: 'Si true, inclut les 10 derniers messages par dialogue. Défaut false.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_financial_snapshot',
      description:
        "Snapshots financiers (CA, marge, cash flow, créances, dettes) agrégés ou par source. Table financial_snapshots seedée pour la vision produit. Utile pour 'Comment va le cash flow ce mois ?', 'Quel est mon CA 2026 vs 2025 ?', 'Combien ai-je en créances en retard ?'.",
      parameters: {
        type: 'object',
        properties: {
          period_type: { type: 'string', description: 'month | year. Défaut: retourne les deux plus récents.' },
          source: { type: 'string', description: 'aggregate (défaut) | amazon | shopify | canal spécifique.' },
          limit: { type: 'number', description: 'Nombre max de snapshots (défaut 6).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_marketing_analytics',
      description:
        "Trafic et taux de conversion quotidiens par canal (table marketing_analytics). Retourne visits, sessions, orders, sales, conversion_pct. Calcule automatiquement un delta vs la période précédente. Utile pour 'Comment évoluent mes visites ?', 'Quel canal convertit le mieux cette semaine ?', 'Pourquoi mon CR est tombé à 0 ?'.",
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', description: "Canal (all, amazon_fr, etc.). Défaut: 'all'." },
          period_days: { type: 'number', description: 'Fenêtre en jours depuis aujourd\'hui. Défaut 7.' },
          include_daily: { type: 'boolean', description: 'Si true, renvoie la série jour par jour. Défaut false.' },
        },
      },
    },
  },
]

type Args = Record<string, any>

async function queryOrders(ctx: ReadToolContext, a: Args) {
  const limit = Math.min(Number(a.limit) || 20, 200)
  const periodHours = Number(a.period_hours) || 0
  const since = periodHours > 0 ? new Date(Date.now() - periodHours * 3600_000) : null

  const rows = await ctx.prisma.operationalObject.findMany({
    where: {
      user_id: ctx.userId,
      kind: 'order',
      ...(a.channel ? { source_channel: String(a.channel) } : {}),
      ...(a.sku ? { sku: String(a.sku) } : {}),
      ...(since ? { occurred_at: { gte: since } } : {}),
    },
    orderBy: { occurred_at: 'desc' },
    take: limit,
    select: {
      external_id: true,
      source_channel: true,
      sku: true,
      status: true,
      quantity: true,
      amount_cents: true,
      currency: true,
      occurred_at: true,
    },
  })

  return {
    count: rows.length,
    orders: rows.map((r) => ({
      id: r.external_id,
      channel: r.source_channel,
      sku: r.sku,
      status: r.status,
      quantity: r.quantity,
      amount: r.amount_cents !== null ? r.amount_cents / 100 : null,
      currency: r.currency,
      occurred_at: r.occurred_at?.toISOString(),
    })),
  }
}

async function queryStock(ctx: ReadToolContext, a: Args) {
  if (a.sku) {
    const row = await ctx.prisma.stockState.findUnique({
      where: { user_id_sku: { user_id: ctx.userId, sku: String(a.sku) } },
    })
    return { sku: a.sku, state: row }
  }
  const rows = await ctx.prisma.stockState.findMany({
    where: { user_id: ctx.userId },
    orderBy: [{ on_hand: 'asc' }],
    take: 20,
  })
  return { count: rows.length, top_at_risk: rows }
}

async function queryVelocity(ctx: ReadToolContext, a: Args) {
  const windowHours = Number(a.window_hours) || 168
  const since = new Date(Date.now() - windowHours * 3600_000)

  const rows = await ctx.prisma.operationalObject.findMany({
    where: {
      user_id: ctx.userId,
      kind: 'order',
      sku: String(a.sku),
      ...(a.channel ? { source_channel: String(a.channel) } : {}),
      occurred_at: { gte: since },
    },
    select: { quantity: true, occurred_at: true },
  })

  const math = calculateVelocity(rows, windowHours)

  return {
    sku: a.sku,
    channel: a.channel || 'all',
    window_hours: windowHours,
    orders: math.orders,
    units_sold: math.units_sold,
    units_per_day: math.units_per_day,
    units_per_week: math.units_per_week,
  }
}

async function queryCalendar(ctx: ReadToolContext, a: Args) {
  const nextDays = Number(a.next_days) || 30
  const until = new Date()
  until.setDate(until.getDate() + nextDays)

  const rows = await ctx.prisma.commercialCalendar.findMany({
    where: {
      ...(a.region ? { region: String(a.region) } : {}),
      event_date: { gte: new Date(), lte: until },
    },
    orderBy: { event_date: 'asc' },
    take: 50,
  })
  return { count: rows.length, events: rows }
}

async function queryDecisions(ctx: ReadToolContext, a: Args) {
  const limit = Math.min(Number(a.limit) || 20, 200)
  const rows = await ctx.prisma.decisionRecord.findMany({
    where: {
      user_id: ctx.userId,
      ...(a.status ? { status: String(a.status) } : {}),
      ...(a.sku ? { sku: String(a.sku) } : {}),
    },
    orderBy: { created_at: 'desc' },
    take: limit,
    select: {
      id: true,
      sku: true,
      channel: true,
      action_type: true,
      template_id: true,
      logical_inference: true,
      status: true,
      source_agent: true,
      created_at: true,
      executed_at: true,
    },
  })
  return { count: rows.length, decisions: rows }
}

async function predictStockout(ctx: ReadToolContext, a: Args) {
  const sku = String(a.sku)
  const state = await ctx.prisma.stockState.findUnique({
    where: { user_id_sku: { user_id: ctx.userId, sku } },
  })
  if (!state) return { sku, known: false, message: 'Pas de snapshot stock pour ce SKU.' }

  const perWeek = Number(state.velocity_per_week)
  if (perWeek <= 0) return { sku, known: true, on_hand: state.on_hand, days_to_stockout: null, message: 'Vélocité nulle.' }

  const perDay = perWeek / DAYS_PER_WEEK
  const days = calculateStockoutDays(state.on_hand, perDay)
  return {
    sku,
    known: true,
    on_hand: state.on_hand,
    velocity_per_day: Number(perDay.toFixed(2)),
    days_to_stockout: days,
  }
}

async function getFounderState(ctx: ReadToolContext) {
  const [state, configs] = await Promise.all([
    ctx.prisma.founderState.findUnique({ where: { user_id: ctx.userId } }),
    ctx.prisma.autonomyConfig.findMany({ where: { user_id: ctx.userId } }),
  ])
  return {
    founder: state ?? { user_id: ctx.userId, state: 'Active', until: null, notes: null },
    autonomy: configs,
  }
}

async function queryReturns(ctx: ReadToolContext, a: Args) {
  const periodDays = Number(a.period_days) || 30
  const limit = Math.min(Number(a.limit) || 50, 200)
  const since = new Date(Date.now() - periodDays * 86400_000)

  const rows = await ctx.prisma.operationalObject.findMany({
    where: {
      user_id: ctx.userId,
      kind: 'return',
      ...(a.sku ? { sku: String(a.sku) } : {}),
      occurred_at: { gte: since },
    },
    orderBy: { occurred_at: 'desc' },
    take: limit,
    select: {
      external_id: true,
      source_channel: true,
      sku: true,
      quantity: true,
      amount_cents: true,
      occurred_at: true,
      raw_payload: true,
    },
  })

  const byReasonCounts: Record<string, number> = {}
  const returns = rows.map((r) => {
    const payload = (r.raw_payload ?? {}) as Record<string, unknown>
    const reason = typeof payload.reason_code === 'string' ? payload.reason_code : 'unknown'
    byReasonCounts[reason] = (byReasonCounts[reason] ?? 0) + 1
    return {
      id: r.external_id,
      channel: r.source_channel,
      sku: r.sku,
      quantity: r.quantity,
      refund_amount: r.amount_cents !== null ? r.amount_cents / 100 : null,
      occurred_at: r.occurred_at?.toISOString(),
      reason_code: reason,
    }
  })

  return {
    count: rows.length,
    period_days: periodDays,
    returns,
    by_reason: byReasonCounts,
  }
}

async function compareChannels(ctx: ReadToolContext, a: Args) {
  const periodDays = Number(a.period_days) || 30
  const since = new Date(Date.now() - periodDays * 86400_000)

  const grouped = await ctx.prisma.operationalObject.groupBy({
    by: ['source_channel'],
    where: {
      user_id: ctx.userId,
      kind: 'order',
      ...(a.sku ? { sku: String(a.sku) } : {}),
      occurred_at: { gte: since },
    },
    _count: { _all: true },
    _sum: { amount_cents: true, quantity: true },
  })

  const channels = grouped
    .map((g) => ({
      channel: g.source_channel,
      orders: g._count._all,
      units: g._sum.quantity ?? 0,
      revenue: g._sum.amount_cents !== null ? (g._sum.amount_cents ?? 0) / 100 : 0,
    }))
    .sort((x, y) => y.revenue - x.revenue)

  const withShare = calculateChannelShares(channels)
  const totalRevenue = channels.reduce((n, c) => n + c.revenue, 0)

  return {
    period_days: periodDays,
    sku: a.sku ?? null,
    total_revenue: Number(totalRevenue.toFixed(2)),
    channels: withShare,
  }
}

async function getTopProducts(ctx: ReadToolContext, a: Args) {
  const periodDays = Number(a.period_days) || 30
  const limit = Math.min(Number(a.limit) || 10, 50)
  const metric = (String(a.metric || 'revenue') as 'revenue' | 'units' | 'orders')
  const since = new Date(Date.now() - periodDays * 86400_000)

  const grouped = await ctx.prisma.operationalObject.groupBy({
    by: ['sku'],
    where: {
      user_id: ctx.userId,
      kind: 'order',
      sku: { not: null },
      ...(a.channel ? { source_channel: String(a.channel) } : {}),
      occurred_at: { gte: since },
    },
    _count: { _all: true },
    _sum: { amount_cents: true, quantity: true },
  })

  const products = grouped.map((g) => ({
    sku: g.sku,
    orders: g._count._all,
    units: g._sum.quantity ?? 0,
    revenue: g._sum.amount_cents !== null ? (g._sum.amount_cents ?? 0) / 100 : 0,
  }))

  products.sort((x, y) => {
    if (metric === 'units') return y.units - x.units
    if (metric === 'orders') return y.orders - x.orders
    return y.revenue - x.revenue
  })

  return {
    period_days: periodDays,
    channel: a.channel ?? 'all',
    metric,
    count: products.length,
    top: products.slice(0, limit),
  }
}

// Magnitude defaults used when N-1 data is thin. Labeled seasonal_assumption
// per spec: "If real historical data is thin, label as 'seasonal assumption'".
const MAGNITUDE_DEFAULT_GROWTH: Record<string, number> = {
  low: 1.1,
  medium: 1.3,
  high: 1.8,
  very_high: 2.5,
}

const MAGNITUDE_DEFAULT_BUFFER_WEEKS: Record<string, number> = {
  low: 2,
  medium: 3,
  high: 4,
  very_high: 5,
}

async function getSeasonalPatterns(ctx: ReadToolContext, a: Args) {
  const nextDays = Math.min(Math.max(Number(a.next_days) || 120, 7), 365)
  const now = new Date()
  const until = new Date(now.getTime() + nextDays * 86400_000)

  const events = await ctx.prisma.commercialCalendar.findMany({
    where: {
      event_date: { gte: now, lte: until },
      ...(a.region ? { region: String(a.region) } : {}),
      ...(a.event
        ? { event_name: { contains: String(a.event), mode: 'insensitive' } }
        : {}),
    },
    orderBy: { event_date: 'asc' },
    take: 20,
  })

  // For each event, try N-1: sum units sold in a 7-day window centered on the
  // same date one year ago (±3 days). Compare to a baseline from 14-21 days
  // before event_date - 365 to get a "quiet week" reference.
  const results = await Promise.all(
    events.map(async (e) => {
      const eventDate = e.event_date
      const n1Center = new Date(eventDate.getTime() - 365 * 86400_000)
      const n1Start = new Date(n1Center.getTime() - 3 * 86400_000)
      const n1End = new Date(n1Center.getTime() + 3 * 86400_000)
      const baselineStart = new Date(n1Center.getTime() - 21 * 86400_000)
      const baselineEnd = new Date(n1Center.getTime() - 14 * 86400_000)

      const whereBase = {
        user_id: ctx.userId,
        kind: 'order',
        ...(a.sku ? { sku: String(a.sku) } : {}),
      } as const

      const [n1Rows, baselineRows] = await Promise.all([
        ctx.prisma.operationalObject.findMany({
          where: { ...whereBase, occurred_at: { gte: n1Start, lte: n1End } },
          select: { quantity: true },
        }),
        ctx.prisma.operationalObject.findMany({
          where: { ...whereBase, occurred_at: { gte: baselineStart, lte: baselineEnd } },
          select: { quantity: true },
        }),
      ])

      const n1Units = n1Rows.reduce((n, r) => n + (r.quantity ?? 0), 0)
      const baselineUnits = baselineRows.reduce((n, r) => n + (r.quantity ?? 0), 0)
      const observedGrowth = calculateGrowthFactor(n1Units, baselineUnits)
      const hasN1 = n1Units > 0 && baselineUnits > 0 && observedGrowth !== null

      const magnitudeKey = (e.magnitude_hint ?? 'medium').toLowerCase()
      const defaultGrowth = MAGNITUDE_DEFAULT_GROWTH[magnitudeKey] ?? 1.3
      const defaultBuffer = MAGNITUDE_DEFAULT_BUFFER_WEEKS[magnitudeKey] ?? 3

      return {
        event_name: e.event_name,
        event_date: e.event_date.toISOString().slice(0, 10),
        region: e.region,
        impact_tag: e.impact_tag,
        magnitude_hint: e.magnitude_hint,
        growth_factor: hasN1 ? observedGrowth : defaultGrowth,
        recommended_buffer_weeks: defaultBuffer,
        data_source: hasN1 ? 'observed_n1' : 'seasonal_assumption',
        n1_units: n1Units,
        baseline_units: baselineUnits,
        notes: e.notes,
      }
    }),
  )

  return {
    window_days: nextDays,
    sku: a.sku ?? null,
    count: results.length,
    events: results,
  }
}

export async function executeReadTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ReadToolContext,
): Promise<unknown> {
  switch (name) {
    case 'query_orders': return queryOrders(ctx, args)
    case 'query_stock': return queryStock(ctx, args)
    case 'query_velocity': return queryVelocity(ctx, args)
    case 'query_calendar': return queryCalendar(ctx, args)
    case 'query_decisions': return queryDecisions(ctx, args)
    case 'predict_stockout': return predictStockout(ctx, args)
    case 'get_founder_state': return getFounderState(ctx)
    case 'query_returns': return queryReturns(ctx, args)
    case 'compare_channels': return compareChannels(ctx, args)
    case 'get_top_products': return getTopProducts(ctx, args)
    case 'get_seasonal_patterns': return getSeasonalPatterns(ctx, args)
    case 'query_marketplace_proposals': return queryMarketplaceProposals(ctx, args)
    case 'query_marketplace_dialogues': return queryMarketplaceDialogues(ctx, args)
    case 'query_financial_snapshot': return queryFinancialSnapshot(ctx, args)
    case 'query_marketing_analytics': return queryMarketingAnalytics(ctx, args)
    default: throw new Error(`Unknown read tool: ${name}`)
  }
}

// BigInt doesn't round-trip through JSON.stringify by default. Convert at serialization boundary.
function bigintToNumber(n: bigint): number {
  return Number(n)
}

async function queryMarketplaceProposals(ctx: ReadToolContext, a: Args) {
  const limit = Math.min(Number(a.limit) || 10, 50)
  const rows = await ctx.prisma.marketplaceProposal.findMany({
    where: {
      user_id: ctx.userId,
      ...(a.status ? { status: String(a.status) } : {}),
    },
    orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
    take: limit,
    include: { requirements: { orderBy: { position: 'asc' } } },
  })
  return {
    count: rows.length,
    proposals: rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      status: r.status,
      daily_users: r.daily_users,
      last_year_revenue: r.last_year_revenue,
      match_score: r.match_score,
      risk_signal: r.risk_signal,
      source: r.source,
      decided_at: r.decided_at?.toISOString() ?? null,
      about: r.about,
      requirements: r.requirements.map((req) => ({
        label: req.label,
        status: req.status,
      })),
    })),
  }
}

async function queryMarketplaceDialogues(ctx: ReadToolContext, a: Args) {
  const limit = Math.min(Number(a.limit) || 5, 20)
  const includeMessages = a.include_messages === true
  const rows = await ctx.prisma.marketplaceDialogue.findMany({
    where: {
      user_id: ctx.userId,
      ...(a.counterpart_name
        ? { counterpart_name: { contains: String(a.counterpart_name), mode: 'insensitive' as const } }
        : {}),
    },
    orderBy: [{ last_message_at: 'desc' }, { created_at: 'desc' }],
    take: limit,
    include: includeMessages
      ? { messages: { orderBy: { created_at: 'desc' }, take: 10 } }
      : undefined,
  })
  return {
    count: rows.length,
    dialogues: rows.map((d) => ({
      id: d.id,
      counterpart_name: d.counterpart_name,
      status: d.status,
      last_message_preview: d.last_message_preview,
      last_message_at: d.last_message_at?.toISOString() ?? null,
      unread_count: d.unread_count,
      messages: includeMessages
        ? ('messages' in d ? (d.messages as Array<{ sender: string; body: string; autopilot: boolean; created_at: Date }>).map((m) => ({
            sender: m.sender,
            body: m.body,
            autopilot: m.autopilot,
            created_at: m.created_at.toISOString(),
          })).reverse() : [])
        : undefined,
    })),
  }
}

async function queryFinancialSnapshot(ctx: ReadToolContext, a: Args) {
  const limit = Math.min(Number(a.limit) || 6, 24)
  const source = a.source ? String(a.source) : 'aggregate'
  const rows = await ctx.prisma.financialSnapshot.findMany({
    where: {
      user_id: ctx.userId,
      source,
      ...(a.period_type ? { period_type: String(a.period_type) } : {}),
    },
    orderBy: { period_end: 'desc' },
    take: limit,
  })
  return {
    count: rows.length,
    source,
    snapshots: rows.map((r) => {
      const previous = r.previous_period_revenue_cents ? bigintToNumber(r.previous_period_revenue_cents) : null
      const current = bigintToNumber(r.revenue_cents)
      const growth_pct = previous && previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(1)) : null
      return {
        period_type: r.period_type,
        period_start: r.period_start.toISOString().slice(0, 10),
        period_end: r.period_end.toISOString().slice(0, 10),
        source: r.source,
        revenue_eur: bigintToNumber(r.revenue_cents) / 100,
        cost_eur: bigintToNumber(r.cost_cents) / 100,
        margin_eur: bigintToNumber(r.margin_cents) / 100,
        margin_pct: r.margin_pct ? Number(r.margin_pct) : null,
        cashflow_in_eur: bigintToNumber(r.cashflow_in_cents) / 100,
        cashflow_out_eur: bigintToNumber(r.cashflow_out_cents) / 100,
        net_cashflow_eur:
          (bigintToNumber(r.cashflow_in_cents) - bigintToNumber(r.cashflow_out_cents)) / 100,
        receivables_eur: bigintToNumber(r.receivables_cents) / 100,
        payables_eur: bigintToNumber(r.payables_cents) / 100,
        overdue_receivables_eur: bigintToNumber(r.overdue_receivables_cents) / 100,
        overdue_payables_eur: bigintToNumber(r.overdue_payables_cents) / 100,
        previous_revenue_eur: previous !== null ? previous / 100 : null,
        growth_pct,
        notes: r.notes,
      }
    }),
  }
}

async function queryMarketingAnalytics(ctx: ReadToolContext, a: Args) {
  const channel = a.channel ? String(a.channel) : 'all'
  const periodDays = Math.min(Number(a.period_days) || 7, 60)
  const includeDaily = a.include_daily === true

  const now = new Date()
  const sinceCurrent = new Date(now.getTime() - periodDays * 24 * 3600_000)
  const sincePrev = new Date(sinceCurrent.getTime() - periodDays * 24 * 3600_000)

  const [currentRows, previousRows] = await Promise.all([
    ctx.prisma.marketingAnalytic.findMany({
      where: { user_id: ctx.userId, channel, day: { gte: sinceCurrent } },
      orderBy: { day: 'asc' },
    }),
    ctx.prisma.marketingAnalytic.findMany({
      where: { user_id: ctx.userId, channel, day: { gte: sincePrev, lt: sinceCurrent } },
      orderBy: { day: 'asc' },
    }),
  ])

  const sum = <T extends { visits: number; sessions: number; orders: number; sales_cents: bigint }>(rows: T[]) => {
    const totals = { visits: 0, sessions: 0, orders: 0, sales_eur: 0 }
    for (const r of rows) {
      totals.visits += r.visits
      totals.sessions += r.sessions
      totals.orders += r.orders
      totals.sales_eur += bigintToNumber(r.sales_cents) / 100
    }
    return totals
  }

  const cur = sum(currentRows)
  const prev = sum(previousRows)
  const conv = cur.sessions > 0 ? Number(((cur.orders / cur.sessions) * 100).toFixed(2)) : 0
  const prevConv = prev.sessions > 0 ? Number(((prev.orders / prev.sessions) * 100).toFixed(2)) : 0
  const delta = (a: number, b: number) => (b > 0 ? Number((((a - b) / b) * 100).toFixed(1)) : null)

  return {
    channel,
    period_days: periodDays,
    current: { ...cur, conversion_pct: conv },
    previous: { ...prev, conversion_pct: prevConv },
    delta_pct: {
      visits: delta(cur.visits, prev.visits),
      sessions: delta(cur.sessions, prev.sessions),
      orders: delta(cur.orders, prev.orders),
      sales: delta(cur.sales_eur, prev.sales_eur),
      conversion: delta(conv, prevConv),
    },
    ...(includeDaily
      ? {
          daily: currentRows.map((r) => ({
            day: r.day.toISOString().slice(0, 10),
            visits: r.visits,
            sessions: r.sessions,
            orders: r.orders,
            sales_eur: bigintToNumber(r.sales_cents) / 100,
            conversion_pct: r.conversion_pct ? Number(r.conversion_pct) : 0,
          })),
        }
      : {}),
  }
}
