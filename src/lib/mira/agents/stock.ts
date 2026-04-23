// StockAgent — detects oversell risk. Pure function: same inputs → same template payload.

import type { TemplateInputs } from '../templates'

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
export function isOversellRisk(input: OversellInput, horizonHours = 24): boolean {
  if (input.on_hand <= 0) return true
  const velocityPerHour = input.velocity_24h / 24
  const hoursOfStock = velocityPerHour > 0 ? input.on_hand / velocityPerHour : Infinity
  return hoursOfStock < horizonHours
}
