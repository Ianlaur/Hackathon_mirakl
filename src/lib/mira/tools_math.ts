// MIRA — tools_math. Every number that appears in a decision_ledger row must
// come from one of these functions. The LLM never calculates. The LLM asks a
// tool, the tool uses these, the result is what goes in the trace.
//
// Invariant (enforced socially + by test-math): if a number ends up rendered
// by a template, it was produced here.
//
// Pure functions. No I/O. No LLM. Easy to unit-test.

export const HOURS_PER_DAY = 24
export const DAYS_PER_WEEK = 7

export type OrderLike = { quantity: number | null }

/** Units sold per day over the window. */
export function calculateVelocity(orders: OrderLike[], windowHours: number): {
  orders: number
  units_sold: number
  units_per_hour: number
  units_per_day: number
  units_per_week: number
} {
  if (windowHours <= 0) {
    return { orders: orders.length, units_sold: 0, units_per_hour: 0, units_per_day: 0, units_per_week: 0 }
  }
  const unitsSold = orders.reduce((n, r) => n + (r.quantity ?? 0), 0)
  const perHour = unitsSold / windowHours
  const perDay = perHour * HOURS_PER_DAY
  const perWeek = perDay * DAYS_PER_WEEK
  return {
    orders: orders.length,
    units_sold: unitsSold,
    units_per_hour: round2(perHour),
    units_per_day: round2(perDay),
    units_per_week: round2(perWeek),
  }
}

/** Days until stock reaches zero at current velocity. null if velocity ≤ 0. */
export function calculateStockoutDays(onHand: number, velocityPerDay: number): number | null {
  if (velocityPerDay <= 0) return null
  return round1(onHand / velocityPerDay)
}

/** How many units to order to cover (lead_time + buffer) of demand minus on_hand. */
export function calculateReorderQty(
  velocityPerWeek: number,
  leadTimeWeeks: number,
  bufferWeeks: number,
  onHand: number,
): { demand: number; qty: number; lead_time_weeks: number; buffer_weeks: number } {
  const demand = velocityPerWeek * (leadTimeWeeks + bufferWeeks)
  const qty = Math.max(0, Math.ceil(demand - onHand))
  return {
    demand: round2(demand),
    qty,
    lead_time_weeks: round2(leadTimeWeeks),
    buffer_weeks: round2(bufferWeeks),
  }
}

/** Year-over-year or event-over-event growth factor. null if previous ≤ 0. */
export function calculateGrowthFactor(currentPeriod: number, previousPeriod: number): number | null {
  if (previousPeriod <= 0) return null
  return round2(currentPeriod / previousPeriod)
}

/** Return rate as percentage (returns / total_orders × 100). */
export function calculateReturnRate(returns: number, totalOrders: number): number {
  if (totalOrders <= 0) return 0
  return round1((returns / totalOrders) * 100)
}

/** Net margin percentage ((revenue - cost) / revenue × 100). */
export function calculateMargin(revenue: number, cost: number): number {
  if (revenue <= 0) return 0
  return round1(((revenue - cost) / revenue) * 100)
}

/** Hours of stock remaining given velocity per hour. Infinity if velocity = 0. */
export function calculateHoursOfStock(onHand: number, velocityPerHour: number): number {
  if (velocityPerHour <= 0) return Infinity
  return round2(onHand / velocityPerHour)
}

/** Revenue share per channel as percent, summing to 100. */
export function calculateChannelShares<T extends { revenue: number }>(rows: T[]): Array<T & { share_pct: number }> {
  const total = rows.reduce((n, r) => n + r.revenue, 0)
  return rows.map((r) => ({
    ...r,
    share_pct: total > 0 ? round1((r.revenue / total) * 100) : 0,
  }))
}

function round1(n: number): number {
  return Number(n.toFixed(1))
}

function round2(n: number): number {
  return Number(n.toFixed(2))
}
