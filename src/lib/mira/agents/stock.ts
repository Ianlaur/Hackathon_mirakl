// StockAgent — detects oversell risk. Pure function: same inputs → same template payload.
// Numeric comparisons go through tools_math (no LLM, no ad-hoc arithmetic in this file).

import type { TemplateInputs } from '../templates'
import { calculateHoursOfStock, HOURS_PER_DAY } from '../tools_math'

export type OversellInput = {
  sku: string
  total_24h: number
  velocity_24h: number
  on_hand: number
}

export function buildOversellRisk(input: OversellInput): TemplateInputs['oversell_risk_v1'] {
  return {
    sku: input.sku,
    total_24h: input.total_24h,
    velocity_24h: input.velocity_24h,
    on_hand: input.on_hand,
  }
}

// Convenience predicate — used by schedulers/fuses to decide whether to raise.
export function isOversellRisk(input: OversellInput, horizonHours = HOURS_PER_DAY): boolean {
  if (input.on_hand <= 0) return true
  const velocityPerHour = input.velocity_24h / HOURS_PER_DAY
  const hoursOfStock = calculateHoursOfStock(input.on_hand, velocityPerHour)
  return hoursOfStock < horizonHours
}
