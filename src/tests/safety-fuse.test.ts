import { describe, expect, it } from 'vitest'

import { evaluateSafetyFuse } from '@/lib/mira/safety-fuse'

describe('Safety Fuse', () => {
  it('does not trip return rate below threshold', () => {
    expect(
      evaluateSafetyFuse({
        sku: 'NRD-CHAIR-012',
        metric: 'return_rate',
        numerator: 2,
        denominator: 10,
        previousTripsWithin7Days: 0,
      })
    ).toBeNull()
  })

  it('proposes pause on first return-rate trip and auto-pauses on second trip', () => {
    expect(
      evaluateSafetyFuse({
        sku: 'NRD-CHAIR-012',
        metric: 'return_rate',
        numerator: 4,
        denominator: 10,
        previousTripsWithin7Days: 0,
      })?.action
    ).toBe('propose_pause')

    expect(
      evaluateSafetyFuse({
        sku: 'NRD-CHAIR-012',
        metric: 'return_rate',
        numerator: 4,
        denominator: 10,
        previousTripsWithin7Days: 1,
      })
    ).toMatchObject({
      action: 'auto_pause',
      status: 'auto_executed',
      templateId: 'fuse_tripped_v1',
      thresholdPct: 30,
      ratePct: 40,
    })
  })

  it('trips damage and loss deterministic thresholds', () => {
    expect(
      evaluateSafetyFuse({
        sku: 'NRD-TABLE-002',
        metric: 'damage_rate',
        numerator: 2,
        denominator: 10,
        previousTripsWithin7Days: 0,
      })
    ).toMatchObject({ action: 'propose_pause', thresholdPct: 15, ratePct: 20 })

    expect(
      evaluateSafetyFuse({
        sku: 'NRD-SOFA-008',
        metric: 'loss_rate',
        numerator: 3,
        denominator: 20,
        previousTripsWithin7Days: 0,
      })
    ).toMatchObject({ action: 'propose_investigation', thresholdPct: 10, ratePct: 15 })
  })
})
