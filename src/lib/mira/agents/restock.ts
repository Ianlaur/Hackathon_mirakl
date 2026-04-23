// RestockAgent — computes reorder quantity from velocity × (lead_time + buffer), applying
// policy multipliers (founder away widens both). Pure function.
// Reorder math delegates to tools_math so the number rendered in the template
// comes from the shared calculator, not from ad-hoc arithmetic here.

import type { TemplateInputs } from '../templates'
import { calculateReorderQty } from '../tools_math'

export type RestockInput = {
  sku: string
  velocity_per_week: number
  lead_time_weeks: number
  buffer_weeks: number
  on_hand?: number
  incoming?: number
  explicit_qty?: number
}

export type RestockMultipliers = { buffer: number; leadTime: number }

export function buildRestockProposal(
  input: RestockInput,
  multipliers: RestockMultipliers = { buffer: 1, leadTime: 1 },
): TemplateInputs['restock_proposal_v1'] {
  const leadTimeInflated = input.lead_time_weeks * multipliers.leadTime
  const bufferInflated = input.buffer_weeks * multipliers.buffer
  const covered = (input.on_hand ?? 0) + (input.incoming ?? 0)
  const math = calculateReorderQty(
    input.velocity_per_week,
    leadTimeInflated,
    bufferInflated,
    covered,
  )
  const qty = input.explicit_qty !== undefined ? input.explicit_qty : math.qty

  return {
    sku: input.sku,
    velocity_per_week: Number(input.velocity_per_week.toFixed(2)),
    lead_time_weeks: math.lead_time_weeks,
    buffer_weeks: math.buffer_weeks,
    qty,
  }
}
