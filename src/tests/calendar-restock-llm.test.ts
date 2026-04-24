import { describe, expect, it } from 'vitest'
import { buildDeterministicFallback } from '@/lib/calendar-restock-llm'

describe('buildDeterministicFallback', () => {
  it('adds supply strategies when a leave overlaps a commercial peak', () => {
    const output = buildDeterministicFallback({
      leaveTitle: 'Summer leave',
      leaveStart: new Date('2026-06-25'),
      leaveEnd: new Date('2026-07-05'),
      atRiskItems: [
        {
          productId: 'p1',
          sku: 'NKS-00042',
          productName: 'Oslo Chair',
          currentStock: 8,
          velocityPerDay: 1.215,
          projectedStockEndOfLeave: -4,
          recommendedQty: 17,
          supplier: 'Scandi Wood Co',
          leadTimeDays: 7,
          unitCostEur: 12.8,
          estimatedCostEur: 217.6,
          priority: 'critical',
          orderDeadline: new Date('2026-06-16'),
          reasoning: '',
          commercialPressureMultiplier: 1.35,
          supplyStrategies: [
            'Pull supplier orders forward before Summer sales France and protect inbound capacity before the leave starts.',
          ],
        },
      ],
      coincidingEvents: [
        {
          title: 'Summer sales France',
          kind: 'commerce',
          start: new Date('2026-06-25'),
          end: new Date('2026-07-22'),
        },
      ],
      merchantProfile: null,
    })

    expect(output.reasoningSummary).toContain('Summer sales France')
    expect(output.supplementaryNotes).toContain(
      'Pull supplier orders forward before Summer sales France and protect inbound capacity before the leave starts.'
    )
  })
})
