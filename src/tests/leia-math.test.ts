import { describe, expect, it } from 'vitest'

import {
  calculateChannelShares,
  calculateDailyAverage,
  calculateGrowthFactor,
  calculateHoursOfStock,
  calculateMargin,
  applyGrowthFactor,
  projectDemand,
  calculateReorderQty,
  calculateReturnRate,
  calculateStockoutDays,
  calculateSupplierLossCost,
  calculateVelocity,
} from '@/lib/leia/tools-math'

describe('Leia tools math', () => {
  it('calculates velocity from units and days', () => {
    expect(calculateVelocity(42, 14)).toBe(3)
  })

  it('calculates daily velocity from order rows and a window in hours', () => {
    expect(
      calculateVelocity(
        [
          { quantity: 2 },
          { quantity: 4 },
          { quantity: 6 },
        ],
        48,
        'hours'
      )
    ).toBe(6)
  })

  it('ignores invalid order quantities in velocity inputs', () => {
    expect(
      calculateVelocity(
        [
          { quantity: 2 },
          { quantity: Number.NaN },
          { quantity: null },
        ],
        24,
        'hours'
      )
    ).toBe(2)
  })

  it('calculates stockout days from on-hand and velocity', () => {
    expect(calculateStockoutDays(18, 3)).toBe(6)
  })

  it('returns null stockout days when velocity is zero', () => {
    expect(calculateStockoutDays(18, 0)).toBeNull()
  })

  it('calculates reorder quantity from need, buffer, and on-hand', () => {
    expect(calculateReorderQty(45, 12, 20)).toBe(37)
  })

  it('calculates reorder quantity from velocity, lead time, buffer, and on-hand', () => {
    expect(calculateReorderQty(3, 14, 12, 20)).toBe(34)
  })

  it('does not return a negative reorder quantity', () => {
    expect(calculateReorderQty(10, 5, 25)).toBe(0)
  })

  it('calculates a growth factor', () => {
    expect(calculateGrowthFactor(100, 134)).toBe(1.34)
  })

  it('calculates daily average from order timestamps', () => {
    expect(
      calculateDailyAverage([
        { order_ts: '2025-08-10T08:00:00.000Z' },
        { order_ts: '2025-08-12T08:00:00.000Z' },
        { order_ts: '2025-08-12T18:00:00.000Z' },
      ])
    ).toBe(1.2414)
  })

  it('projects demand with deterministic rounding', () => {
    expect(projectDemand(47, 1.34)).toBe(63)
  })

  it('applies growth factors to baseline velocity', () => {
    expect(applyGrowthFactor(3.25, 1.34)).toBe(4.355)
  })

  it('calculates return rate as a percentage', () => {
    expect(calculateReturnRate(4, 7)).toBeCloseTo(57.14, 2)
  })

  it('calculates margin percentage', () => {
    expect(calculateMargin(310, 214)).toBeCloseTo(30.97, 2)
  })

  it('calculates supplier loss cost from unit cost and impacted quantity', () => {
    expect(calculateSupplierLossCost(42.5, 5)).toBe(212.5)
  })

  it('calculates hours of stock from on-hand and hourly velocity', () => {
    expect(calculateHoursOfStock(18, 1.5)).toBe(12)
  })

  it('returns null hours of stock when hourly velocity is zero', () => {
    expect(calculateHoursOfStock(18, 0)).toBeNull()
  })

  it('calculates channel shares as percentages', () => {
    expect(calculateChannelShares({ amazon_fr: 70, google_de: 30 })).toEqual({
      amazon_fr: 70,
      google_de: 30,
    })
  })

  it('returns zero shares when channel totals are empty', () => {
    expect(calculateChannelShares({ amazon_fr: 0, google_de: 0 })).toEqual({
      amazon_fr: 0,
      google_de: 0,
    })
  })

  it('rounds channel shares deterministically', () => {
    expect(calculateChannelShares({ amazon_fr: 1, google_de: 2 })).toEqual({
      amazon_fr: 33.33,
      google_de: 66.67,
    })
  })
})
