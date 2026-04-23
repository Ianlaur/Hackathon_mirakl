// RestockAgent — computes reorder quantity from velocity × (lead_time + buffer), applying
// policy multipliers (founder away widens both). Pure function.

import type { TemplateInputs } from '../templates'

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
  const leadTime = input.lead_time_weeks * multipliers.leadTime
  const buffer = input.buffer_weeks * multipliers.buffer
  const covered = (input.on_hand ?? 0) + (input.incoming ?? 0)
  const demand = input.velocity_per_week * (leadTime + buffer)
  const computed = Math.max(0, Math.ceil(demand - covered))
  const qty = input.explicit_qty !== undefined ? input.explicit_qty : computed

  return {
    sku: input.sku,
    velocity_per_week: Number(input.velocity_per_week.toFixed(2)),
    lead_time_weeks: Number(leadTime.toFixed(2)),
    buffer_weeks: Number(buffer.toFixed(2)),
    qty,
  }
}
