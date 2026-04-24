function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export type VelocityOrder = {
  quantity?: number | null
  qty?: number | null
  units?: number | null
}

function unitsFromOrder(order: VelocityOrder) {
  const value = order.quantity ?? order.qty ?? order.units ?? 0
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

export function calculateVelocity(
  ordersOrUnits: number | VelocityOrder[],
  window: number,
  unit: 'days' | 'hours' = 'days'
) {
  if (!Number.isFinite(window) || window <= 0) return 0
  const units = Array.isArray(ordersOrUnits)
    ? ordersOrUnits.reduce((sum, order) => sum + unitsFromOrder(order), 0)
    : ordersOrUnits

  if (!Number.isFinite(units)) return 0

  const days = unit === 'hours' ? window / 24 : window
  if (days <= 0) return 0

  return round(units / days, 4)
}

export function calculateStockoutDays(onHand: number, velocityPerDay: number) {
  if (!Number.isFinite(onHand) || onHand < 0) return null
  if (!Number.isFinite(velocityPerDay) || velocityPerDay <= 0) return null
  return round(onHand / velocityPerDay, 2)
}

export function calculateReorderQty(
  velocityOrPredictedNeed: number,
  leadTimeOrSafetyBuffer: number,
  bufferOrOnHand: number,
  onHand?: number
) {
  const hasVelocitySignature = onHand !== undefined
  const predictedNeed = hasVelocitySignature
    ? velocityOrPredictedNeed * leadTimeOrSafetyBuffer
    : velocityOrPredictedNeed
  const safetyBuffer = hasVelocitySignature ? bufferOrOnHand : leadTimeOrSafetyBuffer
  const available = hasVelocitySignature ? onHand : bufferOrOnHand

  if (![predictedNeed, safetyBuffer, available].every(Number.isFinite)) return 0
  return Math.max(0, Math.ceil(predictedNeed + safetyBuffer - available))
}

export function calculateGrowthFactor(baselineValue: number, nextValue: number) {
  if (!Number.isFinite(baselineValue) || !Number.isFinite(nextValue) || baselineValue <= 0) {
    return 1
  }

  return round(nextValue / baselineValue, 4)
}

export function calculateReturnRate(returnsCount: number, orderCount: number) {
  if (!Number.isFinite(returnsCount) || !Number.isFinite(orderCount) || orderCount <= 0) {
    return 0
  }

  return round((returnsCount / orderCount) * 100, 2)
}

export function calculateMargin(revenue: number, cost: number) {
  if (!Number.isFinite(revenue) || !Number.isFinite(cost) || revenue <= 0) {
    return 0
  }

  return round(((revenue - cost) / revenue) * 100, 2)
}

export function calculateHoursOfStock(onHand: number, velocityPerHour: number) {
  if (!Number.isFinite(onHand) || onHand < 0) return null
  if (!Number.isFinite(velocityPerHour) || velocityPerHour <= 0) return null
  return round(onHand / velocityPerHour, 2)
}

export function calculateChannelShares(channelTotals: Record<string, number>) {
  const entries = Object.entries(channelTotals)
  const total = entries.reduce((sum, [, value]) => {
    const numeric = Number(value)
    return sum + (Number.isFinite(numeric) && numeric > 0 ? numeric : 0)
  }, 0)

  return Object.fromEntries(
    entries.map(([channel, value]) => {
      const numeric = Number(value)
      const safeValue = Number.isFinite(numeric) && numeric > 0 ? numeric : 0
      return [channel, total > 0 ? round((safeValue / total) * 100, 2) : 0]
    })
  )
}
