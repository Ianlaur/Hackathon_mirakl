import { describe, it, expect } from 'vitest'
import {
  daysBetween,
  computeProjection,
  pickPriority,
  buildPlanItems,
  summarizePlan,
  ProductForProjection,
  OrderAggregate,
} from '@/lib/calendar-restock'

describe('daysBetween', () => {
  it('returns 10 between two dates 10 days apart', () => {
    expect(daysBetween(new Date('2026-05-10'), new Date('2026-05-20'))).toBe(10)
  })
  it('returns 0 for same day', () => {
    expect(daysBetween(new Date('2026-05-10'), new Date('2026-05-10'))).toBe(0)
  })
})

describe('computeProjection', () => {
  it('returns stock minus velocity times days', () => {
    expect(computeProjection({ currentStock: 100, velocityPerDay: 2, daysAhead: 10 })).toBe(80)
  })
  it('can go negative for under-stocked SKUs', () => {
    expect(computeProjection({ currentStock: 5, velocityPerDay: 2, daysAhead: 10 })).toBe(-15)
  })
})

describe('pickPriority', () => {
  it('is critical when stock runs out before leave starts', () => {
    expect(
      pickPriority({ daysCovered: 3, daysUntilLeaveStart: 5, daysUntilLeaveEnd: 15 })
    ).toBe('critical')
  })
  it('is high when stock runs out during leave', () => {
    expect(
      pickPriority({ daysCovered: 10, daysUntilLeaveStart: 5, daysUntilLeaveEnd: 15 })
    ).toBe('high')
  })
  it('is medium otherwise', () => {
    expect(
      pickPriority({ daysCovered: 20, daysUntilLeaveStart: 5, daysUntilLeaveEnd: 15 })
    ).toBe('medium')
  })
})

describe('buildPlanItems', () => {
  const today = new Date('2026-05-01')
  const leaveStart = new Date('2026-05-10')
  const leaveEnd = new Date('2026-05-20')

  const products: ProductForProjection[] = [
    {
      id: 'p1',
      sku: 'NKS-00042',
      name: 'Chaise Oslo',
      currentStock: 8,
      supplier: 'Scandi Wood Co',
      supplierLeadTimeDays: 7,
      supplierUnitCostEur: 12.8,
    },
    {
      id: 'p2',
      sku: 'NKS-00100',
      name: 'Table Stockholm',
      currentStock: 200,
      supplier: 'Oak Mill',
      supplierLeadTimeDays: 14,
      supplierUnitCostEur: 60,
    },
    {
      id: 'p3',
      sku: 'NKS-00050',
      name: 'Dormant',
      currentStock: 50,
      supplier: 'Nordic Textile',
      supplierLeadTimeDays: 10,
      supplierUnitCostEur: 20,
    },
  ]

  const orders: OrderAggregate[] = [
    { productId: 'p1', orders60d: 54 },   // 0.9/day → stock 8 = 9 days cover
    { productId: 'p2', orders60d: 30 },   // 0.5/day → stock 200 = 400 days cover (no risk)
    { productId: 'p3', orders60d: 0 },    // dormant → excluded
  ]

  it('includes at-risk SKU only', () => {
    const items = buildPlanItems({ today, leaveStart, leaveEnd, products, orders })
    expect(items).toHaveLength(1)
    expect(items[0].sku).toBe('NKS-00042')
  })

  it('excludes SKU without orders (dormant)', () => {
    const items = buildPlanItems({ today, leaveStart, leaveEnd, products, orders })
    expect(items.find((i) => i.sku === 'NKS-00050')).toBeUndefined()
  })

  it('excludes SKU with enough coverage', () => {
    const items = buildPlanItems({ today, leaveStart, leaveEnd, products, orders })
    expect(items.find((i) => i.sku === 'NKS-00100')).toBeUndefined()
  })

  it('computes recommended qty with safety factor 1.2', () => {
    const items = buildPlanItems({ today, leaveStart, leaveEnd, products, orders })
    const item = items[0]
    // velocity 0.9/day × (10 days leave + 7 days lead) × 1.2 = 18.36 → ceil 19 minus current 8 = 11
    expect(item.recommendedQty).toBe(11)
  })

  it('sets order_deadline = leave_start - lead_time - 2j buffer', () => {
    const items = buildPlanItems({ today, leaveStart, leaveEnd, products, orders })
    // leaveStart 2026-05-10, lead 7, buffer 2 → deadline 2026-05-01
    expect(items[0].orderDeadline.toISOString().slice(0, 10)).toBe('2026-05-01')
  })
})

describe('summarizePlan', () => {
  it('returns zeros for empty plan', () => {
    const s = summarizePlan([])
    expect(s.totalCostEur).toBe(0)
    expect(s.itemsCount).toBe(0)
    expect(s.earliestDeadline).toBeNull()
  })

  it('sums costs and picks earliest deadline', () => {
    const items = [
      {
        productId: 'a',
        sku: 'A',
        productName: 'A',
        currentStock: 0,
        velocityPerDay: 1,
        projectedStockEndOfLeave: -5,
        recommendedQty: 10,
        supplier: 'X',
        leadTimeDays: 5,
        unitCostEur: 10,
        estimatedCostEur: 100,
        priority: 'critical' as const,
        orderDeadline: new Date('2026-05-05'),
        reasoning: '',
      },
      {
        productId: 'b',
        sku: 'B',
        productName: 'B',
        currentStock: 0,
        velocityPerDay: 1,
        projectedStockEndOfLeave: -5,
        recommendedQty: 10,
        supplier: 'Y',
        leadTimeDays: 5,
        unitCostEur: 5,
        estimatedCostEur: 50,
        priority: 'high' as const,
        orderDeadline: new Date('2026-05-02'),
        reasoning: '',
      },
    ]
    const s = summarizePlan(items)
    expect(s.totalCostEur).toBe(150)
    expect(s.itemsCount).toBe(2)
    expect(s.earliestDeadline?.toISOString().slice(0, 10)).toBe('2026-05-02')
  })
})
