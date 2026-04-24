import { describe, expect, it } from 'vitest'
import {
  expandOrdersDataset,
  exportOrdersCsv,
  filterOrders,
  paginateOrders,
  type PresentationOrder,
} from '@/lib/orders'
import { buildLossEscalationBrief, buildLossEvidenceCase } from '@/lib/losses'

const baseOrders: PresentationOrder[] = [
  {
    marketplace: 'Amazon DE',
    mpColor: 'bg-[#03182F]',
    mpCode: 'AMZ',
    orderId: '#ORD-100',
    date: 'Today, 10:24 AM',
    status: 'Action Required',
    statusStyle: 'bg-[#FFE7EC] text-[#F22E75]',
    items: 2,
    value: '€142.00',
  },
  {
    marketplace: 'Bol.com',
    mpColor: 'bg-[#2764FF]',
    mpCode: 'BOL',
    orderId: '#ORD-101',
    date: 'Yesterday, 4:15 PM',
    status: 'Shipped',
    statusStyle: 'bg-[#F2F8FF] text-[#2764FF]',
    items: 1,
    value: '€89.50',
  },
]

describe('orders helpers', () => {
  it('expands a short dataset for pagination demos', () => {
    const expanded = expandOrdersDataset(baseOrders, 5)

    expect(expanded).toHaveLength(5)
    expect(new Set(expanded.map((order) => order.orderId)).size).toBe(5)
  })

  it('filters by query and status and paginates the result', () => {
    const expanded = expandOrdersDataset(baseOrders, 6)
    const filtered = filterOrders(expanded, 'amazon', 'Action Required')
    const page = paginateOrders(filtered, 1, 2)

    expect(filtered.every((order) => order.marketplace.includes('Amazon'))).toBe(true)
    expect(filtered.every((order) => order.status === 'Action Required')).toBe(true)
    expect(page).toHaveLength(2)
  })

  it('exports visible orders into a CSV payload', () => {
    const csv = exportOrdersCsv(baseOrders)

    expect(csv).toContain('"Marketplace";"Order ID";"Date";"Status";"Items";"Value"')
    expect(csv).toContain('"Amazon DE";"#ORD-100"')
  })
})

describe('losses helpers', () => {
  const events = [
    {
      sku: 'SKU-RED',
      productName: 'Red Vase',
      quantityLost: 2,
      estimatedLossValue: 48,
      reasonCategory: 'damaged',
      detectedAt: '2026-04-22T08:00:00.000Z',
      carrierName: 'DHL',
      marketplace: 'Amazon',
      sourceOrderRef: '#ORD-100',
      locationLabel: 'Warehouse A',
      notes: 'Broken on arrival',
      status: 'open',
    },
    {
      sku: 'SKU-RED',
      productName: 'Red Vase',
      quantityLost: 1,
      estimatedLossValue: 24,
      reasonCategory: 'damaged',
      detectedAt: '2026-04-23T09:00:00.000Z',
      carrierName: 'DHL',
      marketplace: 'Amazon',
      sourceOrderRef: '#ORD-101',
      locationLabel: 'Warehouse A',
      notes: 'Packaging torn',
      status: 'investigating',
    },
  ]

  it('builds an evidence case for a selected sku', () => {
    const lossCase = buildLossEvidenceCase(events, 'SKU-RED')

    expect(lossCase).not.toBeNull()
    expect(lossCase?.totalUnits).toBe(3)
    expect(lossCase?.totalValue).toBe(72)
    expect(lossCase?.productName).toBe('Red Vase')
  })

  it('creates a readable escalation brief', () => {
    const lossCase = buildLossEvidenceCase(events, 'SKU-RED')
    const brief = buildLossEscalationBrief(lossCase!)

    expect(brief).toContain('Case: Red Vase (SKU-RED)')
    expect(brief).toContain('Estimated value: 72.00 EUR')
    expect(brief).toContain('Carriers: DHL')
  })
})
