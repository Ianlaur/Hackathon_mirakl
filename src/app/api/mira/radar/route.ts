// MIRA — RADAR endpoint (F5). Carrier audit + supplier scorecard + profit
// recovery aggregates. Spec: plugin page, NEVER on home screen. Mocks at the
// edges are allowed (labeled SIMULÉ in UI).

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import { calculateReturnRate } from '@/lib/mira/tools_math'

export const dynamic = 'force-dynamic'

const WINDOW_DAYS = 90
const DAMAGE_KEYWORDS = ['damag', 'broken', 'casse', 'abim', 'defect', 'fracas']

export async function GET() {
  try {
    const userId = await getCurrentUserId()
    const since = new Date(Date.now() - WINDOW_DAYS * 86400_000)

    const [returns, orders, products] = await Promise.all([
      prisma.operationalObject.findMany({
        where: { user_id: userId, kind: 'return', occurred_at: { gte: since } },
        select: {
          sku: true,
          source_channel: true,
          quantity: true,
          raw_payload: true,
          occurred_at: true,
        },
      }),
      prisma.operationalObject.groupBy({
        by: ['sku'],
        where: {
          user_id: userId,
          kind: 'order',
          sku: { not: null },
          occurred_at: { gte: since },
        },
        _count: { _all: true },
      }),
      prisma.product.findMany({
        where: { user_id: userId },
        select: {
          sku: true,
          name: true,
          supplier: true,
          supplier_lead_time_days: true,
          supplier_min_order_qty: true,
          supplier_unit_cost_eur: true,
        },
      }),
    ])

    const orderCountBySku = new Map<string, number>()
    for (const o of orders) {
      if (o.sku) orderCountBySku.set(o.sku, o._count._all)
    }

    // Carrier audit: SKUs whose returns mention damage-like reason codes.
    type DamageRow = { sku: string; returns: number; damage_returns: number; orders: number; damage_rate: number }
    const damageIdx = new Map<string, { returns: number; damage: number }>()
    for (const r of returns) {
      if (!r.sku) continue
      const payload = (r.raw_payload ?? {}) as Record<string, unknown>
      const reason = typeof payload.reason_code === 'string' ? payload.reason_code.toLowerCase() : ''
      const entry = damageIdx.get(r.sku) ?? { returns: 0, damage: 0 }
      entry.returns += 1
      if (DAMAGE_KEYWORDS.some((k) => reason.includes(k))) {
        entry.damage += 1
      }
      damageIdx.set(r.sku, entry)
    }
    const carrier: DamageRow[] = []
    for (const [sku, e] of Array.from(damageIdx.entries())) {
      const ordersCount = orderCountBySku.get(sku) ?? 0
      const rate = calculateReturnRate(e.damage, ordersCount + e.returns)
      if (e.damage >= 1 || rate >= 2) {
        carrier.push({ sku, returns: e.returns, damage_returns: e.damage, orders: ordersCount, damage_rate: rate })
      }
    }
    carrier.sort((a, b) => b.damage_rate - a.damage_rate)

    // Supplier scorecard: roll Product.supplier fields up. Mocked defect rate
    // derived from observed return rate per supplier (labeled SIMULÉ in UI).
    type SupplierAgg = {
      supplier: string
      skus: number
      avg_lead_time_days: number
      total_min_order: number
      avg_unit_cost_eur: number
      observed_return_rate: number
      is_simulated: boolean
    }
    const bySupplier = new Map<string, { skus: string[]; leadSum: number; moqSum: number; costSum: number; costN: number }>()
    for (const p of products) {
      if (!p.supplier) continue
      const entry = bySupplier.get(p.supplier) ?? { skus: [], leadSum: 0, moqSum: 0, costSum: 0, costN: 0 }
      entry.skus.push(p.sku)
      entry.leadSum += p.supplier_lead_time_days ?? 7
      entry.moqSum += p.supplier_min_order_qty ?? 1
      if (p.supplier_unit_cost_eur) {
        entry.costSum += Number(p.supplier_unit_cost_eur)
        entry.costN += 1
      }
      bySupplier.set(p.supplier, entry)
    }

    const returnsBySku = new Map<string, number>()
    for (const r of returns) {
      if (r.sku) returnsBySku.set(r.sku, (returnsBySku.get(r.sku) ?? 0) + 1)
    }

    const suppliers: SupplierAgg[] = Array.from(bySupplier.entries()).map(([supplier, e]) => {
      const supplierReturns = e.skus.reduce((n, sku) => n + (returnsBySku.get(sku) ?? 0), 0)
      const supplierOrders = e.skus.reduce((n, sku) => n + (orderCountBySku.get(sku) ?? 0), 0)
      return {
        supplier,
        skus: e.skus.length,
        avg_lead_time_days: Math.round(e.leadSum / Math.max(1, e.skus.length)),
        total_min_order: e.moqSum,
        avg_unit_cost_eur: e.costN > 0 ? Number((e.costSum / e.costN).toFixed(2)) : 0,
        observed_return_rate: calculateReturnRate(supplierReturns, supplierOrders + supplierReturns),
        is_simulated: supplierReturns === 0,
      }
    })
    suppliers.sort((a, b) => b.observed_return_rate - a.observed_return_rate || b.skus - a.skus)

    // Profit recovery estimate: total refund amount in the damage bucket.
    const potential_recovery_eur = returns.reduce((n, r) => {
      const payload = (r.raw_payload ?? {}) as Record<string, unknown>
      const reason = typeof payload.reason_code === 'string' ? payload.reason_code.toLowerCase() : ''
      if (!DAMAGE_KEYWORDS.some((k) => reason.includes(k))) return n
      const refund = typeof payload.refund_amount_cents === 'number' ? payload.refund_amount_cents / 100 : 0
      return n + refund
    }, 0)

    return NextResponse.json({
      window_days: WINDOW_DAYS,
      carrier_audit: carrier.slice(0, 10),
      supplier_scorecard: suppliers.slice(0, 12),
      profit_recovery: {
        estimated_eur: Number(potential_recovery_eur.toFixed(2)),
        source: potential_recovery_eur > 0 ? 'observed_damage_returns' : 'no_damage_returns_in_window',
      },
    })
  } catch (error) {
    console.error('radar fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load RADAR' },
      { status: 500 },
    )
  }
}
