import { prisma } from '@/lib/prisma'
import { buildPlanItems, summarizePlan } from '@/lib/calendar-restock'
import { requiresExplicitCalendarConfirmation } from '@/lib/calendar-confirmation'
import {
  createDecisionLedgerEntry,
  createOverrideRecord,
  listDecisionLedgerRows,
  updateDecisionLedgerStatus,
} from '@/lib/mira/ledger'
import {
  calculateChannelShares,
  calculateGrowthFactor,
  calculateMargin,
  calculateReorderQty,
  calculateStockoutDays,
  calculateVelocity,
} from '@/lib/mira/tools-math'
import {
  evaluateFounderPolicy,
  normalizeAutonomyMode,
  normalizeFounderState,
} from '@/lib/mira/policy'
import { z } from 'zod'

export type ToolDefinition = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export const MASCOT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'query_orders',
      description:
        'Reads recent order objects for operational analysis. Optional filters: channel, SKU, and period in hours.',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', description: 'Optional channel filter, ex: amazon_de' },
          sku: { type: 'string', description: 'Optional SKU filter, ex: NRD-CHAIR-012' },
          period_hours: { type: 'number', description: 'Lookback window in hours, default 24' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_stock',
      description:
        'Reads product stock state. Use a SKU for one item or omit SKU for a compact stock list.',
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string', description: 'Optional SKU filter, ex: NRD-CHAIR-012' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_returns',
      description:
        'Reads recent return objects and reason codes when available. Optional SKU and period filters.',
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string', description: 'Optional SKU filter' },
          period_days: { type: 'number', description: 'Lookback window in days, default 30' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_velocity',
      description:
        'Calculates deterministic SKU sales velocity from order rows. Uses Leia math helpers, not model math.',
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string', description: 'Required SKU, ex: NRD-CHAIR-012' },
          channel: { type: 'string', description: 'Optional channel filter, ex: amazon_de' },
          window_hours: { type: 'number', description: 'Lookback window in hours, default 168' },
        },
        required: ['sku'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_calendar',
      description:
        'Reads upcoming commercial calendar events. Optional region and next-days filters.',
      parameters: {
        type: 'object',
        properties: {
          region: { type: 'string', description: 'Optional region, ex: FR, DE, IT' },
          next_days: { type: 'number', description: 'Lookahead in days, default 90' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_decisions',
      description:
        'Reads governed Leia decisions. Use this when the merchant asks what happened with a SKU, why a channel was paused, what is queued, or what Leia decided recently.',
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string', description: 'Optional SKU filter, ex: NKS-00108' },
          status: {
            type: 'string',
            description: 'Optional status filter, ex: proposed, queued, auto_executed, rejected, overridden',
          },
          limit: { type: 'number', description: 'Optional limit, default 5, max 20' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'predict_stockout',
      description:
        'Predicts stockout timing for a SKU using deterministic stock and velocity math.',
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string', description: 'Required SKU' },
        },
        required: ['sku'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_channels',
      description:
        'Compares revenue, units, share, and margin by channel for a SKU or all recent orders.',
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string', description: 'Optional SKU filter' },
          period_days: { type: 'number', description: 'Lookback window in days, default 30' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_seasonal_patterns',
      description:
        'Gets upcoming seasonal demand patterns and deterministic fallback growth assumptions.',
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string', description: 'Optional SKU context' },
          event: { type: 'string', description: 'Optional event name filter' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_top_products',
      description:
        'Ranks top products by units or revenue over a recent period, optionally filtered by channel.',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', description: 'Optional channel filter' },
          period_days: { type: 'number', description: 'Lookback window in days, default 30' },
          metric: { type: 'string', enum: ['units', 'revenue'], description: 'Ranking metric' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_action',
      description:
        'Creates a governed operational action through FounderPolicy. This is the only tool that may create action ledger entries.',
      parameters: {
        type: 'object',
        properties: {
          action_type: { type: 'string', description: 'Action type, ex: pause_listing' },
          target: { type: 'string', description: 'Target SKU, channel, or operational object' },
          params: { type: 'object', description: 'Action parameters' },
          reversible: { type: 'boolean', description: 'Whether the action can be undone' },
        },
        required: ['action_type', 'target'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_founder_state',
      description:
        'Sets founder availability state. Supported states: Available, Travelling, OffHours, Sick, Vacation.',
      parameters: {
        type: 'object',
        properties: {
          state: { type: 'string', description: 'Founder state' },
          until: { type: 'string', description: 'Optional ISO date/time until state ends' },
        },
        required: ['state'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_autonomy',
      description:
        'Updates autonomy mode for one action type. Modes: watching, ask_me, handle_it.',
      parameters: {
        type: 'object',
        properties: {
          action_type: { type: 'string', description: 'Action type to configure' },
          mode: { type: 'string', description: 'watching, ask_me, or handle_it' },
        },
        required: ['action_type', 'mode'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'approve_decision',
      description: 'Approves a governed Leia decision by id.',
      parameters: {
        type: 'object',
        properties: {
          decision_id: { type: 'string', description: 'Decision UUID' },
        },
        required: ['decision_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reject_decision',
      description: 'Rejects a governed Leia decision by id.',
      parameters: {
        type: 'object',
        properties: {
          decision_id: { type: 'string', description: 'Decision UUID' },
          reason: { type: 'string', description: 'Optional reason' },
        },
        required: ['decision_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'override_decision',
      description: 'Overrides an executed Leia decision and records the override reason.',
      parameters: {
        type: 'object',
        properties: {
          decision_id: { type: 'string', description: 'Decision UUID' },
          reason: { type: 'string', description: 'Optional reason' },
        },
        required: ['decision_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_stock_summary',
      description:
        'Retourne un résumé du stock : nombre total de produits, produits en alerte (stock bas ou rupture), valeur totale estimée. À utiliser quand le merchant demande "où en est mon stock", "combien de produits", "quels sont les stocks bas".',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product_by_sku',
      description:
        "Récupère les détails d'un produit spécifique par son SKU (ex: NKS-00042). Retourne nom, quantité, seuil min, fournisseur, prix de vente. À utiliser quand le merchant demande combien il a d'un produit précis.",
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string', description: 'Le SKU du produit, ex: NKS-00042' },
        },
        required: ['sku'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_products',
      description:
        'Recherche des produits par mot-clé dans le nom. Retourne max 10 résultats. À utiliser quand le merchant cherche un type de produit (ex: "chaises", "tables").',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Mot-clé à rechercher' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_pending_actions',
      description:
        "Liste les recommandations en attente d'approbation dans l'inbox /actions. À utiliser quand le merchant demande ce qu'il a à faire, ce qui l'attend, ses actions en cours.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_calendar_event',
      description:
        'Crée un événement dans le calendrier du merchant. Très utile pour les congés (kind=leave) qui déclenchent automatiquement une analyse de stock. Date format YYYY-MM-DD.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: "Titre de l'événement, ex: Congés Savoie" },
          start_date: { type: 'string', description: 'Date début YYYY-MM-DD' },
          end_date: { type: 'string', description: 'Date fin YYYY-MM-DD' },
          kind: {
            type: 'string',
            enum: ['commerce', 'holiday', 'leave', 'logistics', 'marketing', 'internal'],
            description: 'Type. Pour congés utiliser leave.',
          },
          impact: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Impact estimé',
          },
          notes: { type: 'string', description: 'Notes optionnelles' },
          confirmed: {
            type: 'boolean',
            description: "Mettre true uniquement après validation explicite du merchant. Obligatoire pour un congé.",
          },
        },
        required: ['title', 'start_date', 'end_date', 'kind'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_restock_plan',
      description:
        "Génère un plan de réapprovisionnement pour les SKUs à risque de rupture sur un horizon donné (par défaut 30 jours). Crée une recommandation dans l'inbox /actions que le merchant peut approuver/rejeter. À utiliser quand le merchant demande 'prépare un plan restock', 'commande ce qu'il faut', ou après avoir détecté des stocks critiques.",
      parameters: {
        type: 'object',
        properties: {
          horizon_days: {
            type: 'number',
            description: 'Nombre de jours de couverture ciblés (défaut 30)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_supplier_emails',
      description:
        "Génère des brouillons d'emails fournisseur, un par fournisseur concerné, pour commander les SKUs sous seuil. Retourne le sujet et le corps de chaque mail. Les mails ne sont PAS envoyés, uniquement préparés pour que le merchant les copie/colle ou les valide avant envoi. À utiliser quand le merchant demande 'écris les mails fournisseurs', 'prépare les commandes', 'rédige les relances'.",
      parameters: {
        type: 'object',
        properties: {
          horizon_days: {
            type: 'number',
            description: 'Horizon de couverture en jours pour calculer les quantités (défaut 30)',
          },
        },
        required: [],
      },
    },
  },
]

function toIsoNoon(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`)
}

const boundedNumber = (defaultValue: number, min: number, max: number) =>
  z
    .number()
    .optional()
    .transform((value) => Math.max(min, Math.min(max, Number(value ?? defaultValue) || defaultValue)))

const TOOL_ARG_SCHEMAS: Record<string, z.ZodType<Record<string, unknown>>> = {
  query_orders: z.object({
    channel: z.string().trim().min(1).optional(),
    sku: z.string().trim().min(1).optional(),
    period_hours: boundedNumber(24, 1, 24 * 365),
  }),
  query_stock: z.object({
    sku: z.string().trim().min(1).optional(),
  }),
  query_returns: z.object({
    sku: z.string().trim().min(1).optional(),
    period_days: boundedNumber(30, 1, 365),
  }),
  query_velocity: z.object({
    sku: z.string().trim().min(1),
    channel: z.string().trim().min(1).optional(),
    window_hours: boundedNumber(168, 1, 24 * 365),
  }),
  query_calendar: z.object({
    region: z.string().trim().min(1).optional(),
    next_days: boundedNumber(90, 1, 730),
  }),
  query_decisions: z.object({
    sku: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).optional(),
    limit: boundedNumber(5, 1, 20),
  }),
  predict_stockout: z.object({
    sku: z.string().trim().min(1),
  }),
  compare_channels: z.object({
    sku: z.string().trim().min(1).optional(),
    period_days: boundedNumber(30, 1, 365),
  }),
  get_seasonal_patterns: z.object({
    sku: z.string().trim().min(1).optional(),
    event: z.string().trim().min(1).optional(),
  }),
  get_top_products: z.object({
    channel: z.string().trim().min(1).optional(),
    period_days: boundedNumber(30, 1, 365),
    metric: z.enum(['units', 'revenue']).optional().default('units'),
  }),
  execute_action: z.object({
    action_type: z.string().trim().min(1),
    target: z.string().trim().min(1),
    params: z.record(z.unknown()).optional().default({}),
    reversible: z.boolean().optional().default(true),
  }),
  set_founder_state: z.object({
    state: z.string().trim().min(1),
    until: z.string().trim().min(1).optional(),
  }),
  update_autonomy: z.object({
    action_type: z.string().trim().min(1),
    mode: z.string().trim().min(1),
  }),
  approve_decision: z.object({
    decision_id: z.string().uuid(),
  }),
  reject_decision: z.object({
    decision_id: z.string().uuid(),
    reason: z.string().trim().min(1).optional(),
  }),
  override_decision: z.object({
    decision_id: z.string().uuid(),
    reason: z.string().trim().min(1).optional(),
  }),
  get_stock_summary: z.object({}),
  get_product_by_sku: z.object({ sku: z.string().trim().min(1) }),
  search_products: z.object({ query: z.string().trim().min(1) }),
  list_pending_actions: z.object({}),
  create_calendar_event: z.object({
    title: z.string().trim().min(1),
    start_date: z.string().trim().min(1),
    end_date: z.string().trim().min(1),
    kind: z.string().trim().min(1),
    impact: z.string().trim().min(1).optional(),
    notes: z.string().optional(),
    confirmed: z.boolean().optional(),
  }),
  propose_restock_plan: z.object({
    horizon_days: boundedNumber(30, 7, 120),
  }),
  draft_supplier_emails: z.object({
    horizon_days: boundedNumber(30, 7, 120),
  }),
}

export function validateToolArgs(name: string, args: Record<string, unknown>) {
  const schema = TOOL_ARG_SCHEMAS[name]
  if (!schema) return args

  const parsed = schema.safeParse(args)
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => {
        const path = issue.path.join('.')
        return path ? `${path}: ${issue.message}` : issue.message
      })
      .join('; ')
    throw new Error(`Invalid arguments for ${name}: ${details}`)
  }

  return parsed.data
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function rawString(value: unknown, key: string) {
  const record = asRecord(value)
  const raw = record[key]
  return raw === null || raw === undefined ? null : String(raw)
}

function orderUnits(row: { quantity: number | null; raw_payload: unknown }) {
  const payload = asRecord(row.raw_payload)
  const candidates = [
    row.quantity,
    payload.quantity,
    payload.qty,
    payload.units,
    payload.QuantityOrdered,
  ]
  for (const candidate of candidates) {
    const numeric = Number(candidate)
    if (Number.isFinite(numeric) && numeric > 0) return numeric
  }
  return 1
}

function orderRevenueCents(row: { amount_cents: number | null; raw_payload: unknown }) {
  if (Number.isFinite(Number(row.amount_cents))) return Number(row.amount_cents)
  const payload = asRecord(row.raw_payload)
  const candidates = [payload.amount_cents, payload.total_cents, payload.revenue_cents]
  for (const candidate of candidates) {
    const numeric = Number(candidate)
    if (Number.isFinite(numeric)) return numeric
  }
  return 0
}

function seasonalMagnitudeFactor(value: string | null | undefined) {
  switch (String(value || '').toLowerCase()) {
    case 'very_high':
      return 2.5
    case 'high':
      return 1.8
    case 'medium':
      return 1.3
    case 'low':
      return 1.1
    default:
      return 1.1
  }
}

function templateForAction(actionType: string) {
  switch (actionType) {
    case 'pause_listing':
    case 'listing_pause':
      return 'listing_pause_v1'
    case 'resume_listing':
    case 'listing_resume':
      return 'listing_resume_v1'
    case 'adjust_buffer':
    case 'buffer_adjustment':
      return 'buffer_adjustment_v1'
    case 'reputation_shield':
      return 'reputation_shield_v1'
    case 'restock':
    case 'restock_proposal':
      return 'restock_proposal_v1'
    default:
      return 'buffer_adjustment_v1'
  }
}

function buildTemplateInputForAction(args: {
  actionType: string
  target: string
  params: Record<string, unknown>
  founderReturnsOn?: string | null
  queued: boolean
}) {
  const sku = String(args.params.sku || args.target || '')
  const channel = String(args.params.channel || '')
  const reason = String(args.params.reason || 'operator request')

  if (args.queued) {
    return {
      founder_returns_on: args.founderReturnsOn || '',
      request: {
        action_type: args.actionType,
        sku,
        channel,
        params: args.params,
      },
    }
  }

  switch (templateForAction(args.actionType)) {
    case 'listing_pause_v1':
      return { sku, channel, reason }
    case 'listing_resume_v1':
      return { sku, channel }
    case 'reputation_shield_v1':
      return {
        primary_channel: String(args.params.primary_channel || channel || 'primary channel'),
        secondary_channel_count: Number(args.params.secondary_channel_count || 1),
      }
    case 'restock_proposal_v1':
      return {
        sku,
        sell_through_per_week: Number(args.params.sell_through_per_week || 0),
        supplier_lead_time_weeks: Number(args.params.supplier_lead_time_weeks || 1),
        safety_buffer_weeks: Number(args.params.safety_buffer_weeks || 1),
        reorder_qty: Number(args.params.reorder_qty || 0),
      }
    default:
      return {
        sku,
        previous_buffer_units: Number(args.params.previous_buffer_units || 0),
        next_buffer_units: Number(args.params.next_buffer_units || args.params.buffer_units || 0),
        reason,
      }
  }
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { userId: string; origin: string }
): Promise<unknown> {
  args = validateToolArgs(name, args)

  switch (name) {
    case 'query_orders': {
      const periodHours = Number(args.period_hours ?? 24)
      const since = new Date(Date.now() - periodHours * 3600 * 1000)
      const channel = String(args.channel ?? '').trim()
      const sku = String(args.sku ?? '').trim()

      const orders = await prisma.operationalObject.findMany({
        where: {
          user_id: ctx.userId,
          kind: { in: ['order', 'orders'] },
          occurred_at: { gte: since },
          ...(channel ? { source_channel: channel } : {}),
          ...(sku ? { sku: { equals: sku, mode: 'insensitive' } } : {}),
        },
        orderBy: { occurred_at: 'desc' },
        take: 50,
        select: {
          id: true,
          source_channel: true,
          sku: true,
          status: true,
          quantity: true,
          amount_cents: true,
          currency: true,
          occurred_at: true,
          raw_payload: true,
        },
      })

      const totalUnits = orders.reduce((sum, order) => sum + orderUnits(order), 0)
      const totalRevenueCents = orders.reduce((sum, order) => sum + orderRevenueCents(order), 0)

      return {
        count: orders.length,
        period_hours: periodHours,
        total_units: totalUnits,
        total_revenue_eur: Number((totalRevenueCents / 100).toFixed(2)),
        orders: orders.slice(0, 20).map((order) => ({
          id: order.id,
          channel: order.source_channel,
          sku: order.sku,
          status: order.status,
          quantity: orderUnits(order),
          amount_eur: Number((orderRevenueCents(order) / 100).toFixed(2)),
          currency: order.currency,
          occurred_at: order.occurred_at?.toISOString() ?? null,
        })),
      }
    }

    case 'query_stock': {
      const sku = String(args.sku ?? '').trim()
      const products = await prisma.product.findMany({
        where: {
          user_id: ctx.userId,
          active: true,
          ...(sku ? { sku: { equals: sku, mode: 'insensitive' } } : {}),
        },
        orderBy: [{ quantity: 'asc' }, { name: 'asc' }],
        take: sku ? 1 : 20,
        select: {
          sku: true,
          name: true,
          quantity: true,
          min_quantity: true,
          selling_price: true,
          supplier: true,
          supplier_lead_time_days: true,
          supplier_min_order_qty: true,
          supplier_unit_cost_eur: true,
        },
      })

      return {
        count: products.length,
        products: products.map((product) => ({
          sku: product.sku,
          name: product.name,
          on_hand: product.quantity,
          min_quantity: product.min_quantity,
          stock_status:
            product.quantity === 0
              ? 'out_of_stock'
              : product.quantity <= product.min_quantity
                ? 'low'
                : 'ok',
          selling_price_eur: Number(product.selling_price),
          supplier: product.supplier,
          supplier_lead_time_days: product.supplier_lead_time_days,
          supplier_min_order_qty: product.supplier_min_order_qty,
          supplier_unit_cost_eur: product.supplier_unit_cost_eur
            ? Number(product.supplier_unit_cost_eur)
            : null,
        })),
      }
    }

    case 'query_returns': {
      const periodDays = Number(args.period_days ?? 30)
      const since = new Date(Date.now() - periodDays * 24 * 3600 * 1000)
      const sku = String(args.sku ?? '').trim()
      const returns = await prisma.operationalObject.findMany({
        where: {
          user_id: ctx.userId,
          kind: { in: ['return', 'returns'] },
          occurred_at: { gte: since },
          ...(sku ? { sku: { equals: sku, mode: 'insensitive' } } : {}),
        },
        orderBy: { occurred_at: 'desc' },
        take: 100,
        select: {
          id: true,
          source_channel: true,
          sku: true,
          status: true,
          quantity: true,
          occurred_at: true,
          raw_payload: true,
        },
      })
      const reasonBreakdown: Record<string, number> = {}
      for (const row of returns) {
        const reason =
          rawString(row.raw_payload, 'reason_code') ||
          rawString(row.raw_payload, 'reason') ||
          rawString(row.raw_payload, 'return_reason') ||
          'unknown'
        reasonBreakdown[reason] = (reasonBreakdown[reason] ?? 0) + 1
      }

      return {
        count: returns.length,
        period_days: periodDays,
        reason_breakdown: reasonBreakdown,
        returns: returns.slice(0, 20).map((row) => ({
          id: row.id,
          channel: row.source_channel,
          sku: row.sku,
          status: row.status,
          quantity: orderUnits(row),
          reason:
            rawString(row.raw_payload, 'reason_code') ||
            rawString(row.raw_payload, 'reason') ||
            rawString(row.raw_payload, 'return_reason') ||
            'unknown',
          occurred_at: row.occurred_at?.toISOString() ?? null,
        })),
      }
    }

    case 'query_velocity': {
      const sku = String(args.sku ?? '').trim()
      const channel = String(args.channel ?? '').trim()
      const windowHours = Number(args.window_hours ?? 168)
      const since = new Date(Date.now() - windowHours * 3600 * 1000)
      const orders = await prisma.operationalObject.findMany({
        where: {
          user_id: ctx.userId,
          kind: { in: ['order', 'orders'] },
          sku: { equals: sku, mode: 'insensitive' },
          occurred_at: { gte: since },
          ...(channel ? { source_channel: channel } : {}),
        },
        select: { quantity: true, raw_payload: true },
      })
      const units = orders.map((order) => ({ quantity: orderUnits(order) }))
      const velocityPerDay = calculateVelocity(units, windowHours, 'hours')

      return {
        sku,
        channel: channel || null,
        window_hours: windowHours,
        order_count: orders.length,
        units_sold: units.reduce((sum, order) => sum + Number(order.quantity ?? 0), 0),
        velocity_per_day: velocityPerDay,
        velocity_per_hour: Number((velocityPerDay / 24).toFixed(4)),
      }
    }

    case 'query_calendar': {
      const region = String(args.region ?? '').trim().toUpperCase()
      const nextDays = Number(args.next_days ?? 90)
      const now = new Date()
      const until = new Date(now.getTime() + nextDays * 24 * 3600 * 1000)
      const events = await prisma.commercialCalendar.findMany({
        where: {
          event_date: { gte: now, lte: until },
          ...(region ? { region } : {}),
        },
        orderBy: { event_date: 'asc' },
        take: 50,
        select: {
          id: true,
          region: true,
          event_name: true,
          event_date: true,
          impact_tag: true,
          magnitude_hint: true,
          notes: true,
        },
      })

      return {
        count: events.length,
        next_days: nextDays,
        events: events.map((event) => ({
          id: event.id,
          region: event.region,
          event_name: event.event_name,
          event_date: event.event_date.toISOString().slice(0, 10),
          impact_tag: event.impact_tag,
          magnitude_hint: event.magnitude_hint,
          notes: event.notes,
        })),
      }
    }

    case 'query_decisions': {
      const sku = String(args.sku ?? '').trim().toLowerCase()
      const status = String(args.status ?? '').trim().toLowerCase()
      const limit = Math.max(1, Math.min(20, Number(args.limit ?? 5) || 5))
      const rows = await listDecisionLedgerRows(100)
      const filtered = rows
        .filter((row) => row.user_id === ctx.userId)
        .filter((row) => !sku || String(row.sku || '').toLowerCase() === sku)
        .filter((row) => !status || String(row.status || '').toLowerCase() === status)
        .slice(0, limit)

      return {
        count: filtered.length,
        decisions: filtered.map((row) => ({
          id: row.id,
          sku: row.sku,
          channel: row.channel,
          action_type: row.action_type,
          reasoning: row.logical_inference,
          status: row.status,
          created_at: row.created_at.toISOString(),
        })),
      }
    }

    case 'predict_stockout': {
      const sku = String(args.sku ?? '').trim()
      const product = await prisma.product.findFirst({
        where: { user_id: ctx.userId, active: true, sku: { equals: sku, mode: 'insensitive' } },
        select: {
          sku: true,
          name: true,
          quantity: true,
          min_quantity: true,
          supplier_lead_time_days: true,
        },
      })
      if (!product) return { found: false, sku }

      const windowHours = 168
      const since = new Date(Date.now() - windowHours * 3600 * 1000)
      const orders = await prisma.operationalObject.findMany({
        where: {
          user_id: ctx.userId,
          kind: { in: ['order', 'orders'] },
          sku: { equals: sku, mode: 'insensitive' },
          occurred_at: { gte: since },
        },
        select: { quantity: true, raw_payload: true },
      })
      const velocityPerDay = calculateVelocity(
        orders.map((order) => ({ quantity: orderUnits(order) })),
        windowHours,
        'hours'
      )
      const stockoutDays = calculateStockoutDays(product.quantity, velocityPerDay)
      const leadTimeDays = product.supplier_lead_time_days ?? 7
      const reorderQty = calculateReorderQty(
        velocityPerDay,
        leadTimeDays,
        product.min_quantity,
        product.quantity
      )

      return {
        found: true,
        sku: product.sku,
        name: product.name,
        on_hand: product.quantity,
        velocity_per_day: velocityPerDay,
        stockout_days: stockoutDays,
        supplier_lead_time_days: leadTimeDays,
        recommended_reorder_qty: reorderQty,
      }
    }

    case 'compare_channels': {
      const periodDays = Number(args.period_days ?? 30)
      const since = new Date(Date.now() - periodDays * 24 * 3600 * 1000)
      const sku = String(args.sku ?? '').trim()
      const orders = await prisma.operationalObject.findMany({
        where: {
          user_id: ctx.userId,
          kind: { in: ['order', 'orders'] },
          occurred_at: { gte: since },
          ...(sku ? { sku: { equals: sku, mode: 'insensitive' } } : {}),
        },
        select: {
          source_channel: true,
          sku: true,
          quantity: true,
          amount_cents: true,
          raw_payload: true,
        },
      })

      const product = sku
        ? await prisma.product.findFirst({
            where: { user_id: ctx.userId, active: true, sku: { equals: sku, mode: 'insensitive' } },
            select: { supplier_unit_cost_eur: true },
          })
        : null
      const unitCostCents = Math.round(Number(product?.supplier_unit_cost_eur ?? 0) * 100)
      const byChannel = new Map<
        string,
        { units: number; revenue_cents: number; estimated_cost_cents: number }
      >()

      for (const order of orders) {
        const channel = order.source_channel || 'unknown'
        const current = byChannel.get(channel) ?? {
          units: 0,
          revenue_cents: 0,
          estimated_cost_cents: 0,
        }
        const units = orderUnits(order)
        current.units += units
        current.revenue_cents += orderRevenueCents(order)
        current.estimated_cost_cents += unitCostCents * units
        byChannel.set(channel, current)
      }

      const revenueTotals = Object.fromEntries(
        Array.from(byChannel.entries()).map(([channel, totals]) => [
          channel,
          totals.revenue_cents / 100,
        ])
      )
      const shares = calculateChannelShares(revenueTotals)

      return {
        sku: sku || null,
        period_days: periodDays,
        order_count: orders.length,
        channels: Array.from(byChannel.entries())
          .map(([channel, totals]) => {
            const revenue = totals.revenue_cents / 100
            const cost = totals.estimated_cost_cents / 100
            return {
              channel,
              units: totals.units,
              revenue_eur: Number(revenue.toFixed(2)),
              revenue_share_pct: shares[channel] ?? 0,
              margin_pct: calculateMargin(revenue, cost),
            }
          })
          .sort((left, right) => right.revenue_eur - left.revenue_eur),
      }
    }

    case 'get_seasonal_patterns': {
      const eventFilter = String(args.event ?? '').trim()
      const now = new Date()
      const until = new Date(now.getTime() + 120 * 24 * 3600 * 1000)
      const events = await prisma.commercialCalendar.findMany({
        where: {
          event_date: { gte: now, lte: until },
          ...(eventFilter ? { event_name: { contains: eventFilter, mode: 'insensitive' } } : {}),
        },
        orderBy: { event_date: 'asc' },
        take: 20,
        select: {
          region: true,
          event_name: true,
          event_date: true,
          magnitude_hint: true,
          impact_tag: true,
        },
      })

      return {
        sku: args.sku ?? null,
        data_source: 'seasonal_assumption',
        patterns: events.map((event) => {
          const factor = seasonalMagnitudeFactor(event.magnitude_hint)
          const growthFactor = calculateGrowthFactor(1, factor)
          return {
            region: event.region,
            event_name: event.event_name,
            event_date: event.event_date.toISOString().slice(0, 10),
            impact_tag: event.impact_tag,
            magnitude_hint: event.magnitude_hint,
            growth_factor: growthFactor,
            expected_growth_pct: Number(((growthFactor - 1) * 100).toFixed(2)),
          }
        }),
      }
    }

    case 'get_top_products': {
      const periodDays = Number(args.period_days ?? 30)
      const since = new Date(Date.now() - periodDays * 24 * 3600 * 1000)
      const channel = String(args.channel ?? '').trim()
      const metric = String(args.metric ?? 'units')
      const orders = await prisma.operationalObject.findMany({
        where: {
          user_id: ctx.userId,
          kind: { in: ['order', 'orders'] },
          occurred_at: { gte: since },
          ...(channel ? { source_channel: channel } : {}),
        },
        select: {
          sku: true,
          quantity: true,
          amount_cents: true,
          raw_payload: true,
        },
      })

      const totals = new Map<string, { units: number; revenue_cents: number }>()
      for (const order of orders) {
        const sku = order.sku || 'unknown'
        const current = totals.get(sku) ?? { units: 0, revenue_cents: 0 }
        current.units += orderUnits(order)
        current.revenue_cents += orderRevenueCents(order)
        totals.set(sku, current)
      }

      return {
        channel: channel || null,
        period_days: periodDays,
        metric,
        products: Array.from(totals.entries())
          .map(([sku, values]) => ({
            sku,
            units: values.units,
            revenue_eur: Number((values.revenue_cents / 100).toFixed(2)),
          }))
          .sort((left, right) =>
            metric === 'revenue' ? right.revenue_eur - left.revenue_eur : right.units - left.units
          )
          .slice(0, 10),
      }
    }

    case 'execute_action': {
      const actionType = String(args.action_type ?? '').trim()
      const target = String(args.target ?? '').trim()
      const params = asRecord(args.params)
      const reversible = Boolean(args.reversible ?? true)

      const [founderState, autonomy] = await Promise.all([
        prisma.founderState.findUnique({ where: { user_id: ctx.userId } }),
        prisma.autonomyConfig.findUnique({
          where: { user_id_action_type: { user_id: ctx.userId, action_type: actionType } },
        }),
      ])

      const policy = evaluateFounderPolicy({
        autonomyMode: autonomy?.mode ?? 'propose',
        founderState: founderState?.state ?? 'Available',
        reversible,
      })

      if (!policy.writeLedger) {
        return {
          ok: true,
          status: policy.status,
          route: policy.route,
          ledger_written: false,
        }
      }

      const queued = policy.status === 'queued'
      const templateId = queued ? 'vacation_queue_v1' : templateForAction(actionType)
      const sku = String(params.sku || target || '').trim()
      const channel = String(params.channel || '').trim() || null
      const templateInput = buildTemplateInputForAction({
        actionType,
        target,
        params,
        founderReturnsOn: founderState?.until?.toISOString().slice(0, 10) ?? null,
        queued,
      })
      const row = await createDecisionLedgerEntry({
        userId: ctx.userId,
        sku,
        channel,
        actionType,
        templateId,
        templateInput,
        rawPayload: {
          request: { action_type: actionType, target, params },
          policy: { route: policy.route, status: policy.status },
        },
        status: policy.status,
        reversible,
        sourceAgent: 'leia',
        triggeredBy: 'chat',
      })

      return {
        ok: true,
        decision_id: row.id,
        status: row.status,
        route: policy.route,
        ledger_written: true,
        reasoning: row.logical_inference,
      }
    }

    case 'set_founder_state': {
      const state = normalizeFounderState(String(args.state ?? 'Available'))
      const untilRaw = String(args.until ?? '').trim()
      const until = untilRaw ? new Date(untilRaw) : null
      if (untilRaw && Number.isNaN(until?.getTime())) {
        return { ok: false, error: 'Invalid until date' }
      }

      const row = await prisma.founderState.upsert({
        where: { user_id: ctx.userId },
        update: { state, until },
        create: { user_id: ctx.userId, state, until },
      })

      return {
        ok: true,
        state: row.state,
        until: row.until?.toISOString() ?? null,
      }
    }

    case 'update_autonomy': {
      const actionType = String(args.action_type ?? '').trim()
      const mode = normalizeAutonomyMode(String(args.mode ?? 'propose'))
      const row = await prisma.autonomyConfig.upsert({
        where: { user_id_action_type: { user_id: ctx.userId, action_type: actionType } },
        update: { mode },
        create: { user_id: ctx.userId, action_type: actionType, mode },
      })

      return {
        ok: true,
        action_type: row.action_type,
        mode: row.mode,
      }
    }

    case 'approve_decision': {
      const decisionId = String(args.decision_id ?? '')
      const row = await updateDecisionLedgerStatus({
        decisionId,
        userId: ctx.userId,
        status: 'approved',
      })
      return row
        ? { ok: true, decision_id: row.id, status: row.status, reasoning: row.logical_inference }
        : { ok: false, error: 'Decision not found' }
    }

    case 'reject_decision': {
      const decisionId = String(args.decision_id ?? '')
      const row = await updateDecisionLedgerStatus({
        decisionId,
        userId: ctx.userId,
        status: 'rejected',
      })
      return row
        ? {
            ok: true,
            decision_id: row.id,
            status: row.status,
            reason: args.reason ?? null,
          }
        : { ok: false, error: 'Decision not found' }
    }

    case 'override_decision': {
      const decisionId = String(args.decision_id ?? '')
      const current = await prisma.decisionLedger.findFirst({
        where: { id: decisionId, user_id: ctx.userId },
        select: { status: true },
      })
      if (!current) return { ok: false, error: 'Decision not found' }

      const updated = await updateDecisionLedgerStatus({
        decisionId,
        userId: ctx.userId,
        status: 'overridden',
      })
      const override = await createOverrideRecord({
        userId: ctx.userId,
        decisionId,
        reason: args.reason ? String(args.reason) : null,
        previousStatus: current.status,
      })

      return {
        ok: true,
        decision_id: updated?.id ?? decisionId,
        status: updated?.status ?? 'overridden',
        override_id: override.id,
      }
    }

    case 'get_stock_summary': {
      const products = await prisma.product.findMany({
        where: { user_id: ctx.userId, active: true },
        select: {
          id: true,
          sku: true,
          name: true,
          quantity: true,
          min_quantity: true,
          selling_price: true,
        },
      })
      const lowStock = products.filter((p) => p.quantity <= p.min_quantity)
      const outOfStock = products.filter((p) => p.quantity === 0)
      const totalValue = products.reduce(
        (sum, p) => sum + Number(p.selling_price) * p.quantity,
        0
      )
      return {
        total_products: products.length,
        low_stock_count: lowStock.length,
        out_of_stock_count: outOfStock.length,
        total_inventory_value_eur: Number(totalValue.toFixed(2)),
        top_critical: lowStock.slice(0, 5).map((p) => ({
          sku: p.sku,
          name: p.name,
          quantity: p.quantity,
          min_quantity: p.min_quantity,
        })),
      }
    }

    case 'get_product_by_sku': {
      const sku = String(args.sku ?? '').trim()
      const product = await prisma.product.findFirst({
        where: { user_id: ctx.userId, sku: { equals: sku, mode: 'insensitive' } },
        select: {
          sku: true,
          name: true,
          quantity: true,
          min_quantity: true,
          selling_price: true,
          supplier: true,
          supplier_lead_time_days: true,
          supplier_unit_cost_eur: true,
        },
      })
      if (!product) {
        return { found: false, sku, message: `Aucun produit trouvé avec le SKU ${sku}` }
      }
      return {
        found: true,
        sku: product.sku,
        name: product.name,
        quantity: product.quantity,
        min_quantity: product.min_quantity,
        stock_status:
          product.quantity === 0
            ? 'out_of_stock'
            : product.quantity <= product.min_quantity
              ? 'low'
              : 'ok',
        selling_price_eur: Number(product.selling_price),
        supplier: product.supplier,
        supplier_lead_time_days: product.supplier_lead_time_days,
        supplier_unit_cost_eur: product.supplier_unit_cost_eur
          ? Number(product.supplier_unit_cost_eur)
          : null,
      }
    }

    case 'search_products': {
      const query = String(args.query ?? '').trim()
      if (!query) return { products: [] }
      const results = await prisma.product.findMany({
        where: {
          user_id: ctx.userId,
          active: true,
          name: { contains: query, mode: 'insensitive' },
        },
        select: {
          sku: true,
          name: true,
          quantity: true,
          min_quantity: true,
          selling_price: true,
        },
        take: 10,
      })
      return {
        query,
        count: results.length,
        products: results.map((p) => ({
          sku: p.sku,
          name: p.name,
          quantity: p.quantity,
          min_quantity: p.min_quantity,
          selling_price_eur: Number(p.selling_price),
          stock_status:
            p.quantity === 0
              ? 'out_of_stock'
              : p.quantity <= p.min_quantity
                ? 'low'
                : 'ok',
        })),
      }
    }

    case 'list_pending_actions': {
      const recos = await prisma.agentRecommendation.findMany({
        where: { user_id: ctx.userId, status: 'pending_approval' },
        orderBy: { created_at: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          scenario_type: true,
          reasoning_summary: true,
          expected_impact: true,
          created_at: true,
        },
      })
      return {
        count: recos.length,
        actions: recos.map((r) => ({
          id: r.id,
          title: r.title,
          scenario: r.scenario_type,
          reasoning: r.reasoning_summary,
          impact: r.expected_impact,
          created_at: r.created_at.toISOString(),
        })),
      }
    }

    case 'create_calendar_event': {
      const title = String(args.title ?? '').trim()
      const start = String(args.start_date ?? '')
      const end = String(args.end_date ?? '')
      const kind = String(args.kind ?? 'internal')
      const impact = String(args.impact ?? 'medium')
      const notes = args.notes ? String(args.notes) : null
      const confirmed = args.confirmed

      if (!title || !start || !end) {
        return { ok: false, error: 'title, start_date, end_date requis' }
      }

      if (requiresExplicitCalendarConfirmation(kind, confirmed)) {
        return {
          ok: true,
          pending_confirmation: true,
          message:
            "Validation requise avant ajout au calendrier. Confirme avec 'oui' pour créer l'événement.",
          event: {
            title,
            start,
            end,
            kind,
          },
          advisor_triggered: false,
        }
      }

      const startTs = toIsoNoon(start)
      const endTs = toIsoNoon(end)

      const rows = await prisma.$queryRaw<
        Array<{ id: string; title: string; start_at: Date; end_at: Date; kind: string }>
      >`
        INSERT INTO public.calendar_events (
          user_id, title, start_at, end_at, kind, impact, notes, locked
        ) VALUES (
          ${ctx.userId}::uuid,
          ${title},
          ${startTs},
          ${endTs},
          ${kind},
          ${impact},
          ${notes},
          false
        )
        RETURNING id::text, title, start_at, end_at, kind
      `

      const created = rows[0]

      // Si c'est un event leave, déclencher l'agent advisor en parallèle
      // (même logique que le webhook n8n, mais en direct pour cas où n8n n'est pas actif)
      if (created.kind === 'leave') {
        fetch(`${ctx.origin}/api/agent/calendar-advisor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: created.id, user_id: ctx.userId }),
        }).catch((err) => console.error('advisor trigger failed:', err))
      }

      return {
        ok: true,
        event: {
          id: created.id,
          title: created.title,
          start: created.start_at.toISOString().slice(0, 10),
          end: created.end_at.toISOString().slice(0, 10),
          kind: created.kind,
        },
        advisor_triggered: created.kind === 'leave',
      }
    }

    case 'propose_restock_plan': {
      const horizonDays = Math.max(
        7,
        Math.min(120, Number(args.horizon_days ?? 30) || 30)
      )
      const plan = await buildRestockPlanForUser(ctx.userId, horizonDays)
      if (plan.items.length === 0) {
        return {
          ok: true,
          created: false,
          horizon_days: horizonDays,
          message: 'Aucun SKU sous risque de rupture sur cet horizon, pas de plan nécessaire.',
        }
      }

      const title = `📦 Plan restock — ${plan.items.length} SKU critique${plan.items.length > 1 ? 's' : ''} (${horizonDays}j)`
      const reasoning = `Sur les ${horizonDays} prochains jours, ${plan.items.length} produits risquent la rupture. Total estimé ${plan.totalCost.toFixed(0)} €.`

      const reco = await prisma.agentRecommendation.create({
        data: {
          user_id: ctx.userId,
          title,
          scenario_type: 'restock_plan_manual',
          status: 'pending_approval',
          reasoning_summary: reasoning,
          expected_impact: `Éviter ${plan.items.length} ruptures potentielles et protéger environ ${plan.totalCost.toFixed(0)} € de chiffre d'affaires.`,
          confidence_note: 'Confiance élevée sur le filtrage déterministe, à valider par le merchant.',
          evidence_payload: [
            { label: 'Horizon', value: `${horizonDays} jours` },
            { label: 'SKUs analysés', value: String(plan.productsCount) },
            { label: 'SKUs à risque', value: String(plan.items.length) },
            {
              label: 'Deadline commande au plus tard',
              value: plan.earliestDeadline ?? '—',
            },
            { label: 'Coût total estimé', value: `${plan.totalCost.toFixed(2)} €` },
          ],
          action_payload: {
            horizon_days: horizonDays,
            order_deadline: plan.earliestDeadline,
            total_estimated_cost_eur: plan.totalCost,
            items_count: plan.items.length,
            target: 'restock_plan_manual',
            supplementary_notes: [],
            items: plan.items,
          },
          approval_required: true,
          source: 'leia_chat',
        },
      })

      return {
        ok: true,
        created: true,
        recommendation_id: reco.id,
        horizon_days: horizonDays,
        items_count: plan.items.length,
        total_estimated_cost_eur: plan.totalCost,
      }
    }

    case 'draft_supplier_emails': {
      const horizonDays = Math.max(
        7,
        Math.min(120, Number(args.horizon_days ?? 30) || 30)
      )
      const plan = await buildRestockPlanForUser(ctx.userId, horizonDays)
      if (plan.items.length === 0) {
        return {
          ok: true,
          drafts: [],
          message: "Rien à commander pour l'instant, aucun SKU sous risque de rupture.",
        }
      }

      const profile = await prisma.merchantProfileContext.findUnique({
        where: { user_id: ctx.userId },
      })
      const merchantName = profile?.merchant_category ?? 'Nordika Studio'

      // Grouper par fournisseur
      const grouped = new Map<string, typeof plan.items>()
      for (const item of plan.items) {
        const key = item.supplier ?? 'Fournisseur inconnu'
        const arr = grouped.get(key) ?? []
        arr.push(item)
        grouped.set(key, arr)
      }

      const drafts = Array.from(grouped.entries()).map(([supplier, items]) => {
        const total = items.reduce((s, i) => s + (i.estimated_cost_eur ?? 0), 0)
        const earliestDeadline = items
          .map((i) => i.order_deadline)
          .filter(Boolean)
          .sort()[0]

        const tableLines = items
          .map(
            (i) =>
              `- ${i.sku ?? '?'} — ${i.product_name} — ${i.recommended_qty} unités @ ${(i.unit_cost_eur ?? 0).toFixed(2)} € = ${(i.estimated_cost_eur ?? 0).toFixed(2)} €`
          )
          .join('\n')

        const subject = `Commande ${merchantName} — ${items.length} référence${items.length > 1 ? 's' : ''} (${items.reduce((s, i) => s + i.recommended_qty, 0)} unités)`

        const body =
          `Bonjour,\n\n` +
          `J'espère que vous allez bien. Je vous sollicite pour une commande de réassort :\n\n` +
          tableLines +
          `\n\nTotal estimé : ${total.toFixed(2)} €\n` +
          (earliestDeadline
            ? `Idéalement livrée avant le ${earliestDeadline} pour éviter toute rupture.\n\n`
            : `\n`) +
          `Merci de me confirmer disponibilité, délai de livraison et facture pro forma.\n\n` +
          `Bien cordialement,\n` +
          `Jean-Charles — ${merchantName}`

        return {
          supplier,
          subject,
          body,
          items_count: items.length,
          total_units: items.reduce((s, i) => s + i.recommended_qty, 0),
          total_cost_eur: Number(total.toFixed(2)),
          order_deadline: earliestDeadline ?? null,
        }
      })

      return {
        ok: true,
        drafts,
        horizon_days: horizonDays,
      }
    }

    default:
      return { error: `Tool ${name} not implemented` }
  }
}

async function buildRestockPlanForUser(userId: string, horizonDays: number) {
  const products = await prisma.product.findMany({
    where: { user_id: userId, active: true },
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

  type OrderCountRow = { sku: string; cnt: number }
  const orderCounts = await prisma.$queryRaw<OrderCountRow[]>`
    SELECT sku, SUM(qty)::int AS cnt
    FROM (
      SELECT (item->>'SellerSKU') AS sku, COALESCE((item->>'QuantityOrdered')::int, 1) AS qty
      FROM public.data_orders_amazon o,
           jsonb_array_elements(o.order_items) AS item
      WHERE o.purchase_date >= NOW() - INTERVAL '60 days'
      UNION ALL
      SELECT (item->>'product_sku') AS sku, COALESCE((item->>'quantity')::int, 1) AS qty
      FROM public.data_orders_google o,
           jsonb_array_elements(o.line_items) AS item
      WHERE o.created_at >= NOW() - INTERVAL '60 days'
    ) x
    WHERE sku IS NOT NULL
    GROUP BY sku
  `
  const ordersMap = new Map(orderCounts.map((r) => [r.sku, r.cnt]))

  const today = new Date()
  const leaveEnd = new Date(today.getTime() + horizonDays * 24 * 3600 * 1000)

  const items = buildPlanItems({
    today,
    leaveStart: today,
    leaveEnd,
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
      orders60d: p.sku ? (ordersMap.get(p.sku) ?? 0) : 0,
    })),
  })

  const summary = summarizePlan(items)

  return {
    productsCount: products.length,
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
    totalCost: summary.totalCostEur,
    earliestDeadline: summary.earliestDeadline?.toISOString().slice(0, 10) ?? null,
  }
}
