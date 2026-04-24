type TemplateRenderer = (input: Record<string, unknown>) => string

function asString(value: unknown, fallback = '') {
  if (value === null || value === undefined) return fallback
  return String(value)
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function asNumber(value: unknown, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function formatBreakdown(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, count]) => Number.isFinite(Number(count)))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([channel, count]) => `${asNumber(count)} on ${channel}`)

  return entries.length > 0 ? `(${entries.join(', ')}) ` : ''
}

function sentence(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function formatMoney(value: unknown) {
  return asNumber(value).toFixed(2)
}

function ordinal(value: unknown) {
  const count = Math.max(0, Math.trunc(asNumber(value)))
  const mod100 = count % 100
  if (mod100 >= 11 && mod100 <= 13) return `${count}th`

  switch (count % 10) {
    case 1:
      return `${count}st`
    case 2:
      return `${count}nd`
    case 3:
      return `${count}rd`
    default:
      return `${count}th`
  }
}

function normalizeReason(value: unknown) {
  const reason = asString(value).trim()
  if (!reason) return 'operator review'

  const normalized = reason
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (normalized.includes('rupture imminente')) return 'imminent stockout'
  if (normalized.includes('risque de rupture')) return 'oversell risk'
  if (normalized.includes('retour')) return 'return trend'
  if (normalized.includes('vacances') || normalized.includes('conges')) return 'founder unavailable'

  return reason
}

function buildVacationOriginalProposal(input: Record<string, unknown>) {
  const provided = asString(input.original_proposal || input.summary)
  if (provided) return provided

  const request = asRecord(input.request)
  const actionType = asString(request.action_type, asString(input.action_type))
  const sku = asString(request.sku, asString(input.sku))
  const channel = asString(request.channel, asString(input.channel))
  const params = asRecord(request.params)
  const reason = normalizeReason(params.reason || input.reason)

  if (!actionType) return 'manual review'

  if (actionType === 'pause_listing') {
    return sentence(`pause ${sku} on ${channel}. Reason: ${reason}.`)
  }

  if (actionType === 'flag_oversell') {
    return sentence(`flag oversell risk on ${sku} for ${channel}.`)
  }

  return sentence(`${actionType} for ${sku}${channel ? ` on ${channel}` : ''}.`)
}

export const TEMPLATE_REGISTRY = {
  oversell_risk_v1: (input) =>
    sentence(
      `${asString(input.sku)} sold ${asNumber(input.total_24h)} units in the last 24h ${formatBreakdown(
        input.channel_breakdown
      )}against ${asNumber(input.on_hand)} on hand. Next order will oversell.`
    ),
  restock_proposal_v1: (input) =>
    sentence(
      `${asString(input.sku)}: sell-through ${asNumber(input.sell_through_per_week)}/week, supplier lead time ${asNumber(
        input.supplier_lead_time_weeks
      )} weeks, safety buffer ${asNumber(input.safety_buffer_weeks)} weeks. Proposing reorder of ${asNumber(
        input.reorder_qty
      )} units.`
    ),
  vacation_queue_v1: (input) =>
    sentence(
      `Queued because founder is on vacation until ${asString(
        input.founder_returns_on || input.until
      )}. Original proposal: ${buildVacationOriginalProposal(input)}`
    ),
  returns_pattern_v1: (input) =>
    sentence(
      `${asString(input.sku)}: ${asNumber(input.returns_count)} of last ${asNumber(
        input.sample_size
      )} returns cited '${asString(input.reason_code)}'. Return rate ${asNumber(
        input.return_rate_pct
      )}% vs catalog baseline ${asNumber(input.catalog_baseline_pct)}%.`
    ),
  reconciliation_variance_v1: (input) =>
    sentence(
      `${asString(input.sku)}: channel reports ${asNumber(
        input.channel_units
      )} units, records expect ${asNumber(input.expected_units)}. Variance ${asNumber(
        input.variance_pct
      )}% above ${asNumber(input.threshold_pct)}% threshold. Likely cause: ${asString(input.likely_cause)}.`
    ),
  fuse_tripped_v1: (input) =>
    sentence(
      `Safety Fuse tripped on ${asString(input.sku)}: return_rate at ${asNumber(
        input.return_rate_pct
      )}% over last ${asNumber(input.sample_size)} orders (threshold ${asNumber(
        input.threshold_pct
      )}%). ${asString(input.trip_stage || 'First trip — proposing pause.')}`
    ),
  calendar_posture_v1: (input) =>
    sentence(
      `Suggesting buffer +${asNumber(input.buffer_delta_pct)}% on ${asString(
        input.sku
      )}. Event: ${asString(input.event_name)} on ${asString(input.event_date)} in region ${asString(
        input.region
      )}. Evidence: historical ${asString(input.historical_signal)} on this category.`
    ),
  listing_pause_v1: (input) =>
    sentence(
      `Paused ${asString(input.sku)} on ${asString(input.channel)}. Reason: ${normalizeReason(
        input.reason
      )}.`
    ),
  listing_resume_v1: (input) =>
    sentence(`Resumed ${asString(input.sku)} on ${asString(input.channel)}.`),
  buffer_adjustment_v1: (input) =>
    sentence(
      `${asString(input.sku)}: buffer raised from ${asNumber(input.previous_buffer_units)} to ${asNumber(
        input.next_buffer_units
      )} units. Reason: ${normalizeReason(input.reason)}.`
    ),
  reputation_shield_v1: (input) =>
    sentence(
      `Protecting primary channel ${asString(
        input.primary_channel
      )} (highest revenue). Reduced exposure on ${asNumber(
        input.secondary_channel_count || (Array.isArray(input.secondary_channels) ? input.secondary_channels.length : 0)
      )} secondary channels until founder returns.`
    ),
  seasonal_prediction_v1: (input) =>
    sentence(
      `${asString(input.sku)}: expected demand +${asNumber(input.expected_growth_pct)}% during ${asString(
        input.event_name
      )} (data_source: ${asString(input.data_source)}). Current stock ${asNumber(
        input.current_stock
      )}, projected need ${asNumber(input.projected_need)}.`
    ),
  carrier_audit_v1: (input) =>
    sentence(
      `${asString(input.sku)} via ${asString(input.carrier)}: damage rate ${asNumber(
        input.damage_rate_pct
      )}% over ${asNumber(input.order_count)} orders. Recommend switching to ${asString(
        input.recommended_carrier
      )}.`
    ),
  supplier_scorecard_v1: (input) =>
    sentence(
      `Supplier ${asString(input.supplier_name)}: average delay ${asNumber(
        input.actual_lead_time_weeks
      )} weeks vs ${asNumber(input.announced_lead_time_weeks)} announced over last ${asNumber(
        input.sample_size
      )} orders. Defect rate ${asNumber(input.defect_rate_pct)}%.`
    ),
  supplier_loss_v1: (input) =>
    sentence(
      `Supplier loss declared: ${asString(input.supplier)} short-delivered ${asNumber(
        input.quantity
      )} units of ${asString(input.sku)} (loss_type: ${asString(
        input.loss_type
      )}). Estimated cost: €${formatMoney(input.cost)}. This is the ${ordinal(
        input.count
      )} loss from this supplier in the last 90 days. Current defect rate: ${asNumber(input.rate)}%.`
    ),
} satisfies Record<string, TemplateRenderer>

export const LEIA_TEMPLATE_IDS = Object.keys(TEMPLATE_REGISTRY).sort()

export function renderTemplate(templateId: string, input: Record<string, unknown>) {
  const renderer = TEMPLATE_REGISTRY[templateId as keyof typeof TEMPLATE_REGISTRY]

  if (!renderer) {
    throw new Error(`Unknown template_id: ${templateId}`)
  }

  return renderer(input)
}
