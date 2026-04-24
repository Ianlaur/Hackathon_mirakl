function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function calculateVelocity(units: number, days: number) {
  if (!Number.isFinite(units) || !Number.isFinite(days) || days <= 0) return 0
  return round(units / days, 4)
}

export function calculateStockoutDays(onHand: number, velocityPerDay: number) {
  if (!Number.isFinite(onHand) || onHand < 0) return null
  if (!Number.isFinite(velocityPerDay) || velocityPerDay <= 0) return null
  return round(onHand / velocityPerDay, 2)
}

export function calculateReorderQty(predictedNeed: number, safetyBuffer: number, onHand: number) {
  if (![predictedNeed, safetyBuffer, onHand].every(Number.isFinite)) return 0
  return Math.max(0, Math.ceil(predictedNeed + safetyBuffer - onHand))
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
