// GET /api/integrations/shopify/orders?limit=10
// Returns live Shopify orders normalised into the same shape as /api/mira/orders-recent.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000

function deriveStatus(fulfillment: string | null, financial: string | null): string {
  const f = (fulfillment ?? '').toLowerCase()
  const p = (financial ?? '').toLowerCase()
  if (p === 'pending' || p === 'authorized') return 'action_required'
  if (f === 'fulfilled' || f === 'delivered') return 'delivered'
  if (f === 'shipped' || f === 'partial') return 'in_transit'
  if (p === 'refunded' || p === 'voided') return 'cancelled'
  return 'processing'
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const url = new URL(request.url)
    const limit = Math.min(
      Math.max(Number.parseInt(url.searchParams.get('limit') || '10', 10) || 10, 1),
      100,
    )
    const aggregate = url.searchParams.get('aggregate') === 'true'
    const since24h = new Date(Date.now() - DAY_MS)

    const [orders, aggRows] = await Promise.all([
      prisma.shopifyOrder.findMany({
        where: { user_id: userId },
        orderBy: { order_created_at: 'desc' },
        take: limit,
        select: {
          id: true,
          order_name: true,
          shopify_order_id: true,
          financial_status: true,
          fulfillment_status: true,
          currency: true,
          total_price: true,
          order_created_at: true,
          connection: { select: { shop_name: true, shop_domain: true } },
        },
      }),
      aggregate
        ? prisma.shopifyOrder.findMany({
            where: { user_id: userId, order_created_at: { gte: since24h } },
            select: { financial_status: true, fulfillment_status: true },
          })
        : Promise.resolve([]),
    ])

    const rows = orders.map((o) => {
      const euros = o.total_price ? Number(o.total_price) : 0
      const shopLabel = o.connection.shop_name ?? o.connection.shop_domain
      return {
        id: o.id,
        external_id: o.order_name ?? o.shopify_order_id,
        channel: `shopify:${o.connection.shop_domain}`,
        channel_label: `Shopify · ${shopLabel}`,
        sku: null,
        status: deriveStatus(o.fulfillment_status, o.financial_status),
        amount_cents: Math.round(euros * 100),
        currency: o.currency ?? 'EUR',
        occurred_at: o.order_created_at?.toISOString() ?? null,
        has_pending_decision: false,
      }
    })

    let aggregateCounts
    if (aggregate) {
      let pending_action = 0
      let in_transit = 0
      let delivered_24h = 0
      let processing = 0
      for (const r of aggRows) {
        const derived = deriveStatus(r.fulfillment_status, r.financial_status)
        if (derived === 'action_required') pending_action += 1
        else if (derived === 'in_transit') in_transit += 1
        else if (derived === 'delivered') delivered_24h += 1
        else if (derived === 'processing') processing += 1
      }
      aggregateCounts = { pending_action, in_transit, delivered_24h, processing }
    }

    return NextResponse.json({
      count: rows.length,
      orders: rows,
      ...(aggregateCounts ? { aggregate: aggregateCounts } : {}),
    })
  } catch (error) {
    console.error('shopify orders fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load Shopify orders' },
      { status: 500 },
    )
  }
}
