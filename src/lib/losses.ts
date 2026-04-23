export type LossEvidenceEvent = {
  sku: string
  productName: string
  quantityLost: number
  estimatedLossValue: number
  reasonCategory: string
  detectedAt: string
  carrierName: string
  marketplace: string
  sourceOrderRef: string
  locationLabel: string
  notes: string
  status: string
}

export type LossEvidenceCase = {
  sku: string
  productName: string
  eventCount: number
  totalUnits: number
  totalValue: number
  reasons: string[]
  carriers: string[]
  marketplaces: string[]
  latestDetectedAt: string
  location: string
  sourceOrderRef: string
  notes: string[]
}

export function buildLossEvidenceCase(events: LossEvidenceEvent[], sku?: string | null) {
  const scopedEvents =
    sku && sku.length > 0 ? events.filter((event) => event.sku === sku) : events

  if (scopedEvents.length === 0) {
    return null
  }

  const leadEvent = [...scopedEvents].sort(
    (left, right) => new Date(right.detectedAt).getTime() - new Date(left.detectedAt).getTime()
  )[0]

  const reasons = Array.from(new Set(scopedEvents.map((event) => event.reasonCategory).filter(Boolean)))
  const carriers = Array.from(new Set(scopedEvents.map((event) => event.carrierName || 'Unknown')))
  const marketplaces = Array.from(
    new Set(scopedEvents.map((event) => event.marketplace || 'Other'))
  )
  const notes = Array.from(new Set(scopedEvents.map((event) => event.notes).filter(Boolean)))

  return {
    sku: leadEvent.sku,
    productName: leadEvent.productName,
    eventCount: scopedEvents.length,
    totalUnits: scopedEvents.reduce((sum, event) => sum + event.quantityLost, 0),
    totalValue: scopedEvents.reduce((sum, event) => sum + event.estimatedLossValue, 0),
    reasons,
    carriers,
    marketplaces,
    latestDetectedAt: leadEvent.detectedAt,
    location: leadEvent.locationLabel || 'Warehouse',
    sourceOrderRef: leadEvent.sourceOrderRef || 'Not linked',
    notes,
  }
}

export function buildLossEscalationBrief(lossCase: LossEvidenceCase) {
  return [
    `Case: ${lossCase.productName} (${lossCase.sku})`,
    `Events: ${lossCase.eventCount}`,
    `Units impacted: ${lossCase.totalUnits}`,
    `Estimated value: ${lossCase.totalValue.toFixed(2)} EUR`,
    `Reasons: ${lossCase.reasons.join(', ') || 'Unspecified'}`,
    `Carriers: ${lossCase.carriers.join(', ') || 'Unknown'}`,
    `Marketplaces: ${lossCase.marketplaces.join(', ') || 'Other'}`,
    `Location: ${lossCase.location}`,
    `Reference: ${lossCase.sourceOrderRef}`,
    `Latest detection: ${lossCase.latestDetectedAt}`,
    `Notes: ${lossCase.notes.join(' | ') || 'None'}`,
  ].join('\n')
}
