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

export type CommercialEvent = {
  title: string
  kind: string
  impact: string
  start: Date
  end: Date
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
  commercialPressureMultiplier?: number
  supplyStrategies?: string[]
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

export function commercialEventDemandMultiplier(event: CommercialEvent): number {
  const kind = event.kind.toLowerCase()
  const title = event.title.toLowerCase()
  const isCommercialPeak =
    ['commerce', 'peak', 'marketing', 'celebration'].includes(kind) ||
    /(sale|sales|soldes|black friday|cyber monday|christmas|noel|peak|promo)/.test(title)

  if (!isCommercialPeak) return 1

  const impact = event.impact.toLowerCase()
  if (impact === 'critical') return 1.5
  if (impact === 'high') return 1.35
  if (impact === 'medium') return 1.2
  return 1.1
}

export function demandMultiplierForCommercialEvents(events: CommercialEvent[] = []): number {
  return events.reduce(
    (max, event) => Math.max(max, commercialEventDemandMultiplier(event)),
    1
  )
}

export function buildPeakSupplyStrategies(events: CommercialEvent[] = []): string[] {
  if (events.length === 0) return []

  const strongest = [...events].sort(
    (a, b) => commercialEventDemandMultiplier(b) - commercialEventDemandMultiplier(a)
  )[0]

  return [
    `Commercial peak detected: ${strongest.title} overlaps the leave window.`,
    `Pull supplier orders forward before ${strongest.title} and protect inbound capacity before the leave starts.`,
    'Prioritize scarce stock for the highest-margin channels during the peak period.',
    'Prepare a temporary channel throttle if projected stock falls below the safety buffer.',
  ]
}

export function buildPlanItems(args: {
  today: Date
  leaveStart: Date
  leaveEnd: Date
  products: ProductForProjection[]
  orders: OrderAggregate[]
  commercialEvents?: CommercialEvent[]
}): PlanItem[] {
  const { today, leaveStart, leaveEnd, products, orders } = args
  const leaveDuration = daysBetween(leaveStart, leaveEnd)
  const ordersByProduct = new Map(orders.map((o) => [o.productId, o.orders60d]))
  const commercialEvents = args.commercialEvents ?? []
  const commercialPressureMultiplier = demandMultiplierForCommercialEvents(commercialEvents)
  const supplyStrategies = buildPeakSupplyStrategies(commercialEvents)

  const items: PlanItem[] = []

  for (const product of products) {
    const orders60d = ordersByProduct.get(product.id) ?? 0
    if (orders60d === 0) continue

    const velocityPerDay = (orders60d / 60) * commercialPressureMultiplier
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
      `Current stock covers ${daysCovered.toFixed(1)} days at ${velocityPerDay.toFixed(2)}/day. ` +
      `Absence plus supplier lead time = ${daysUntilSafe} days. ` +
      (commercialPressureMultiplier > 1
        ? `Commercial peak multiplier x${commercialPressureMultiplier.toFixed(2)} applied. `
        : '') +
      (projection < 0
        ? `Estimated stockout during the absence.`
        : `Insufficient margin to cover replenishment lead time.`)

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
      commercialPressureMultiplier,
      supplyStrategies,
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
