// MIRA — READ tools. Free to call; no governance involved. The LLM uses these to analyze.
// Each tool returns a plain object serialized to the LLM as tool message content.
// Schemas follow the OpenAI function-calling format.

import type { PrismaClient } from '@prisma/client'

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

  const unitsSold = rows.reduce((n, r) => n + (r.quantity ?? 0), 0)
  const perHour = unitsSold / windowHours
  const perDay = perHour * 24
  const perWeek = perDay * 7

  return {
    sku: a.sku,
    channel: a.channel || 'all',
    window_hours: windowHours,
    orders: rows.length,
    units_sold: unitsSold,
    units_per_day: Number(perDay.toFixed(2)),
    units_per_week: Number(perWeek.toFixed(2)),
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

  const perDay = perWeek / 7
  const days = state.on_hand / perDay
  return {
    sku,
    known: true,
    on_hand: state.on_hand,
    velocity_per_day: Number(perDay.toFixed(2)),
    days_to_stockout: Number(days.toFixed(1)),
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
    default: throw new Error(`Unknown read tool: ${name}`)
  }
}
