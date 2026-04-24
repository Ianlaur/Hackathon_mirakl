export type PlanItemDTO = {
  product_id: string
  sku: string | null
  product_name: string
  current_stock: number
  velocity_per_day: number
  projected_stock_end_of_leave: number
  recommended_qty: number
  supplier: string | null
  lead_time_days: number
  unit_cost_eur: number
  estimated_cost_eur: number
  priority: 'critical' | 'high' | 'medium'
  order_deadline: string
  reasoning: string
  commercial_pressure_multiplier?: number
  supply_strategies?: string[]
}

export type ActionPayload = {
  leave_event_id: string
  leave_start: string
  leave_end: string
  leave_duration_days: number
  order_deadline: string | null
  total_estimated_cost_eur: number
  items_count: number
  target: string
  supplementary_notes: string[]
  supply_strategies?: string[]
  commercial_events?: Array<{
    title: string
    kind: string
    impact: string
    start: string
    end: string
  }>
  items: PlanItemDTO[]
}

export type EvidenceEntry = { label: string; value: string }

export type RecommendationDTO = {
  id: string
  title: string
  scenario_type: string
  status: string
  reasoning_summary: string
  expected_impact: string | null
  confidence_note: string | null
  evidence_payload: EvidenceEntry[] | null
  action_payload: ActionPayload | null
  approval_required: boolean
  source: string
  created_at: string
  updated_at: string
}
