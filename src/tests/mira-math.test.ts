import { describe, expect, it } from 'vitest'

import {
  calculateGrowthFactor,
  calculateMargin,
  calculateReorderQty,
  calculateReturnRate,
  calculateStockoutDays,
  calculateVelocity,
} from '@/lib/mira/tools-math'

describe('mira tools math', () => {
  it('calculates velocity from units and days', () => {
    expect(calculateVelocity(42, 14)).toBe(3)
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

  it('does not return a negative reorder quantity', () => {
    expect(calculateReorderQty(10, 5, 25)).toBe(0)
  })

  it('calculates a growth factor', () => {
    expect(calculateGrowthFactor(100, 134)).toBe(1.34)
  })

  it('calculates return rate as a percentage', () => {
    expect(calculateReturnRate(4, 7)).toBeCloseTo(57.14, 2)
  })

  it('calculates margin percentage', () => {
    expect(calculateMargin(310, 214)).toBeCloseTo(30.97, 2)
  })
})
