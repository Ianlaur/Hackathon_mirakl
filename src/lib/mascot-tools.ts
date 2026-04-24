import { prisma } from '@/lib/prisma'
import { buildPlanItems, summarizePlan } from '@/lib/calendar-restock'
import { requiresExplicitCalendarConfirmation } from '@/lib/calendar-confirmation'
import {
  createDecisionLedgerEntry,
  createOverrideRecord,
  listDecisionLedgerRows,
  updateDecisionLedgerStatus,
} from '@/lib/leia/ledger'
import {
  applyGrowthFactor,
  calculateChannelShares,
  calculateDailyAverage,
  calculateGrowthFactor,
  calculateMargin,
  calculateReorderQty,
  calculateStockoutDays,
  calculateVelocity,
  projectDemand,
} from '@/lib/leia/tools-math'
import {
  evaluateFounderPolicy,
  normalizeAutonomyMode,
  normalizeFounderState,
} from '@/lib/leia/policy'
import { evaluateReputationShieldForUser } from '@/lib/leia/reputation-shield'
import { syncFounderStateFromCalendarForUser } from '@/lib/leia/calendar-sync'
import { declareSupplierLoss, SUPPLIER_LOSS_TYPES } from '@/lib/leia/supplier-losses'
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
          seasonal_context: {
            type: 'object',
            description:
              'Optional seasonal context returned by get_seasonal_patterns. Use this for event demand projections.',
            properties: {
              event_name: { type: 'string', description: 'Seasonal event name, ex: Ferragosto' },
              growth_factor: { type: 'number', description: 'Growth factor returned by Leia math tools' },
            },
            required: ['event_name', 'growth_factor'],
          },
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
          category: { type: 'string', description: 'Optional category filter, ex: lamps, desks, chairs' },
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
      name: 'declare_supplier_loss',
      description:
        'Declares a supplier-side loss when a supplier short-delivers, sends defective batches, ships late, sends wrong items, or damages items in transit. Ask for supplier name, SKU, and quantity first if missing.',
      parameters: {
        type: 'object',
        properties: {
          supplier_name: { type: 'string', description: 'Supplier name, ex: Bois & Design' },
          sku: { type: 'string', description: 'Impacted SKU, ex: NRD-CHAIR-012' },
          loss_type: {
            type: 'string',
            enum: SUPPLIER_LOSS_TYPES,
            description:
              'delivery_short, defective_batch, late_delivery, wrong_item, or damaged_in_transit',
          },
          quantity: { type: 'number', description: 'Impacted units, not the total shipment size' },
          notes: { type: 'string', description: 'Optional shipment or claim context' },
        },
        required: ['supplier_name', 'sku', 'loss_type', 'quantity'],
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
        'Returns a stock summary: total products, products in alert (low stock or stockout), and estimated total value. Use when the merchant asks about stock status, product counts, or low-stock products.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product_by_sku',
      description:
        "Gets details for a specific product by SKU (ex: NKS-00042). Returns name, quantity, minimum threshold, supplier, and selling price. Use when the merchant asks about one specific product.",
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string', description: 'Product SKU, ex: NKS-00042' },
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
        'Searches products by keyword in the name. Returns up to 10 results. Use when the merchant searches for a product type (ex: chairs, tables).',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Keyword to search' },
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
        "Lists recommendations waiting for approval in the /actions inbox. Use when the merchant asks what they need to do, what is waiting, or current actions.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_calendar_event',
      description:
        'Creates an event in the merchant calendar. Useful for leave events (kind=leave), which automatically trigger stock analysis. Date format YYYY-MM-DD.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: "Event title, ex: Savoie vacation" },
          start_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
          end_date: { type: 'string', description: 'Date fin YYYY-MM-DD' },
          kind: {
            type: 'string',
            enum: ['commerce', 'holiday', 'leave', 'logistics', 'marketing', 'internal'],
            description: 'Type. Use leave for vacation.',
          },
          impact: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Estimated impact',
          },
          notes: { type: 'string', description: 'Notes optionnelles' },
          confirmed: {
            type: 'boolean',
            description: "Set true only after explicit merchant confirmation. Required for vacation.",
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
        "Generates a replenishment plan for SKUs at stockout risk over a given horizon (default 30 days). Creates a recommendation in /actions that the merchant can approve or reject. Use when the merchant asks to prepare a restock plan, order what is needed, or after detecting critical stock.",
      parameters: {
        type: 'object',
        properties: {
          horizon_days: {
            type: 'number',
            description: 'Target coverage days (default 30)',
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
        "Generates supplier email drafts, one per affected supplier, to order SKUs below threshold. Returns each email subject and body. Emails are not sent; they are prepared for the merchant to validate before sending.",
      parameters: {
        type: 'object',
        properties: {
          horizon_days: {
            type: 'number',
            description: 'Coverage horizon in days for quantity calculation (default 30)',
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
    seasonal_context: z
      .object({
        event_name: z.string().trim().min(1),
        growth_factor: z.number().positive(),
      })
      .optional(),
  }),
  compare_channels: z.object({
    sku: z.string().trim().min(1).optional(),
    period_days: boundedNumber(30, 1, 365),
  }),
  get_seasonal_patterns: z.object({
    sku: z.string().trim().min(1).optional(),
    event: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).optional(),
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
  declare_supplier_loss: z.object({
    supplier_name: z.string().trim().min(1),
    sku: z.string().trim().min(1),
    loss_type: z.enum(SUPPLIER_LOSS_TYPES),
    quantity: boundedNumber(1, 1, 100000),
    notes: z.string().trim().min(1).optional(),
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

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 3600 * 1000)
}

function regionChannels(region: string) {
  const normalized = region.trim().toLowerCase()
  if (normalized === 'fr') return ['amazon_fr', 'google_fr']
  if (normalized === 'it') return ['amazon_it', 'google_it']
  if (normalized === 'de') return ['amazon_de', 'google_de']
  return [
    'amazon_fr',
    'google_fr',
    'amazon_it',
    'google_it',
    'amazon_de',
    'google_de',
  ]
}

function channelsForSeasonalEvent(eventName: string, region: string) {
  const normalized = normalizeSearch(eventName)
  if (/(black friday|cyber monday|christmas|noel)/.test(normalized)) {
    return regionChannels('')
  }

  return regionChannels(region)
}

function normalizeSearch(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function categoryAliases(value: string) {
  const normalized = normalizeSearch(value)
  if (!normalized) return []
  const aliases = new Set([normalized, normalized.replace(/s$/, '')])
  if (normalized.includes('lamp')) aliases.add('lamps')
  if (normalized.includes('rug')) aliases.add('rugs')
  if (normalized.includes('chair')) aliases.add('chairs')
  if (normalized.includes('table')) aliases.add('tables')
  if (normalized.includes('desk')) aliases.add('desks')
  if (normalized.includes('shelf')) aliases.add('shelves')
  return Array.from(aliases)
}

function inferCategoryFromText(value: unknown) {
  const normalized = normalizeSearch(value)
  if (/(lamp|lampe|applique|suspension)/.test(normalized)) return 'lamps'
  if (/(rug|tapis)/.test(normalized)) return 'rugs'
  if (/(mirror|miroir)/.test(normalized)) return 'mirrors'
  if (/(chair|chaise|fauteuil)/.test(normalized)) return 'chairs'
  if (/(table|bureau)/.test(normalized)) return normalized.includes('bureau') ? 'desks' : 'tables'
  if (/(desk|bureau)/.test(normalized)) return 'desks'
  if (/(shelf|etagere|bibliotheque)/.test(normalized)) return 'shelves'
  if (/(decor|deco|vase|objet)/.test(normalized)) return 'decor'
  return 'other'
}

function orderCategory(row: { raw_payload: unknown; sku?: string | null }) {
  const payload = asRecord(row.raw_payload)
  return String(payload.category || payload.product_category || inferCategoryFromText(payload.product_name || row.sku))
}

function categoryMatches(row: { raw_payload: unknown; sku?: string | null }, category: string) {
  if (!category) return true
  const aliases = categoryAliases(category)
  const rowCategory = normalizeSearch(orderCategory(row))
  return aliases.some((alias) => rowCategory === alias || rowCategory.includes(alias))
}

function seasonalEventAlias(value: string) {
  const normalized = normalizeSearch(value)
  if (normalized.includes('christmas') || normalized.includes('noel')) return 'noel'
  if (normalized.includes('soldes')) return 'soldes'
  if (normalized.includes('back') || normalized.includes('rentree')) return 'rentree'
  return normalized
}

function eventMatchesName(eventName: string, filter: string) {
  const event = seasonalEventAlias(eventName)
  const target = seasonalEventAlias(filter)
  return event.includes(target) || target.includes(event)
}

type SeasonalOrderRow = {
  sku: string | null
  source_channel: string
  quantity: number | null
  amount_cents: number | null
  occurred_at: Date | null
  raw_payload: unknown
}

function seasonalOrderUnits(row: SeasonalOrderRow) {
  return orderUnits({ quantity: row.quantity, raw_payload: row.raw_payload })
}

function summarizeSeasonalOrders(orders: SeasonalOrderRow[], growthFactor: number) {
  const bySku = new Map<string, { count: number; units: number }>()
  const byCategory: Record<string, number> = {}

  for (const order of orders) {
    const sku = order.sku || rawString(order.raw_payload, 'sku') || 'unknown'
    const units = seasonalOrderUnits(order)
    const current = bySku.get(sku) ?? { count: 0, units: 0 }
    current.count += 1
    current.units += units
    bySku.set(sku, current)

    const category = orderCategory(order)
    byCategory[category] = (byCategory[category] ?? 0) + 1
  }

  return {
    categoryGrowth: calculateChannelShares(byCategory),
    affectedSkus: Array.from(bySku.entries())
      .filter(([, values]) => values.count >= 5)
      .map(([sku, values]) => ({
        sku,
        n1_volume: values.count,
        n1_units: values.units,
        projected_demand: projectDemand(values.count, growthFactor),
      }))
      .sort((left, right) => right.n1_volume - left.n1_volume)
      .slice(0, 10),
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
      const seasonalContext = asRecord(args.seasonal_context)
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
      const growthFactor = Number(seasonalContext.growth_factor)
      const projectedVelocityPerDay = seasonalContext.event_name
        ? applyGrowthFactor(velocityPerDay, growthFactor)
        : velocityPerDay
      const stockoutDays = calculateStockoutDays(product.quantity, projectedVelocityPerDay)
      const leadTimeDays = product.supplier_lead_time_days ?? 7
      const reorderQty = calculateReorderQty(
        projectedVelocityPerDay,
        leadTimeDays,
        product.min_quantity,
        product.quantity
      )
      const riskLevel =
        stockoutDays === null ? 'safe' : stockoutDays < 7 ? 'critical' : stockoutDays < 14 ? 'warning' : 'safe'

      return {
        found: true,
        sku: product.sku,
        name: product.name,
        current_stock: product.quantity,
        current_velocity_per_day: velocityPerDay,
        projected_velocity_per_day: projectedVelocityPerDay,
        days_remaining: stockoutDays,
        risk_level: riskLevel,
        context: String(seasonalContext.event_name || 'normal'),
        on_hand: product.quantity,
        velocity_per_day: velocityPerDay,
        projected_velocity_per_day_legacy: projectedVelocityPerDay,
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
      const category = String(args.category ?? '').trim()
      const now = new Date()
      const until = new Date(now.getTime() + 365 * 24 * 3600 * 1000)
      const events = await prisma.commercialCalendar.findMany({
        where: {
          event_date: { gte: now, lte: until },
        },
        orderBy: { event_date: 'asc' },
        take: 50,
        select: {
          region: true,
          event_name: true,
          event_date: true,
          magnitude_hint: true,
          impact_tag: true,
        },
      })
      const selectedEvent = eventFilter
        ? events.find((event) => eventMatchesName(event.event_name, eventFilter))
        : events[0]

      if (!selectedEvent) {
        return { error: 'Event not found', event: eventFilter || null }
      }

      const eventDate = selectedEvent.event_date
      const n1Start = addDays(eventDate, -(365 + 7))
      const n1End = addDays(eventDate, -(365 - 14))
      const baselineStart = addDays(eventDate, -(365 + 90))
      const baselineEnd = addDays(eventDate, -(365 + 30))
      const channels = channelsForSeasonalEvent(selectedEvent.event_name, selectedEvent.region)
      const baseWhere = {
        user_id: ctx.userId,
        kind: { in: ['order', 'orders'] },
        source_channel: { in: channels },
      }
      const [n1Rows, directBaselineRows, fallbackBaselineRows] = await Promise.all([
        prisma.operationalObject.findMany({
          where: {
            ...baseWhere,
            occurred_at: { gte: n1Start, lte: n1End },
          },
          select: {
            sku: true,
            source_channel: true,
            quantity: true,
            amount_cents: true,
            occurred_at: true,
            raw_payload: true,
          },
        }),
        prisma.operationalObject.findMany({
          where: {
            ...baseWhere,
            occurred_at: { gte: baselineStart, lte: baselineEnd },
          },
          select: {
            sku: true,
            source_channel: true,
            quantity: true,
            amount_cents: true,
            occurred_at: true,
            raw_payload: true,
          },
        }),
        prisma.operationalObject.findMany({
          where: {
            ...baseWhere,
            raw_payload: {
              path: ['source'],
              equals: 'n1_seed',
            },
            occurred_at: {
              gte: new Date('2025-02-01T00:00:00.000Z'),
              lte: new Date('2025-10-31T23:59:59.999Z'),
            },
          },
          select: {
            sku: true,
            source_channel: true,
            quantity: true,
            amount_cents: true,
            occurred_at: true,
            raw_payload: true,
          },
        }),
      ])
      const n1Orders = n1Rows.filter((order) => categoryMatches(order, category))
      const directBaseline = directBaselineRows.filter((order) => categoryMatches(order, category))
      const fallbackBaseline = fallbackBaselineRows
        .filter((order) => categoryMatches(order, category))
        .filter((order) => {
          const payload = asRecord(order.raw_payload)
          return payload.event === 'baseline'
        })
      const baselineOrders = directBaseline.length > 0 ? directBaseline : fallbackBaseline
      const n1DailyAvg = calculateDailyAverage(
        n1Orders.map((order) => ({ order_ts: order.occurred_at }))
      )
      const baselineDailyAvg = calculateDailyAverage(
        baselineOrders.map((order) => ({ order_ts: order.occurred_at }))
      )
      const observed = n1Orders.length >= 20 && baselineDailyAvg > 0
      const growthFactor = observed
        ? calculateGrowthFactor(baselineDailyAvg, n1DailyAvg)
        : calculateGrowthFactor(1, seasonalMagnitudeFactor(selectedEvent.magnitude_hint))
      const summary = summarizeSeasonalOrders(n1Orders, growthFactor)

      return {
        sku: args.sku ?? null,
        category: category || null,
        event: selectedEvent.event_name,
        event_date: selectedEvent.event_date.toISOString().slice(0, 10),
        region: selectedEvent.region,
        data_source: observed ? 'observed_n1' : 'seasonal_assumption',
        n1_sample_size: n1Orders.length,
        baseline_sample_size: baselineOrders.length,
        n1_window: {
          start: n1Start.toISOString().slice(0, 10),
          end: n1End.toISOString().slice(0, 10),
        },
        baseline_window: {
          start: baselineStart.toISOString().slice(0, 10),
          end: baselineEnd.toISOString().slice(0, 10),
        },
        n1_daily_avg: n1DailyAvg,
        baseline_daily_avg: baselineDailyAvg,
        growth_factor: growthFactor,
        expected_growth_pct: Number(((growthFactor - 1) * 100).toFixed(2)),
        category_growth: summary.categoryGrowth,
        affected_skus: summary.affectedSkus,
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

    case 'declare_supplier_loss': {
      return declareSupplierLoss({
        userId: ctx.userId,
        supplier_name: String(args.supplier_name ?? ''),
        sku: String(args.sku ?? ''),
        loss_type: args.loss_type as (typeof SUPPLIER_LOSS_TYPES)[number],
        quantity: Number(args.quantity ?? 1),
        notes: args.notes ? String(args.notes) : null,
      })
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
      const shieldDecision =
        state === 'Travelling' || state === 'Sick' || state === 'Vacation'
          ? await evaluateReputationShieldForUser(ctx.userId)
          : null

      return {
        ok: true,
        state: row.state,
        until: row.until?.toISOString() ?? null,
        reputation_shield_decision_id: shieldDecision?.id ?? null,
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
        return { found: false, sku, message: `No product found with SKU ${sku}` }
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
            "Validation required before adding to the calendar. Confirm with yes to create the event.",
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

      // If this is a leave event, trigger the advisor agent in parallel
      // Same logic as the n8n webhook, but direct when n8n is inactive
      if (created.kind === 'leave') {
        await syncFounderStateFromCalendarForUser(ctx.userId)

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
          message: 'No SKU is at stockout risk on this horizon; no plan is needed.',
        }
      }

      const title = `Restock plan - ${plan.items.length} critical SKU${plan.items.length > 1 ? 's' : ''} (${horizonDays} days)`
      const reasoning = `Over the next ${horizonDays} days, ${plan.items.length} products risk stockout. Estimated total: €${plan.totalCost.toFixed(0)}.`

      const reco = await prisma.agentRecommendation.create({
        data: {
          user_id: ctx.userId,
          title,
          scenario_type: 'restock_plan_manual',
          status: 'pending_approval',
          reasoning_summary: reasoning,
          expected_impact: `Avoid ${plan.items.length} potential stockouts and protect roughly €${plan.totalCost.toFixed(0)} in revenue.`,
          confidence_note: 'High confidence in deterministic filtering; merchant validation required.',
          evidence_payload: [
            { label: 'Horizon', value: `${horizonDays} days` },
            { label: 'SKUs analyzed', value: String(plan.productsCount) },
            { label: 'SKUs at risk', value: String(plan.items.length) },
            {
              label: 'Latest order deadline',
              value: plan.earliestDeadline ?? '-',
            },
            { label: 'Estimated total cost', value: `€${plan.totalCost.toFixed(2)}` },
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
          message: "Nothing to order right now; no SKU is at stockout risk.",
        }
      }

      const profile = await prisma.merchantProfileContext.findUnique({
        where: { user_id: ctx.userId },
      })
      const merchantName = profile?.merchant_category ?? 'Nordika Studio'

      // Group by supplier.
      const grouped = new Map<string, typeof plan.items>()
      for (const item of plan.items) {
        const key = item.supplier ?? 'Unknown supplier'
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
              `- ${i.sku ?? '?'} - ${i.product_name} - ${i.recommended_qty} units @ €${(i.unit_cost_eur ?? 0).toFixed(2)} = €${(i.estimated_cost_eur ?? 0).toFixed(2)}`
          )
          .join('\n')

        const subject = `Order ${merchantName} - ${items.length} reference${items.length > 1 ? 's' : ''} (${items.reduce((s, i) => s + i.recommended_qty, 0)} units)`

        const body =
          `Hello,\n\n` +
          `I am reaching out to request a replenishment order:\n\n` +
          tableLines +
          `\n\nEstimated total: €${total.toFixed(2)}\n` +
          (earliestDeadline
            ? `Ideally delivered before ${earliestDeadline} to avoid stockouts.\n\n`
            : `\n`) +
          `Please confirm availability, delivery lead time, and pro forma invoice.\n\n` +
          `Best regards,\n` +
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
